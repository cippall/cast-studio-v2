import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Mock pool — vi.mock is hoisted, so mock client must be created inside the factory
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
import marketplaceRouter from '../src/routes/marketplace.js';
import adminMarketplaceRouter from '../src/routes/admin/marketplace.js';

const mockQuery = vi.mocked(poolModule.query);

// Valid v4 UUIDs
const WORKSPACE_UUID = 'a0000000-0000-4000-8000-000000000001';
const STUDIO_UUID = 'a0000000-0000-4000-8000-000000000099';
const ARTIST_UUID = 'c0000000-0000-4000-8000-000000000002';
const ADMIN_UUID = 'd0000000-0000-4000-8000-000000000003';
const ASSET_UUID = 'f0000000-0000-4000-8000-000000000020';
const ASSET_OUTPUT_UUID = 'ff000000-0000-4000-8000-000000000021';
const LISTING_UUID = '10000000-0000-4000-8000-000000000001';

// --- Test data factories ---

function makeArtistRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ARTIST_UUID,
    workspace_id: STUDIO_UUID,
    name: 'Test Artist',
    email: 'artist@studio.com',
    role: 'ARTIST',
    is_api_able: false,
    password_hash: '$2a$10$hashedpassword',
    created_at: '2026-06-17T10:00:00.000Z',
    ...overrides,
  };
}

function makeAdminRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ADMIN_UUID,
    workspace_id: STUDIO_UUID,
    name: 'Test Admin',
    email: 'admin@studio.com',
    role: 'ADMIN',
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
    workspace_type: 'STUDIO',
    created_at: '2026-06-17T10:00:00.000Z',
    ...overrides,
  };
}

function makeAssetRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ASSET_UUID,
    workspace_id: STUDIO_UUID,
    creator_id: ARTIST_UUID,
    client_id: null,
    asset_type: 'ACTOR',
    name: 'Cyberpunk Woman',
    seed: 12345,
    prompt_recipe: { identity: { age: 25, gender: 'female' } },
    marketplace_status: null,
    is_marketplace_frozen: false,
    source_asset_id: null,
    source_type: 'ORIGINAL',
    deleted_at: null,
    sold_at: null,
    created_at: '2026-06-17T10:00:00.000Z',
    ...overrides,
  };
}

function makeOutputRow(
  layoutType: string,
  status: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id: ASSET_OUTPUT_UUID,
    asset_id: ASSET_UUID,
    layout_type: layoutType,
    model: 'flux-pro',
    image_url: status === 'SUCCESS' ? 'https://fal.ai/image.png' : null,
    local_backup_url: null,
    cost_credits: 0.05,
    status,
    version: 1,
    is_obsolete: false,
    obsolete_reason: null,
    error_message: null,
    generation_params: null,
    reference_images: null,
    source_asset_outputs: null,
    created_at: '2026-06-17T10:00:00.000Z',
    ...overrides,
  };
}

// --- Test setup helpers ---

function seedRequireSessionQueries(accountRow: Record<string, unknown>) {
  mockQuery.mockResolvedValueOnce({ rows: [accountRow] } as any);
  mockQuery.mockResolvedValueOnce({
    rows: [makeWorkspaceRow({ id: accountRow.workspace_id })],
  } as any);
}

function createMarketplaceApp(accountOverride?: Record<string, unknown>) {
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
  app.use('/api/marketplace', marketplaceRouter);
  return app;
}

function createAdminMarketplaceApp(accountOverride?: Record<string, unknown>) {
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
  app.use('/api/admin/marketplace', adminMarketplaceRouter);
  return app;
}

function resetMock() {
  mockQuery.mockReset();
}

