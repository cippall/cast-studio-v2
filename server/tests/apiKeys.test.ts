import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import crypto from 'node:crypto';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Mock pool before importing modules
vi.mock('../src/db/pool.js', () => ({
  query: vi.fn(),
  getClient: vi.fn(),
  default: {},
}));

import * as poolModule from '../src/db/pool.js';
import apiKeysRouter from '../src/routes/apiKeys.js';
import accountsRouter from '../src/routes/accounts.js';

const mockQuery = vi.mocked(poolModule.query);

const WORKSPACE_UUID = 'a0000000-0000-4000-8000-000000000001';
const ADMIN_UUID = 'b0000000-0000-4000-8000-000000000001';
const ARTIST_UUID = 'c0000000-0000-4000-8000-000000000002';
const API_KEY_ID = 'd0000000-0000-4000-8000-000000000003';

function makeAccountRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ADMIN_UUID,
    workspace_id: WORKSPACE_UUID,
    name: 'Test Admin',
    email: 'admin@studio.com',
    role: 'ADMIN',
    is_api_able: true,
    password_hash: '$2a$10$hashedpassword',
    created_at: '2026-06-17T10:00:00.000Z',
    ...overrides,
  };
}

function makeWorkspaceRow() {
  return {
    id: WORKSPACE_UUID,
    name: 'Test Workspace',
    slug: 'test',
    workspace_type: 'STUDIO',
    created_at: '2026-06-17T10:00:00.000Z',
  };
}

function makeApiKeyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: API_KEY_ID,
    account_id: ARTIST_UUID,
    key_hash: '$2a$10$fakehashvaluexxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    name: 'Dev Script',
    is_active: true,
    created_at: '2026-06-17T10:00:00.000Z',
    last_used_at: null,
    ...overrides,
  };
}

/** Seed mockQuery so requireSession succeeds (consumes 1 call) */
function seedRequireSessionQueries(accountRow: Record<string, unknown>) {
  mockQuery.mockResolvedValueOnce({ rows: [accountRow] } as any);
}

/** Build an Express app with a fake session for testing protected routes */
function createApiKeysApp(accountOverride?: Record<string, unknown>) {
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
  app.use('/api/api-keys', apiKeysRouter);
  return app;
}

function createAccountsApp(accountOverride?: Record<string, unknown>) {
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
  app.use('/api/accounts', accountsRouter);
  return app;
}

// ================================================================
// Key generation utility
// ================================================================
describe('key generation utility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates a key with cs_live_ prefix and hex characters', async () => {
    const { generateApiKey } = await import('../src/utils/keyGeneration.js');
    const { rawKey, prefix } = generateApiKey();
    expect(rawKey).toMatch(/^cs_live_[0-9a-f]{64}$/);
    expect(prefix).toBe('cs_live_');
  });

  it('generates unique keys each time', async () => {
    const { generateApiKey } = await import('../src/utils/keyGeneration.js');
    const keys = new Set<string>();
    for (let i = 0; i < 10; i++) {
      keys.add(generateApiKey().rawKey);
    }
    expect(keys.size).toBe(10);
  });

  it('generates 32 bytes of random hex (64 hex chars)', async () => {
    const { generateApiKey } = await import('../src/utils/keyGeneration.js');
    const { rawKey } = generateApiKey();
    const hexPart = rawKey.slice('cs_live_'.length);
    expect(hexPart).toHaveLength(64);
    expect(Buffer.from(hexPart, 'hex').length).toBe(32);
  });
});

