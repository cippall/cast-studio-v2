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
import looksRouter from '../src/routes/looks.js';

const mockQuery = vi.mocked(poolModule.query);

// Valid v4 UUIDs
const WORKSPACE_UUID = 'a0000000-0000-4000-8000-000000000001';
const ARTIST_UUID = 'b0000000-0000-4000-8000-000000000001';
const LOOK_UUID = 'c0000000-0000-4000-8000-000000000002';
const SECOND_LOOK_UUID = 'e0000000-0000-4000-8000-000000000004';
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

function makeLookRow(overrides: Record<string, unknown> = {}) {
  return {
    id: LOOK_UUID,
    workspace_id: WORKSPACE_UUID,
    creator_id: ARTIST_UUID,
    client_id: null,
    asset_type: 'LOOK',
    name: 'Black Suit Editorial',
    seed: 12345,
    prompt_recipe: { prompt: 'Black suit, editorial', identity: null },
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
    asset_id: LOOK_UUID,
    layout_type: 'look',
    model: 'flux-pro',
    image_url: null,
    local_backup_url: null,
    cost_credits: 0.05,
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
  app.use('/api/looks', looksRouter);
  return app;
}

/** Reset mock to pristine state */
function resetMock() {
  mockQuery.mockReset();
}

// ================================================================
// POST /api/looks
// ================================================================
describe('POST /api/looks', () => {
  beforeEach(() => {
    resetMock();
  });

  it('401 when not authenticated', async () => {
    const res = await request(createRouteApp())
      .post('/api/looks')
      .send({ entry_method: 'PROMPT', prompt: 'Black suit' });
    expect(res.status).toBe(401);
  });

  it('422 when entry_method is missing', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);
    const res = await request(createRouteApp(artist)).post('/api/looks').send({});
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('422 when PROMPT without prompt', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);
    const res = await request(createRouteApp(artist))
      .post('/api/looks')
      .send({ entry_method: 'PROMPT' });
    expect(res.status).toBe(422);
  });

  it('422 when REFERENCE without reference_image', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);
    const res = await request(createRouteApp(artist))
      .post('/api/looks')
      .send({ entry_method: 'REFERENCE' });
    expect(res.status).toBe(422);
  });

  it('422 when COMPOSITE without fashion_item_ids', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);
    const res = await request(createRouteApp(artist))
      .post('/api/looks')
      .send({ entry_method: 'COMPOSITE' });
    expect(res.status).toBe(422);
  });

  it('202 creates look with PROMPT entry method, returns 4 PENDING outputs', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    // Mock asset INSERT
    const createdLook = makeLookRow({ name: 'Black Suit Editorial' });
    mockQuery.mockResolvedValueOnce({ rows: [createdLook] } as any);

    // Mock 4 output INSERTs in sequence
    for (let i = 0; i < 4; i++) {
      mockQuery.mockResolvedValueOnce({
        rows: [makeAssetOutputRow({ id: `${OUTPUT_UUID}-${i}` })],
      } as any);
    }

    const res = await request(createRouteApp(artist))
      .post('/api/looks')
      .send({ entry_method: 'PROMPT', prompt: 'Black suit, editorial fashion photography' });

    expect(res.status).toBe(202);
    expect(res.body).toHaveProperty('id');
    expect(res.body.asset_type).toBe('LOOK');
    expect(res.body.outputs).toHaveLength(4);
    expect(res.body.outputs[0]).toMatchObject({
      status: 'PENDING',
      model: 'flux-pro',
      cost_credits: 0.05,
    });
    expect(res.body).toHaveProperty('auto_name');
    expect(res.body).toHaveProperty('created_at');

    // Verify asset INSERT was called
    const insertCall = mockQuery.mock.calls[2];
    expect(insertCall[0]).toContain('INSERT INTO assets');
    expect(insertCall[1]).toContain(WORKSPACE_UUID);
    expect(insertCall[1]).toContain(ARTIST_UUID);
    expect(insertCall[1]).toContain('LOOK');
    // auto_name = 'Black Suit Editorial Fashion' from prompt 'Black suit, editorial fashion photography'
    // The params array should include the auto_name
    const nameInParams = insertCall[1].some(
      (p: unknown) => typeof p === 'string' && p.includes('Black'),
    );
    expect(nameInParams).toBe(true);
  });

  it('202 creates look with REFERENCE entry method', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    const createdLook = makeLookRow({ name: 'New Look' });
    mockQuery.mockResolvedValueOnce({ rows: [createdLook] } as any);
    for (let i = 0; i < 4; i++) {
      mockQuery.mockResolvedValueOnce({
        rows: [makeAssetOutputRow({ id: `${OUTPUT_UUID}-${i}` })],
      } as any);
    }

    const res = await request(createRouteApp(artist))
      .post('/api/looks')
      .send({ entry_method: 'REFERENCE', reference_image: 'base64img' });

    expect(res.status).toBe(202);
    expect(res.body.outputs).toHaveLength(4);
  });

  it('202 creates look with COMPOSITE entry method', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    const createdLook = makeLookRow({ name: 'New Look' });
    mockQuery.mockResolvedValueOnce({ rows: [createdLook] } as any);
    for (let i = 0; i < 4; i++) {
      mockQuery.mockResolvedValueOnce({
        rows: [makeAssetOutputRow({ id: `${OUTPUT_UUID}-${i}` })],
      } as any);
    }

    const res = await request(createRouteApp(artist))
      .post('/api/looks')
      .send({
        entry_method: 'COMPOSITE',
        fashion_item_ids: ['item1-uuid', 'item2-uuid'],
      });

    expect(res.status).toBe(202);
    expect(res.body.outputs).toHaveLength(4);
  });
});

