import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Mock pool before importing modules
vi.mock('../src/db/pool.js', () => ({
  query: vi.fn(),
  getClient: vi.fn(),
  default: {},
}));

import * as poolModule from '../src/db/pool.js';
import adminRouter from '../src/routes/admin/admin.js';

const mockQuery = vi.mocked(poolModule.query);

const WORKSPACE_UUID = 'a0000000-0000-4000-8000-000000000001';
const ADMIN_UUID = 'b0000000-0000-4000-8000-000000000001';

function makeAdminRow() {
  return {
    id: ADMIN_UUID,
    workspace_id: WORKSPACE_UUID,
    name: 'Test Admin',
    email: 'admin@studio.com',
    role: 'ADMIN',
    is_api_able: true,
    password_hash: '$2a$10$hashedpassword',
    created_at: '2026-06-17T10:00:00.000Z',
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

/** Seed mockQuery so requireSession succeeds (consumes 1 call) */
function seedRequireSessionQueries() {
  mockQuery.mockResolvedValueOnce({ rows: [makeAdminRow()] } as any);
  mockQuery.mockResolvedValueOnce({ rows: [makeWorkspaceRow()] } as any);
}

/** Build an Express app with a fake session for testing admin routes */
function createAdminApp() {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).session = {
      accountId: ADMIN_UUID,
      destroy: vi.fn((cb?: (err?: unknown) => void) => {
        if (cb) cb();
      }),
    };
    next();
  });
  app.use('/api/admin', adminRouter);
  return app;
}

// ================================================================
// Encryption utility
// ================================================================
describe('encryption utility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('encrypt produces different ciphertext each time (random IV)', async () => {
    const { encrypt } = await import('../src/utils/encryption.js');
    const data1 = encrypt('test-key-123');
    const data2 = encrypt('test-key-123');
    expect(data1.encrypted).not.toBe(data2.encrypted);
    expect(data1.iv).not.toBe(data2.iv);
  });

  it('decrypt reverses encrypt', async () => {
    const { encrypt, decrypt } = await import('../src/utils/encryption.js');
    const original = 'fal-ai_test_key_abc123';
    const encrypted = encrypt(original);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(original);
  });

  it('decrypt throws on tampered auth tag', async () => {
    const { encrypt, decrypt } = await import('../src/utils/encryption.js');
    const encrypted = encrypt('secret');
    encrypted.authTag = '00000000000000000000000000000000';
    expect(() => decrypt(encrypted)).toThrow();
  });
});

// ================================================================
// GET /api/admin/fal-key/status
// ================================================================
describe('GET /api/admin/fal-key/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('401 when not authenticated', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/admin', adminRouter);
    const res = await request(app).get('/api/admin/fal-key/status');
    expect(res.status).toBe(401);
  });

  it('403 when non-admin', async () => {
    const app = express();
    app.use(express.json());
    app.use((req: Request, _res: Response, next: NextFunction) => {
      (req as any).session = {
        accountId: 'c0000000-0000-4000-8000-000000000002',
        destroy: vi.fn((cb?: (err?: unknown) => void) => {
          if (cb) cb();
        }),
      };
      next();
    });
    app.use('/api/admin', adminRouter);

    // Seed session queries for non-admin
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'c0000000-0000-4000-8000-000000000002',
          workspace_id: WORKSPACE_UUID,
          name: 'Artist',
          email: 'artist@studio.com',
          role: 'ARTIST',
          is_api_able: false,
          password_hash: '$2a$10$hash',
          created_at: '2026-06-17T10:00:00.000Z',
        },
      ],
    } as any);
    mockQuery.mockResolvedValueOnce({ rows: [makeWorkspaceRow()] } as any);

    const res = await request(app).get('/api/admin/fal-key/status');
    expect(res.status).toBe(403);
  });

  it('returns connected false when no key configured', async () => {
    seedRequireSessionQueries();
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createAdminApp()).get('/api/admin/fal-key/status');
    expect(res.status).toBe(200);
    expect(res.body.data.connected).toBe(false);
  });

  it('returns connected true when key exists', async () => {
    seedRequireSessionQueries();
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'key-uuid',
          created_at: '2026-06-17T10:00:00.000Z',
          updated_at: '2026-06-17T10:00:00.000Z',
        },
      ],
    } as any);

    const res = await request(createAdminApp()).get('/api/admin/fal-key/status');
    expect(res.status).toBe(200);
    expect(res.body.data.connected).toBe(true);
    expect(res.body.data.created_at).toBe('2026-06-17T10:00:00.000Z');
  });
});

