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

// Mock requireApiKey to simply set req.account from a header and call next
vi.mock('../src/middleware/requireApiKey.js', () => ({
  requireApiKey: async (req: Request, _res: Response, next: NextFunction) => {
    // In tests, the account is set via a custom header
    const accountId = req.headers['x-test-account-id'] as string | undefined;
    if (!accountId) {
      _res
        .status(401)
        .json({ error: { code: 'UNAUTHORIZED', message: 'Missing or invalid API key' } });
      return;
    }
    // We'll set a minimal account; tests that need specific data override via mockQuery
    (req as any).account = {
      id: accountId,
      workspace_id: STUDIO_UUID,
      role: 'AGENT',
      is_api_able: true,
    };
    (req as any).workspace = {
      id: STUDIO_UUID,
      name: 'Test Workspace',
      slug: 'test-workspace',
      workspace_type: 'STUDIO',
    };
    next();
  },
}));

import * as poolModule from '../src/db/pool.js';
import marketplaceRouter from '../src/routes/marketplace.js';
import adminMarketplaceRouter from '../src/routes/admin/marketplace.js';
import agentMarketplaceRouter from '../src/routes/agent/marketplace.js';

const mockQuery = vi.mocked(poolModule.query);

// Valid v4 UUIDs
const WORKSPACE_UUID = 'a0000000-0000-4000-8000-000000000001';
const STUDIO_UUID = 'a0000000-0000-4000-8000-000000000099';
const ARTIST_UUID = 'c0000000-0000-4000-8000-000000000002';
const ADMIN_UUID = 'd0000000-0000-4000-8000-000000000003';
const AGENT_UUID = 'e0000000-0000-4000-8000-000000000004';
const ASSET_UUID = 'f0000000-0000-4000-8000-000000000020';
const LISTING_UUID = '10000000-0000-4000-8000-000000000001';
const LISTING2_UUID = '20000000-0000-4000-8000-000000000002';

function makeArtistRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ARTIST_UUID,
    workspace_id: STUDIO_UUID,
    name: 'Test Artist',
    email: 'artist@studio.com',
    role: 'ARTIST',
    is_api_able: false,
    password_hash: '$2a$10$hashed',
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
    password_hash: '$2a$10$hashed',
    created_at: '2026-06-17T10:00:00.000Z',
    ...overrides,
  };
}

function makeAgentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: AGENT_UUID,
    workspace_id: STUDIO_UUID,
    name: 'Test Agent',
    email: 'agent@studio.com',
    role: 'AGENT',
    is_api_able: true,
    password_hash: '$2a$10$hashed',
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
    id: 'ff000000-0000-4000-8000-0000000000' + layoutType.slice(0, 2),
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

function makeListingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: LISTING_UUID,
    asset_id: ASSET_UUID,
    seller_id: ARTIST_UUID,
    price_credits: 10.0,
    listing_type: 'ACTOR_PACKAGE',
    is_active: true,
    purchased_by: null,
    purchased_at: null,
    created_at: '2026-06-17T10:00:00.000Z',
    ...overrides,
  };
}

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

function createAgentMarketplaceApp(accountOverride?: Record<string, unknown>) {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    // Simulate requireApiKey middleware by directly setting req.account
    (req as any).account = accountOverride;
    (req as any).workspace = makeWorkspaceRow({ id: accountOverride?.workspace_id });
    next();
  });
  app.use('/api/agent/marketplace', agentMarketplaceRouter);
  return app;
}

function resetMock() {
  mockQuery.mockReset();
}