// ================================================================
// POST /api/marketplace/submit
// ================================================================
describe('POST /api/marketplace/submit', () => {
  beforeEach(() => {
    resetMock();
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(createMarketplaceApp())
      .post('/api/marketplace/submit')
      .send({ asset_id: ASSET_UUID });
    expect(res.status).toBe(401);
  });

  it('returns 422 when asset_id is missing', async () => {
    const artist = makeArtistRow();
    seedRequireSessionQueries(artist);
    const res = await request(createMarketplaceApp(artist))
      .post('/api/marketplace/submit')
      .send({});
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 when asset_id is not a valid UUID', async () => {
    const artist = makeArtistRow();
    seedRequireSessionQueries(artist);
    const res = await request(createMarketplaceApp(artist))
      .post('/api/marketplace/submit')
      .send({ asset_id: 'not-a-uuid' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 when asset does not exist', async () => {
    const artist = makeArtistRow();
    seedRequireSessionQueries(artist);

    // findAssetById returns null
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createMarketplaceApp(artist))
      .post('/api/marketplace/submit')
      .send({ asset_id: ASSET_UUID });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 403 when artist tries to submit another artist asset', async () => {
    const artist = makeArtistRow();
    seedRequireSessionQueries(artist);

    // Transaction: BEGIN + SELECT FOR UPDATE
    const mockPoolClient = await poolModule.getClient();
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
    mockPoolClient.query.mockResolvedValueOnce({
      rows: [makeAssetRow({ creator_id: 'e0000000-0000-4000-8000-000000000099' })],
    } as any); // SELECT FOR UPDATE

    const res = await request(createMarketplaceApp(artist))
      .post('/api/marketplace/submit')
      .send({ asset_id: ASSET_UUID });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 409 when asset already has pending submission', async () => {
    const artist = makeArtistRow();
    seedRequireSessionQueries(artist);

    // Transaction: BEGIN + SELECT FOR UPDATE
    const mockPoolClient = await poolModule.getClient();
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
    mockPoolClient.query.mockResolvedValueOnce({
      rows: [makeAssetRow({ marketplace_status: 'MARKETPLACE_PENDING' })],
    } as any); // SELECT FOR UPDATE
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    const res = await request(createMarketplaceApp(artist))
      .post('/api/marketplace/submit')
      .send({ asset_id: ASSET_UUID });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
    expect(res.body.error.message).toContain('already has an active marketplace submission');
  });

  it('returns 409 when asset is already approved', async () => {
    const artist = makeArtistRow();
    seedRequireSessionQueries(artist);

    // Transaction: BEGIN + SELECT FOR UPDATE
    const mockPoolClient = await poolModule.getClient();
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
    mockPoolClient.query.mockResolvedValueOnce({
      rows: [makeAssetRow({ marketplace_status: 'MARKETPLACE_APPROVED' })],
    } as any); // SELECT FOR UPDATE
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    const res = await request(createMarketplaceApp(artist))
      .post('/api/marketplace/submit')
      .send({ asset_id: ASSET_UUID });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
    expect(res.body.error.message).toContain('already listed');
  });

  it('returns 409 when actor is missing required outputs', async () => {
    const artist = makeArtistRow();
    seedRequireSessionQueries(artist);

    // Transaction: BEGIN + SELECT FOR UPDATE
    const mockPoolClient = await poolModule.getClient();
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
    mockPoolClient.query.mockResolvedValueOnce({ rows: [makeAssetRow()] } as any); // SELECT FOR UPDATE
    mockQuery.mockResolvedValueOnce({
      rows: [makeOutputRow('headshot', 'SUCCESS'), makeOutputRow('fullshot', 'PENDING')],
    } as any); // getAssetOutputs (uses module-level query)
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    const res = await request(createMarketplaceApp(artist))
      .post('/api/marketplace/submit')
      .send({ asset_id: ASSET_UUID });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
    expect(res.body.error.message).toContain('missing required outputs');
    expect(res.body.error.details.missing).toContain('fullshot');
    expect(res.body.error.details.missing).toContain('expressions_3x4');
    expect(res.body.error.details.missing).toContain('character_sheet');
    expect(res.body.error.details.missing).toContain('editorial');
  });

  it('returns 201 when actor has all required outputs', async () => {
    const artist = makeArtistRow();
    seedRequireSessionQueries(artist);

    // Transaction: BEGIN + SELECT FOR UPDATE
    const mockPoolClient = await poolModule.getClient();
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
    mockPoolClient.query.mockResolvedValueOnce({ rows: [makeAssetRow()] } as any); // SELECT FOR UPDATE

    // All 5 required outputs are SUCCESS
    const outputs = [
      makeOutputRow('headshot', 'SUCCESS'),
      makeOutputRow('fullshot', 'SUCCESS'),
      makeOutputRow('expressions_3x4', 'SUCCESS'),
      makeOutputRow('character_sheet', 'SUCCESS'),
      makeOutputRow('editorial', 'SUCCESS'),
    ];
    mockQuery.mockResolvedValueOnce({ rows: outputs } as any); // getAssetOutputs (module-level query)

    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // UPDATE marketplace_status
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // COMMIT

    const res = await request(createMarketplaceApp(artist))
      .post('/api/marketplace/submit')
      .send({ asset_id: ASSET_UUID });
    expect(res.status).toBe(201);
    expect(res.body.asset_id).toBe(ASSET_UUID);
    expect(res.body.marketplace_status).toBe('MARKETPLACE_PENDING');
    expect(res.body.asset_type).toBe('ACTOR');
  });
});

// ================================================================
// GET /api/marketplace/submissions
// ================================================================
describe('GET /api/marketplace/submissions', () => {
  beforeEach(() => {
    resetMock();
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(createMarketplaceApp()).get('/api/marketplace/submissions');
    expect(res.status).toBe(401);
  });

  it('returns paginated submissions for artist', async () => {
    const artist = makeArtistRow();
    seedRequireSessionQueries(artist);

    mockQuery.mockResolvedValueOnce({ rows: [{ count: 1 }] } as any);
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          asset_id: ASSET_UUID,
          asset_name: 'Cyberpunk Woman',
          asset_type: 'ACTOR',
          creator_id: ARTIST_UUID,
          marketplace_status: 'MARKETPLACE_PENDING',
          submitted_at: '2026-06-17T10:00:00.000Z',
        },
      ],
    } as any);

    const res = await request(createMarketplaceApp(artist)).get('/api/marketplace/submissions');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].asset_id).toBe(ASSET_UUID);
    expect(res.body.data[0].marketplace_status).toBe('MARKETPLACE_PENDING');
    expect(res.body.pagination).toEqual({
      page: 1,
      pageSize: 20,
      totalItems: 1,
      totalPages: 1,
    });
  });

  it('filters by status when provided', async () => {
    const artist = makeArtistRow();
    seedRequireSessionQueries(artist);

    mockQuery.mockResolvedValueOnce({ rows: [{ count: 0 }] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createMarketplaceApp(artist)).get(
      '/api/marketplace/submissions?status=MARKETPLACE_PENDING',
    );
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });
});

