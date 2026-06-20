import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Mock pool
vi.mock('../src/db/pool.js', () => {
  const mockPoolClient = {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    release: vi.fn(),
    on: vi.fn(),
  };
  return {
    query: vi.fn(),
    getClient: vi.fn().mockResolvedValue(mockPoolClient),
    default: { connect: vi.fn().mockResolvedValue(mockPoolClient) },
  };
});

import * as poolModule from '../src/db/pool.js';
import commissionsRouter from '../src/routes/commissions.js';

const mockQuery = vi.mocked(poolModule.query);

const WORKSPACE_UUID = 'a0000000-0000-4000-8000-000000000001';
const ARTIST_UUID = 'c0000000-0000-4000-8000-000000000002';
const COMMISSION_UUID = 'e0000000-0000-4000-8000-000000000010';
const ASSET_UUID = 'f0000000-0000-4000-8000-000000000020';

function makeArtistRow() {
  return {
    id: ARTIST_UUID,
    workspace_id: WORKSPACE_UUID,
    name: 'Test Artist',
    email: 'artist@test.com',
    role: 'ARTIST',
    is_api_able: false,
    password_hash: '$2a$10$hashedpassword',
    created_at: '2026-06-17T10:00:00.000Z',
  };
}

function makeCommissionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: COMMISSION_UUID,
    client_workspace_id: WORKSPACE_UUID,
    studio_workspace_id: WORKSPACE_UUID,
    client_id: 'b0000000-0000-4000-8000-000000000001',
    assignee_id: ARTIST_UUID,
    title: 'Test Commission',
    brief: { description: 'test' },
    status: 'IN_PROGRESS',
    premium_cost: 0,
    change_notes: null,
    submitted_at: null,
    approved_at: null,
    created_at: '2026-06-17T10:00:00.000Z',
    updated_at: '2026-06-17T10:00:00.000Z',
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

// ===================================================================
// premium_cost validation for SUBMITTED transition
// ===================================================================
describe('commission status transition — premium_cost validation', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    // Also reset the shared pool client mock
    poolModule.getClient().then((client: any) => {
      client.query.mockReset();
    });
  });

  it('returns 422 when submitting without premium_cost', async () => {
    const artist = makeArtistRow();
    seedSession(artist);

    const res = await request(createApp(artist))
      .patch(`/api/commissions/${COMMISSION_UUID}/status`)
      .send({ status: 'SUBMITTED', asset_ids: [ASSET_UUID] });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('Premium cost');
  });

  it('returns 422 when submitting with premium_cost of 0', async () => {
    const artist = makeArtistRow();
    seedSession(artist);

    const res = await request(createApp(artist))
      .patch(`/api/commissions/${COMMISSION_UUID}/status`)
      .send({ status: 'SUBMITTED', premium_cost: 0, asset_ids: [ASSET_UUID] });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 when submitting with negative premium_cost', async () => {
    const artist = makeArtistRow();
    seedSession(artist);

    const res = await request(createApp(artist))
      .patch(`/api/commissions/${COMMISSION_UUID}/status`)
      .send({ status: 'SUBMITTED', premium_cost: -5, asset_ids: [ASSET_UUID] });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 when submitting without asset_ids', async () => {
    const artist = makeArtistRow();
    seedSession(artist);

    const res = await request(createApp(artist))
      .patch(`/api/commissions/${COMMISSION_UUID}/status`)
      .send({ status: 'SUBMITTED', premium_cost: 5.0 });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('asset_id');
  });

  it('returns 422 when submitting with empty asset_ids array', async () => {
    const artist = makeArtistRow();
    seedSession(artist);

    const res = await request(createApp(artist))
      .patch(`/api/commissions/${COMMISSION_UUID}/status`)
      .send({ status: 'SUBMITTED', premium_cost: 5.0, asset_ids: [] });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('succeeds when submitting with valid premium_cost and asset_ids', async () => {
    const artist = makeArtistRow();
    seedSession(artist);

    const commission = makeCommissionRow({ status: 'IN_PROGRESS', assignee_id: ARTIST_UUID });
    const updated = {
      ...commission,
      status: 'SUBMITTED',
      submitted_at: '2026-06-17T14:00:00.000Z',
    };

    mockQuery.mockResolvedValueOnce({ rows: [commission] } as any); // findCommissionByIdUnfiltered
    mockQuery.mockResolvedValueOnce({ rows: [updated] } as any); // updateCommissionStatus
    mockQuery.mockResolvedValueOnce({ rows: [] } as any); // linkAssetToCommission
    mockQuery.mockResolvedValueOnce({ rows: [] } as any); // getCommissionAssets

    const res = await request(createApp(artist))
      .patch(`/api/commissions/${COMMISSION_UUID}/status`)
      .send({ status: 'SUBMITTED', premium_cost: 5.0, asset_ids: [ASSET_UUID] });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('SUBMITTED');
  });

  it('does not require premium_cost for non-SUBMITTED transitions (e.g. IN_PROGRESS)', async () => {
    const artist = makeArtistRow();
    seedSession(artist);

    const commission = makeCommissionRow({ status: 'ASSIGNED', assignee_id: ARTIST_UUID });
    const updated = { ...commission, status: 'IN_PROGRESS' };

    mockQuery.mockResolvedValueOnce({ rows: [commission] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [updated] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [] } as any); // getCommissionAssets

    const res = await request(createApp(artist))
      .patch(`/api/commissions/${COMMISSION_UUID}/status`)
      .send({ status: 'IN_PROGRESS' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('IN_PROGRESS');
  });
});
