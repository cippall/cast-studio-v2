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
import actorsRouter from '../src/routes/actors.js';
import assetVersionsRouter from '../src/routes/asset-versions.js';

const mockQuery = vi.mocked(poolModule.query);

// Valid v4 UUIDs
const WORKSPACE_UUID = 'a0000000-0000-4000-8000-000000000001';
const ARTIST_UUID = 'b0000000-0000-4000-8000-000000000001';
const OTHER_ARTIST_UUID = 'd0000000-0000-4000-8000-000000000003';
const ACTOR_UUID = 'c0000000-0000-4000-8000-000000000001';
const SECOND_ACTOR_UUID = 'e0000000-0000-4000-8000-000000000004';
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

function makeClientRoleRow(overrides: Record<string, unknown> = {}) {
  return makeAccountRow({
    role: 'CLIENT',
    id: 'client-0000-0000-4000-8000-000000000001',
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

function makeActorRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ACTOR_UUID,
    workspace_id: WORKSPACE_UUID,
    creator_id: ARTIST_UUID,
    client_id: null,
    asset_type: 'ACTOR',
    name: null,
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

function makeAssetOutputRow(overrides: Record<string, unknown> = {}) {
  return {
    id: OUTPUT_UUID,
    asset_id: ACTOR_UUID,
    layout_type: 'headshot',
    model: 'flux-pro',
    image_url: 'https://fal.ai/images/headshot.png',
    local_backup_url: null,
    cost_credits: 0.05,
    status: 'SUCCESS',
    version: 1,
    is_obsolete: false,
    obsolete_reason: null,
    error_message: null,
    generation_params: { seed: 12345 },
    reference_images: null,
    source_asset_outputs: null,
    created_at: '2026-06-17T10:00:00.000Z',
    ...overrides,
  };
}

// --- Test setup helpers ---

/** Seed mockQuery so requireSession succeeds (consumes 2 calls) */
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
  app.use('/api/actors', actorsRouter);
  return app;
}

/** Build express app with asset-versions router for duplicate endpoint tests */
function createDuplicateApp(accountOverride?: Record<string, unknown>) {
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
  app.use('/api/assets', assetVersionsRouter);
  return app;
}

/** Reset mock to pristine state */
function resetMock() {
  mockQuery.mockReset();
}

// ================================================================
// POST /api/actors
// ================================================================
describe('POST /api/actors', () => {
  beforeEach(() => {
    resetMock();
  });

  it('401 when not authenticated', async () => {
    const res = await request(createRouteApp())
      .post('/api/actors')
      .send({ entry_method: 'RANDOMIZE' });
    expect(res.status).toBe(401);
  });

  it('422 when entry_method is missing', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);
    const res = await request(createRouteApp(artist)).post('/api/actors').send({});
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('422 when entry_method is invalid', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);
    const res = await request(createRouteApp(artist))
      .post('/api/actors')
      .send({ entry_method: 'INVALID' });
    expect(res.status).toBe(422);
  });

  it('422 when REFERENCE without reference_image', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);
    const res = await request(createRouteApp(artist))
      .post('/api/actors')
      .send({ entry_method: 'REFERENCE' });
    expect(res.status).toBe(422);
  });

  it('422 when TEXT without prompt', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);
    const res = await request(createRouteApp(artist))
      .post('/api/actors')
      .send({ entry_method: 'TEXT' });
    expect(res.status).toBe(422);
  });

  it('201 creates actor with RANDOMIZE entry method', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    // Mock the INSERT result
    const createdActor = makeActorRow();
    mockQuery.mockResolvedValueOnce({ rows: [createdActor] } as any);

    const res = await request(createRouteApp(artist))
      .post('/api/actors')
      .send({ entry_method: 'RANDOMIZE' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: ACTOR_UUID,
      asset_type: 'ACTOR',
      outputs: {},
    });
    expect(res.body).toHaveProperty('seed');
    expect(res.body).toHaveProperty('prompt_recipe');
    expect(res.body).toHaveProperty('created_at');

    // Verify the INSERT query was called with correct params
    const insertCall = mockQuery.mock.calls[2]; // After 2 auth queries
    expect(insertCall[0]).toContain('INSERT INTO assets');
    expect(insertCall[1]).toContain(WORKSPACE_UUID);
    expect(insertCall[1]).toContain(ARTIST_UUID);
    expect(insertCall[1]).toContain('ACTOR');
  });

  it('201 creates actor with FORM entry method and form_data', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    const createdActor = makeActorRow({
      prompt_recipe: { identity: { age: 30, vibe: 'cyberpunk' } },
    });
    mockQuery.mockResolvedValueOnce({ rows: [createdActor] } as any);

    const res = await request(createRouteApp(artist))
      .post('/api/actors')
      .send({
        entry_method: 'FORM',
        form_data: { age: 30, vibe: 'cyberpunk' },
      });

    expect(res.status).toBe(201);
    expect(res.body.prompt_recipe.identity).toEqual({ age: 30, vibe: 'cyberpunk' });
  });

  it('201 creates actor with TEXT entry method', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    const createdActor = makeActorRow({
      prompt_recipe: { identity: null, prompt: 'A tall warrior with blue eyes', style: null },
    });
    mockQuery.mockResolvedValueOnce({ rows: [createdActor] } as any);

    const res = await request(createRouteApp(artist)).post('/api/actors').send({
      entry_method: 'TEXT',
      prompt: 'A tall warrior with blue eyes',
    });

    expect(res.status).toBe(201);
    expect(res.body.prompt_recipe.prompt).toBe('A tall warrior with blue eyes');
  });

  it('201 creates actor with REFERENCE entry method', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    const createdActor = makeActorRow({
      prompt_recipe: { identity: null, reference_image: 'base64data', style: null },
    });
    mockQuery.mockResolvedValueOnce({ rows: [createdActor] } as any);

    const res = await request(createRouteApp(artist)).post('/api/actors').send({
      entry_method: 'REFERENCE',
      reference_image: 'base64data',
    });

    expect(res.status).toBe(201);
    expect(res.body.prompt_recipe.reference_image).toBe('base64data');
  });
});

