import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';

// Tests commonly use `any` for mock DB response shapes
/* eslint-disable @typescript-eslint/no-explicit-any */

// Mock pool before importing modules that use it
vi.mock('../src/db/pool.js', () => ({
  query: vi.fn(),
  getClient: vi.fn(),
  default: {},
}));

import * as poolModule from '../src/db/pool.js';
import authRouter from '../src/routes/auth.js';

const mockQuery = vi.mocked(poolModule.query);

// Real-looking UUIDs (hex-only so Zod uuid() doesn't reject)
// Use valid v4 UUIDs (third group starts with 4, fourth with 8/9/a/b)
const WORKSPACE_UUID = 'a0000000-0000-4000-8000-000000000001';
const ADMIN_UUID = 'b0000000-0000-4000-8000-000000000001';

function makeAccountRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ADMIN_UUID,
    workspace_id: WORKSPACE_UUID,
    name: 'Test Admin',
    email: 'admin@studio.com',
    role: 'ADMIN',
    is_api_able: true,
    password_hash: '$2a$10$hashedpassword', // will be overridden in login tests
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

/** Seed mockQuery so requireSession succeeds (consumes 1 call) */
function seedRequireSessionQueries(accountRow: Record<string, unknown>) {
  mockQuery.mockResolvedValueOnce({ rows: [accountRow] } as any);
}

/** Build app with fake session injected on every request */
function createRouteApp(accountOverride?: Record<string, unknown>) {
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
  app.use('/api/auth', authRouter);
  return app;
}