// ================================================================
// GET /api/admin/marketplace/submissions
// ================================================================
describe('GET /api/admin/marketplace/submissions', () => {
  beforeEach(() => {
    resetMock();
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(createAdminMarketplaceApp()).get(
      '/api/admin/marketplace/submissions',
    );
    expect(res.status).toBe(401);
  });

  it('returns 403 when non-admin tries to access', async () => {
    const artist = makeArtistRow();
    seedRequireSessionQueries(artist);

    const res = await request(createAdminMarketplaceApp(artist)).get(
      '/api/admin/marketplace/submissions',
    );
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns paginated submissions for admin', async () => {
    const admin = makeAdminRow();
    seedRequireSessionQueries(admin);

    mockQuery.mockResolvedValueOnce({ rows: [{ count: 1 }] } as any);
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          asset_id: ASSET_UUID,
          asset_name: 'Cyberpunk Woman',
          asset_type: 'ACTOR',
          creator_id: ARTIST_UUID,
          creator_name: 'Test Artist',
          marketplace_status: 'MARKETPLACE_PENDING',
          submitted_at: '2026-06-17T10:00:00.000Z',
        },
      ],
    } as any);
    // getAssetOutputs for the submission detail
    mockQuery.mockResolvedValueOnce({
      rows: [
        makeOutputRow('headshot', 'SUCCESS'),
        makeOutputRow('fullshot', 'SUCCESS'),
        makeOutputRow('expressions_3x4', 'SUCCESS'),
        makeOutputRow('character_sheet', 'SUCCESS'),
        makeOutputRow('editorial', 'SUCCESS'),
      ],
    } as any);

    const res = await request(createAdminMarketplaceApp(admin)).get(
      '/api/admin/marketplace/submissions',
    );
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].asset_id).toBe(ASSET_UUID);
    expect(res.body.data[0].creator_name).toBe('Test Artist');
    expect(res.body.data[0].outputs.headshot.status).toBe('SUCCESS');
    expect(res.body.pagination.totalItems).toBe(1);
  });

  it('filters by status when provided', async () => {
    const admin = makeAdminRow();
    seedRequireSessionQueries(admin);

    mockQuery.mockResolvedValueOnce({ rows: [{ count: 0 }] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createAdminMarketplaceApp(admin)).get(
      '/api/admin/marketplace/submissions?status=MARKETPLACE_PENDING',
    );
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });
});