// ================================================================
// GET /api/actors
// ================================================================
describe('GET /api/actors', () => {
  beforeEach(() => {
    resetMock();
  });

  it('401 when not authenticated', async () => {
    const res = await request(createRouteApp()).get('/api/actors');
    expect(res.status).toBe(401);
  });

  it('200 with empty list when no actors', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    // Count returns 0
    mockQuery.mockResolvedValueOnce({ rows: [{ count: 0 }] } as any);
    // Data query returns empty (still fires, just doesn't return rows)
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createRouteApp(artist)).get('/api/actors');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination).toMatchObject({
      page: 1,
      pageSize: 20,
      totalItems: 0,
      totalPages: 0,
    });
  });

  it('200 with paginated actor list', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    const actor1 = makeActorRow({
      id: ACTOR_UUID,
      name: 'Actor 1',
      headshot_url: 'https://fal.ai/1.png',
    });
    const actor2 = makeActorRow({ id: SECOND_ACTOR_UUID, name: 'Actor 2', headshot_url: null });

    mockQuery.mockResolvedValueOnce({ rows: [{ count: 2 }] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [actor1, actor2] } as any);

    const res = await request(createRouteApp(artist)).get('/api/actors');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].headshot_url).toBe('https://fal.ai/1.png');
    expect(res.body.data[1].headshot_url).toBeNull();
    expect(res.body.pagination).toMatchObject({
      page: 1,
      pageSize: 20,
      totalItems: 2,
      totalPages: 1,
    });
  });

  it('200 respects pagination params', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    mockQuery.mockResolvedValueOnce({ rows: [{ count: 50 }] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [makeActorRow()] } as any);

    const res = await request(createRouteApp(artist))
      .get('/api/actors')
      .query({ page: 3, pageSize: 10 });
    expect(res.status).toBe(200);
    expect(res.body.pagination).toMatchObject({
      page: 3,
      pageSize: 10,
      totalItems: 50,
      totalPages: 5,
    });
  });

  it('200 filters by creator_id', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    mockQuery.mockResolvedValueOnce({ rows: [{ count: 1 }] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [makeActorRow()] } as any);

    const res = await request(createRouteApp(artist))
      .get('/api/actors')
      .query({ creator_id: ARTIST_UUID });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);

    // Verify creator_id was in the SQL params
    const countCall = mockQuery.mock.calls[2];
    expect(countCall[1]).toContain(ARTIST_UUID);
  });

  it('200 filters by taxonomy key', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    mockQuery.mockResolvedValueOnce({ rows: [{ count: 1 }] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [makeActorRow()] } as any);

    const res = await request(createRouteApp(artist))
      .get('/api/actors')
      .query({ age: '25', gender: 'female' });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);

    // Verify taxonomy filters were passed as params (key and value)
    const countCall = mockQuery.mock.calls[2];
    expect(countCall[1]).toContain('age');
    expect(countCall[1]).toContain('25');
    expect(countCall[1]).toContain('female');
    expect(countCall[0]).toContain("prompt_recipe -> 'identity'");
  });

  it('200 with admin bypass for admin accounts', async () => {
    const admin = makeAdminRow();
    seedRequireSessionQueries(admin);

    mockQuery.mockResolvedValueOnce({ rows: [{ count: 1 }] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [makeActorRow()] } as any);

    const res = await request(createRouteApp(admin)).get('/api/actors');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);

    // Admin bypass: no workspace_id filter in the query
    const countCall = mockQuery.mock.calls[2] as [string, unknown[]];
    expect(countCall[0]).not.toContain('workspace_id');
  });

  it('200 client sees purchased assets via client_id filter', async () => {
    const client = makeClientRoleRow();
    seedRequireSessionQueries(client);

    mockQuery.mockResolvedValueOnce({ rows: [{ count: 1 }] } as any);
    mockQuery.mockResolvedValueOnce({
      rows: [makeActorRow({ workspace_id: 'other-workspace-uuid', client_id: client.id })],
    } as any);

    const res = await request(createRouteApp(client)).get('/api/actors');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);

    // Verify the query uses (workspace_id = $X OR client_id = $Y) pattern
    const dataCall = mockQuery.mock.calls[3] as [string, unknown[]];
    expect(dataCall[0]).toContain('client_id');
    expect(dataCall[0]).toContain('OR');
    expect(dataCall[1]).toContain(client.id);
  });
});

