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
import collectionsRouter from '../src/routes/collections.js';

const mockQuery = vi.mocked(poolModule.query);

// Valid v4 UUIDs
const WORKSPACE_A_UUID = 'a0000000-0000-4000-8000-000000000001';
const WORKSPACE_B_UUID = 'a0000000-0000-4000-8000-000000000002';
const USER_A_UUID = 'b0000000-0000-4000-8000-000000000001';
const USER_B_UUID = 'b0000000-0000-4000-8000-000000000002';
const COLLECTION_UUID = 'c0000000-0000-4000-8000-000000000001';
const COLLECTION_B_UUID = 'c0000000-0000-4000-8000-000000000002';
const ITEM_UUID = 'd0000000-0000-4000-8000-000000000001';
const ASSET_UUID = 'e0000000-0000-4000-8000-000000000001';
const ASSET_B_UUID = 'e0000000-0000-4000-8000-000000000002';

// --- Test data factories ---

function makeUserA(overrides: Record<string, unknown> = {}) {
  return {
    id: USER_A_UUID,
    workspace_id: WORKSPACE_A_UUID,
    name: 'User A',
    email: 'usera@test.com',
    role: 'ARTIST',
    is_api_able: true,
    password_hash: '$2a$10$hashedpassword',
    created_at: '2026-06-17T10:00:00.000Z',
    ...overrides,
  };
}

function makeUserB(overrides: Record<string, unknown> = {}) {
  return {
    id: USER_B_UUID,
    workspace_id: WORKSPACE_B_UUID,
    name: 'User B',
    email: 'userb@test.com',
    role: 'ARTIST',
    is_api_able: true,
    password_hash: '$2a$10$hashedpassword',
    created_at: '2026-06-17T10:00:00.000Z',
    ...overrides,
  };
}

function makeWorkspaceA(overrides: Record<string, unknown> = {}) {
  return {
    id: WORKSPACE_A_UUID,
    name: 'Workspace A',
    slug: 'workspace-a',
    workspace_type: 'STUDIO',
    created_at: '2026-06-17T10:00:00.000Z',
    ...overrides,
  };
}

function makeWorkspaceB(overrides: Record<string, unknown> = {}) {
  return {
    id: WORKSPACE_B_UUID,
    name: 'Workspace B',
    slug: 'workspace-b',
    workspace_type: 'STUDIO',
    created_at: '2026-06-17T10:00:00.000Z',
    ...overrides,
  };
}

function makeCollectionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: COLLECTION_UUID,
    user_id: USER_A_UUID,
    workspace_id: WORKSPACE_A_UUID,
    name: 'My Collection',
    created_at: '2026-06-17T10:00:00.000Z',
    updated_at: '2026-06-17T10:00:00.000Z',
    ...overrides,
  };
}

function makeCollectionItemRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ITEM_UUID,
    collection_id: COLLECTION_UUID,
    asset_type: 'LOOK',
    asset_id: ASSET_UUID,
    created_at: '2026-06-17T10:00:00.000Z',
    ...overrides,
  };
}

// --- Test setup helpers ---

/** Seed mockQuery so requireSession + requireWorkspace succeed (consumes 2 calls) */
function seedAuthQueries(
  accountRow: Record<string, unknown>,
  workspaceRow: Record<string, unknown>,
) {
  mockQuery.mockResolvedValueOnce({ rows: [accountRow] } as any);
  mockQuery.mockResolvedValueOnce({ rows: [workspaceRow] } as any);
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
  app.use('/api/collections', collectionsRouter);
  return app;
}

/** Reset mock to pristine state */
function resetMock() {
  mockQuery.mockReset();
}

