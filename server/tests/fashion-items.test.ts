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
import fashionItemsRouter from '../src/routes/fashion-items.js';

const mockQuery = vi.mocked(poolModule.query);

// Valid v4 UUIDs
const WORKSPACE_UUID = 'a0000000-0000-4000-8000-000000000001';
const ARTIST_UUID = 'b0000000-0000-4000-8000-000000000001';
const ITEM_UUID = 'c0000000-0000-4000-8000-000000000003';
const SECOND_ITEM_UUID = 'e0000000-0000-4000-8000-000000000004';
const OUTPUT_UUID = 'f0000000-0000-4000-8000-000000000005';

// --- Test data factories ---

function makeAccountRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ARTIST_UUID,
    workspace_id: WORKSPACE_UUID,
    name: 'Test Artist',
    email: 'artist@studio.com',
    role: 'ARTIST',
    is_api_able: true,
    password_hash: '$2a$10$hashedpassword',
    created_at: '2026-06-17T10:00:00.000Z',
    ...overrides,
  };
}

function makeAdminRow(overrides: Record<string, unknown> = {}) {
  return makeAccountRow({
    role: 'ADMIN',
    id: 'admin-0000-0000-4000-8000-000000000001',
    ...overrides,
  });
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

function makeItemRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ITEM_UUID,
    workspace_id: WORKSPACE_UUID,
    creator_id: ARTIST_UUID,
    client_id: null,
    asset_type: 'FASHION_ITEM',
    name: 'Black Leather Jacket',
    seed: 12345,
    prompt_recipe: { prompt: 'Black leather jacket', identity: null },
    marketplace_status: null,
    is_marketplace_frozen: false,
    source_asset_id: null,
    source_type: 'ORIGINAL',
    deleted_at: null,
    created_at: '2026-06-17T10:00:00.000Z',
    headshot_url: null,
    ...overrides,
  };
}

function makeAssetOutputRow(overrides: Record<string, unknown> = {}) {
  return {
    id: OUTPUT_UUID,
    asset_id: ITEM_UUID,
    layout_type: 'fashion_item',
    model: 'flux-pro',
    image_url: null,
    local_backup_url: null,
    cost_credits: 0.02,
    status: 'PENDING',
    version: 1,
    is_obsolete: false,
    obsolete_reason: null,
    error_message: null,
    generation_params: { seed: 12345, model: 'flux-pro' },
    reference_images: null,
    source_asset_outputs: null,
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
  app.use('/api/fashion-items', fashionItemsRouter);
  return app;
}

/** Reset mock to pristine state */
function resetMock() {
  mockQuery.mockReset();
}

// ================================================================
// POST /api/fashion-items
// ================================================================
describe('POST /api/fashion-items', () => {
  beforeEach(() => {
    resetMock();
  });

  it('401 when not authenticated', async () => {
    const res = await request(createRouteApp())
      .post('/api/fashion-items')
      .send({ entry_method: 'PROMPT', prompt: 'Black jacket' });
    expect(res.status).toBe(401);
  });

  it('422 when entry_method is missing', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);
    const res = await request(createRouteApp(artist)).post('/api/fashion-items').send({});
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('422 when PROMPT without prompt', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);
    const res = await request(createRouteApp(artist))
      .post('/api/fashion-items')
      .send({ entry_method: 'PROMPT' });
    expect(res.status).toBe(422);
  });

  it('422 when REFERENCE without reference_image', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);
    const res = await request(createRouteApp(artist))
      .post('/api/fashion-items')
      .send({ entry_method: 'REFERENCE' });
    expect(res.status).toBe(422);
  });

  it('422 when entry_method is COMPOSITE (not valid for fashion items)', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);
    const res = await request(createRouteApp(artist))
      .post('/api/fashion-items')
      .send({ entry_method: 'COMPOSITE' });
    expect(res.status).toBe(422);
  });

  it('202 creates fashion item with PROMPT, returns 4 PENDING outputs', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    const createdItem = makeItemRow({ name: 'Black Leather Jacket' });
    mockQuery.mockResolvedValueOnce({ rows: [createdItem] } as any);

    for (let i = 0; i < 4; i++) {
      mockQuery.mockResolvedValueOnce({
        rows: [makeAssetOutputRow({ id: `${OUTPUT_UUID}-${i}` })],
      } as any);
    }

    const res = await request(createRouteApp(artist))
      .post('/api/fashion-items')
      .send({ entry_method: 'PROMPT', prompt: 'Black leather jacket, product photography' });

    expect(res.status).toBe(202);
    expect(res.body.asset_type).toBe('FASHION_ITEM');
    expect(res.body.outputs).toHaveLength(4);
    expect(res.body.outputs[0]).toMatchObject({
      status: 'PENDING',
      model: 'flux-pro',
      cost_credits: 0.02,
    });
    expect(res.body).toHaveProperty('auto_name');
    expect(res.body).toHaveProperty('created_at');

    const insertCall = mockQuery.mock.calls[2];
    expect(insertCall[0]).toContain('INSERT INTO assets');
    expect(insertCall[1]).toContain(WORKSPACE_UUID);
    expect(insertCall[1]).toContain(ARTIST_UUID);
    expect(insertCall[1]).toContain('FASHION_ITEM');
  });

  it('202 creates fashion item with REFERENCE entry method', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    const createdItem = makeItemRow({ name: 'New Fashion Item' });
    mockQuery.mockResolvedValueOnce({ rows: [createdItem] } as any);
    for (let i = 0; i < 4; i++) {
      mockQuery.mockResolvedValueOnce({
        rows: [makeAssetOutputRow({ id: `${OUTPUT_UUID}-${i}` })],
      } as any);
    }

    const res = await request(createRouteApp(artist))
      .post('/api/fashion-items')
      .send({ entry_method: 'REFERENCE', reference_image: 'base64img' });

    expect(res.status).toBe(202);
    expect(res.body.outputs).toHaveLength(4);
  });
});