// ================================================================
// POST /api/admin/marketplace/submissions/:assetId/approve
// ================================================================
describe('POST /api/admin/marketplace/submissions/:assetId/approve', () => {
  beforeEach(() => {
    resetMock();
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(createAdminMarketplaceApp())
      .post(`/api/admin/marketplace/submissions/${ASSET_UUID}/approve`)
      .send({ price_credits: 10.0 });
    expect(res.status).toBe(401);
  });

  it('returns 403 when non-admin tries to approve', async () => {
    const artist = makeArtistRow();
    seedRequireSessionQueries(artist);

    const res = await request(createAdminMarketplaceApp(artist))
      .post(`/api/admin/marketplace/submissions/${ASSET_UUID}/approve`)
      .send({ price_credits: 10.0 });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 422 when price_credits is missing', async () => {
    const admin = makeAdminRow();
    seedRequireSessionQueries(admin);

    const res = await request(createAdminMarketplaceApp(admin))
      .post(`/api/admin/marketplace/submissions/${ASSET_UUID}/approve`)
      .send({});
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 when price_credits is not positive', async () => {
    const admin = makeAdminRow();
    seedRequireSessionQueries(admin);

    const res = await request(createAdminMarketplaceApp(admin))
      .post(`/api/admin/marketplace/submissions/${ASSET_UUID}/approve`)
      .send({ price_credits: -5 });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 when submission is not in pending status', async () => {
    const admin = makeAdminRow();
    seedRequireSessionQueries(admin);

    // SELECT returns no rows (not pending)
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createAdminMarketplaceApp(admin))
      .post(`/api/admin/marketplace/submissions/${ASSET_UUID}/approve`)
      .send({ price_credits: 10.0 });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 200 and creates listing on approve', async () => {
    const admin = makeAdminRow();
    seedRequireSessionQueries(admin);

    // Transaction: BEGIN + SELECT FOR UPDATE
    const mockPoolClient = await poolModule.getClient();
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
    mockPoolClient.query.mockResolvedValueOnce({
      rows: [makeAssetRow({ marketplace_status: 'MARKETPLACE_PENDING' })],
    } as any); // SELECT FOR UPDATE
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // UPDATE assets
    mockPoolClient.query.mockResolvedValueOnce({ rows: [{ id: LISTING_UUID }] } as any); // INSERT listing
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // COMMIT

    // Notification: dispatchNotification -> notificationRepo.createNotification (1 query)
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createAdminMarketplaceApp(admin))
      .post(`/api/admin/marketplace/submissions/${ASSET_UUID}/approve`)
      .send({ price_credits: 10.0 });
    expect(res.status).toBe(200);
    expect(res.body.asset_id).toBe(ASSET_UUID);
    expect(res.body.marketplace_status).toBe('MARKETPLACE_APPROVED');
    expect(res.body.listing_id).toBe(LISTING_UUID);
    expect(res.body.price_credits).toBe(10.0);
  });
});

