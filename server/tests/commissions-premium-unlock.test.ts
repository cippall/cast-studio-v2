import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';

/* eslint-disable @typescript-eslint/no-explicit-any */

vi.mock('../src/db/pool.js', () => ({
  query: vi.fn(),
  getClient: vi.fn(),
  default: {},
}));

import * as poolModule from '../src/db/pool.js';
import commissionsRouter from '../src/routes/commissions.js';

const mockQuery = vi.mocked(poolModule.query);

const WORKSPACE_UUID = 'a0000000-0000-4000-8000-000000000001';
const CLIENT_UUID = 'b0000000-0000-4000-8000-000000000001';
const ARTIST_UUID = 'c0000000-0000-4000-8000-000000000002';
const COMMISSION_UUID = 'e0000000-0000-4000-8000-000000000010';
const ASSET_UUID = 'f0000000-0000-4000-8000-000000000020';

function makeAccountRow(overrides: Record<string, unknown> = {}) {
  return {
    id: CLIENT_UUID,
    workspace_id: WORKSPACE_UUID,
    name: 'Test Client',
    email: 'client@brand.com',
    role: 'CLIENT',
    is_api_able: false,
    password_hash: '$2a$10$hashedpassword',
    created_at: '2026-06-17T10:00:00.000Z',
    ...overrides,
  };
}

function makeClientRow() {
  return makeAccountRow({
    id: CLIENT_UUID,
    workspace_id: WORKSPACE_UUID,
    name: 'Test Client',
    role: 'CLIENT',
  });
}

function makeArtistRow() {
  return makeAccountRow({
    id: ARTIST_UUID,
    workspace_id: WORKSPACE_UUID,
    name: 'Test Artist',
    role: 'ARTIST',
  });
}

function makeCommissionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: COMMISSION_UUID,
    client_workspace_id: WORKSPACE_UUID,
    studio_workspace_id: WORKSPACE_UUID,
    client_id: CLIENT_UUID,
    assignee_id: null,
    title: 'Cyberpunk actor needed',
    brief: { project_type: 'editorial', style: 'cyberpunk', notes: 'Looking for young female' },
    status: 'SUBMITTED',
    premium_cost: 5.0,
    submitted_at: '2026-06-17T10:05:00.000Z',
    approved_at: null,
    created_at: '2026-06-17T10:00:00.000Z',
    ...overrides,
  };
}

function makeCommissionAssetRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ca-00000000-0000-4000-8000-000000000001',
    commission_id: COMMISSION_UUID,
    asset_id: ASSET_UUID,
    asset_output_id: null,
    created_at: '2026-06-17T10:00:00.000Z',
    ...overrides,
  };
}

function seedSession(accountRow: Record<string, unknown>) {
  mockQuery.mockResolvedValueOnce({ rows: [accountRow] } as any);
  mockQuery.mockResolvedValueOnce({
    rows: [
      {
        id: WORKSPACE_UUID,
        name: 'Workspace',
        slug: 'workspace',
        workspace_type: 'STUDIO',
        created_at: '2026-06-17T10:00:00.000Z',
      },
    ],
  } as any);
}

function createApp(accountOverride?: Record<string, unknown>) {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).session = {
      accountId: accountOverride?.id ?? null,
      destroy: vi.fn((cb?: (err?: unknown) => void) => {
        if (cb) cb();
      }),
    };
    next();
  });
  app.use('/api/commissions', commissionsRouter);
  return app;
}

describe('T15: Commission Premium Unlock Integration', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('returns 402 when client balance is insufficient', async () => {
    const client = makeClientRow();
    seedSession(client);

    const commission = makeCommissionRow({ premium_cost: 5.0 });
    mockQuery.mockResolvedValueOnce({ rows: [commission] } as any);
    // Wallet lookup — balance too low
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'w-00000000-0000-4000-8000-000000000001',
          workspace_id: WORKSPACE_UUID,
          account_id: CLIENT_UUID,
          balance_credits: 2.0,
          updated_at: '2026-06-17T10:00:00.000Z',
        },
      ],
    } as any);

    const res = await request(createApp(client))
      .patch(`/api/commissions/${COMMISSION_UUID}/status`)
      .send({ status: 'APPROVED' });

    expect(res.status).toBe(402);
    expect(res.body.error.code).toBe('INSUFFICIENT_CREDITS');
    expect(res.body.error.message).toContain('Insufficient credits');
  });

  it('approves commission with sufficient balance, deducts wallet, transfers asset ownership', async () => {
    const client = makeClientRow();
    seedSession(client);

    const commission = makeCommissionRow({ premium_cost: 5.0 });
    const updated = {
      ...commission,
      status: 'APPROVED',
      approved_at: '2026-06-17T14:00:00.000Z',
    };

    mockQuery.mockResolvedValueOnce({ rows: [commission] } as any);
    // Wallet lookup
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'w-00000000-0000-4000-8000-000000000001',
          workspace_id: WORKSPACE_UUID,
          account_id: CLIENT_UUID,
          balance_credits: 10.0,
          updated_at: '2026-06-17T10:00:00.000Z',
        },
      ],
    } as any);
    // Wallet balance update
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'w-00000000-0000-4000-8000-000000000001',
          workspace_id: WORKSPACE_UUID,
          account_id: CLIENT_UUID,
          balance_credits: 5.0,
          updated_at: '2026-06-17T14:00:00.000Z',
        },
      ],
    } as any);
    // Ledger entry creation
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'l-00000000-0000-4000-8000-000000000001',
          workspace_id: WORKSPACE_UUID,
          wallet_id: 'w-00000000-0000-4000-8000-000000000001',
          workflow_id: null,
          api_key_id: null,
          amount: -5.0,
          type: 'CHARGE',
          created_at: '2026-06-17T14:00:00.000Z',
        },
      ],
    } as any);
    // getCommissionAssets (for ownership transfer)
    mockQuery.mockResolvedValueOnce({ rows: [makeCommissionAssetRow()] } as any);
    // setAssetOwnership
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: ASSET_UUID,
          workspace_id: WORKSPACE_UUID,
          creator_id: ARTIST_UUID,
          client_id: CLIENT_UUID,
          asset_type: 'ACTOR',
          name: 'Cyberpunk Actor',
          seed: 123,
          prompt_recipe: {},
          marketplace_status: null,
          is_marketplace_frozen: false,
          source_asset_id: null,
          source_type: 'COMMISSION',
          deleted_at: null,
          created_at: '2026-06-17T10:00:00.000Z',
        },
      ],
    } as any);
    // Update commission status
    mockQuery.mockResolvedValueOnce({ rows: [updated] } as any);
    // getCommissionAssets (for response)
    mockQuery.mockResolvedValueOnce({ rows: [makeCommissionAssetRow()] } as any);

    const res = await request(createApp(client))
      .patch(`/api/commissions/${COMMISSION_UUID}/status`)
      .send({ status: 'APPROVED' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('APPROVED');
    expect(res.body.approved_at).toBeTruthy();
  });
});