// ================================================================
// GET /api/fashion-items
// ================================================================
describe('GET /api/fashion-items', () => {
  beforeEach(() => {
    resetMock();
  });

  it('401 when not authenticated', async () => {
    const res = await request(createRouteApp()).get('/api/fashion-items');
    expect(res.status).toBe(401);
  });

  it('200 with empty list when no items', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    mockQuery.mockResolvedValueOnce({ rows: [{ count: 0 }] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createRouteApp(artist)).get('/api/fashion-items');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination).toMatchObject({
      page: 1,
      pageSize: 20,
      totalItems: 0,
      totalPages: 0,
    });
  });

  it('200 with paginated list', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    const item1 = makeItemRow({
      id: ITEM_UUID,
      name: 'Item 1',
      headshot_url: 'https://fal.ai/1.png',
    });
    const item2 = makeItemRow({ id: SECOND_ITEM_UUID, name: 'Item 2', headshot_url: null });

    mockQuery.mockResolvedValueOnce({ rows: [{ count: 2 }] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [item1, item2] } as any);

    const res = await request(createRouteApp(artist)).get('/api/fashion-items');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].image_url).toBe('https://fal.ai/1.png');
    expect(res.body.data[1].image_url).toBeNull();
    expect(res.body.pagination).toMatchObject({
      page: 1,
      pageSize: 20,
      totalItems: 2,
      totalPages: 1,
    });
  });

  it('200 filters by creator_id', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    mockQuery.mockResolvedValueOnce({ rows: [{ count: 1 }] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [makeItemRow()] } as any);

    const res = await request(createRouteApp(artist))
      .get('/api/fashion-items')
      .query({ creator_id: ARTIST_UUID });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('200 filters by taxonomy key', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    mockQuery.mockResolvedValueOnce({ rows: [{ count: 1 }] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [makeItemRow()] } as any);

    const res = await request(createRouteApp(artist))
      .get('/api/fashion-items')
      .query({ item_type: 'clothing', color: 'black' });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);

    const countCall = mockQuery.mock.calls[2];
    expect(countCall[1]).toContain('item_type');
    expect(countCall[1]).toContain('clothing');
    expect(countCall[1]).toContain('color');
    expect(countCall[1]).toContain('black');
  });
});

