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
import workspacesRouter from '../src/routes/workspaces.js';

const mockQuery = vi.mocked(poolModule.query);

// Valid v4 UUIDs (third group starts with 4, fourth with 8/9/a/b)
const WORKSPACE_UUID = 'a0000000-0000-4000-8000-000000000001';
const ADMIN_UUID = 'b0000000-0000-4000-8000-000000000001';
const OTHER_WS_UUID = 'd0000000-0000-4000-8000-000000000003';

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

function makeWorkspaceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: WORKSPACE_UUID,
    name: 'Test Workspace',
    slug: 'test-workspace',
    workspace_type: 'STUDIO',
    created_at: '2026-06-17T10:00:00.000Z',
    ...overrides,
  };
}

/** Seed mockQuery so requireSession succeeds (consumes 2 calls) */
function seedRequireSessionQueries(accountRow: Record<string, unknown>) {
  mockQuery.mockResolvedValueOnce({ rows: [accountRow] } as any);
  mockQuery.mockResolvedValueOnce({ rows: [makeWorkspaceRow()] } as any);
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
  app.use('/api/workspaces', workspacesRouter);
  return app;
}

/** Reset mock to pristine state before each test */
function resetMock() {
  mockQuery.mockReset();
}

// ================================================================
// requireWorkspace middleware
// ================================================================
describe('requireWorkspace middleware', () => {
  beforeEach(() => {
    resetMock();
  });

  it('401 when no account set', async () => {
    const { requireWorkspace } = await import('../src/middleware/requireWorkspace.js');
    const req = {} as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();
    await requireWorkspace(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('404 when workspace not found', async () => {
    const { requireWorkspace } = await import('../src/middleware/requireWorkspace.js');
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);
    const req = { account: { workspace_id: 'nonexistent' } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();
    await requireWorkspace(req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('skips DB query when req.workspace already set', async () => {
    const { requireWorkspace } = await import('../src/middleware/requireWorkspace.js');
    const existingWorkspace = makeWorkspaceRow({ id: OTHER_WS_UUID });
    const req = {
      account: { workspace_id: WORKSPACE_UUID },
      workspace: existingWorkspace,
    } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();
    await requireWorkspace(req, res, next);
    expect(mockQuery).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('loads workspace from DB and sets req.workspace', async () => {
    const { requireWorkspace } = await import('../src/middleware/requireWorkspace.js');
    const ws = makeWorkspaceRow();
    mockQuery.mockResolvedValueOnce({ rows: [ws] } as any);
    const req = { account: { workspace_id: WORKSPACE_UUID } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();
    await requireWorkspace(req, res, next);
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('workspaces'), [WORKSPACE_UUID]);
    expect(req.workspace).toEqual(ws);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('500 on DB error', async () => {
    const { requireWorkspace } = await import('../src/middleware/requireWorkspace.js');
    mockQuery.mockRejectedValueOnce(new Error('boom'));
    const req = { account: { workspace_id: WORKSPACE_UUID } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();
    await requireWorkspace(req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });
});

// ================================================================
// GET /api/workspaces
// ================================================================
describe('GET /api/workspaces', () => {
  beforeEach(() => {
    resetMock();
  });

  it('401 when not authenticated', async () => {
    const res = await request(createRouteApp()).get('/api/workspaces');
    expect(res.status).toBe(401);
  });

  it('403 when not admin', async () => {
    const artist = makeAccountRow({ role: 'ARTIST' });
    seedRequireSessionQueries(artist);
    const res = await request(createRouteApp(artist)).get('/api/workspaces');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('200 with paginated list for admin', async () => {
    const admin = makeAccountRow();
    seedRequireSessionQueries(admin);
    mockQuery.mockResolvedValueOnce({ rows: [{ count: 3 }] } as any);
    mockQuery.mockResolvedValueOnce({
      rows: [
        makeWorkspaceRow({ id: WORKSPACE_UUID, name: 'WS 1', slug: 'ws-1' }),
        makeWorkspaceRow({ id: OTHER_WS_UUID, name: 'WS 2', slug: 'ws-2' }),
        makeWorkspaceRow({
          id: 'e0000000-0000-4000-8000-000000000004',
          name: 'WS 3',
          slug: 'ws-3',
        }),
      ],
    } as any);

    const res = await request(createRouteApp(admin)).get('/api/workspaces');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.pagination).toMatchObject({
      page: 1,
      pageSize: 20,
      totalItems: 3,
      totalPages: 1,
    });
  });

  it('respects page and pageSize query params', async () => {
    const admin = makeAccountRow();
    seedRequireSessionQueries(admin);
    mockQuery.mockResolvedValueOnce({ rows: [{ count: 10 }] } as any);
    mockQuery.mockResolvedValueOnce({
      rows: [makeWorkspaceRow({ id: WORKSPACE_UUID })],
    } as any);

    const res = await request(createRouteApp(admin))
      .get('/api/workspaces')
      .query({ page: 2, pageSize: 5 });
    expect(res.status).toBe(200);
    expect(res.body.pagination).toMatchObject({
      page: 2,
      pageSize: 5,
      totalItems: 10,
      totalPages: 2,
    });
  });
});

// ================================================================
// POST /api/workspaces
// ================================================================
describe('POST /api/workspaces', () => {
  beforeEach(() => {
    resetMock();
  });

  it('401 when not authenticated', async () => {
    const res = await request(createRouteApp()).post('/api/workspaces').send({
      name: 'New Studio',
      slug: 'new-studio',
      workspace_type: 'STUDIO',
    });
    expect(res.status).toBe(401);
  });

  it('403 when not admin', async () => {
    const artist = makeAccountRow({ role: 'ARTIST' });
    seedRequireSessionQueries(artist);
    const res = await request(createRouteApp(artist)).post('/api/workspaces').send({
      name: 'New Studio',
      slug: 'new-studio',
      workspace_type: 'STUDIO',
    });
    expect(res.status).toBe(403);
  });

  it('422 on invalid input', async () => {
    const admin = makeAccountRow();
    seedRequireSessionQueries(admin);
    const res = await request(createRouteApp(admin)).post('/api/workspaces').send({
      name: '',
      slug: 'bad-slug!',
      workspace_type: 'INVALID',
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('409 on duplicate slug', async () => {
    const admin = makeAccountRow();
    seedRequireSessionQueries(admin);
    mockQuery.mockResolvedValueOnce({ rows: [{ id: WORKSPACE_UUID }] } as any);

    const res = await request(createRouteApp(admin)).post('/api/workspaces').send({
      name: 'New Studio',
      slug: 'test-workspace',
      workspace_type: 'STUDIO',
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('201 on success', async () => {
    const admin = makeAccountRow();
    seedRequireSessionQueries(admin);
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const newWs = {
      id: 'f0000000-0000-4000-8000-000000000005',
      name: 'Brand New Studio',
      slug: 'brand-new-studio',
      workspace_type: 'STUDIO',
      created_at: '2026-06-17T12:00:00.000Z',
    };
    mockQuery.mockResolvedValueOnce({ rows: [newWs] } as any);

    const res = await request(createRouteApp(admin)).post('/api/workspaces').send({
      name: 'Brand New Studio',
      slug: 'brand-new-studio',
      workspace_type: 'STUDIO',
    });
    expect(res.status).toBe(201);
    expect(res.body).toEqual(newWs);
  });

  it('defaults workspace_type to STUDIO', async () => {
    const admin = makeAccountRow();
    seedRequireSessionQueries(admin);
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const newWs = {
      id: 'f0000000-0000-4000-8000-000000000005',
      name: 'Default Type',
      slug: 'default-type',
      workspace_type: 'STUDIO',
      created_at: '2026-06-17T12:00:00.000Z',
    };
    mockQuery.mockResolvedValueOnce({ rows: [newWs] } as any);

    const res = await request(createRouteApp(admin)).post('/api/workspaces').send({
      name: 'Default Type',
      slug: 'default-type',
    });
    expect(res.status).toBe(201);
    expect(res.body.workspace_type).toBe('STUDIO');
  });

  it('can create CLIENT workspace type', async () => {
    const admin = makeAccountRow();
    seedRequireSessionQueries(admin);
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const newWs = {
      id: 'f0000000-0000-4000-8000-000000000005',
      name: 'Client Corp',
      slug: 'client-corp',
      workspace_type: 'CLIENT',
      created_at: '2026-06-17T12:00:00.000Z',
    };
    mockQuery.mockResolvedValueOnce({ rows: [newWs] } as any);

    const res = await request(createRouteApp(admin)).post('/api/workspaces').send({
      name: 'Client Corp',
      slug: 'client-corp',
      workspace_type: 'CLIENT',
    });
    expect(res.status).toBe(201);
    expect(res.body.workspace_type).toBe('CLIENT');
  });
});

// ================================================================
// GET /api/workspaces/:id
// ================================================================
describe('GET /api/workspaces/:id', () => {
  beforeEach(() => {
    resetMock();
  });

  it('401 when not authenticated', async () => {
    const res = await request(createRouteApp()).get(`/api/workspaces/${WORKSPACE_UUID}`);
    expect(res.status).toBe(401);
  });

  it('403 when not admin', async () => {
    const artist = makeAccountRow({ role: 'ARTIST' });
    seedRequireSessionQueries(artist);
    const res = await request(createRouteApp(artist)).get(`/api/workspaces/${WORKSPACE_UUID}`);
    expect(res.status).toBe(403);
  });

  it('404 when workspace not found', async () => {
    const admin = makeAccountRow();
    seedRequireSessionQueries(admin);
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createRouteApp(admin)).get(`/api/workspaces/${OTHER_WS_UUID}`);
    expect(res.status).toBe(404);
  });

  it('200 with workspace object', async () => {
    const admin = makeAccountRow();
    seedRequireSessionQueries(admin);

    const ws = makeWorkspaceRow({ id: OTHER_WS_UUID, name: 'Other WS', slug: 'other-ws' });
    mockQuery.mockResolvedValueOnce({ rows: [ws] } as any);

    const res = await request(createRouteApp(admin)).get(`/api/workspaces/${OTHER_WS_UUID}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(ws);
  });
});

// ================================================================
// PATCH /api/workspaces/:id
// ================================================================
describe('PATCH /api/workspaces/:id', () => {
  beforeEach(() => {
    resetMock();
  });

  it('401 when not authenticated', async () => {
    const res = await request(createRouteApp())
      .patch(`/api/workspaces/${WORKSPACE_UUID}`)
      .send({ name: 'Renamed' });
    expect(res.status).toBe(401);
  });

  it('403 when not admin', async () => {
    const artist = makeAccountRow({ role: 'ARTIST' });
    seedRequireSessionQueries(artist);
    const res = await request(createRouteApp(artist))
      .patch(`/api/workspaces/${WORKSPACE_UUID}`)
      .send({ name: 'Renamed' });
    expect(res.status).toBe(403);
  });

  it('404 when workspace not found', async () => {
    const admin = makeAccountRow();
    seedRequireSessionQueries(admin);
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createRouteApp(admin))
      .patch(`/api/workspaces/${OTHER_WS_UUID}`)
      .send({ name: 'Renamed' });
    expect(res.status).toBe(404);
  });

  it('422 on invalid input', async () => {
    const admin = makeAccountRow();
    seedRequireSessionQueries(admin);
    mockQuery.mockResolvedValueOnce({ rows: [{ id: WORKSPACE_UUID }] } as any);

    const res = await request(createRouteApp(admin))
      .patch(`/api/workspaces/${WORKSPACE_UUID}`)
      .send({ slug: 'BAD SLUG!' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('409 on duplicate slug', async () => {
    const admin = makeAccountRow();
    seedRequireSessionQueries(admin);
    mockQuery.mockResolvedValueOnce({ rows: [{ id: WORKSPACE_UUID }] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [{ id: OTHER_WS_UUID }] } as any);

    const res = await request(createRouteApp(admin))
      .patch(`/api/workspaces/${WORKSPACE_UUID}`)
      .send({ slug: 'taken-slug' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('200 on successful name update', async () => {
    const admin = makeAccountRow();
    seedRequireSessionQueries(admin);
    mockQuery.mockResolvedValueOnce({ rows: [{ id: WORKSPACE_UUID }] } as any);

    const updated = makeWorkspaceRow({ name: 'Renamed Workspace' });
    mockQuery.mockResolvedValueOnce({ rows: [updated] } as any);

    const res = await request(createRouteApp(admin))
      .patch(`/api/workspaces/${WORKSPACE_UUID}`)
      .send({ name: 'Renamed Workspace' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Renamed Workspace');
  });

  it('200 on successful slug update', async () => {
    const admin = makeAccountRow();
    seedRequireSessionQueries(admin);
    mockQuery.mockResolvedValueOnce({ rows: [{ id: WORKSPACE_UUID }] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const updated = makeWorkspaceRow({ slug: 'new-slug' });
    mockQuery.mockResolvedValueOnce({ rows: [updated] } as any);

    const res = await request(createRouteApp(admin))
      .patch(`/api/workspaces/${WORKSPACE_UUID}`)
      .send({ slug: 'new-slug' });
    expect(res.status).toBe(200);
    expect(res.body.slug).toBe('new-slug');
  });

  it('200 on workspace_type update', async () => {
    const admin = makeAccountRow();
    seedRequireSessionQueries(admin);
    mockQuery.mockResolvedValueOnce({ rows: [{ id: WORKSPACE_UUID }] } as any);

    const updated = makeWorkspaceRow({ workspace_type: 'CLIENT' });
    mockQuery.mockResolvedValueOnce({ rows: [updated] } as any);

    const res = await request(createRouteApp(admin))
      .patch(`/api/workspaces/${WORKSPACE_UUID}`)
      .send({ workspace_type: 'CLIENT' });
    expect(res.status).toBe(200);
    expect(res.body.workspace_type).toBe('CLIENT');
  });
});

// ================================================================
// DELETE /api/workspaces/:id
// ================================================================
describe('DELETE /api/workspaces/:id', () => {
  beforeEach(() => {
    resetMock();
  });

  it('401 when not authenticated', async () => {
    const res = await request(createRouteApp()).delete(`/api/workspaces/${WORKSPACE_UUID}`);
    expect(res.status).toBe(401);
  });

  it('403 when not admin', async () => {
    const artist = makeAccountRow({ role: 'ARTIST' });
    seedRequireSessionQueries(artist);
    const res = await request(createRouteApp(artist)).delete(`/api/workspaces/${WORKSPACE_UUID}`);
    expect(res.status).toBe(403);
  });

  it('404 when workspace not found', async () => {
    const admin = makeAccountRow();
    seedRequireSessionQueries(admin);
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createRouteApp(admin)).delete(`/api/workspaces/${OTHER_WS_UUID}`);
    expect(res.status).toBe(404);
  });

  it('200 on successful delete', async () => {
    const admin = makeAccountRow();
    seedRequireSessionQueries(admin);
    mockQuery.mockResolvedValueOnce({ rows: [{ id: WORKSPACE_UUID }] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createRouteApp(admin)).delete(`/api/workspaces/${WORKSPACE_UUID}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Workspace deleted successfully');
  });
});