// ================================================================
// POST /api/admin/marketplace/submissions/:assetId/reject
// ================================================================
describe('POST /api/admin/marketplace/submissions/:assetId/reject', () => {
  beforeEach(() => {
    resetMock();
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(createAdminMarketplaceApp())
      .post(`/api/admin/marketplace/submissions/${ASSET_UUID}/reject`)
      .send({});
    expect(res.status).toBe(401);
  });

  it('returns 403 when non-admin tries to reject', async () => {
    const artist = makeArtistRow();
    seedRequireSessionQueries(artist);

    const res = await request(createAdminMarketplaceApp(artist))
      .post(`/api/admin/marketplace/submissions/${ASSET_UUID}/reject`)
      .send({});
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 404 when submission is not in pending status', async () => {
    const admin = makeAdminRow();
    seedRequireSessionQueries(admin);

    // SELECT returns no rows (not pending)
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createAdminMarketplaceApp(admin))
      .post(`/api/admin/marketplace/submissions/${ASSET_UUID}/reject`)
      .send({});
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 200 and sets REJECTED on reject', async () => {
    const admin = makeAdminRow();
    seedRequireSessionQueries(admin);

    // Transaction: BEGIN + SELECT FOR UPDATE + UPDATE + COMMIT
    const mockPoolClient = await poolModule.getClient();
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
    mockPoolClient.query.mockResolvedValueOnce({
      rows: [makeAssetRow({ marketplace_status: 'MARKETPLACE_PENDING' })],
    } as any); // SELECT FOR UPDATE
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // UPDATE assets
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // COMMIT

    // Notification: dispatchNotification -> notificationRepo.createNotification (1 query)
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createAdminMarketplaceApp(admin))
      .post(`/api/admin/marketplace/submissions/${ASSET_UUID}/reject`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.asset_id).toBe(ASSET_UUID);
    expect(res.body.marketplace_status).toBe('MARKETPLACE_REJECTED');
  });
});