describe('GET /api/marketplace/manage', () => {
  beforeEach(() => {
    resetMock();
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(createMarketplaceApp()).get('/api/marketplace/manage');
    expect(res.status).toBe(401);
  });

  it('returns own listings for artist', async () => {
    const artist = makeArtistRow();
    seedRequireSessionQueries(artist);
    mockQuery.mockResolvedValueOnce({ rows: [{ count: 1 }] } as any);
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: LISTING_UUID,
          asset_id: ASSET_UUID,
          listing_type: 'ACTOR_PACKAGE',
          price_credits: 10.0,
          is_active: true,
          purchased_by: null,
          purchased_at: null,
          created_at: '2026-06-17T10:00:00.000Z',
          asset_name: 'Cyberpunk Woman',
          asset_type: 'ACTOR',
        },
      ],
    } as any);
    const res = await request(createMarketplaceApp(artist)).get('/api/marketplace/manage');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(LISTING_UUID);
    expect(res.body.data[0].asset_name).toBe('Cyberpunk Woman');
    expect(res.body.data[0].is_active).toBe(true);
    expect(res.body.pagination.totalItems).toBe(1);
  });

  it('returns all listings for admin', async () => {
    const admin = makeAdminRow();
    seedRequireSessionQueries(admin);
    mockQuery.mockResolvedValueOnce({ rows: [{ count: 2 }] } as any);
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: LISTING_UUID,
          asset_id: ASSET_UUID,
          listing_type: 'ACTOR_PACKAGE',
          price_credits: 10.0,
          is_active: true,
          purchased_by: null,
          purchased_at: null,
          created_at: '2026-06-17T10:00:00.000Z',
          asset_name: 'Cyberpunk Woman',
          asset_type: 'ACTOR',
        },
        {
          id: LISTING2_UUID,
          asset_id: ASSET_UUID,
          listing_type: 'LOOK',
          price_credits: 5.0,
          is_active: false,
          purchased_by: null,
          purchased_at: null,
          created_at: '2026-06-16T10:00:00.000Z',
          asset_name: 'Summer Look',
          asset_type: 'LOOK',
        },
      ],
    } as any);
    const res = await request(createMarketplaceApp(admin)).get('/api/marketplace/manage');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.totalItems).toBe(2);
  });

  it('filters by is_active and listing_type', async () => {
    const artist = makeArtistRow();
    seedRequireSessionQueries(artist);

    mockQuery.mockResolvedValueOnce({ rows: [{ count: 0 }] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createMarketplaceApp(artist)).get(
      '/api/marketplace/manage?is_active=true&listing_type=ACTOR_PACKAGE',
    );
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });
});