// ================================================================
// GET /api/actors/:id
// ================================================================
describe('GET /api/actors/:id', () => {
  beforeEach(() => {
    resetMock();
  });

  it('401 when not authenticated', async () => {
    const res = await request(createRouteApp()).get(`/api/actors/${ACTOR_UUID}`);
    expect(res.status).toBe(401);
  });

  it('404 when actor not found', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    // findAssetById returns empty
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createRouteApp(artist)).get(`/api/actors/${ACTOR_UUID}`);
    expect(res.status).toBe(404);
  });

  it('404 for non-actor asset type', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    // Return an asset that's not an ACTOR
    const look = makeActorRow({ asset_type: 'LOOK' });
    mockQuery.mockResolvedValueOnce({ rows: [look] } as any);

    const res = await request(createRouteApp(artist)).get(`/api/actors/${ACTOR_UUID}`);
    expect(res.status).toBe(404);
  });

  it('200 with full actor detail including outputs grouped by layout_type', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    const actor = makeActorRow({ name: 'Test Actor' });
    const headshot = makeAssetOutputRow({
      layout_type: 'headshot',
      image_url: 'https://fal.ai/headshot.png',
      status: 'SUCCESS',
    });
    const fullshot = makeAssetOutputRow({
      id: 'f0000000-0000-4000-8000-000000000006',
      layout_type: 'fullshot',
      image_url: 'https://fal.ai/fullshot.png',
      status: 'SUCCESS',
    });

    // findAssetById (route-level access check)
    mockQuery.mockResolvedValueOnce({ rows: [actor] } as any);
    // checkAssetAccess returns early (artist is creator, no DB call needed)
    // findAssetById (inside actorService.getActor)
    mockQuery.mockResolvedValueOnce({ rows: [actor] } as any);
    // getAssetOutputs
    mockQuery.mockResolvedValueOnce({ rows: [headshot, fullshot] } as any);

    const res = await request(createRouteApp(artist)).get(`/api/actors/${ACTOR_UUID}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(ACTOR_UUID);
    expect(res.body.name).toBe('Test Actor');
    expect(res.body.asset_type).toBe('ACTOR');

    // Outputs should be grouped by layout_type
    expect(res.body.outputs).toHaveProperty('headshot');
    expect(res.body.outputs).toHaveProperty('fullshot');
    expect(res.body.outputs).toHaveProperty('expressions_3x4', null);
    expect(res.body.outputs).toHaveProperty('character_sheet', null);
    expect(res.body.outputs).toHaveProperty('editorial', null);
    expect(res.body.outputs.headshot.image_url).toBe('https://fal.ai/headshot.png');

    // Taxonomy values extracted from prompt_recipe
    expect(res.body.taxonomy_values).toEqual({ age: 25, gender: 'female' });
  });
});

// ================================================================
// PATCH /api/actors/:id
// ================================================================
describe('PATCH /api/actors/:id', () => {
  beforeEach(() => {
    resetMock();
  });

  it('401 when not authenticated', async () => {
    const res = await request(createRouteApp())
      .patch(`/api/actors/${ACTOR_UUID}`)
      .send({ name: 'Renamed' });
    expect(res.status).toBe(401);
  });

  it('422 when no fields to update', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);
    const res = await request(createRouteApp(artist)).patch(`/api/actors/${ACTOR_UUID}`).send({});
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('404 when actor not found', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    // findAssetById returns empty (actor doesn't exist)
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createRouteApp(artist))
      .patch(`/api/actors/${ACTOR_UUID}`)
      .send({ name: 'Renamed' });
    expect(res.status).toBe(404);
  });

  it('200 updates actor name', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    // findAssetById result
    const actor = makeActorRow({ name: null });
    mockQuery.mockResolvedValueOnce({ rows: [actor] } as any);

    // updateAsset result
    const updated = makeActorRow({ name: 'Cyberpunk Woman' });
    mockQuery.mockResolvedValueOnce({ rows: [updated] } as any);

    // getAssetOutputs (returns empty for now)
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createRouteApp(artist))
      .patch(`/api/actors/${ACTOR_UUID}`)
      .send({ name: 'Cyberpunk Woman' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Cyberpunk Woman');
  });

  it('200 updates taxonomy_values (merges with existing)', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    // findAssetById — current actor has prompt_recipe.identity
    const actor = makeActorRow({
      prompt_recipe: { identity: { age: 25, gender: 'female' } },
    });
    mockQuery.mockResolvedValueOnce({ rows: [actor] } as any);

    // updateAsset result — taxonomy_values merged
    const updated = makeActorRow({
      name: null,
      prompt_recipe: { identity: { age: 25, gender: 'female', vibe: 'steampunk' } },
    });
    mockQuery.mockResolvedValueOnce({ rows: [updated] } as any);

    // getAssetOutputs
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createRouteApp(artist))
      .patch(`/api/actors/${ACTOR_UUID}`)
      .send({ taxonomy_values: { vibe: 'steampunk' } });
    expect(res.status).toBe(200);
    expect(res.body.taxonomy_values).toEqual({ age: 25, gender: 'female', vibe: 'steampunk' });
  });

  it('200 updates both name and taxonomy_values', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    const actor = makeActorRow({
      name: null,
      prompt_recipe: { identity: { age: 25 } },
    });
    mockQuery.mockResolvedValueOnce({ rows: [actor] } as any);

    const updated = makeActorRow({
      name: 'New Name',
      prompt_recipe: { identity: { age: 25, gender: 'male' } },
    });
    mockQuery.mockResolvedValueOnce({ rows: [updated] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createRouteApp(artist))
      .patch(`/api/actors/${ACTOR_UUID}`)
      .send({ name: 'New Name', taxonomy_values: { gender: 'male' } });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New Name');
    expect(res.body.taxonomy_values).toEqual({ age: 25, gender: 'male' });
  });
});

// ================================================================
// DELETE /api/actors/:id
// ================================================================
describe('DELETE /api/actors/:id', () => {
  beforeEach(() => {
    resetMock();
  });

  it('401 when not authenticated', async () => {
    const res = await request(createRouteApp()).delete(`/api/actors/${ACTOR_UUID}`);
    expect(res.status).toBe(401);
  });

  it('404 when actor not found', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    // softDeleteAsset returns no rows
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createRouteApp(artist)).delete(`/api/actors/${ACTOR_UUID}`);
    expect(res.status).toBe(404);
  });

  it('200 soft-deletes actor', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    // findAssetById (client_id check)
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: ACTOR_UUID,
          workspace_id: WORKSPACE_UUID,
          creator_id: artist.id,
          client_id: null,
          asset_type: 'ACTOR',
          name: 'Test Actor',
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
    // softDeleteAsset returns the deleted id
    mockQuery.mockResolvedValueOnce({ rows: [{ id: ACTOR_UUID }] } as any);

    const res = await request(createRouteApp(artist)).delete(`/api/actors/${ACTOR_UUID}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Actor deleted successfully');

    // Verify the soft delete SQL
    const deleteCall = mockQuery.mock.calls[3] as [string, unknown[]];
    expect(deleteCall[0]).toContain('UPDATE assets');
    expect(deleteCall[0]).toContain('deleted_at = NOW()');
    expect(deleteCall[1]).toContain(ACTOR_UUID);
    expect(deleteCall[1]).toContain(WORKSPACE_UUID);
  });

  it('200 admin bypass for admin accounts (no workspace_id filter)', async () => {
    const admin = makeAdminRow();
    seedRequireSessionQueries(admin);

    // findAssetById (client_id check)
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: ACTOR_UUID,
          workspace_id: WORKSPACE_UUID,
          creator_id: 'some-creator',
          client_id: null,
          asset_type: 'ACTOR',
          name: 'Test Actor',
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
    mockQuery.mockResolvedValueOnce({ rows: [{ id: ACTOR_UUID }] } as any);

    const res = await request(createRouteApp(admin)).delete(`/api/actors/${ACTOR_UUID}`);
    expect(res.status).toBe(200);

    // Admin bypass: no workspace_id in the WHERE clause
    const deleteCall = mockQuery.mock.calls[3] as [string, unknown[]];
    expect(deleteCall[0]).not.toContain('workspace_id');
  });
});