// ================================================================
// GET /api/looks
// ================================================================
describe('GET /api/looks', () => {
  beforeEach(() => {
    resetMock();
  });

  it('401 when not authenticated', async () => {
    const res = await request(createRouteApp()).get('/api/looks');
    expect(res.status).toBe(401);
  });

  it('200 with empty list when no looks', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    mockQuery.mockResolvedValueOnce({ rows: [{ count: 0 }] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createRouteApp(artist)).get('/api/looks');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination).toMatchObject({
      page: 1,
      pageSize: 20,
      totalItems: 0,
      totalPages: 0,
    });
  });

  it('200 with paginated look list', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    const look1 = makeLookRow({
      id: LOOK_UUID,
      name: 'Look 1',
      headshot_url: 'https://fal.ai/1.png',
    });
    const look2 = makeLookRow({ id: SECOND_LOOK_UUID, name: 'Look 2', headshot_url: null });

    mockQuery.mockResolvedValueOnce({ rows: [{ count: 2 }] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [look1, look2] } as any);

    const res = await request(createRouteApp(artist)).get('/api/looks');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].image_url).toBe('https://fal.ai/1.png');
    expect(res.body.data[1].image_url).toBeNull();
    expect(res.body.data[0].asset_type).toBe('LOOK');
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
    mockQuery.mockResolvedValueOnce({ rows: [makeLookRow()] } as any);

    const res = await request(createRouteApp(artist))
      .get('/api/looks')
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
    mockQuery.mockResolvedValueOnce({ rows: [makeLookRow()] } as any);

    const res = await request(createRouteApp(artist))
      .get('/api/looks')
      .query({ creator_id: ARTIST_UUID });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);

    const countCall = mockQuery.mock.calls[2];
    expect(countCall[1]).toContain(ARTIST_UUID);
  });

  it('200 filters by taxonomy key', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    mockQuery.mockResolvedValueOnce({ rows: [{ count: 1 }] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [makeLookRow()] } as any);

    const res = await request(createRouteApp(artist))
      .get('/api/looks')
      .query({ gender: 'women', style: 'formal' });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);

    const countCall = mockQuery.mock.calls[2];
    expect(countCall[1]).toContain('gender');
    expect(countCall[1]).toContain('women');
    expect(countCall[1]).toContain('formal');
  });

  it('200 with admin bypass for admin accounts', async () => {
    const admin = makeAdminRow();
    seedRequireSessionQueries(admin);

    mockQuery.mockResolvedValueOnce({ rows: [{ count: 1 }] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [makeLookRow()] } as any);

    const res = await request(createRouteApp(admin)).get('/api/looks');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});