// ===================================================================
// GET /api/collections — List collections
// ===================================================================
describe('GET /api/collections', () => {
  beforeEach(() => {
    resetMock();
  });

  it('401 when not authenticated', async () => {
    const res = await request(createRouteApp()).get('/api/collections');
    expect(res.status).toBe(401);
  });

  it('returns empty list when user has no collections', async () => {
    const user = makeUserA();
    const ws = makeWorkspaceA();
    seedAuthQueries(user, ws);
    mockQuery.mockResolvedValueOnce({ rows: [{ count: 0 }] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createRouteApp(user)).get('/api/collections');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.totalItems).toBe(0);
  });

  it('returns collections with item counts', async () => {
    const user = makeUserA();
    const ws = makeWorkspaceA();
    seedAuthQueries(user, ws);
    mockQuery.mockResolvedValueOnce({ rows: [{ count: 1 }] } as any);
    mockQuery.mockResolvedValueOnce({
      rows: [{ ...makeCollectionRow(), item_count: 5 }],
    } as any);

    const res = await request(createRouteApp(user)).get('/api/collections');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('My Collection');
    expect(res.body.data[0].item_count).toBe(5);
    expect(res.body.pagination.totalItems).toBe(1);
  });

  it('supports search filter', async () => {
    const user = makeUserA();
    const ws = makeWorkspaceA();
    seedAuthQueries(user, ws);
    mockQuery.mockResolvedValueOnce({ rows: [{ count: 1 }] } as any);
    mockQuery.mockResolvedValueOnce({
      rows: [{ ...makeCollectionRow({ name: 'Editorial Shots' }), item_count: 3 }],
    } as any);

    const res = await request(createRouteApp(user))
      .get('/api/collections')
      .query({ search: 'Editorial' });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Editorial Shots');
  });

  it('supports pagination', async () => {
    const user = makeUserA();
    const ws = makeWorkspaceA();
    seedAuthQueries(user, ws);
    mockQuery.mockResolvedValueOnce({ rows: [{ count: 25 }] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createRouteApp(user))
      .get('/api/collections')
      .query({ page: 2, pageSize: 10 });
    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(2);
    expect(res.body.pagination.pageSize).toBe(10);
    expect(res.body.pagination.totalItems).toBe(25);
    expect(res.body.pagination.totalPages).toBe(3);
  });
});

// ===================================================================
// POST /api/collections — Create collection
// ===================================================================
describe('POST /api/collections', () => {
  beforeEach(() => {
    resetMock();
  });

  it('401 when not authenticated', async () => {
    const res = await request(createRouteApp())
      .post('/api/collections')
      .send({ name: 'New Collection' });
    expect(res.status).toBe(401);
  });

  it('422 when name is missing', async () => {
    const user = makeUserA();
    const ws = makeWorkspaceA();
    seedAuthQueries(user, ws);

    const res = await request(createRouteApp(user)).post('/api/collections').send({});
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('422 when name is empty string', async () => {
    const user = makeUserA();
    const ws = makeWorkspaceA();
    seedAuthQueries(user, ws);

    const res = await request(createRouteApp(user)).post('/api/collections').send({ name: '' });
    expect(res.status).toBe(422);
  });

  it('creates collection and returns 201', async () => {
    const user = makeUserA();
    const ws = makeWorkspaceA();
    seedAuthQueries(user, ws);
    mockQuery.mockResolvedValueOnce({ rows: [makeCollectionRow()] } as any);

    const res = await request(createRouteApp(user))
      .post('/api/collections')
      .send({ name: 'My Collection' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('My Collection');
    expect(res.body.user_id).toBe(USER_A_UUID);
    expect(res.body.workspace_id).toBe(WORKSPACE_A_UUID);
  });
});

// ===================================================================
// GET /api/collections/:id — Get single collection
// ===================================================================
describe('GET /api/collections/:id', () => {
  beforeEach(() => {
    resetMock();
  });

  it('401 when not authenticated', async () => {
    const res = await request(createRouteApp()).get(`/api/collections/${COLLECTION_UUID}`);
    expect(res.status).toBe(401);
  });

  it('returns collection when it exists and belongs to user', async () => {
    const user = makeUserA();
    const ws = makeWorkspaceA();
    seedAuthQueries(user, ws);
    mockQuery.mockResolvedValueOnce({ rows: [makeCollectionRow()] } as any);

    const res = await request(createRouteApp(user)).get(`/api/collections/${COLLECTION_UUID}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(COLLECTION_UUID);
    expect(res.body.name).toBe('My Collection');
  });

  it('returns 404 when collection does not exist', async () => {
    const user = makeUserA();
    const ws = makeWorkspaceA();
    seedAuthQueries(user, ws);
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createRouteApp(user)).get(`/api/collections/${COLLECTION_B_UUID}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

// ===================================================================
// PUT /api/collections/:id — Update collection
// ===================================================================
describe('PUT /api/collections/:id', () => {
  beforeEach(() => {
    resetMock();
  });

  it('401 when not authenticated', async () => {
    const res = await request(createRouteApp())
      .put(`/api/collections/${COLLECTION_UUID}`)
      .send({ name: 'Renamed' });
    expect(res.status).toBe(401);
  });

  it('422 when name is missing', async () => {
    const user = makeUserA();
    const ws = makeWorkspaceA();
    seedAuthQueries(user, ws);

    const res = await request(createRouteApp(user))
      .put(`/api/collections/${COLLECTION_UUID}`)
      .send({});
    expect(res.status).toBe(422);
  });

  it('updates collection name', async () => {
    const user = makeUserA();
    const ws = makeWorkspaceA();
    seedAuthQueries(user, ws);
    mockQuery.mockResolvedValueOnce({
      rows: [makeCollectionRow({ name: 'Renamed Collection' })],
    } as any);

    const res = await request(createRouteApp(user))
      .put(`/api/collections/${COLLECTION_UUID}`)
      .send({ name: 'Renamed Collection' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Renamed Collection');
  });

  it('returns 404 when collection not found', async () => {
    const user = makeUserA();
    const ws = makeWorkspaceA();
    seedAuthQueries(user, ws);
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createRouteApp(user))
      .put(`/api/collections/${COLLECTION_B_UUID}`)
      .send({ name: 'New Name' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

// ===================================================================
// DELETE /api/collections/:id — Delete collection
// ===================================================================
describe('DELETE /api/collections/:id', () => {
  beforeEach(() => {
    resetMock();
  });

  it('401 when not authenticated', async () => {
    const res = await request(createRouteApp()).delete(`/api/collections/${COLLECTION_UUID}`);
    expect(res.status).toBe(401);
  });

  it('deletes collection and returns success message', async () => {
    const user = makeUserA();
    const ws = makeWorkspaceA();
    seedAuthQueries(user, ws);
    mockQuery.mockResolvedValueOnce({ rowCount: 1 } as any);

    const res = await request(createRouteApp(user)).delete(`/api/collections/${COLLECTION_UUID}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Collection deleted successfully');
  });

  it('returns 404 when collection not found', async () => {
    const user = makeUserA();
    const ws = makeWorkspaceA();
    seedAuthQueries(user, ws);
    mockQuery.mockResolvedValueOnce({ rowCount: 0 } as any);

    const res = await request(createRouteApp(user)).delete(`/api/collections/${COLLECTION_B_UUID}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

// ===================================================================
// POST /api/collections/:id/items — Add item to collection
// ===================================================================
describe('POST /api/collections/:id/items', () => {
  beforeEach(() => {
    resetMock();
  });

  it('401 when not authenticated', async () => {
    const res = await request(createRouteApp())
      .post(`/api/collections/${COLLECTION_UUID}/items`)
      .send({ asset_type: 'LOOK', asset_id: ASSET_UUID });
    expect(res.status).toBe(401);
  });

  it('422 when asset_type is missing', async () => {
    const user = makeUserA();
    const ws = makeWorkspaceA();
    seedAuthQueries(user, ws);

    const res = await request(createRouteApp(user))
      .post(`/api/collections/${COLLECTION_UUID}/items`)
      .send({ asset_id: ASSET_UUID });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('422 when asset_id is missing', async () => {
    const user = makeUserA();
    const ws = makeWorkspaceA();
    seedAuthQueries(user, ws);

    const res = await request(createRouteApp(user))
      .post(`/api/collections/${COLLECTION_UUID}/items`)
      .send({ asset_type: 'LOOK' });
    expect(res.status).toBe(422);
  });

  it('adds item to collection and returns 201', async () => {
    const user = makeUserA();
    const ws = makeWorkspaceA();
    seedAuthQueries(user, ws);
    // First query: findCollectionById to verify ownership
    mockQuery.mockResolvedValueOnce({ rows: [makeCollectionRow()] } as any);
    // Second query: addCollectionItem
    mockQuery.mockResolvedValueOnce({ rows: [makeCollectionItemRow()] } as any);

    const res = await request(createRouteApp(user))
      .post(`/api/collections/${COLLECTION_UUID}/items`)
      .send({ asset_type: 'LOOK', asset_id: ASSET_UUID });
    expect(res.status).toBe(201);
    expect(res.body.collection_id).toBe(COLLECTION_UUID);
    expect(res.body.asset_type).toBe('LOOK');
    expect(res.body.asset_id).toBe(ASSET_UUID);
  });

  it('returns 404 when collection does not belong to user', async () => {
    const user = makeUserA();
    const ws = makeWorkspaceA();
    seedAuthQueries(user, ws);
    // findCollectionById returns empty (collection belongs to another user)
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createRouteApp(user))
      .post(`/api/collections/${COLLECTION_B_UUID}/items`)
      .send({ asset_type: 'LOOK', asset_id: ASSET_UUID });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

// ===================================================================
// DELETE /api/collections/:id/items/:itemId — Remove item
// ===================================================================
describe('DELETE /api/collections/:id/items/:itemId', () => {
  beforeEach(() => {
    resetMock();
  });

  it('401 when not authenticated', async () => {
    const res = await request(createRouteApp()).delete(
      `/api/collections/${COLLECTION_UUID}/items/${ITEM_UUID}`,
    );
    expect(res.status).toBe(401);
  });

  it('removes item and returns success message', async () => {
    const user = makeUserA();
    const ws = makeWorkspaceA();
    seedAuthQueries(user, ws);
    mockQuery.mockResolvedValueOnce({ rowCount: 1 } as any);

    const res = await request(createRouteApp(user)).delete(
      `/api/collections/${COLLECTION_UUID}/items/${ITEM_UUID}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Item removed from collection');
  });

  it('returns 404 when item not found', async () => {
    const user = makeUserA();
    const ws = makeWorkspaceA();
    seedAuthQueries(user, ws);
    mockQuery.mockResolvedValueOnce({ rowCount: 0 } as any);

    const res = await request(createRouteApp(user)).delete(
      `/api/collections/${COLLECTION_UUID}/items/${ITEM_UUID}`,
    );
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

// ===================================================================
// GET /api/collections/:id/items — Get collection items with assets
// ===================================================================
describe('GET /api/collections/:id/items', () => {
  beforeEach(() => {
    resetMock();
  });

  it('401 when not authenticated', async () => {
    const res = await request(createRouteApp()).get(`/api/collections/${COLLECTION_UUID}/items`);
    expect(res.status).toBe(401);
  });

  it('returns items with asset details', async () => {
    const user = makeUserA();
    const ws = makeWorkspaceA();
    seedAuthQueries(user, ws);
    // First query: findCollectionById to verify ownership
    mockQuery.mockResolvedValueOnce({ rows: [makeCollectionRow()] } as any);
    // Second query: getCollectionItemsWithAssets
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: ITEM_UUID,
          collection_id: COLLECTION_UUID,
          asset_type: 'LOOK',
          asset_id: ASSET_UUID,
          created_at: '2026-06-17T10:00:00.000Z',
          asset_name: 'Black Suit',
          asset_type_ref: 'LOOK',
          asset_image_url: 'https://cdn.example.com/black-suit.jpg',
        },
      ],
    } as any);

    const res = await request(createRouteApp(user)).get(
      `/api/collections/${COLLECTION_UUID}/items`,
    );
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(ITEM_UUID);
    expect(res.body[0].asset.name).toBe('Black Suit');
    expect(res.body[0].asset.image_url).toBe('https://cdn.example.com/black-suit.jpg');
  });

  it('returns empty array when collection not found', async () => {
    const user = makeUserA();
    const ws = makeWorkspaceA();
    seedAuthQueries(user, ws);
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createRouteApp(user)).get(
      `/api/collections/${COLLECTION_B_UUID}/items`,
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ===================================================================
// Workspace isolation — User B cannot access User A's collections
// ===================================================================
describe('workspace isolation', () => {
  beforeEach(() => {
    resetMock();
  });

  it('User B cannot GET User A collection', async () => {
    const userB = makeUserB();
    const wsB = makeWorkspaceB();
    seedAuthQueries(userB, wsB);
    // findCollectionById with userB's id returns empty (not their collection)
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createRouteApp(userB)).get(`/api/collections/${COLLECTION_UUID}`);
    expect(res.status).toBe(404);
  });

  it('User B cannot UPDATE User A collection', async () => {
    const userB = makeUserB();
    const wsB = makeWorkspaceB();
    seedAuthQueries(userB, wsB);
    // updateCollection with userB's id returns empty
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createRouteApp(userB))
      .put(`/api/collections/${COLLECTION_UUID}`)
      .send({ name: 'Hacked' });
    expect(res.status).toBe(404);
  });

  it('User B cannot DELETE User A collection', async () => {
    const userB = makeUserB();
    const wsB = makeWorkspaceB();
    seedAuthQueries(userB, wsB);
    // deleteCollection with userB's id returns rowCount 0
    mockQuery.mockResolvedValueOnce({ rowCount: 0 } as any);

    const res = await request(createRouteApp(userB)).delete(`/api/collections/${COLLECTION_UUID}`);
    expect(res.status).toBe(404);
  });

  it('User B cannot ADD ITEMS to User A collection', async () => {
    const userB = makeUserB();
    const wsB = makeWorkspaceB();
    seedAuthQueries(userB, wsB);
    // findCollectionById with userB's id returns empty
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createRouteApp(userB))
      .post(`/api/collections/${COLLECTION_UUID}/items`)
      .send({ asset_type: 'LOOK', asset_id: ASSET_UUID });
    expect(res.status).toBe(404);
  });

  it('User B cannot REMOVE ITEMS from User A collection', async () => {
    const userB = makeUserB();
    const wsB = makeWorkspaceB();
    seedAuthQueries(userB, wsB);
    // removeCollectionItem with userB's id returns rowCount 0
    mockQuery.mockResolvedValueOnce({ rowCount: 0 } as any);

    const res = await request(createRouteApp(userB)).delete(
      `/api/collections/${COLLECTION_UUID}/items/${ITEM_UUID}`,
    );
    expect(res.status).toBe(404);
  });

  it('User B cannot LIST User A collections', async () => {
    const userB = makeUserB();
    const wsB = makeWorkspaceB();
    seedAuthQueries(userB, wsB);
    // listCollections filtered by userB's id returns empty
    mockQuery.mockResolvedValueOnce({ rows: [{ count: 0 }] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createRouteApp(userB)).get('/api/collections');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.totalItems).toBe(0);
  });
});

// ===================================================================
// Duplicate item prevention
// ===================================================================
describe('duplicate item prevention', () => {
  beforeEach(() => {
    resetMock();
  });

  it('adding same asset twice returns unique constraint violation', async () => {
    const user = makeUserA();
    const ws = makeWorkspaceA();
    seedAuthQueries(user, ws);
    // findCollectionById succeeds
    mockQuery.mockResolvedValueOnce({ rows: [makeCollectionRow()] } as any);
    // addCollectionItem throws duplicate key error
    mockQuery.mockRejectedValueOnce(
      new Error('duplicate key value violates unique constraint "idx_collection_items_unique"'),
    );

    const res = await request(createRouteApp(user))
      .post(`/api/collections/${COLLECTION_UUID}/items`)
      .send({ asset_type: 'LOOK', asset_id: ASSET_UUID });
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });
});
