import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Mock pool before importing modules that use it
// vi.mock is hoisted, so mock client must be created inside the factory
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

// Valid v4 UUIDs
const WORKSPACE_UUID = 'a0000000-0000-4000-8000-000000000001';
const STUDIO_UUID = 'a0000000-0000-4000-8000-000000000099';
const CLIENT_UUID = 'b0000000-0000-4000-8000-000000000001';
const ARTIST_UUID = 'c0000000-0000-4000-8000-000000000002';
const ADMIN_UUID = 'd0000000-0000-4000-8000-000000000003';
const COMMISSION_UUID = 'e0000000-0000-4000-8000-000000000010';
const ASSET_UUID = 'f0000000-0000-4000-8000-000000000020';
const ASSET_OUTPUT_UUID = 'ff000000-0000-4000-8000-000000000021';
const SECOND_CLIENT_UUID = 'b0000000-0000-4000-8000-000000000011';

// --- Test data factories ---

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
    workspace_id: STUDIO_UUID,
    name: 'Test Artist',
    role: 'ARTIST',
  });
}

function makeAdminRow() {
  return makeAccountRow({
    id: ADMIN_UUID,
    workspace_id: STUDIO_UUID,
    name: 'Test Admin',
    role: 'ADMIN',
  });
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

function makeCommissionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: COMMISSION_UUID,
    client_workspace_id: WORKSPACE_UUID,
    studio_workspace_id: STUDIO_UUID,
    client_id: CLIENT_UUID,
    assignee_id: null,
    title: 'Cyberpunk actor needed',
    brief: { project_type: 'editorial', style: 'cyberpunk', notes: 'Looking for young female' },
    status: 'REQUESTED',
    premium_cost: null,
    submitted_at: null,
    approved_at: null,
    is_premium_unlocked: false,
    created_at: '2026-06-17T10:00:00.000Z',
    ...overrides,
  };
}

function makeCommissionAssetRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ca-00000000-0000-4000-8000-000000000001',
    commission_id: COMMISSION_UUID,
    asset_id: ASSET_UUID,
    asset_output_id: ASSET_OUTPUT_UUID,
    created_at: '2026-06-17T10:00:00.000Z',
    ...overrides,
  };
}

// --- Test setup helpers ---

/** Seed mockQuery so requireSession succeeds (consumes 1 call) */
function seedRequireSessionQueries(accountRow: Record<string, unknown>) {
  mockQuery.mockResolvedValueOnce({ rows: [accountRow] } as any);
  mockQuery.mockResolvedValueOnce({ rows: [makeWorkspaceRow()] } as any);
}

/** Mock getCommissionAssets (1 call) for status transition responses */
function mockGetCommissionAssets(rows: Record<string, unknown>[] = []) {
  mockQuery.mockResolvedValueOnce({ rows } as any);
}

/** Build express app with fake session injected on every request */
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
  app.use('/api/commissions', commissionsRouter);
  return app;
}

/** Reset mock to pristine state */
function resetMock() {
  mockQuery.mockReset();
}