// ================================================================
// POST /api/admin/fal-key
// ================================================================
describe('POST /api/admin/fal-key', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('401 when not authenticated', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/admin', adminRouter);
    const res = await request(app).post('/api/admin/fal-key').send({ api_key: 'test' });
    expect(res.status).toBe(401);
  });

  it('422 when api_key is missing', async () => {
    seedRequireSessionQueries();
    const res = await request(createAdminApp()).post('/api/admin/fal-key').send({});
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('422 when api_key is empty string', async () => {
    seedRequireSessionQueries();
    const res = await request(createAdminApp()).post('/api/admin/fal-key').send({ api_key: '' });
    expect(res.status).toBe(422);
  });

  it('201 on success — deactivates old keys and inserts new one', async () => {
    seedRequireSessionQueries();

    // UPDATE fal_ai_keys SET is_active = FALSE
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);
    // INSERT INTO fal_ai_keys
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'new-key-uuid',
          workspace_id: WORKSPACE_UUID,
          is_active: true,
          created_at: '2026-06-19T12:00:00.000Z',
          updated_at: '2026-06-19T12:00:00.000Z',
        },
      ],
    } as any);

    const res = await request(createAdminApp())
      .post('/api/admin/fal-key')
      .send({ api_key: 'fal-ai_test_key_12345' });

    expect(res.status).toBe(201);
    expect(res.body.data.connected).toBe(true);
    expect(res.body.data.id).toBe('new-key-uuid');

    // Verify the UPDATE was called first (deactivate old)
    expect(mockQuery.mock.calls[2][0]).toContain('UPDATE fal_ai_keys SET is_active = FALSE');
    // Verify the INSERT was called with encrypted data
    expect(mockQuery.mock.calls[3][0]).toContain('INSERT INTO fal_ai_keys');
  });
});

// ================================================================
// POST /api/admin/fal-key/test
// ================================================================
describe('POST /api/admin/fal-key/test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('422 when api_key is missing', async () => {
    seedRequireSessionQueries();
    const res = await request(createAdminApp()).post('/api/admin/fal-key/test').send({});
    expect(res.status).toBe(422);
  });

  it('returns connected on successful test', async () => {
    seedRequireSessionQueries();

    // Mock fetch for fal.ai API test
    const mockFetch = vi.fn().mockResolvedValueOnce({ ok: true, status: 200 });
    vi.stubGlobal('fetch', mockFetch);

    const res = await request(createAdminApp())
      .post('/api/admin/fal-key/test')
      .send({ api_key: 'fal-ai_valid_key' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('connected');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('queue.fal.run'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Key fal-ai_valid_key',
        }),
      }),
    );

    vi.unstubAllGlobals();
  });

  it('returns AUTH_FAILED on 401 from fal.ai', async () => {
    seedRequireSessionQueries();

    const mockFetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 401 });
    vi.stubGlobal('fetch', mockFetch);

    const res = await request(createAdminApp())
      .post('/api/admin/fal-key/test')
      .send({ api_key: 'fal-ai_invalid_key' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_FAILED');

    vi.unstubAllGlobals();
  });
});

// ================================================================
// DELETE /api/admin/fal-key
// ================================================================
describe('DELETE /api/admin/fal-key', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('401 when not authenticated', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/admin', adminRouter);
    const res = await request(app).delete('/api/admin/fal-key');
    expect(res.status).toBe(401);
  });

  it('200 on success — deactivates key', async () => {
    seedRequireSessionQueries();
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createAdminApp()).delete('/api/admin/fal-key');
    expect(res.status).toBe(200);
    expect(res.body.data.connected).toBe(false);

    // Verify UPDATE was called
    expect(mockQuery.mock.calls[2][0]).toContain('UPDATE fal_ai_keys SET is_active = FALSE');
  });
});