// ================================================================
// requireApiKey middleware
// ================================================================
describe('requireApiKey middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('401 when no Authorization header', async () => {
    const { requireApiKey } = await import('../src/middleware/requireApiKey.js');
    const req = { headers: {} } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();
    await requireApiKey(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('401 when auth header is not Bearer', async () => {
    const { requireApiKey } = await import('../src/middleware/requireApiKey.js');
    const req = { headers: { authorization: 'Basic xyz' } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();
    await requireApiKey(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('401 when no active keys match', async () => {
    const { requireApiKey } = await import('../src/middleware/requireApiKey.js');
    const req = { headers: { authorization: 'Bearer cs_live_nonexistentkey' } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();

    // Return empty array of keys
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    await requireApiKey(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("401 when key exists but bcrypt doesn't match", async () => {
    const { requireApiKey } = await import('../src/middleware/requireApiKey.js');
    const bcrypt = await import('bcryptjs');
    const wrongHash = await bcrypt.hash('wrongkey', 4);

    const req = { headers: { authorization: 'Bearer cs_live_mismatch' } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();

    // Key found but hash won't match
    mockQuery.mockResolvedValueOnce({
      rows: [makeApiKeyRow({ key_hash: wrongHash, account_id: ARTIST_UUID })],
    } as any);

    await requireApiKey(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('401 when key is inactive', async () => {
    const { requireApiKey } = await import('../src/middleware/requireApiKey.js');
    const keyText = 'cs_live_testkey123';

    const req = { headers: { authorization: `Bearer ${keyText}` } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();

    // No active keys returned (the key exists but is_active = false)
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    await requireApiKey(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('sets req.account + req.workspace and calls next when key matches', async () => {
    const { requireApiKey } = await import('../src/middleware/requireApiKey.js');
    const bcrypt = await import('bcryptjs');
    const keyText = 'cs_live_validkey123';
    const keyHash = await bcrypt.hash(keyText, 4);

    const req = { headers: { authorization: `Bearer ${keyText}` } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();

    const artist = makeAccountRow({ id: ARTIST_UUID, role: 'ARTIST', is_api_able: true });

    // First query: find matching key
    mockQuery.mockResolvedValueOnce({
      rows: [makeApiKeyRow({ key_hash: keyHash, account_id: ARTIST_UUID })],
    } as any);
    // Second query: lookup account by account_id
    mockQuery.mockResolvedValueOnce({ rows: [artist] } as any);
    // Third query: lookup workspace
    mockQuery.mockResolvedValueOnce({ rows: [makeWorkspaceRow()] } as any);
    // Fourth query: update last_used_at
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    await requireApiKey(req, res, next);
    expect(req.account).toMatchObject({
      id: ARTIST_UUID,
      role: 'ARTIST',
      is_api_able: true,
    });
    expect(req.workspace).toBeDefined();
    expect(req.workspace.id).toBe(WORKSPACE_UUID);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('401 when account is not api_able', async () => {
    const { requireApiKey } = await import('../src/middleware/requireApiKey.js');
    const bcrypt = await import('bcryptjs');
    const keyText = 'cs_live_notapiable';
    const keyHash = await bcrypt.hash(keyText, 4);

    const req = { headers: { authorization: `Bearer ${keyText}` } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();

    const client = makeAccountRow({ id: ARTIST_UUID, role: 'CLIENT', is_api_able: false });

    mockQuery.mockResolvedValueOnce({
      rows: [makeApiKeyRow({ key_hash: keyHash, account_id: ARTIST_UUID })],
    } as any);
    mockQuery.mockResolvedValueOnce({ rows: [client] } as any);

    await requireApiKey(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('401 when account not found', async () => {
    const { requireApiKey } = await import('../src/middleware/requireApiKey.js');
    const bcrypt = await import('bcryptjs');
    const keyText = 'cs_live_orphankey';
    const keyHash = await bcrypt.hash(keyText, 4);

    const req = { headers: { authorization: `Bearer ${keyText}` } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();

    mockQuery.mockResolvedValueOnce({
      rows: [makeApiKeyRow({ key_hash: keyHash, account_id: ARTIST_UUID })],
    } as any);
    mockQuery.mockResolvedValueOnce({ rows: [] } as any); // account not found

    await requireApiKey(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('500 on DB error', async () => {
    const { requireApiKey } = await import('../src/middleware/requireApiKey.js');
    const req = { headers: { authorization: 'Bearer cs_live_error' } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();

    mockQuery.mockRejectedValueOnce(new Error('db boom'));

    await requireApiKey(req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });
});

// ================================================================
// POST /api/api-keys
// ================================================================
describe('POST /api/api-keys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('401 when not authenticated', async () => {
    const res = await request(createApiKeysApp()).post('/api/api-keys').send({ name: 'My Key' });
    expect(res.status).toBe(401);
  });

  it('403 when account is not api_able', async () => {
    const client = makeAccountRow({ role: 'CLIENT', is_api_able: false });
    seedRequireSessionQueries(client);
    const res = await request(createApiKeysApp(client))
      .post('/api/api-keys')
      .send({ name: 'My Key' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('422 on missing name', async () => {
    const artist = makeAccountRow({ id: ARTIST_UUID, role: 'ARTIST', is_api_able: true });
    seedRequireSessionQueries(artist);
    const res = await request(createApiKeysApp(artist)).post('/api/api-keys').send({});
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('422 on empty name', async () => {
    const artist = makeAccountRow({ id: ARTIST_UUID, role: 'ARTIST', is_api_able: true });
    seedRequireSessionQueries(artist);
    const res = await request(createApiKeysApp(artist)).post('/api/api-keys').send({ name: '' });
    expect(res.status).toBe(422);
  });

  it('201 on success, returns full key once', async () => {
    const artist = makeAccountRow({ id: ARTIST_UUID, role: 'ARTIST', is_api_able: true });
    seedRequireSessionQueries(artist);

    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: API_KEY_ID,
          name: 'My Key',
          is_active: true,
          created_at: '2026-06-17T10:00:00.000Z',
          account_id: ARTIST_UUID,
        },
      ],
    } as any);

    const res = await request(createApiKeysApp(artist))
      .post('/api/api-keys')
      .send({ name: 'My Key' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('key');
    expect(res.body.key).toMatch(/^cs_live_[0-9a-f]{64}$/);
    expect(res.body.name).toBe('My Key');
    expect(res.body.is_active).toBe(true);
    expect(res.body).not.toHaveProperty('key_hash');
    expect(res.body).not.toHaveProperty('password_hash');
  });
});

// ================================================================
// GET /api/api-keys
// ================================================================
describe('GET /api/api-keys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('401 when not authenticated', async () => {
    const res = await request(createApiKeysApp()).get('/api/api-keys');
    expect(res.status).toBe(401);
  });

  it('200 returns masked keys (last 4 chars only)', async () => {
    const artist = makeAccountRow({ id: ARTIST_UUID, role: 'ARTIST', is_api_able: true });
    seedRequireSessionQueries(artist);

    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: API_KEY_ID,
          name: 'Dev Script',
          key_hash: '$2a$10$hashvalue',
          is_active: true,
          created_at: '2026-06-17T10:00:00.000Z',
          last_used_at: null,
        },
      ],
    } as any);

    const res = await request(createApiKeysApp(artist)).get('/api/api-keys');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    const key = res.body.data[0];
    expect(key.name).toBe('Dev Script');
    // The key_hash field should be a masked string with last 4 chars
    expect(key.key).toMatch(/^cs_live_/);
    expect(key).not.toHaveProperty('key_hash'); // bcrypt hash never exposed
    expect(key.is_active).toBe(true);
  });

  it('200 returns empty array when no keys', async () => {
    const artist = makeAccountRow({ id: ARTIST_UUID, role: 'ARTIST', is_api_able: true });
    seedRequireSessionQueries(artist);

    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createApiKeysApp(artist)).get('/api/api-keys');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

// ================================================================
// DELETE /api/api-keys/:id
// ================================================================
describe('DELETE /api/api-keys/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('401 when not authenticated', async () => {
    const res = await request(createApiKeysApp()).delete('/api/api-keys/some-uuid');
    expect(res.status).toBe(401);
  });

  it('404 when key not found or not owned by user', async () => {
    const artist = makeAccountRow({ id: ARTIST_UUID, role: 'ARTIST', is_api_able: true });
    seedRequireSessionQueries(artist);

    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createApiKeysApp(artist)).delete(`/api/api-keys/${API_KEY_ID}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('200 on successful revoke (sets is_active = false)', async () => {
    const artist = makeAccountRow({ id: ARTIST_UUID, role: 'ARTIST', is_api_able: true });
    seedRequireSessionQueries(artist);

    // Single UPDATE query replaces the old SELECT + UPDATE pattern
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: API_KEY_ID, name: 'Dev Script', is_active: false }],
    } as any);

    const res = await request(createApiKeysApp(artist)).delete(`/api/api-keys/${API_KEY_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.is_active).toBe(false);
  });
});

// ================================================================
// PATCH /api/accounts/:id — toggle is_api_able
// ================================================================
describe('PATCH /api/accounts/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('401 when not authenticated', async () => {
    const res = await request(createAccountsApp())
      .patch(`/api/accounts/${ARTIST_UUID}`)
      .send({ is_api_able: true });
    expect(res.status).toBe(401);
  });

  it('403 when non-admin tries to toggle is_api_able', async () => {
    const artist = makeAccountRow({ id: ARTIST_UUID, role: 'ARTIST', is_api_able: true });
    seedRequireSessionQueries(artist);

    const res = await request(createAccountsApp(artist))
      .patch(`/api/accounts/${ARTIST_UUID}`)
      .send({ is_api_able: true });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('200 on admin toggle is_api_able to true', async () => {
    const admin = makeAccountRow({ id: ADMIN_UUID, role: 'ADMIN', is_api_able: true });
    seedRequireSessionQueries(admin);

    // Find target account
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: ARTIST_UUID, workspace_id: WORKSPACE_UUID, role: 'ARTIST', is_api_able: false }],
    } as any);
    // Update account
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: ARTIST_UUID, is_api_able: true }],
    } as any);

    const res = await request(createAccountsApp(admin))
      .patch(`/api/accounts/${ARTIST_UUID}`)
      .send({ is_api_able: true });
    expect(res.status).toBe(200);
    expect(res.body.is_api_able).toBe(true);
  });

  it('200 on admin toggle is_api_able to false', async () => {
    const admin = makeAccountRow({ id: ADMIN_UUID, role: 'ADMIN', is_api_able: true });
    seedRequireSessionQueries(admin);

    mockQuery.mockResolvedValueOnce({
      rows: [{ id: ARTIST_UUID, workspace_id: WORKSPACE_UUID, role: 'ARTIST', is_api_able: true }],
    } as any);
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: ARTIST_UUID, is_api_able: false }],
    } as any);

    const res = await request(createAccountsApp(admin))
      .patch(`/api/accounts/${ARTIST_UUID}`)
      .send({ is_api_able: false });
    expect(res.status).toBe(200);
    expect(res.body.is_api_able).toBe(false);
  });

  it('200 on self-service name update (non-admin can update own name)', async () => {
    const artist = makeAccountRow({ id: ARTIST_UUID, role: 'ARTIST', is_api_able: true });
    seedRequireSessionQueries(artist);

    // Find target account (own account)
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: ARTIST_UUID, workspace_id: WORKSPACE_UUID, role: 'ARTIST', is_api_able: true }],
    } as any);
    // Update name
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: ARTIST_UUID, name: 'New Name', is_api_able: true }],
    } as any);

    const res = await request(createAccountsApp(artist))
      .patch(`/api/accounts/${ARTIST_UUID}`)
      .send({ name: 'New Name' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New Name');
  });

  it('403 when non-admin tries to change role', async () => {
    const artist = makeAccountRow({ id: ARTIST_UUID, role: 'ARTIST', is_api_able: false });
    seedRequireSessionQueries(artist);

    const res = await request(createAccountsApp(artist))
      .patch(`/api/accounts/${ARTIST_UUID}`)
      .send({ role: 'ADMIN' });
    expect(res.status).toBe(403);
  });

  it('422 on invalid account id', async () => {
    const admin = makeAccountRow({ id: ADMIN_UUID, role: 'ADMIN', is_api_able: true });
    seedRequireSessionQueries(admin);

    const res = await request(createAccountsApp(admin))
      .patch('/api/accounts/not-a-uuid')
      .send({ is_api_able: true });
    expect(res.status).toBe(422);
  });
});