// ================================================================
// GET /api/looks/:id
// ================================================================
describe('GET /api/looks/:id', () => {
  beforeEach(() => {
    resetMock();
  });

  it('401 when not authenticated', async () => {
    const res = await request(createRouteApp()).get(`/api/looks/${LOOK_UUID}`);
    expect(res.status).toBe(401);
  });

  it('404 when look not found', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createRouteApp(artist)).get(`/api/looks/${LOOK_UUID}`);
    expect(res.status).toBe(404);
  });

  it('404 for non-look asset type', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    const actor = makeLookRow({ asset_type: 'ACTOR' });
    mockQuery.mockResolvedValueOnce({ rows: [actor] } as any);

    const res = await request(createRouteApp(artist)).get(`/api/looks/${LOOK_UUID}`);
    expect(res.status).toBe(404);
  });

  it('200 with full look detail including outputs', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    const look = makeLookRow({ name: 'Test Look' });
    const output1 = makeAssetOutputRow({ id: `${OUTPUT_UUID}-1`, status: 'PENDING' });
    const output2 = makeAssetOutputRow({ id: `${OUTPUT_UUID}-2`, status: 'PENDING' });

    mockQuery.mockResolvedValueOnce({ rows: [look] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [output1, output2] } as any);

    const res = await request(createRouteApp(artist)).get(`/api/looks/${LOOK_UUID}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(LOOK_UUID);
    expect(res.body.name).toBe('Test Look');
    expect(res.body.asset_type).toBe('LOOK');
    expect(res.body.outputs).toHaveLength(2);
  });
});

// ================================================================
// PATCH /api/looks/:id
// ================================================================
describe('PATCH /api/looks/:id', () => {
  beforeEach(() => {
    resetMock();
  });

  it('401 when not authenticated', async () => {
    const res = await request(createRouteApp())
      .patch(`/api/looks/${LOOK_UUID}`)
      .send({ name: 'Renamed' });
    expect(res.status).toBe(401);
  });

  it('422 when no fields to update', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    const res = await request(createRouteApp(artist)).patch(`/api/looks/${LOOK_UUID}`).send({});
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('422 when name is empty string', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    const res = await request(createRouteApp(artist))
      .patch(`/api/looks/${LOOK_UUID}`)
      .send({ name: '' });
    expect(res.status).toBe(422);
  });

  it('200 renames a look', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    // findAssetById (look exists)
    const existingLook = makeLookRow();
    mockQuery.mockResolvedValueOnce({ rows: [existingLook] } as any);
    // updateAsset
    const updatedLook = makeLookRow({ name: 'Renamed Look' });
    mockQuery.mockResolvedValueOnce({ rows: [updatedLook] } as any);
    // getAssetOutputs
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createRouteApp(artist))
      .patch(`/api/looks/${LOOK_UUID}`)
      .send({ name: 'Renamed Look' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Renamed Look');
  });

  it('200 selects an output and renames', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    // findAssetById (look exists)
    const existingLook = makeLookRow();
    mockQuery.mockResolvedValueOnce({ rows: [existingLook] } as any);

    // getAssetOutputs - return 4 outputs
    const output1 = makeAssetOutputRow({ id: `${OUTPUT_UUID}-1` });
    const output2 = makeAssetOutputRow({ id: `${OUTPUT_UUID}-2` });
    const output3 = makeAssetOutputRow({ id: `${OUTPUT_UUID}-3` });
    const output4 = makeAssetOutputRow({ id: `${OUTPUT_UUID}-4` });
    mockQuery.mockResolvedValueOnce({ rows: [output1, output2, output3, output4] } as any);

    // updateOutputsStatus - mark selected as SUCCESS (1 query)
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);
    // updateOutputsStatus - mark rest as FAILED (1 query)
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    // updateAsset - rename
    const renamedLook = makeLookRow({ name: 'Selected Look' });
    mockQuery.mockResolvedValueOnce({ rows: [renamedLook] } as any);
    // getAssetOutputs after update
    mockQuery.mockResolvedValueOnce({ rows: [output1, output2, output3, output4] } as any);

    const res = await request(createRouteApp(artist))
      .patch(`/api/looks/${LOOK_UUID}`)
      .send({ selected_output_id: `${OUTPUT_UUID}-1`, name: 'Selected Look' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Selected Look');
  });

  it('404 when look not found', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createRouteApp(artist))
      .patch(`/api/looks/${LOOK_UUID}`)
      .send({ name: 'Renamed' });
    expect(res.status).toBe(404);
  });

  it('404 when selected_output_id does not exist', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    const existingLook = makeLookRow();
    mockQuery.mockResolvedValueOnce({ rows: [existingLook] } as any);
    // getAssetOutputs - empty (selected output not found among outputs)
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createRouteApp(artist))
      .patch(`/api/looks/${LOOK_UUID}`)
      .send({ selected_output_id: 'nonexistent-output' });
    expect(res.status).toBe(404);
  });
});

// ================================================================
// DELETE /api/looks/:id
// ================================================================
describe('DELETE /api/looks/:id', () => {
  beforeEach(() => {
    resetMock();
  });

  it('401 when not authenticated', async () => {
    const res = await request(createRouteApp()).delete(`/api/looks/${LOOK_UUID}`);
    expect(res.status).toBe(401);
  });

  it('404 when look not found', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createRouteApp(artist)).delete(`/api/looks/${LOOK_UUID}`);
    expect(res.status).toBe(404);
  });

  it('200 soft deletes a look', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    // findAssetById (client_id check)
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: LOOK_UUID,
          workspace_id: WORKSPACE_UUID,
          creator_id: artist.id,
          client_id: null,
          asset_type: 'LOOK',
          name: 'Test Look',
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
    // softDeleteAsset returns a row (success)
    mockQuery.mockResolvedValueOnce({ rows: [{ id: LOOK_UUID }] } as any);

    const res = await request(createRouteApp(artist)).delete(`/api/looks/${LOOK_UUID}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Look deleted successfully' });

    // Verify soft-delete SQL was used
    const deleteCall = mockQuery.mock.calls[3];
    expect(deleteCall[0]).toContain('SET deleted_at = NOW()');
    expect(deleteCall[0]).toContain('assets');
  });
});
