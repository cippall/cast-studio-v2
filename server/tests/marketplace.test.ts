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

    // Asset belongs to a different creator
    const asset = makeAssetRow({ creator_id: 'e0000000-0000-4000-8000-000000000099' });
    mockQuery.mockResolvedValueOnce({ rows: [asset] } as any);

    const res = await request(createMarketplaceApp(artist))
      .post('/api/marketplace/submit')
      .send({ asset_id: ASSET_UUID });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 409 when asset already has pending submission', async () => {
    const artist = makeArtistRow();
    seedRequireSessionQueries(artist);

    const asset = makeAssetRow({ marketplace_status: 'MARKETPLACE_PENDING' });
    mockQuery.mockResolvedValueOnce({ rows: [asset] } as any);

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

    const asset = makeAssetRow({ marketplace_status: 'MARKETPLACE_APPROVED' });
    mockQuery.mockResolvedValueOnce({ rows: [asset] } as any);

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

    const asset = makeAssetRow();
    mockQuery.mockResolvedValueOnce({ rows: [asset] } as any);

    // Only headshot SUCCESS, missing fullshot, expressions, character_sheet, editorial
    const outputs = [makeOutputRow('headshot', 'SUCCESS'), makeOutputRow('fullshot', 'PENDING')];
    mockQuery.mockResolvedValueOnce({ rows: outputs } as any);

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

    const asset = makeAssetRow();
    mockQuery.mockResolvedValueOnce({ rows: [asset] } as any);

    // All 5 required outputs are SUCCESS
    const outputs = [
      makeOutputRow('headshot', 'SUCCESS'),
      makeOutputRow('fullshot', 'SUCCESS'),
      makeOutputRow('expressions_3x4', 'SUCCESS'),
      makeOutputRow('character_sheet', 'SUCCESS'),
      makeOutputRow('editorial', 'SUCCESS'),
    ];
    mockQuery.mockResolvedValueOnce({ rows: outputs } as any);

    // UPDATE to set marketplace_status
    mockQuery.mockResolvedValueOnce({ rows: [asset] } as any);

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

    // SELECT asset (pending)
    const asset = makeAssetRow({ marketplace_status: 'MARKETPLACE_PENDING' });
    mockQuery.mockResolvedValueOnce({ rows: [asset] } as any);

    // UPDATE assets SET marketplace_status = APPROVED
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    // INSERT marketplace_listings
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: LISTING_UUID }],
    } as any);

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

    // SELECT asset (pending)
    const asset = makeAssetRow({ marketplace_status: 'MARKETPLACE_PENDING' });
    mockQuery.mockResolvedValueOnce({ rows: [asset] } as any);

    // UPDATE assets SET marketplace_status = REJECTED
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

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