// ================================================================
// requireSession middleware
// ================================================================
describe('requireSession middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('401 when no session', async () => {
    const { requireSession } = await import('../src/middleware/requireSession.js');
    const req = { session: null } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();
    await requireSession(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('401 when session.accountId is null', async () => {
    const { requireSession } = await import('../src/middleware/requireSession.js');
    const req = { session: { accountId: null, destroy: vi.fn() } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();
    await requireSession(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('401 when account not found', async () => {
    const { requireSession } = await import('../src/middleware/requireSession.js');
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);
    const dm = vi.fn((cb?: (e?: unknown) => void) => {
      if (cb) cb();
    });
    const req = { session: { accountId: 'bad', destroy: dm } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();
    await requireSession(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(dm).toHaveBeenCalled();
  });

  it('sets req.account and calls next', async () => {
    const { requireSession } = await import('../src/middleware/requireSession.js');
    const acct = makeAccountRow();
    mockQuery.mockResolvedValueOnce({ rows: [acct] } as any);
    const req = { session: { accountId: acct.id, destroy: vi.fn() } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();
    await requireSession(req, res, next);
    expect(req.account).toEqual(acct);
    expect(req.workspace).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('500 on DB error', async () => {
    const { requireSession } = await import('../src/middleware/requireSession.js');
    mockQuery.mockRejectedValueOnce(new Error('boom'));
    const req = { session: { accountId: 'x', destroy: vi.fn() } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();
    await requireSession(req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });
});

// ================================================================
// POST /api/auth/register
// ================================================================
describe('POST /api/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('401 when not authenticated', async () => {
    const res = await request(createRouteApp()).post('/api/auth/register').send({
      email: 'a@b.com',
      password: '12345678',
      name: 'N',
      role: 'ARTIST',
      workspace_id: WORKSPACE_UUID,
    });
    expect(res.status).toBe(401);
  });

  it('403 when not admin', async () => {
    const artist = makeAccountRow({ role: 'ARTIST' });
    seedRequireSessionQueries(artist);
    const res = await request(createRouteApp(artist)).post('/api/auth/register').send({
      email: 'a@b.com',
      password: '12345678',
      name: 'N',
      role: 'ARTIST',
      workspace_id: WORKSPACE_UUID,
    });
    expect(res.status).toBe(403);
  });

  it('422 on invalid input', async () => {
    seedRequireSessionQueries(makeAccountRow());
    const res = await request(createRouteApp(makeAccountRow())).post('/api/auth/register').send({
      email: 'bad',
      password: 's',
      name: '',
      role: 'NOPE',
      workspace_id: 'x',
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('409 on duplicate email', async () => {
    const admin = makeAccountRow();
    seedRequireSessionQueries(admin);
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'x' }] } as any); // duplicate
    const res = await request(createRouteApp(admin)).post('/api/auth/register').send({
      email: 'dup@b.com',
      password: '12345678',
      name: 'N',
      role: 'ARTIST',
      workspace_id: WORKSPACE_UUID,
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('201 on success', async () => {
    const admin = makeAccountRow();
    seedRequireSessionQueries(admin);
    mockQuery.mockResolvedValueOnce({ rows: [] } as any); // no dup

    const newAcct = {
      id: 'c0000000-0000-4000-8000-000000000002',
      workspace_id: WORKSPACE_UUID,
      name: 'N',
      email: 'n@b.com',
      role: 'ARTIST',
      is_api_able: true,
      created_at: '2026-01-01T00:00:00.000Z',
    };
    mockQuery.mockResolvedValueOnce({ rows: [newAcct] } as any);
    const res = await request(createRouteApp(admin)).post('/api/auth/register').send({
      email: 'n@b.com',
      password: '12345678',
      name: 'N',
      role: 'ARTIST',
      workspace_id: WORKSPACE_UUID,
    });
    expect(res.status).toBe(201);
    expect(res.body).toEqual(newAcct);
    expect(res.body).not.toHaveProperty('password_hash');
  });
});

// ================================================================
// POST /api/auth/login (REAL bcryptjs — no mocking)
// ================================================================
describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('422 on empty body', async () => {
    const res = await request(createRouteApp())
      .post('/api/auth/login')
      .send({ email: '', password: '' });
    expect(res.status).toBe(422);
  });

  it('401 on unknown email', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);
    const res = await request(createRouteApp())
      .post('/api/auth/login')
      .send({ email: 'x@y.com', password: 'p' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('401 on wrong password', async () => {
    // Hash a known password with real bcryptjs
    const bcrypt = await import('bcryptjs');
    const realHash = await bcrypt.hash('realpassword', 10);
    const acct = makeAccountRow({ password_hash: realHash });
    mockQuery.mockResolvedValueOnce({ rows: [acct] } as any);

    const res = await request(createRouteApp()).post('/api/auth/login').send({
      email: 'admin@studio.com',
      password: 'wrongpassword',
    });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('200 on correct password, sets session.accountId', async () => {
    // Hash a known password with real bcryptjs
    const bcrypt = await import('bcryptjs');
    const realHash = await bcrypt.hash('correctpassword', 10);
    const acct = makeAccountRow({ password_hash: realHash });
    mockQuery.mockResolvedValueOnce({ rows: [acct] } as any);

    let capturedId: string | null = null;
    const app = express();
    app.use(express.json());
    app.use((req: any, _res: any, next: any) => {
      const s: any = { accountId: null, destroy: vi.fn() };
      Object.defineProperty(s, 'accountId', {
        get: () => capturedId,
        set: (v: string | null) => {
          capturedId = v;
        },
        configurable: true,
      });
      req.session = s;
      next();
    });
    app.use('/api/auth', authRouter);

    const res = await request(app).post('/api/auth/login').send({
      email: 'admin@studio.com',
      password: 'correctpassword',
    });
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('password_hash');
    expect(res.body.id).toBe(acct.id);
    expect(capturedId).toBe(acct.id);
  });
});

// ================================================================
// POST /api/auth/logout
// ================================================================
describe('POST /api/auth/logout', () => {
  it('200 + destroys session', async () => {
    const res = await request(createRouteApp()).post('/api/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Logged out successfully');
  });
});

// ================================================================
// GET /api/auth/me
// ================================================================
describe('GET /api/auth/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('401 when not authenticated', async () => {
    const res = await request(createRouteApp()).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('200 when authenticated', async () => {
    const acct = makeAccountRow();
    seedRequireSessionQueries(acct);
    const res = await request(createRouteApp(acct)).get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('password_hash');
    expect(res.body.id).toBe(acct.id);
  });
});