// ================================================================
// GET /api/fashion-items/:id
// ================================================================
describe('GET /api/fashion-items/:id', () => {
  beforeEach(() => {
    resetMock();
  });

  it('401 when not authenticated', async () => {
    const res = await request(createRouteApp()).get(`/api/fashion-items/${ITEM_UUID}`);
    expect(res.status).toBe(401);
  });

  it('404 when item not found', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createRouteApp(artist)).get(`/api/fashion-items/${ITEM_UUID}`);
    expect(res.status).toBe(404);
  });

  it('200 with full detail including outputs', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    const item = makeItemRow({ name: 'Test Item' });
    const output1 = makeAssetOutputRow({ id: `${OUTPUT_UUID}-1`, status: 'PENDING' });

    mockQuery.mockResolvedValueOnce({ rows: [item] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [output1] } as any);

    const res = await request(createRouteApp(artist)).get(`/api/fashion-items/${ITEM_UUID}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(ITEM_UUID);
    expect(res.body.name).toBe('Test Item');
    expect(res.body.asset_type).toBe('FASHION_ITEM');
    expect(res.body.outputs).toHaveLength(1);
  });
});

// ================================================================
// PATCH /api/fashion-items/:id
// ================================================================
describe('PATCH /api/fashion-items/:id', () => {
  beforeEach(() => {
    resetMock();
  });

  it('401 when not authenticated', async () => {
    const res = await request(createRouteApp())
      .patch(`/api/fashion-items/${ITEM_UUID}`)
      .send({ name: 'Renamed' });
    expect(res.status).toBe(401);
  });

  it('422 when no fields', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    const res = await request(createRouteApp(artist))
      .patch(`/api/fashion-items/${ITEM_UUID}`)
      .send({});
    expect(res.status).toBe(422);
  });

  it('200 renames an item', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    const existingItem = makeItemRow();
    mockQuery.mockResolvedValueOnce({ rows: [existingItem] } as any);

    const updatedItem = makeItemRow({ name: 'Renamed Item' });
    mockQuery.mockResolvedValueOnce({ rows: [updatedItem] } as any);

    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createRouteApp(artist))
      .patch(`/api/fashion-items/${ITEM_UUID}`)
      .send({ name: 'Renamed Item' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Renamed Item');
  });

  it('200 selects an output', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    const existingItem = makeItemRow();
    mockQuery.mockResolvedValueOnce({ rows: [existingItem] } as any);

    const output1 = makeAssetOutputRow({ id: `${OUTPUT_UUID}-1` });
    const output2 = makeAssetOutputRow({ id: `${OUTPUT_UUID}-2` });
    mockQuery.mockResolvedValueOnce({ rows: [output1, output2] } as any);

    // Mark selected SUCCESS
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);
    // Mark rest FAILED
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    // No rename, so it re-fetches asset
    mockQuery.mockResolvedValueOnce({ rows: [existingItem] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [output1, output2] } as any);

    const res = await request(createRouteApp(artist))
      .patch(`/api/fashion-items/${ITEM_UUID}`)
      .send({ selected_output_id: `${OUTPUT_UUID}-1` });

    expect(res.status).toBe(200);
  });

  it('404 when item not found', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createRouteApp(artist))
      .patch(`/api/fashion-items/${ITEM_UUID}`)
      .send({ name: 'Renamed' });
    expect(res.status).toBe(404);
  });
});

// ================================================================
// DELETE /api/fashion-items/:id
// ================================================================
describe('DELETE /api/fashion-items/:id', () => {
  beforeEach(() => {
    resetMock();
  });

  it('401 when not authenticated', async () => {
    const res = await request(createRouteApp()).delete(`/api/fashion-items/${ITEM_UUID}`);
    expect(res.status).toBe(401);
  });

  it('404 when item not found', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createRouteApp(artist)).delete(`/api/fashion-items/${ITEM_UUID}`);
    expect(res.status).toBe(404);
  });

  it('200 soft deletes', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    // findAssetById (client_id check)
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: ITEM_UUID,
          workspace_id: WORKSPACE_UUID,
          creator_id: artist.id,
          client_id: null,
          asset_type: 'FASHION_ITEM',
          name: 'Test Item',
          seed: 12345,
          prompt_recipe: {},
          marketplace_status: null,
          is_marketplace_frozen: false,
          source_asset_id: null,
          source_type: 'ORIGINAL',
          deleted_at: null,
          created_at: '2026-06-17T10:00:00.000Z',
        },
      ],
    } as any);
    // softDeleteAsset
    mockQuery.mockResolvedValueOnce({ rows: [{ id: ITEM_UUID }] } as any);

    const res = await request(createRouteApp(artist)).delete(`/api/fashion-items/${ITEM_UUID}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Fashion item deleted successfully' });

    const deleteCall = mockQuery.mock.calls[3];
    expect(deleteCall[0]).toContain('SET deleted_at = NOW()');
    expect(deleteCall[0]).toContain('assets');
  });
});