describe('PATCH /api/marketplace/manage/:id', () => {
  beforeEach(() => {
    resetMock();
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(createMarketplaceApp())
      .patch(`/api/marketplace/manage/${LISTING_UUID}`)
      .send({ price_credits: 15.0 });
    expect(res.status).toBe(401);
  });

  it('returns 422 when no valid fields provided', async () => {
    const artist = makeArtistRow();
    seedRequireSessionQueries(artist);
    // Service fetches listing first, then throws 422 for empty updates
    const listing = makeListingRow();
    mockQuery.mockResolvedValueOnce({
      rows: [{ ...listing, asset_name: 'Cyberpunk Woman', asset_type: 'ACTOR' }],
    } as any);
    const res = await request(createMarketplaceApp(artist))
      .patch(`/api/marketplace/manage/${LISTING_UUID}`)
      .send({});
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 when listing does not exist', async () => {
    const artist = makeArtistRow();
    seedRequireSessionQueries(artist);
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);
    const res = await request(createMarketplaceApp(artist))
      .patch(`/api/marketplace/manage/${LISTING_UUID}`)
      .send({ price_credits: 15.0 });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 403 when artist tries to update another artist listing', async () => {
    const artist = makeArtistRow();
    seedRequireSessionQueries(artist);
    const listing = makeListingRow({ seller_id: 'f0000000-0000-4000-8000-000000000099' });
    mockQuery.mockResolvedValueOnce({
      rows: [{ ...listing, asset_name: 'Other Asset', asset_type: 'ACTOR' }],
    } as any);
    const res = await request(createMarketplaceApp(artist))
      .patch(`/api/marketplace/manage/${LISTING_UUID}`)
      .send({ price_credits: 15.0 });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('updates price for own listing', async () => {
    const artist = makeArtistRow();
    seedRequireSessionQueries(artist);
    const listing = makeListingRow();
    mockQuery.mockResolvedValueOnce({
      rows: [{ ...listing, asset_name: 'Cyberpunk Woman', asset_type: 'ACTOR' }],
    } as any);
    mockQuery.mockResolvedValueOnce({ rows: [{ ...listing, price_credits: 15.0 }] } as any);
    const res = await request(createMarketplaceApp(artist))
      .patch(`/api/marketplace/manage/${LISTING_UUID}`)
      .send({ price_credits: 15.0 });
    expect(res.status).toBe(200);
    expect(res.body.price_credits).toBe(15.0);
  });

  it('toggles is_active', async () => {
    const artist = makeArtistRow();
    seedRequireSessionQueries(artist);
    const listing = makeListingRow();
    mockQuery.mockResolvedValueOnce({
      rows: [{ ...listing, asset_name: 'Cyberpunk Woman', asset_type: 'ACTOR' }],
    } as any);
    mockQuery.mockResolvedValueOnce({ rows: [{ ...listing, is_active: false }] } as any);
    const res = await request(createMarketplaceApp(artist))
      .patch(`/api/marketplace/manage/${LISTING_UUID}`)
      .send({ is_active: false });
    expect(res.status).toBe(200);
    expect(res.body.is_active).toBe(false);
  });
});

describe('DELETE /api/marketplace/manage/:id', () => {
  beforeEach(() => {
    resetMock();
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(createMarketplaceApp()).delete(
      `/api/marketplace/manage/${LISTING_UUID}`,
    );
    expect(res.status).toBe(401);
  });

  it('returns 404 when listing does not exist', async () => {
    const artist = makeArtistRow();
    seedRequireSessionQueries(artist);
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);
    const res = await request(createMarketplaceApp(artist)).delete(
      `/api/marketplace/manage/${LISTING_UUID}`,
    );
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 403 when artist tries to delete another artist listing', async () => {
    const artist = makeArtistRow();
    seedRequireSessionQueries(artist);
    const listing = makeListingRow({ seller_id: 'f0000000-0000-4000-8000-000000000099' });
    mockQuery.mockResolvedValueOnce({ rows: [listing] } as any);
    const res = await request(createMarketplaceApp(artist)).delete(
      `/api/marketplace/manage/${LISTING_UUID}`,
    );
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('deletes (deactivates) own listing', async () => {
    const artist = makeArtistRow();
    seedRequireSessionQueries(artist);
    const listing = makeListingRow();
    mockQuery.mockResolvedValueOnce({ rows: [listing] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);
    const res = await request(createMarketplaceApp(artist)).delete(
      `/api/marketplace/manage/${LISTING_UUID}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(LISTING_UUID);
    expect(res.body.is_active).toBe(false);
  });
});

describe('GET /api/admin/marketplace/settings', () => {
  beforeEach(() => {
    resetMock();
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(createAdminMarketplaceApp()).get('/api/admin/marketplace/settings');
    expect(res.status).toBe(401);
  });

  it('returns 403 when non-admin tries to access', async () => {
    const artist = makeArtistRow();
    seedRequireSessionQueries(artist);
    const res = await request(createAdminMarketplaceApp(artist)).get(
      '/api/admin/marketplace/settings',
    );
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns settings for admin', async () => {
    const admin = makeAdminRow();
    seedRequireSessionQueries(admin);
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: '00000000-0000-0000-0000-000000000001',
          actor_package: {
            required_outputs: [
              'headshot',
              'fullshot',
              'expressions_3x4',
              'character_sheet',
              'editorial',
            ],
            generic_standard_look_id: null,
            editorial_count: 2,
          },
          look_package: { required_outputs: ['look_image'] },
          fashion_item_package: { required_outputs: ['item_image'] },
          updated_at: '2026-06-17T10:00:00.000Z',
        },
      ],
    } as any);
    const res = await request(createAdminMarketplaceApp(admin)).get(
      '/api/admin/marketplace/settings',
    );
    expect(res.status).toBe(200);
    expect(res.body.actor_package.required_outputs).toContain('headshot');
    expect(res.body.actor_package.required_outputs).toContain('editorial');
    expect(res.body.actor_package.editorial_count).toBe(2);
    expect(res.body.look_package.required_outputs).toEqual(['look_image']);
    expect(res.body.fashion_item_package.required_outputs).toEqual(['item_image']);
  });
});

describe('PUT /api/admin/marketplace/settings', () => {
  beforeEach(() => {
    resetMock();
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(createAdminMarketplaceApp())
      .put('/api/admin/marketplace/settings')
      .send({ actor_package: { required_outputs: ['headshot', 'fullshot'] } });
    expect(res.status).toBe(401);
  });

  it('returns 403 when non-admin tries to update', async () => {
    const artist = makeArtistRow();
    seedRequireSessionQueries(artist);
    const res = await request(createAdminMarketplaceApp(artist))
      .put('/api/admin/marketplace/settings')
      .send({ actor_package: { required_outputs: ['headshot'] } });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('updates actor package settings', async () => {
    const admin = makeAdminRow();
    seedRequireSessionQueries(admin);
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: '00000000-0000-0000-0000-000000000001',
          actor_package: {
            required_outputs: [
              'headshot',
              'fullshot',
              'expressions_3x4',
              'character_sheet',
              'editorial',
            ],
            generic_standard_look_id: null,
            editorial_count: 2,
          },
          look_package: { required_outputs: ['look_image'] },
          fashion_item_package: { required_outputs: ['item_image'] },
          updated_at: '2026-06-17T10:00:00.000Z',
        },
      ],
    } as any);
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);
    const res = await request(createAdminMarketplaceApp(admin))
      .put('/api/admin/marketplace/settings')
      .send({
        actor_package: {
          required_outputs: [
            'headshot',
            'fullshot',
            'expressions_3x4',
            'character_sheet',
            'editorial',
          ],
          editorial_count: 3,
        },
      });
    expect(res.status).toBe(200);
    expect(res.body.actor_package.editorial_count).toBe(3);
  });

  it('returns 422 for invalid input', async () => {
    const admin = makeAdminRow();
    seedRequireSessionQueries(admin);
    const res = await request(createAdminMarketplaceApp(admin))
      .put('/api/admin/marketplace/settings')
      .send({ actor_package: { generic_standard_look_id: 'not-a-uuid' } });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/agent/marketplace/submit', () => {
  beforeEach(() => {
    resetMock();
  });

  function agentApp(accountId?: string) {
    const app = express();
    app.use(express.json());
    app.use((req: Request, _res: Response, next: NextFunction) => {
      if (accountId) {
        req.headers['x-test-account-id'] = accountId;
      }
      next();
    });
    app.use('/api/agent/marketplace', agentMarketplaceRouter);
    return app;
  }

  it('returns 401 when no API key provided', async () => {
    const res = await request(agentApp())
      .post('/api/agent/marketplace/submit')
      .send({ asset_id: ASSET_UUID });
    expect(res.status).toBe(401);
  });

  it('returns 422 when asset_id is missing', async () => {
    const res = await request(agentApp(AGENT_UUID)).post('/api/agent/marketplace/submit').send({});
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 when asset_id is not a valid UUID', async () => {
    const res = await request(agentApp(AGENT_UUID))
      .post('/api/agent/marketplace/submit')
      .send({ asset_id: 'not-a-uuid' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 when asset does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);
    const res = await request(agentApp(AGENT_UUID))
      .post('/api/agent/marketplace/submit')
      .send({ asset_id: ASSET_UUID });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 409 when asset is missing required outputs', async () => {
    const asset = makeAssetRow({ creator_id: AGENT_UUID });
    mockQuery.mockResolvedValueOnce({ rows: [asset] } as any);
    const outputs = [makeOutputRow('headshot', 'SUCCESS'), makeOutputRow('fullshot', 'PENDING')];
    mockQuery.mockResolvedValueOnce({ rows: outputs } as any);
    const res = await request(agentApp(AGENT_UUID))
      .post('/api/agent/marketplace/submit')
      .send({ asset_id: ASSET_UUID });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
    expect(res.body.error.details.missing).toContain('fullshot');
    expect(res.body.error.details.missing).toContain('expressions_3x4');
    expect(res.body.error.details.missing).toContain('character_sheet');
    expect(res.body.error.details.missing).toContain('editorial');
  });

  it('returns 201 when agent submits valid asset', async () => {
    const asset = makeAssetRow({ creator_id: AGENT_UUID });
    mockQuery.mockResolvedValueOnce({ rows: [asset] } as any);
    const outputs = [
      makeOutputRow('headshot', 'SUCCESS'),
      makeOutputRow('fullshot', 'SUCCESS'),
      makeOutputRow('expressions_3x4', 'SUCCESS'),
      makeOutputRow('character_sheet', 'SUCCESS'),
      makeOutputRow('editorial', 'SUCCESS'),
    ];
    mockQuery.mockResolvedValueOnce({ rows: outputs } as any);
    mockQuery.mockResolvedValueOnce({ rows: [asset] } as any);
    const res = await request(agentApp(AGENT_UUID))
      .post('/api/agent/marketplace/submit')
      .send({ asset_id: ASSET_UUID });
    expect(res.status).toBe(201);
    expect(res.body.asset_id).toBe(ASSET_UUID);
    expect(res.body.marketplace_status).toBe('MARKETPLACE_PENDING');
  });
});
