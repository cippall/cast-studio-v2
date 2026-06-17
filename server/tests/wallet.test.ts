import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Mock pool before importing modules that use it
vi.mock('../src/db/pool.js', () => ({
  query: vi.fn(),
  getClient: vi.fn(),
  default: {},
}));

import * as poolModule from '../src/db/pool.js';
import walletRouter, { handleStripeWebhook } from '../src/routes/wallet.js';
import * as walletRepo from '../src/db/repositories/wallet-repo.js';

const mockQuery = vi.mocked(poolModule.query);

const WORKSPACE_UUID = 'a0000000-0000-4000-8000-000000000001';
const ACCOUNT_UUID = 'b0000000-0000-4000-8000-000000000001';
const WALLET_UUID = 'c0000000-0000-4000-8000-000000000001';

function makeAccountRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ACCOUNT_UUID,
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

function makeWorkspaceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: WORKSPACE_UUID,
    name: 'Test Workspace',
    slug: 'test-workspace',
    workspace_type: 'CLIENT',
    created_at: '2026-06-17T10:00:00.000Z',
    ...overrides,
  };
}

function makeWalletRow(overrides: Record<string, unknown> = {}) {
  return {
    id: WALLET_UUID,
    workspace_id: WORKSPACE_UUID,
    account_id: ACCOUNT_UUID,
    balance_credits: '150.50',
    updated_at: '2026-06-17T10:00:00.000Z',
    ...overrides,
  };
}

function buildLedgerRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ledger-0000-0000-4000-8000-000000000001',
    workspace_id: WORKSPACE_UUID,
    wallet_id: WALLET_UUID,
    workflow_id: null,
    api_key_id: null,
    amount: -0.05,
    type: 'CHARGE',
    created_at: '2026-06-17T10:00:00.000Z',
    ...overrides,
  };
}

function seedSession(account = makeAccountRow()) {
  mockQuery.mockResolvedValueOnce({ rows: [account] } as any);
  mockQuery.mockResolvedValueOnce({ rows: [makeWorkspaceRow()] } as any);
}

function resetMock() {
  mockQuery.mockReset();
}

function createWalletApp(accountOverride?: Record<string, unknown>) {
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
  app.use('/api/wallet', walletRouter);
  return app;
}

describe('wallet routes', () => {
  beforeEach(() => {
    resetMock();
  });

  it('GET /api/wallet returns balance when wallet exists', async () => {
    const account = makeAccountRow();
    seedSession(account);
    mockQuery.mockResolvedValueOnce({ rows: [makeWalletRow()] } as any);

    const res = await request(createWalletApp(account)).get('/api/wallet');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: WALLET_UUID,
      balance_credits: 150.5,
      updated_at: '2026-06-17T10:00:00.000Z',
    });
  });

  it('GET /api/wallet creates wallet when missing', async () => {
    const account = makeAccountRow();
    seedSession(account);
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [makeWalletRow({ balance_credits: '0' })] } as any);

    const res = await request(createWalletApp(account)).get('/api/wallet');
    expect(res.status).toBe(200);
    expect(res.body.balance_credits).toBe(0);
  });

  it('POST /api/wallet/top-up returns 501 from stripe stub', async () => {
    const account = makeAccountRow();
    seedSession(account);

    const res = await request(createWalletApp(account))
      .post('/api/wallet/top-up')
      .send({ amount: 100 });

    expect(res.status).toBe(501);
    expect(res.body.error.code).toBe('WALLET_ERROR');
    expect(res.body.error.message).toBe('Stripe top-up is not implemented yet');
  });

  it('POST /api/wallet/top-up validates missing amount', async () => {
    const account = makeAccountRow();
    seedSession(account);

    const res = await request(createWalletApp(account)).post('/api/wallet/top-up').send({});

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('GET /api/wallet/transactions returns paginated ledger', async () => {
    const account = makeAccountRow();
    seedSession(account);
    mockQuery.mockResolvedValueOnce({ rows: [makeWalletRow()] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [{ count: 1 }] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [buildLedgerRow()] } as any);

    const res = await request(createWalletApp(account))
      .get('/api/wallet/transactions')
      .query({ type: 'CHARGE' });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.totalItems).toBe(1);
  });
});

describe('wallet repo/reserve flow', () => {
  beforeEach(() => {
    resetMock();
  });

  it('reserveCreditsForGeneration deducts credits and writes ledger', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [makeWalletRow()] } as any);
    mockQuery.mockResolvedValueOnce({
      rows: [makeWalletRow({ balance_credits: '150.45' })],
    } as any);
    mockQuery.mockResolvedValueOnce({ rows: [buildLedgerRow()] } as any);

    const result = await walletRepo.reserveCreditsForGeneration(
      WORKSPACE_UUID,
      makeAccountRow(),
      0.05,
    );

    expect(Number.parseFloat(result.wallet.balance_credits)).toBeCloseTo(150.45);
    const row = buildLedgerRow();
    expect(result.ledger.amount).toBeCloseTo(row.amount);
    expect(result.ledger.type).toBe(row.type);
  });

  it('reserveCreditsForGeneration throws InsufficientCreditsError when balance is low', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [makeWalletRow({ balance_credits: '0.01' })] } as any);

    await expect(
      walletRepo.reserveCreditsForGeneration(WORKSPACE_UUID, makeAccountRow(), 0.05),
    ).rejects.toThrow('Insufficient credits');
  });
});