// ================================================================
// GET /api/marketplace — Client browses active listings
// ================================================================
describe('GET /api/marketplace', () => {
  beforeEach(() => {
    resetMock();
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(createMarketplaceApp()).get('/api/marketplace');
    expect(res.status).toBe(401);
  });

  it('returns paginated active listings', async () => {
    const client = makeClientRow();
    seedRequireSessionQueries(client);

    mockQuery.mockResolvedValueOnce({ rows: [{ count: 1 }] } as any);
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: LISTING_UUID,
          listing_type: 'ACTOR_PACKAGE',
          asset_id: ASSET_UUID,
          seller_id: ARTIST_UUID,
          price_credits: 10.0,
          is_active: true,
          created_at: '2026-06-17T10:00:00.000Z',
          asset_name: 'Cyberpunk Woman',
          headshot_url: 'https://fal.ai/headshot.png',
          fullshot_url: 'https://fal.ai/fullshot.png',
          seller_name: 'Test Artist',
        },
      ],
    } as any);

    const res = await request(createMarketplaceApp(client)).get('/api/marketplace');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(LISTING_UUID);
    expect(res.body.data[0].listing_type).toBe('ACTOR_PACKAGE');
    expect(res.body.data[0].asset.name).toBe('Cyberpunk Woman');
    expect(res.body.data[0].asset.headshot_url).toBe('https://fal.ai/headshot.png');
    expect(res.body.data[0].seller_name).toBe('Test Artist');
    expect(res.body.data[0].price_credits).toBe(10.0);
    expect(res.body.pagination).toEqual({
      page: 1,
      pageSize: 20,
      totalItems: 1,
      totalPages: 1,
    });
  });

  it('filters by listing_type', async () => {
    const client = makeClientRow();
    seedRequireSessionQueries(client);

    mockQuery.mockResolvedValueOnce({ rows: [{ count: 0 }] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createMarketplaceApp(client)).get(
      '/api/marketplace?listing_type=ACTOR_PACKAGE',
    );
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('filters by max_price', async () => {
    const client = makeClientRow();
    seedRequireSessionQueries(client);

    mockQuery.mockResolvedValueOnce({ rows: [{ count: 0 }] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createMarketplaceApp(client)).get('/api/marketplace?max_price=5.00');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });
});

// ================================================================
// GET /api/marketplace/:id — Client views listing detail
// ================================================================
describe('GET /api/marketplace/:id', () => {
  beforeEach(() => {
    resetMock();
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(createMarketplaceApp()).get(`/api/marketplace/${LISTING_UUID}`);
    expect(res.status).toBe(401);
  });

  it('returns 404 when listing not found', async () => {
    const client = makeClientRow();
    seedRequireSessionQueries(client);

    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createMarketplaceApp(client)).get(`/api/marketplace/${LISTING_UUID}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns listing detail with all output URLs', async () => {
    const client = makeClientRow();
    seedRequireSessionQueries(client);

    // SELECT listing
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: LISTING_UUID,
          listing_type: 'ACTOR_PACKAGE',
          asset_id: ASSET_UUID,
          seller_id: ARTIST_UUID,
          price_credits: 10.0,
          is_active: true,
          created_at: '2026-06-17T10:00:00.000Z',
          asset_name: 'Cyberpunk Woman',
          asset_type: 'ACTOR',
          seller_name: 'Test Artist',
        },
      ],
    } as any);

    // getAssetOutputs
    mockQuery.mockResolvedValueOnce({
      rows: [
        makeOutputRow('headshot', 'SUCCESS', { image_url: 'https://fal.ai/headshot.png' }),
        makeOutputRow('fullshot', 'SUCCESS', { image_url: 'https://fal.ai/fullshot.png' }),
        makeOutputRow('expressions_3x4', 'SUCCESS', {
          image_url: 'https://fal.ai/expressions.png',
        }),
        makeOutputRow('character_sheet', 'SUCCESS', {
          image_url: 'https://fal.ai/character_sheet.png',
        }),
        makeOutputRow('editorial', 'SUCCESS', {
          image_url: 'https://fal.ai/editorial1.png',
        }),
        makeOutputRow('editorial', 'SUCCESS', {
          image_url: 'https://fal.ai/editorial2.png',
        }),
      ],
    } as any);

    const res = await request(createMarketplaceApp(client)).get(`/api/marketplace/${LISTING_UUID}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(LISTING_UUID);
    expect(res.body.listing_type).toBe('ACTOR_PACKAGE');
    expect(res.body.asset.name).toBe('Cyberpunk Woman');
    expect(res.body.asset.headshot_url).toBe('https://fal.ai/headshot.png');
    expect(res.body.asset.fullshot_url).toBe('https://fal.ai/fullshot.png');
    expect(res.body.asset.expression_sheet_url).toBe('https://fal.ai/expressions.png');
    expect(res.body.asset.character_sheet_url).toBe('https://fal.ai/character_sheet.png');
    expect(res.body.asset.editorial_urls).toHaveLength(2);
    expect(res.body.asset.editorial_urls[0]).toBe('https://fal.ai/editorial1.png');
    expect(res.body.seller.name).toBe('Test Artist');
    expect(res.body.price_credits).toBe(10.0);
  });
});

// ================================================================
// POST /api/marketplace/:id/purchase — Client purchases a listing
// ================================================================
describe('POST /api/marketplace/:id/purchase', () => {
  beforeEach(() => {
    resetMock();
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(createMarketplaceApp()).post(
      `/api/marketplace/${LISTING_UUID}/purchase`,
    );
    expect(res.status).toBe(401);
  });

  it('returns 404 when listing not found', async () => {
    const client = makeClientRow();
    seedRequireSessionQueries(client);

    // SELECT listing returns empty
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createMarketplaceApp(client)).post(
      `/api/marketplace/${LISTING_UUID}/purchase`,
    );
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 409 when listing already purchased', async () => {
    const client = makeClientRow();
    seedRequireSessionQueries(client);

    // Transaction: BEGIN + SELECT listing FOR UPDATE
    const mockPoolClient = await poolModule.getClient();
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
    mockPoolClient.query.mockResolvedValueOnce({
      rows: [
        {
          listing_id: LISTING_UUID,
          asset_id: ASSET_UUID,
          price_credits: 10.0,
          is_active: true,
          purchased_by: 'someone-else-uuid',
          seller_id: ARTIST_UUID,
          asset_type: 'ACTOR',
        },
      ],
    } as any); // SELECT listing FOR UPDATE
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    const res = await request(createMarketplaceApp(client)).post(
      `/api/marketplace/${LISTING_UUID}/purchase`,
    );
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
    expect(res.body.error.message).toContain('already been purchased');
  });

  it('returns 402 when insufficient balance', async () => {
    const client = makeClientRow();
    seedRequireSessionQueries(client);

    // Transaction: BEGIN + SELECT listing FOR UPDATE + SELECT wallet FOR UPDATE + ROLLBACK
    const mockPoolClient = await poolModule.getClient();
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
    mockPoolClient.query.mockResolvedValueOnce({
      rows: [
        {
          listing_id: LISTING_UUID,
          asset_id: ASSET_UUID,
          price_credits: 10.0,
          is_active: true,
          purchased_by: null,
          seller_id: ARTIST_UUID,
          asset_type: 'ACTOR',
        },
      ],
    } as any); // SELECT listing FOR UPDATE
    mockPoolClient.query.mockResolvedValueOnce({
      rows: [{ id: 'wallet-uuid', balance_credits: 5.0 }],
    } as any); // SELECT wallet FOR UPDATE
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    const res = await request(createMarketplaceApp(client)).post(
      `/api/marketplace/${LISTING_UUID}/purchase`,
    );
    expect(res.status).toBe(402);
    expect(res.body.error.code).toBe('PAYMENT_REQUIRED');
    expect(res.body.error.message).toContain('Insufficient credits');
  });

  it('returns 402 when no wallet exists', async () => {
    const client = makeClientRow();
    seedRequireSessionQueries(client);

    // Transaction: BEGIN + SELECT listing FOR UPDATE + SELECT wallet (empty) + ROLLBACK
    const mockPoolClient = await poolModule.getClient();
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
    mockPoolClient.query.mockResolvedValueOnce({
      rows: [
        {
          listing_id: LISTING_UUID,
          asset_id: ASSET_UUID,
          price_credits: 10.0,
          is_active: true,
          purchased_by: null,
          seller_id: ARTIST_UUID,
          asset_type: 'ACTOR',
        },
      ],
    } as any); // SELECT listing FOR UPDATE
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // SELECT wallet — no wallet
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    const res = await request(createMarketplaceApp(client)).post(
      `/api/marketplace/${LISTING_UUID}/purchase`,
    );
    expect(res.status).toBe(402);
    expect(res.body.error.code).toBe('PAYMENT_REQUIRED');
    expect(res.body.error.message).toContain('Insufficient credits');
  });

  it('returns 200 and completes purchase with sufficient balance', async () => {
    const client = makeClientRow();
    seedRequireSessionQueries(client);

    const mockPoolClient = await poolModule.getClient();
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
    mockPoolClient.query.mockResolvedValueOnce({
      rows: [
        {
          listing_id: LISTING_UUID,
          asset_id: ASSET_UUID,
          price_credits: 10.0,
          is_active: true,
          purchased_by: null,
          seller_id: ARTIST_UUID,
          asset_type: 'ACTOR',
          name: 'Cyberpunk Woman',
        },
      ],
    } as any); // SELECT listing FOR UPDATE
    mockPoolClient.query.mockResolvedValueOnce({
      rows: [{ id: 'wallet-uuid', balance_credits: 50.0 }],
    } as any); // SELECT wallet FOR UPDATE
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // UPDATE wallet
    mockPoolClient.query.mockResolvedValueOnce({ rows: [{ id: 'ledger-1' }] }); // INSERT ledger
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // UPDATE assets (transfer ownership)
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // UPDATE listing purchased
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // COMMIT

    // Notification dispatch (post-COMMIT, uses module-level query via notificationRepo)
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createMarketplaceApp(client)).post(
      `/api/marketplace/${LISTING_UUID}/purchase`,
    );
    expect(res.status).toBe(200);
    expect(res.body.listing_id).toBe(LISTING_UUID);
    expect(res.body.cost_credits).toBe(10.0);
    expect(res.body.new_balance).toBe(40.0);
    expect(res.body.purchased_at).toBeDefined();
    expect(res.body.assets).toEqual([]); // Single purchase: ownership transferred, no duplication
  });
});

// --- Helper for client tests ---

function makeClientRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'b0000000-0000-4000-8000-000000000005',
    workspace_id: WORKSPACE_UUID,
    name: 'Test Client',
    email: 'client@test.com',
    role: 'CLIENT',
    is_api_able: false,
    password_hash: '$2a$10$hashedpassword',
    created_at: '2026-06-17T10:00:00.000Z',
    ...overrides,
  };
}