// ================================================================
// POST /api/commissions
// ================================================================
describe('POST /api/commissions', () => {
  beforeEach(() => {
    resetMock();
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(createRouteApp())
      .post('/api/commissions')
      .send({ title: 'Test', brief: { style: 'cyberpunk' } });
    expect(res.status).toBe(401);
  });

  it('returns 422 when title is missing', async () => {
    const client = makeClientRow();
    seedRequireSessionQueries(client);
    const res = await request(createRouteApp(client))
      .post('/api/commissions')
      .send({ brief: { style: 'cyberpunk' } });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 when brief is missing', async () => {
    const client = makeClientRow();
    seedRequireSessionQueries(client);
    const res = await request(createRouteApp(client))
      .post('/api/commissions')
      .send({ title: 'Test' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 201 and creates commission when client submits', async () => {
    const client = makeClientRow();
    seedRequireSessionQueries(client);

    // createCommissionRequest: SELECT studio workspace
    mockQuery.mockResolvedValueOnce({ rows: [{ id: STUDIO_UUID }] } as any);
    const createdCommission = makeCommissionRow();
    mockQuery.mockResolvedValueOnce({ rows: [createdCommission] } as any);

    const res = await request(createRouteApp(client))
      .post('/api/commissions')
      .send({
        title: 'Cyberpunk actor needed',
        brief: { project_type: 'editorial', style: 'cyberpunk', notes: 'Looking for young female' },
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: COMMISSION_UUID,
      title: 'Cyberpunk actor needed',
      status: 'REQUESTED',
      client_id: CLIENT_UUID,
    });
    expect(res.body).toHaveProperty('brief');
    expect(res.body).toHaveProperty('created_at');
  });

  it('allows any role (not just CLIENT) to create a commission', async () => {
    const artist = makeArtistRow();
    seedRequireSessionQueries(artist);

    // SELECT studio workspace
    mockQuery.mockResolvedValueOnce({ rows: [{ id: STUDIO_UUID }] } as any);
    const createdCommission = makeCommissionRow({
      client_id: ARTIST_UUID,
    });
    mockQuery.mockResolvedValueOnce({ rows: [createdCommission] } as any);

    const res = await request(createRouteApp(artist))
      .post('/api/commissions')
      .send({
        title: 'Need help with look',
        brief: { style: 'fashion' },
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('REQUESTED');
  });
});

// ================================================================
// GET /api/commissions
// ================================================================
describe('GET /api/commissions', () => {
  beforeEach(() => {
    resetMock();
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(createRouteApp()).get('/api/commissions');
    expect(res.status).toBe(401);
  });

  it('client sees their own commissions', async () => {
    const client = makeClientRow();
    seedRequireSessionQueries(client);

    const commission = makeCommissionRow();
    mockQuery.mockResolvedValueOnce({ rows: [{ count: 1 }] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [commission] } as any);

    const res = await request(createRouteApp(client)).get('/api/commissions');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(COMMISSION_UUID);
  });

  it('artist sees commissions assigned to them', async () => {
    const artist = makeArtistRow();
    seedRequireSessionQueries(artist);

    const commission = makeCommissionRow({ assignee_id: ARTIST_UUID });
    mockQuery.mockResolvedValueOnce({ rows: [{ count: 1 }] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [commission] } as any);

    const res = await request(createRouteApp(artist)).get('/api/commissions');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].assignee_id).toBe(ARTIST_UUID);
  });

  it('admin sees all commissions across workspaces', async () => {
    const admin = makeAdminRow();
    seedRequireSessionQueries(admin);

    const c1 = makeCommissionRow({ id: COMMISSION_UUID, title: 'Commission 1' });
    const c2 = makeCommissionRow({
      id: 'e0000000-0000-4000-8000-000000000011',
      title: 'Commission 2',
    });
    mockQuery.mockResolvedValueOnce({ rows: [{ count: 2 }] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [c1, c2] } as any);

    const res = await request(createRouteApp(admin)).get('/api/commissions');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it('supports status filter', async () => {
    const client = makeClientRow();
    seedRequireSessionQueries(client);

    mockQuery.mockResolvedValueOnce({ rows: [{ count: 0 }] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createRouteApp(client))
      .get('/api/commissions')
      .query({ status: 'APPROVED' });
    expect(res.status).toBe(200);
  });

  it('returns pagination metadata', async () => {
    const client = makeClientRow();
    seedRequireSessionQueries(client);

    mockQuery.mockResolvedValueOnce({ rows: [{ count: 3 }] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [makeCommissionRow()] } as any);

    const res = await request(createRouteApp(client))
      .get('/api/commissions')
      .query({ page: 1, pageSize: 1 });
    expect(res.status).toBe(200);
    expect(res.body.pagination).toMatchObject({
      page: 1,
      pageSize: 1,
      totalItems: 3,
      totalPages: 3,
    });
  });
});

// ================================================================
// GET /api/commissions/:id
// ================================================================
describe('GET /api/commissions/:id', () => {
  beforeEach(() => {
    resetMock();
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(createRouteApp()).get(`/api/commissions/${COMMISSION_UUID}`);
    expect(res.status).toBe(401);
  });

  it('returns 404 when commission not found', async () => {
    const client = makeClientRow();
    seedRequireSessionQueries(client);
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createRouteApp(client)).get(`/api/commissions/${COMMISSION_UUID}`);
    expect(res.status).toBe(404);
  });

  it('returns commission with linked assets', async () => {
    const client = makeClientRow();
    seedRequireSessionQueries(client);

    const commission = makeCommissionRow({ status: 'SUBMITTED', premium_cost: 5.0 });
    const assetLink = makeCommissionAssetRow();

    mockQuery.mockResolvedValueOnce({ rows: [commission] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [assetLink] } as any);

    const res = await request(createRouteApp(client)).get(`/api/commissions/${COMMISSION_UUID}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(COMMISSION_UUID);
    expect(res.body.status).toBe('SUBMITTED');
    expect(res.body.premium_cost).toBe(5.0);
    expect(res.body.assets).toHaveLength(1);
    expect(res.body.assets[0].asset_id).toBe(ASSET_UUID);
    expect(res.body.assets[0].asset_output_id).toBe(ASSET_OUTPUT_UUID);
  });

  it('returns 404 when a different client tries to view another clients commission', async () => {
    const otherClient = makeAccountRow({
      id: SECOND_CLIENT_UUID,
      workspace_id: WORKSPACE_UUID,
      role: 'CLIENT',
    });
    seedRequireSessionQueries(otherClient);

    const commission = makeCommissionRow({ client_id: CLIENT_UUID });
    mockQuery.mockResolvedValueOnce({ rows: [commission] } as any);

    const res = await request(createRouteApp(otherClient)).get(
      `/api/commissions/${COMMISSION_UUID}`,
    );
    // Different client cannot see another client's commission
    expect(res.status).toBe(404);
  });
});

// ================================================================
// PATCH /api/commissions/:id/assign
// ================================================================
describe('PATCH /api/commissions/:id/assign', () => {
  beforeEach(() => {
    resetMock();
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(createRouteApp())
      .patch(`/api/commissions/${COMMISSION_UUID}/assign`)
      .send({ assignee_id: ARTIST_UUID });
    expect(res.status).toBe(401);
  });

  it('returns 403 when non-admin tries to assign', async () => {
    const client = makeClientRow();
    seedRequireSessionQueries(client);

    const res = await request(createRouteApp(client))
      .patch(`/api/commissions/${COMMISSION_UUID}/assign`)
      .send({ assignee_id: ARTIST_UUID });
    expect(res.status).toBe(403);
  });

  it('returns 422 when assignee_id is missing', async () => {
    const admin = makeAdminRow();
    seedRequireSessionQueries(admin);

    const res = await request(createRouteApp(admin))
      .patch(`/api/commissions/${COMMISSION_UUID}/assign`)
      .send({});
    expect(res.status).toBe(422);
  });

  it('returns 404 when commission not found', async () => {
    const admin = makeAdminRow();
    seedRequireSessionQueries(admin);
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createRouteApp(admin))
      .patch(`/api/commissions/${COMMISSION_UUID}/assign`)
      .send({ assignee_id: ARTIST_UUID });
    expect(res.status).toBe(404);
  });

  it('returns 409 when commission is not in REQUESTED status', async () => {
    const admin = makeAdminRow();
    seedRequireSessionQueries(admin);

    const commission = makeCommissionRow({ status: 'IN_PROGRESS' });
    mockQuery.mockResolvedValueOnce({ rows: [commission] } as any);

    const res = await request(createRouteApp(admin))
      .patch(`/api/commissions/${COMMISSION_UUID}/assign`)
      .send({ assignee_id: ARTIST_UUID });
    expect(res.status).toBe(409);
  });

  it('admin can assign a REQUESTED commission to an artist', async () => {
    const admin = makeAdminRow();
    seedRequireSessionQueries(admin);

    const commission = makeCommissionRow({ status: 'REQUESTED' });
    const updatedCommission = makeCommissionRow({
      status: 'ASSIGNED',
      assignee_id: ARTIST_UUID,
    });

    mockQuery.mockResolvedValueOnce({ rows: [commission] } as any); // FIND
    mockQuery.mockResolvedValueOnce({ rows: [updatedCommission] } as any); // UPDATE

    const res = await request(createRouteApp(admin))
      .patch(`/api/commissions/${COMMISSION_UUID}/assign`)
      .send({ assignee_id: ARTIST_UUID });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ASSIGNED');
    expect(res.body.assignee_id).toBe(ARTIST_UUID);
  });
});

// ================================================================
// PATCH /api/commissions/:id/status
// ================================================================
describe('PATCH /api/commissions/:id/status', () => {
  beforeEach(() => {
    resetMock();
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(createRouteApp())
      .patch(`/api/commissions/${COMMISSION_UUID}/status`)
      .send({ status: 'IN_PROGRESS' });
    expect(res.status).toBe(401);
  });

  it('returns 422 when status is missing', async () => {
    const artist = makeArtistRow();
    seedRequireSessionQueries(artist);

    const res = await request(createRouteApp(artist))
      .patch(`/api/commissions/${COMMISSION_UUID}/status`)
      .send({});
    expect(res.status).toBe(422);
  });

  it('returns 422 when invalid status value', async () => {
    const artist = makeArtistRow();
    seedRequireSessionQueries(artist);

    const res = await request(createRouteApp(artist))
      .patch(`/api/commissions/${COMMISSION_UUID}/status`)
      .send({ status: 'INVALID' });
    expect(res.status).toBe(422);
  });

  it('returns 404 when commission not found', async () => {
    const artist = makeArtistRow();
    seedRequireSessionQueries(artist);
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createRouteApp(artist))
      .patch(`/api/commissions/${COMMISSION_UUID}/status`)
      .send({ status: 'IN_PROGRESS' });
    expect(res.status).toBe(404);
  });

  // --- Status transition tests ---

  it('returns 422 for invalid transition: REQUESTED -> SUBMITTED (missing premium_cost/asset_ids)', async () => {
    const client = makeClientRow();
    seedRequireSessionQueries(client);

    const res = await request(createRouteApp(client))
      .patch(`/api/commissions/${COMMISSION_UUID}/status`)
      .send({ status: 'SUBMITTED' });
    // Route-level validation catches missing premium_cost and asset_ids
    expect(res.status).toBe(422);
  });

  it('artist can transition ASSIGNED -> IN_PROGRESS', async () => {
    const artist = makeArtistRow();
    seedRequireSessionQueries(artist);
    const commission = makeCommissionRow({ status: 'ASSIGNED', assignee_id: ARTIST_UUID });
    const updated = makeCommissionRow({ status: 'IN_PROGRESS', assignee_id: ARTIST_UUID });
    mockQuery.mockResolvedValueOnce({ rows: [commission] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [updated] } as any);
    mockGetCommissionAssets(); // getCommissionAssets in response

    const res = await request(createRouteApp(artist))
      .patch(`/api/commissions/${COMMISSION_UUID}/status`)
      .send({ status: 'IN_PROGRESS' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('IN_PROGRESS');
  });

  it('admin can transition ASSIGNED -> IN_PROGRESS', async () => {
    const admin = makeAdminRow();
    seedRequireSessionQueries(admin);
    const commission = makeCommissionRow({ status: 'ASSIGNED', assignee_id: ARTIST_UUID });
    const updated = makeCommissionRow({ status: 'IN_PROGRESS', assignee_id: ARTIST_UUID });
    mockQuery.mockResolvedValueOnce({ rows: [commission] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [updated] } as any);
    mockGetCommissionAssets();

    const res = await request(createRouteApp(admin))
      .patch(`/api/commissions/${COMMISSION_UUID}/status`)
      .send({ status: 'IN_PROGRESS' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('IN_PROGRESS');
  });

  it('returns 409 when artist tries IN_PROGRESS -> CHANGES_REQUESTED (invalid transition)', async () => {
    const artist = makeArtistRow();
    seedRequireSessionQueries(artist);
    const commission = makeCommissionRow({ status: 'IN_PROGRESS', assignee_id: ARTIST_UUID });
    mockQuery.mockResolvedValueOnce({ rows: [commission] } as any);

    const res = await request(createRouteApp(artist))
      .patch(`/api/commissions/${COMMISSION_UUID}/status`)
      .send({ status: 'CHANGES_REQUESTED' });
    // No transition from IN_PROGRESS -> CHANGES_REQUESTED exists
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
  });

  it('artist submits work: IN_PROGRESS -> SUBMITTED with premium_cost and asset_ids', async () => {
    const artist = makeArtistRow();
    seedRequireSessionQueries(artist);
    const commission = makeCommissionRow({ status: 'IN_PROGRESS', assignee_id: ARTIST_UUID });
    const updated = makeCommissionRow({
      status: 'SUBMITTED',
      assignee_id: ARTIST_UUID,
      premium_cost: 5.0,
      submitted_at: '2026-06-17T12:00:00.000Z',
    });
    mockQuery.mockResolvedValueOnce({ rows: [commission] } as any);
    // UPDATE status + premium_cost
    mockQuery.mockResolvedValueOnce({ rows: [updated] } as any);
    // Insert commission_assets (1 per asset_id)
    mockQuery.mockResolvedValueOnce({ rows: [makeCommissionAssetRow()] } as any);
    mockGetCommissionAssets();

    const res = await request(createRouteApp(artist))
      .patch(`/api/commissions/${COMMISSION_UUID}/status`)
      .send({
        status: 'SUBMITTED',
        premium_cost: 5.0,
        asset_ids: [ASSET_UUID],
      });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('SUBMITTED');
    expect(res.body.premium_cost).toBe(5.0);
  });

  it('returns 422 when SUBMITTED without premium_cost', async () => {
    const artist = makeArtistRow();
    seedRequireSessionQueries(artist);
    const commission = makeCommissionRow({ status: 'IN_PROGRESS', assignee_id: ARTIST_UUID });
    mockQuery.mockResolvedValueOnce({ rows: [commission] } as any);

    const res = await request(createRouteApp(artist))
      .patch(`/api/commissions/${COMMISSION_UUID}/status`)
      .send({ status: 'SUBMITTED', asset_ids: [ASSET_UUID] });
    expect(res.status).toBe(422);
  });

  it('returns 422 when SUBMITTED without asset_ids', async () => {
    const artist = makeArtistRow();
    seedRequireSessionQueries(artist);
    const commission = makeCommissionRow({ status: 'IN_PROGRESS', assignee_id: ARTIST_UUID });
    mockQuery.mockResolvedValueOnce({ rows: [commission] } as any);

    const res = await request(createRouteApp(artist))
      .patch(`/api/commissions/${COMMISSION_UUID}/status`)
      .send({ status: 'SUBMITTED', premium_cost: 5.0 });
    expect(res.status).toBe(422);
  });

  it('client requests changes: SUBMITTED -> CHANGES_REQUESTED', async () => {
    const client = makeClientRow();
    seedRequireSessionQueries(client);
    const commission = makeCommissionRow({
      status: 'SUBMITTED',
      client_id: CLIENT_UUID,
      premium_cost: 5.0,
    });
    const updated = makeCommissionRow({
      status: 'CHANGES_REQUESTED',
      client_id: CLIENT_UUID,
      premium_cost: 5.0,
    });
    mockQuery.mockResolvedValueOnce({ rows: [commission] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [updated] } as any);
    mockGetCommissionAssets();

    const res = await request(createRouteApp(client))
      .patch(`/api/commissions/${COMMISSION_UUID}/status`)
      .send({ status: 'CHANGES_REQUESTED' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CHANGES_REQUESTED');
  });

  it('client approves: SUBMITTED -> APPROVED', async () => {
    const client = makeClientRow();
    seedRequireSessionQueries(client);
    const commission = makeCommissionRow({
      status: 'SUBMITTED',
      client_id: CLIENT_UUID,
      premium_cost: 5.0,
    });
    const updated = makeCommissionRow({
      status: 'APPROVED',
      client_id: CLIENT_UUID,
      premium_cost: 5.0,
      submitted_at: '2026-06-17T12:00:00.000Z',
      approved_at: '2026-06-17T13:00:00.000Z',
    });
    mockQuery.mockResolvedValueOnce({ rows: [commission] } as any);
    // Transaction: BEGIN + SELECT wallet FOR UPDATE + UPDATE wallet + INSERT ledger + SELECT assets + UPDATE assets + COMMIT
    const mockPoolClient = await poolModule.getClient();
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
    mockPoolClient.query.mockResolvedValueOnce({
      rows: [
        {
          id: 'w-00000000-0000-4000-8000-000000000001',
          workspace_id: WORKSPACE_UUID,
          account_id: CLIENT_UUID,
          balance_credits: 10.0,
          updated_at: '2026-06-17T10:00:00.000Z',
        },
      ],
    }); // SELECT wallet FOR UPDATE
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // UPDATE wallet
    mockPoolClient.query.mockResolvedValueOnce({
      rows: [{ id: 'l-00000000-0000-4000-8000-000000000001' }],
    }); // INSERT ledger
    mockPoolClient.query.mockResolvedValueOnce({ rows: [{ asset_id: ASSET_UUID }] }); // SELECT commission_assets
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // UPDATE assets ownership
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // COMMIT
    mockQuery.mockResolvedValueOnce({ rows: [] } as any); // UPDATE is_premium_unlocked = TRUE
    // updateCommissionStatus
    mockQuery.mockResolvedValueOnce({ rows: [updated] } as any);
    // getCommissionAssets
    mockQuery.mockResolvedValueOnce({ rows: [makeCommissionAssetRow()] } as any);
    // Update commission status
    mockQuery.mockResolvedValueOnce({ rows: [updated] } as any);
    // getCommissionAssets (for response)
    mockGetCommissionAssets();

    const res = await request(createRouteApp(client))
      .patch(`/api/commissions/${COMMISSION_UUID}/status`)
      .send({ status: 'APPROVED' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('APPROVED');
    expect(res.body.approved_at).toBeTruthy();
  });

  it('returns 402 when client has insufficient balance to approve', async () => {
    const client = makeClientRow();
    seedRequireSessionQueries(client);
    const commission = makeCommissionRow({
      status: 'SUBMITTED',
      client_id: CLIENT_UUID,
      premium_cost: 5.0,
    });
    mockQuery.mockResolvedValueOnce({ rows: [commission] } as any);
    // Transaction: BEGIN + SELECT wallet FOR UPDATE (insufficient) + ROLLBACK
    const mockPoolClient = await poolModule.getClient();
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
    mockPoolClient.query.mockResolvedValueOnce({
      rows: [
        {
          id: 'w-00000000-0000-4000-8000-000000000001',
          workspace_id: WORKSPACE_UUID,
          account_id: CLIENT_UUID,
          balance_credits: 2.0,
          updated_at: '2026-06-17T10:00:00.000Z',
        },
      ],
    }); // SELECT wallet FOR UPDATE
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    const res = await request(createRouteApp(client))
      .patch(`/api/commissions/${COMMISSION_UUID}/status`)
      .send({ status: 'APPROVED' });
    expect(res.status).toBe(402);
    expect(res.body.error.code).toBe('INSUFFICIENT_CREDITS');
  });

  it('returns 402 when client has no wallet to approve', async () => {
    const client = makeClientRow();
    seedRequireSessionQueries(client);
    const commission = makeCommissionRow({
      status: 'SUBMITTED',
      client_id: CLIENT_UUID,
      premium_cost: 5.0,
    });
    mockQuery.mockResolvedValueOnce({ rows: [commission] } as any);
    // Transaction: BEGIN + SELECT wallet (empty) + ROLLBACK
    const mockPoolClient = await poolModule.getClient();
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // SELECT wallet — no rows
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    const res = await request(createRouteApp(client))
      .patch(`/api/commissions/${COMMISSION_UUID}/status`)
      .send({ status: 'APPROVED' });
    expect(res.status).toBe(402);
    expect(res.body.error.code).toBe('INSUFFICIENT_CREDITS');
  });

  it('returns 403 when non-client tries to approve a commission they do not own', async () => {
    const otherClient = makeAccountRow({
      id: SECOND_CLIENT_UUID,
      workspace_id: WORKSPACE_UUID,
      role: 'CLIENT',
    });
    seedRequireSessionQueries(otherClient);
    const commission = makeCommissionRow({ status: 'SUBMITTED', client_id: CLIENT_UUID });
    mockQuery.mockResolvedValueOnce({ rows: [commission] } as any);

    const res = await request(createRouteApp(otherClient))
      .patch(`/api/commissions/${COMMISSION_UUID}/status`)
      .send({ status: 'APPROVED' });
    expect(res.status).toBe(403);
  });

  it('artist can cancel their assigned commission from IN_PROGRESS', async () => {
    const artist = makeArtistRow();
    seedRequireSessionQueries(artist);
    const commission = makeCommissionRow({ status: 'IN_PROGRESS', assignee_id: ARTIST_UUID });
    const updated = makeCommissionRow({ status: 'CANCELLED', assignee_id: ARTIST_UUID });
    mockQuery.mockResolvedValueOnce({ rows: [commission] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [updated] } as any);
    mockGetCommissionAssets();

    const res = await request(createRouteApp(artist))
      .patch(`/api/commissions/${COMMISSION_UUID}/status`)
      .send({ status: 'CANCELLED' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');
  });

  it('client can cancel their own commission from REQUESTED', async () => {
    const client = makeClientRow();
    seedRequireSessionQueries(client);
    const commission = makeCommissionRow({ status: 'REQUESTED', client_id: CLIENT_UUID });
    const updated = makeCommissionRow({ status: 'CANCELLED', client_id: CLIENT_UUID });
    mockQuery.mockResolvedValueOnce({ rows: [commission] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [updated] } as any);
    mockGetCommissionAssets();

    const res = await request(createRouteApp(client))
      .patch(`/api/commissions/${COMMISSION_UUID}/status`)
      .send({ status: 'CANCELLED' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');
  });

  it('admin can cancel any commission', async () => {
    const admin = makeAdminRow();
    seedRequireSessionQueries(admin);
    const commission = makeCommissionRow({ status: 'SUBMITTED' });
    const updated = makeCommissionRow({ status: 'CANCELLED' });
    mockQuery.mockResolvedValueOnce({ rows: [commission] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [updated] } as any);
    mockGetCommissionAssets();

    const res = await request(createRouteApp(admin))
      .patch(`/api/commissions/${COMMISSION_UUID}/status`)
      .send({ status: 'CANCELLED' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');
  });

  it('returns 403 when artist tries to transition a commission assigned to another artist', async () => {
    const otherArtist = makeAccountRow({
      id: 'c0000000-0000-4000-8000-000000000099',
      workspace_id: STUDIO_UUID,
      role: 'ARTIST',
    });
    seedRequireSessionQueries(otherArtist);
    const commission = makeCommissionRow({ status: 'ASSIGNED', assignee_id: ARTIST_UUID });
    mockQuery.mockResolvedValueOnce({ rows: [commission] } as any);

    const res = await request(createRouteApp(otherArtist))
      .patch(`/api/commissions/${COMMISSION_UUID}/status`)
      .send({ status: 'IN_PROGRESS' });
    expect(res.status).toBe(403);
  });
});

// ================================================================
// Full flow integration-like test
// ================================================================
describe('Full commission flow', () => {
  beforeEach(() => {
    resetMock();
  });

  it('complete lifecycle: submit -> assign -> in_progress -> submit -> changes -> in_progress -> submit -> approve', async () => {
    const client = makeClientRow();
    const admin = makeAdminRow();
    const artist = makeArtistRow();

    // --- 1. Create the commission (skip POST, verify base state) ---
    // We test the status transitions, not the POST

    // --- 2. Admin assigns ---
    seedRequireSessionQueries(admin);
    const reqCommission = makeCommissionRow({ status: 'REQUESTED' });
    const assignedCommission = makeCommissionRow({ status: 'ASSIGNED', assignee_id: ARTIST_UUID });
    mockQuery.mockResolvedValueOnce({ rows: [reqCommission] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [assignedCommission] } as any);
    const res2 = await request(createRouteApp(admin))
      .patch(`/api/commissions/${COMMISSION_UUID}/assign`)
      .send({ assignee_id: ARTIST_UUID });
    expect(res2.status).toBe(200);
    expect(res2.body.status).toBe('ASSIGNED');

    // --- 3. Artist starts work ---
    seedRequireSessionQueries(artist);
    mockQuery.mockResolvedValueOnce({
      rows: [makeCommissionRow({ status: 'ASSIGNED', assignee_id: ARTIST_UUID })],
    } as any);
    mockQuery.mockResolvedValueOnce({
      rows: [makeCommissionRow({ status: 'IN_PROGRESS', assignee_id: ARTIST_UUID })],
    } as any);
    mockGetCommissionAssets();
    const res3 = await request(createRouteApp(artist))
      .patch(`/api/commissions/${COMMISSION_UUID}/status`)
      .send({ status: 'IN_PROGRESS' });
    expect(res3.status).toBe(200);
    expect(res3.body.status).toBe('IN_PROGRESS');

    // --- 4. Artist submits ---
    seedRequireSessionQueries(artist);
    mockQuery.mockResolvedValueOnce({
      rows: [makeCommissionRow({ status: 'IN_PROGRESS', assignee_id: ARTIST_UUID })],
    } as any);
    mockQuery.mockResolvedValueOnce({
      rows: [
        makeCommissionRow({
          status: 'SUBMITTED',
          assignee_id: ARTIST_UUID,
          premium_cost: 5.0,
          submitted_at: '2026-06-17T12:00:00.000Z',
        }),
      ],
    } as any);
    mockQuery.mockResolvedValueOnce({ rows: [makeCommissionAssetRow()] } as any); // link
    mockGetCommissionAssets();
    const res4 = await request(createRouteApp(artist))
      .patch(`/api/commissions/${COMMISSION_UUID}/status`)
      .send({ status: 'SUBMITTED', premium_cost: 5.0, asset_ids: [ASSET_UUID] });
    expect(res4.status).toBe(200);
    expect(res4.body.status).toBe('SUBMITTED');

    // --- 5. Client requests changes ---
    seedRequireSessionQueries(client);
    mockQuery.mockResolvedValueOnce({
      rows: [makeCommissionRow({ status: 'SUBMITTED', client_id: CLIENT_UUID, premium_cost: 5.0 })],
    } as any);
    mockQuery.mockResolvedValueOnce({
      rows: [
        makeCommissionRow({
          status: 'CHANGES_REQUESTED',
          client_id: CLIENT_UUID,
          premium_cost: 5.0,
        }),
      ],
    } as any);
    mockGetCommissionAssets();
    const res5 = await request(createRouteApp(client))
      .patch(`/api/commissions/${COMMISSION_UUID}/status`)
      .send({ status: 'CHANGES_REQUESTED' });
    expect(res5.status).toBe(200);
    expect(res5.body.status).toBe('CHANGES_REQUESTED');

    // --- 6. Artist resumes ---
    seedRequireSessionQueries(artist);
    mockQuery.mockResolvedValueOnce({
      rows: [makeCommissionRow({ status: 'CHANGES_REQUESTED', assignee_id: ARTIST_UUID })],
    } as any);
    mockQuery.mockResolvedValueOnce({
      rows: [makeCommissionRow({ status: 'IN_PROGRESS', assignee_id: ARTIST_UUID })],
    } as any);
    mockGetCommissionAssets();
    const res6 = await request(createRouteApp(artist))
      .patch(`/api/commissions/${COMMISSION_UUID}/status`)
      .send({ status: 'IN_PROGRESS' });
    expect(res6.status).toBe(200);
    expect(res6.body.status).toBe('IN_PROGRESS');

    // --- 7. Artist submits again ---
    seedRequireSessionQueries(artist);
    mockQuery.mockResolvedValueOnce({
      rows: [makeCommissionRow({ status: 'IN_PROGRESS', assignee_id: ARTIST_UUID })],
    } as any);
    mockQuery.mockResolvedValueOnce({
      rows: [
        makeCommissionRow({
          status: 'SUBMITTED',
          assignee_id: ARTIST_UUID,
          premium_cost: 5.0,
          submitted_at: '2026-06-17T13:00:00.000Z',
        }),
      ],
    } as any);
    mockQuery.mockResolvedValueOnce({ rows: [makeCommissionAssetRow()] } as any); // link
    mockGetCommissionAssets();
    const res7 = await request(createRouteApp(artist))
      .patch(`/api/commissions/${COMMISSION_UUID}/status`)
      .send({ status: 'SUBMITTED', premium_cost: 5.0, asset_ids: [ASSET_UUID] });
    expect(res7.status).toBe(200);
    expect(res7.body.status).toBe('SUBMITTED');

    // --- 8. Client approves ---
    seedRequireSessionQueries(client);
    mockQuery.mockResolvedValueOnce({
      rows: [makeCommissionRow({ status: 'SUBMITTED', client_id: CLIENT_UUID, premium_cost: 5.0 })],
    } as any);
    // Transaction: BEGIN + SELECT wallet FOR UPDATE + UPDATE wallet + INSERT ledger + SELECT assets + UPDATE assets + COMMIT
    const mockPoolClient = await poolModule.getClient();
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
    mockPoolClient.query.mockResolvedValueOnce({
      rows: [
        {
          id: 'w-00000000-0000-4000-8000-000000000001',
          workspace_id: WORKSPACE_UUID,
          account_id: CLIENT_UUID,
          balance_credits: 10.0,
          updated_at: '2026-06-17T10:00:00.000Z',
        },
      ],
    } as any); // SELECT wallet FOR UPDATE
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // UPDATE wallet
    mockPoolClient.query.mockResolvedValueOnce({
      rows: [{ id: 'l-00000000-0000-4000-8000-000000000001' }],
    }); // INSERT ledger
    mockPoolClient.query.mockResolvedValueOnce({ rows: [{ asset_id: ASSET_UUID }] }); // SELECT commission_assets
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // UPDATE assets ownership
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // COMMIT
    mockQuery.mockResolvedValueOnce({ rows: [] } as any); // UPDATE is_premium_unlocked = TRUE
    // Update commission status
    mockQuery.mockResolvedValueOnce({
      rows: [
        makeCommissionRow({
          status: 'APPROVED',
          client_id: CLIENT_UUID,
          premium_cost: 5.0,
          submitted_at: '2026-06-17T13:00:00.000Z',
          approved_at: '2026-06-17T14:00:00.000Z',
        }),
      ],
    } as any);
    // getCommissionAssets (for response)
    mockGetCommissionAssets();
    const res8 = await request(createRouteApp(client))
      .patch(`/api/commissions/${COMMISSION_UUID}/status`)
      .send({ status: 'APPROVED' });
    expect(res8.status).toBe(200);
    expect(res8.body.status).toBe('APPROVED');
    expect(res8.body.approved_at).toBeTruthy();
  });
});

// ================================================================
// Premium unlock idempotency
// ================================================================
describe('Premium unlock idempotency', () => {
  beforeEach(() => {
    resetMock();
  });

  it('does not double-charge wallet on double APPROVED transition', async () => {
    const client = makeClientRow();

    // --- First APPROVED call: should charge wallet ---
    seedRequireSessionQueries(client);
    const submittedCommission = makeCommissionRow({
      status: 'SUBMITTED',
      client_id: CLIENT_UUID,
      premium_cost: 5.0,
    });
    mockQuery.mockResolvedValueOnce({ rows: [submittedCommission] } as any);
    // Transaction: BEGIN + SELECT wallet FOR UPDATE + UPDATE wallet + INSERT ledger + SELECT assets + UPDATE assets + COMMIT
    const mockPoolClient = await poolModule.getClient();
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
    mockPoolClient.query.mockResolvedValueOnce({
      rows: [
        {
          id: 'w-00000000-0000-4000-8000-000000000001',
          workspace_id: WORKSPACE_UUID,
          account_id: CLIENT_UUID,
          balance_credits: 10.0,
          updated_at: '2026-06-17T10:00:00.000Z',
        },
      ],
    } as any); // SELECT wallet FOR UPDATE
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // UPDATE wallet
    mockPoolClient.query.mockResolvedValueOnce({
      rows: [{ id: 'l-00000000-0000-4000-8000-000000000001' }],
    } as any); // INSERT ledger
    mockPoolClient.query.mockResolvedValueOnce({ rows: [{ asset_id: ASSET_UUID }] } as any); // SELECT commission_assets
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] } as any); // UPDATE assets ownership
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] } as any); // COMMIT
    mockQuery.mockResolvedValueOnce({ rows: [] } as any); // UPDATE is_premium_unlocked = TRUE
    const approvedCommission = makeCommissionRow({
      status: 'APPROVED',
      client_id: CLIENT_UUID,
      premium_cost: 5.0,
      submitted_at: '2026-06-17T12:00:00.000Z',
      approved_at: '2026-06-17T13:00:00.000Z',
      is_premium_unlocked: true,
    });
    mockQuery.mockResolvedValueOnce({ rows: [approvedCommission] } as any); // updateCommissionStatus
    mockQuery.mockResolvedValueOnce({ rows: [makeCommissionAssetRow()] } as any); // getCommissionAssets

    const res1 = await request(createRouteApp(client))
      .patch(`/api/commissions/${COMMISSION_UUID}/status`)
      .send({ status: 'APPROVED' });
    expect(res1.status).toBe(200);
    expect(res1.body.status).toBe('APPROVED');

    // Record wallet UPDATE count after first call
    const walletUpdateCountAfterFirst = mockPoolClient.query.mock.calls.filter(
      (call: unknown[]) => typeof call[0] === 'string' && call[0].includes('UPDATE wallets'),
    ).length;

    // --- Second APPROVED call: should NOT charge wallet again ---
    seedRequireSessionQueries(client);
    // Commission is still SUBMITTED (two rapid-fire approval attempts)
    // The first call already set is_premium_unlocked = true in the DB
    const stillSubmittedCommission = makeCommissionRow({
      status: 'SUBMITTED',
      client_id: CLIENT_UUID,
      premium_cost: 5.0,
      submitted_at: '2026-06-17T12:00:00.000Z',
      is_premium_unlocked: true,
    });
    mockQuery.mockResolvedValueOnce({ rows: [stillSubmittedCommission] } as any);
    // updateCommissionStatus returns APPROVED (no wallet transaction expected since premium already unlocked)
    const approvedSecondCall = makeCommissionRow({
      status: 'APPROVED',
      client_id: CLIENT_UUID,
      premium_cost: 5.0,
      submitted_at: '2026-06-17T12:00:00.000Z',
      approved_at: '2026-06-17T13:00:00.000Z',
      is_premium_unlocked: true,
    });
    mockQuery.mockResolvedValueOnce({ rows: [approvedSecondCall] } as any);
    mockGetCommissionAssets();

    const res2 = await request(createRouteApp(client))
      .patch(`/api/commissions/${COMMISSION_UUID}/status`)
      .send({ status: 'APPROVED' });
    expect(res2.status).toBe(200);
    expect(res2.body.status).toBe('APPROVED');

    // Verify no additional wallet UPDATE happened on second call
    const walletUpdateCountAfterSecond = mockPoolClient.query.mock.calls.filter(
      (call: unknown[]) => typeof call[0] === 'string' && call[0].includes('UPDATE wallets'),
    ).length;
    expect(walletUpdateCountAfterSecond).toBe(walletUpdateCountAfterFirst);
  });
});