// ================================================================
// POST /api/assets/:id/duplicate
// ================================================================
describe('POST /api/assets/:id/duplicate', () => {
  beforeEach(() => {
    resetMock();
  });

  it('401 when not authenticated', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/assets', assetVersionsRouter);
    const res = await request(app).post(`/api/assets/${ACTOR_UUID}/duplicate`).send({});
    expect(res.status).toBe(401);
  });

  it('404 when actor not found', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    // findAssetById returns empty
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createDuplicateApp(artist))
      .post(`/api/assets/${ACTOR_UUID}/duplicate`)
      .send({});
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('201 duplicates actor with same seed, prompt_recipe, and outputs', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    const sourceActor = makeActorRow({
      name: 'Original Actor',
      seed: 12345,
      prompt_recipe: { identity: { age: 25, gender: 'female' } },
    });
    const headshot = makeAssetOutputRow({
      id: 'f0000000-0000-4000-8000-000000000005',
      layout_type: 'headshot',
      image_url: 'https://fal.ai/headshot.png',
      status: 'SUCCESS',
    });
    const fullshot = makeAssetOutputRow({
      id: 'f0000000-0000-4000-8000-000000000006',
      layout_type: 'fullshot',
      image_url: 'https://fal.ai/fullshot.png',
      status: 'SUCCESS',
    });

    // findAssetById (in duplicateActor service)
    mockQuery.mockResolvedValueOnce({ rows: [sourceActor] } as any);

    // INSERT INTO assets (duplicateAsset)
    const newActorId = 'a1000000-0000-4000-8000-000000000001';
    const duplicatedActor = {
      ...sourceActor,
      id: newActorId,
      name: 'Duplicated Actor',
      source_asset_id: ACTOR_UUID,
      source_type: 'DUPLICATE',
      created_at: '2026-06-17T12:00:00.000Z',
    };
    mockQuery.mockResolvedValueOnce({ rows: [duplicatedActor] } as any);

    // INSERT INTO asset_outputs (duplicateAssetOutputs)
    const newHeadshotId = 'b1000000-0000-4000-8000-000000000001';
    const newFullshotId = 'b1000000-0000-4000-8000-000000000002';
    mockQuery.mockResolvedValueOnce({
      rows: [
        { ...headshot, id: newHeadshotId, asset_id: newActorId },
        { ...fullshot, id: newFullshotId, asset_id: newActorId },
      ],
    } as any);

    const res = await request(createDuplicateApp(artist))
      .post(`/api/assets/${ACTOR_UUID}/duplicate`)
      .send({ name: 'Duplicated Actor' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(newActorId);
    expect(res.body.name).toBe('Duplicated Actor');
    expect(res.body.asset_type).toBe('ACTOR');
    expect(res.body.seed).toBe(12345);
    expect(res.body.prompt_recipe).toEqual({ identity: { age: 25, gender: 'female' } });

    // Verify outputs are duplicated with new IDs but same image URLs
    expect(res.body.outputs.headshot).not.toBeNull();
    expect(res.body.outputs.headshot.id).toBe(newHeadshotId);
    expect(res.body.outputs.headshot.image_url).toBe('https://fal.ai/headshot.png');
    expect(res.body.outputs.fullshot).not.toBeNull();
    expect(res.body.outputs.fullshot.id).toBe(newFullshotId);
    expect(res.body.outputs.fullshot.image_url).toBe('https://fal.ai/fullshot.png');

    // Verify the duplicate asset INSERT included source_asset_id and source_type
    // Calls: [0]=session, [1]=workspace, [2]=findAssetById, [3]=INSERT assets, [4]=INSERT outputs
    const insertCall = mockQuery.mock.calls[3] as [string, unknown[]];
    expect(insertCall[0]).toContain('INSERT INTO assets');
    expect(insertCall[1]).toContain(ACTOR_UUID); // source_asset_id
    expect(insertCall[1]).toContain('DUPLICATE'); // source_type
  });

  it('201 duplicates actor without name (null name)', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    const sourceActor = makeActorRow({ name: 'Original' });

    // findAssetById
    mockQuery.mockResolvedValueOnce({ rows: [sourceActor] } as any);

    // INSERT INTO assets
    const newActorId = 'a1000000-0000-4000-8000-000000000001';
    const duplicatedActor = {
      ...sourceActor,
      id: newActorId,
      name: null,
      source_asset_id: ACTOR_UUID,
      source_type: 'DUPLICATE',
    };
    mockQuery.mockResolvedValueOnce({ rows: [duplicatedActor] } as any);

    // INSERT INTO asset_outputs (no outputs)
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createDuplicateApp(artist))
      .post(`/api/assets/${ACTOR_UUID}/duplicate`)
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(newActorId);
    expect(res.body.name).toBeNull();
  });

  it('201 duplicate is editable (not frozen, no marketplace_status)', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    const sourceActor = makeActorRow({
      marketplace_status: 'MARKETPLACE_APPROVED',
      is_marketplace_frozen: true,
    });

    // findAssetById
    mockQuery.mockResolvedValueOnce({ rows: [sourceActor] } as any);

    // INSERT INTO assets — duplicate should NOT inherit marketplace_status or frozen
    const newActorId = 'a1000000-0000-4000-8000-000000000001';
    const duplicatedActor = {
      ...sourceActor,
      id: newActorId,
      marketplace_status: null,
      is_marketplace_frozen: false,
      source_asset_id: ACTOR_UUID,
      source_type: 'DUPLICATE',
    };
    mockQuery.mockResolvedValueOnce({ rows: [duplicatedActor] } as any);

    // No outputs
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createDuplicateApp(artist))
      .post(`/api/assets/${ACTOR_UUID}/duplicate`)
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(newActorId);
  });

  it('422 when name is empty string', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    const res = await request(createDuplicateApp(artist))
      .post(`/api/assets/${ACTOR_UUID}/duplicate`)
      .send({ name: '' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
