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
import generationJobsRouter from '../src/routes/generation-jobs.js';

const mockQuery = vi.mocked(poolModule.query);

// Valid v4 UUIDs
const WORKSPACE_UUID = 'a0000000-0000-4000-8000-000000000001';
const ARTIST_UUID = 'b0000000-0000-4000-8000-000000000001';
const ACTOR_UUID = 'c0000000-0000-4000-8000-000000000001';
const LOOK_UUID = 'd0000000-0000-4000-8000-000000000002';
const OUTPUT_UUID = 'e0000000-0000-4000-8000-000000000003';
const SECOND_OUTPUT_UUID = 'f0000000-0000-4000-8000-000000000004';

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
    name: 'Test Actor',
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

function makeLookRow(overrides: Record<string, unknown> = {}) {
  return {
    id: LOOK_UUID,
    workspace_id: WORKSPACE_UUID,
    creator_id: ARTIST_UUID,
    client_id: null,
    asset_type: 'LOOK',
    name: 'Test Look',
    seed: 54321,
    prompt_recipe: { prompt: 'A cool look' },
    marketplace_status: null,
    is_marketplace_frozen: false,
    source_asset_id: null,
    source_type: 'ORIGINAL',
    deleted_at: null,
    created_at: '2026-06-17T10:00:00.000Z',
    ...overrides,
  };
}

function makeOutputRow(overrides: Record<string, unknown> = {}) {
  return {
    id: OUTPUT_UUID,
    asset_id: ACTOR_UUID,
    layout_type: 'headshot',
    model: 'flux-pro',
    image_url: null,
    local_backup_url: null,
    cost_credits: 0.05,
    status: 'PENDING',
    version: 1,
    is_obsolete: false,
    obsolete_reason: null,
    error_message: null,
    generation_params: { seed: 12345, prompt: 'test', model: 'flux-pro', num_outputs: 1 },
    reference_images: null,
    source_asset_outputs: null,
    created_at: '2026-06-17T10:00:00.000Z',
    ...overrides,
  };
}

function makeVersionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'v1-0000-0000-4000-8000-000000000001',
    asset_output_id: OUTPUT_UUID,
    version: 1,
    image_url: 'https://fal.ai/old.png',
    local_backup_url: null,
    model: 'flux-pro',
    cost_credits: 0.05,
    status: 'SUCCESS',
    generation_params: { seed: 11111 },
    reference_images: null,
    source_asset_outputs: null,
    error_message: null,
    created_at: '2026-06-17T09:00:00.000Z',
    ...overrides,
  };
}

// --- Test setup helpers ---

function seedRequireSessionQueries(accountRow: Record<string, unknown>) {
  mockQuery.mockResolvedValueOnce({ rows: [accountRow] } as any);
  mockQuery.mockResolvedValueOnce({ rows: [makeWorkspaceRow()] } as any);
}

/** Mock the 3 wallet queries for reserveCreditsForGeneration (findWallet, updateWalletBalance, createLedgerEntry) */
function seedWalletCreditMocks(accountId: string) {
  mockQuery.mockResolvedValueOnce({
    rows: [
      {
        id: 'wallet-uuid',
        workspace_id: WORKSPACE_UUID,
        account_id: accountId,
        balance_credits: '1000.0000',
        updated_at: '2026-06-17T10:00:00.000Z',
      },
    ],
  } as any);
  mockQuery.mockResolvedValueOnce({
    rows: [
      {
        id: 'wallet-uuid',
        workspace_id: WORKSPACE_UUID,
        account_id: accountId,
        balance_credits: '999.9500',
        updated_at: '2026-06-17T10:00:00.000Z',
      },
    ],
  } as any);
  mockQuery.mockResolvedValueOnce({
    rows: [
      {
        id: 'ledger-uuid',
        workspace_id: WORKSPACE_UUID,
        wallet_id: 'wallet-uuid',
        workflow_id: null,
        api_key_id: null,
        amount: -0.05,
        type: 'CHARGE',
        created_at: '2026-06-17T10:00:00.000Z',
      },
    ],
  } as any);
}

function resetMock() {
  mockQuery.mockReset();
}

/** Build express app with actors routes and fake session */
function createActorsApp(accountOverride?: Record<string, unknown>) {
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

/** Build express app with generation-jobs routes and fake session */
function createJobsApp(accountOverride?: Record<string, unknown>) {
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
  app.use('/api/generation-jobs', generationJobsRouter);
  return app;
}

// ================================================================
// POST /api/actors/:id/generate
// ================================================================
describe('POST /api/actors/:id/generate', () => {
  beforeEach(() => {
    resetMock();
  });

  it('401 when not authenticated', async () => {
    const res = await request(createActorsApp())
      .post(`/api/actors/${ACTOR_UUID}/generate`)
      .send({ layout_type: 'headshot' });
    expect(res.status).toBe(401);
  });

  it('422 when layout_type is missing', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);
    const res = await request(createActorsApp(artist))
      .post(`/api/actors/${ACTOR_UUID}/generate`)
      .send({});
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('422 when layout_type is invalid', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);
    const res = await request(createActorsApp(artist))
      .post(`/api/actors/${ACTOR_UUID}/generate`)
      .send({ layout_type: 'invalid_type' });
    expect(res.status).toBe(422);
  });

  it('404 when actor not found', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);
    // findAssetById returns empty
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createActorsApp(artist))
      .post(`/api/actors/${ACTOR_UUID}/generate`)
      .send({ layout_type: 'headshot' });
    expect(res.status).toBe(404);
  });

  it('202 creates PENDING output and returns outputs array', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    // findAssetById returns actor
    const actor = makeActorRow();
    mockQuery.mockResolvedValueOnce({ rows: [actor] } as any);
    // reserveCreditsForGeneration: findWallet, updateWalletBalance, createLedgerEntry
    seedWalletCreditMocks(ARTIST_UUID);
    // createAssetOutput returns PENDING output
    const output = makeOutputRow();
    mockQuery.mockResolvedValueOnce({ rows: [output] } as any);

    const res = await request(createActorsApp(artist))
      .post(`/api/actors/${ACTOR_UUID}/generate`)
      .send({ layout_type: 'headshot' });

    expect(res.status).toBe(202);
    expect(res.body).toHaveProperty('outputs');
    expect(res.body.outputs).toHaveLength(1);
    expect(res.body.outputs[0]).toMatchObject({
      id: OUTPUT_UUID,
      layout_type: 'headshot',
      status: 'PENDING',
      model: 'flux-pro',
      cost_credits: 0.05,
    });
  });

  it('202 creates multiple outputs when num_outputs is specified', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    const actor = makeActorRow();
    mockQuery.mockResolvedValueOnce({ rows: [actor] } as any);

    // reserveCreditsForGeneration for output 1
    seedWalletCreditMocks(ARTIST_UUID);

    // Two outputs
    const output1 = makeOutputRow({ id: OUTPUT_UUID });
    const output2 = makeOutputRow({ id: SECOND_OUTPUT_UUID });
    mockQuery.mockResolvedValueOnce({ rows: [output1] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [output2] } as any);

    const res = await request(createActorsApp(artist))
      .post(`/api/actors/${ACTOR_UUID}/generate`)
      .send({ layout_type: 'fullshot', options: { num_outputs: 2 } });

    expect(res.status).toBe(202);
    expect(res.body.outputs).toHaveLength(2);
  });

  it('409 when actor is marketplace frozen', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    const frozenActor = makeActorRow({ is_marketplace_frozen: true });
    mockQuery.mockResolvedValueOnce({ rows: [frozenActor] } as any);

    const res = await request(createActorsApp(artist))
      .post(`/api/actors/${ACTOR_UUID}/generate`)
      .send({ layout_type: 'headshot' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('202 for editorial layout type', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    const actor = makeActorRow();
    mockQuery.mockResolvedValueOnce({ rows: [actor] } as any);
    // reserveCreditsForGeneration: findWallet, updateWalletBalance, createLedgerEntry
    seedWalletCreditMocks(ARTIST_UUID);
    const output = makeOutputRow({ layout_type: 'editorial' });
    mockQuery.mockResolvedValueOnce({ rows: [output] } as any);

    const res = await request(createActorsApp(artist))
      .post(`/api/actors/${ACTOR_UUID}/generate`)
      .send({ layout_type: 'editorial' });

    expect(res.status).toBe(202);
    expect(res.body.outputs[0].layout_type).toBe('editorial');
  });
});

// ================================================================
// POST /api/actors/:id/regenerate
// ================================================================
describe('POST /api/actors/:id/regenerate', () => {
  beforeEach(() => {
    resetMock();
  });

  it('401 when not authenticated', async () => {
    const res = await request(createActorsApp())
      .post(`/api/actors/${ACTOR_UUID}/regenerate`)
      .send({ layout_type: 'headshot' });
    expect(res.status).toBe(401);
  });

  it('422 when layout_type is missing', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);
    const res = await request(createActorsApp(artist))
      .post(`/api/actors/${ACTOR_UUID}/regenerate`)
      .send({});
    expect(res.status).toBe(422);
  });

  it('404 when actor not found', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createActorsApp(artist))
      .post(`/api/actors/${ACTOR_UUID}/regenerate`)
      .send({ layout_type: 'headshot' });
    expect(res.status).toBe(404);
  });

  it('202 archives old output, creates new with version+1, marks downstream obsolete', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    const actor = makeActorRow();
    mockQuery.mockResolvedValueOnce({ rows: [actor] } as any);

    // reserveCreditsForGeneration: findWallet, updateWalletBalance, createLedgerEntry
    seedWalletCreditMocks(ARTIST_UUID);

    // getAssetOutputs returns current outputs (headshot v1, fullshot v1)
    const oldHeadshot = makeOutputRow({
      id: OUTPUT_UUID,
      layout_type: 'headshot',
      status: 'SUCCESS',
      version: 1,
      image_url: 'https://fal.ai/old-headshot.png',
    });
    const fullshot = makeOutputRow({
      id: SECOND_OUTPUT_UUID,
      layout_type: 'fullshot',
      status: 'SUCCESS',
      version: 1,
      image_url: 'https://fal.ai/fullshot.png',
    });
    mockQuery.mockResolvedValueOnce({ rows: [oldHeadshot, fullshot] } as any);

    // archiveAssetOutput: SELECT from asset_outputs
    mockQuery.mockResolvedValueOnce({ rows: [oldHeadshot] } as any);
    // archiveAssetOutput: INSERT into asset_output_versions
    mockQuery.mockResolvedValueOnce({ rowCount: 1 } as any);

    // markDownstreamObsolete: UPDATE asset_outputs SET is_obsolete
    mockQuery.mockResolvedValueOnce({ rowCount: 1 } as any);

    // createAssetOutput: INSERT new output
    const newHeadshot = makeOutputRow({ version: 2 });
    mockQuery.mockResolvedValueOnce({ rows: [newHeadshot] } as any);

    const res = await request(createActorsApp(artist))
      .post(`/api/actors/${ACTOR_UUID}/regenerate`)
      .send({ layout_type: 'headshot' });

    expect(res.status).toBe(202);
    expect(res.body.outputs).toHaveLength(1);
    expect(res.body.outputs[0].status).toBe('PENDING');
  });
});

// ================================================================
// POST /api/actors/:id/character-sheet
// ================================================================
describe('POST /api/actors/:id/character-sheet', () => {
  beforeEach(() => {
    resetMock();
  });

  it('401 when not authenticated', async () => {
    const res = await request(createActorsApp())
      .post(`/api/actors/${ACTOR_UUID}/character-sheet`)
      .send({ look_id: LOOK_UUID });
    expect(res.status).toBe(401);
  });

  it('422 when look_id is missing', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);
    const res = await request(createActorsApp(artist))
      .post(`/api/actors/${ACTOR_UUID}/character-sheet`)
      .send({});
    expect(res.status).toBe(422);
  });

  it('422 when look_id is not a valid UUID', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);
    const res = await request(createActorsApp(artist))
      .post(`/api/actors/${ACTOR_UUID}/character-sheet`)
      .send({ look_id: 'not-a-uuid' });
    expect(res.status).toBe(422);
  });

  it('404 when actor not found', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createActorsApp(artist))
      .post(`/api/actors/${ACTOR_UUID}/character-sheet`)
      .send({ look_id: LOOK_UUID });
    expect(res.status).toBe(404);
  });

  it('404 when look not found', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    const actor = makeActorRow();
    mockQuery.mockResolvedValueOnce({ rows: [actor] } as any);
    // Look not found
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createActorsApp(artist))
      .post(`/api/actors/${ACTOR_UUID}/character-sheet`)
      .send({ look_id: LOOK_UUID });
    expect(res.status).toBe(404);
  });

  it('202 creates character_sheet output with source asset references', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    const actor = makeActorRow();
    mockQuery.mockResolvedValueOnce({ rows: [actor] } as any);

    const look = makeLookRow();
    mockQuery.mockResolvedValueOnce({ rows: [look] } as any);

    // reserveCreditsForGeneration: findWallet, updateWalletBalance, createLedgerEntry
    seedWalletCreditMocks(ARTIST_UUID);

    // getAssetOutputs for actor — headshot exists
    const headshot = makeOutputRow({
      layout_type: 'headshot',
      status: 'SUCCESS',
      image_url: 'https://fal.ai/headshot.png',
    });
    mockQuery.mockResolvedValueOnce({ rows: [headshot] } as any);

    // getAssetOutputs for look — selected output exists
    const lookOutput = makeOutputRow({
      id: SECOND_OUTPUT_UUID,
      asset_id: LOOK_UUID,
      layout_type: 'look',
      status: 'SUCCESS',
    });
    mockQuery.mockResolvedValueOnce({ rows: [lookOutput] } as any);

    // createAssetOutput for character_sheet
    const charSheetOutput = makeOutputRow({
      layout_type: 'character_sheet',
    });
    mockQuery.mockResolvedValueOnce({ rows: [charSheetOutput] } as any);

    const res = await request(createActorsApp(artist))
      .post(`/api/actors/${ACTOR_UUID}/character-sheet`)
      .send({ look_id: LOOK_UUID });

    expect(res.status).toBe(202);
    expect(res.body.layout_type).toBe('character_sheet');
    expect(res.body.status).toBe('PENDING');
    expect(res.body.source_assets).toBeDefined();
    expect(res.body.source_assets).toHaveLength(2);
    expect(res.body.source_assets[0]).toMatchObject({
      asset_id: ACTOR_UUID,
      layout_type: 'headshot',
    });
    expect(res.body.source_assets[1]).toMatchObject({
      asset_id: LOOK_UUID,
      layout_type: 'look',
    });
  });
});

// ================================================================
// GET /api/generation-jobs/:outputId
// ================================================================
describe('GET /api/generation-jobs/:outputId', () => {
  beforeEach(() => {
    resetMock();
  });

  it('401 when not authenticated', async () => {
    const res = await request(createJobsApp()).get(`/api/generation-jobs/${OUTPUT_UUID}`);
    expect(res.status).toBe(401);
  });

  it('404 when output not found', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    // getAssetOutputById returns null
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createJobsApp(artist)).get(`/api/generation-jobs/${OUTPUT_UUID}`);
    expect(res.status).toBe(404);
  });

  it('200 with PENDING status', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    const output = makeOutputRow({ status: 'PENDING', image_url: null });
    // getAssetOutputById returns output
    mockQuery.mockResolvedValueOnce({ rows: [output] } as any);
    // findAssetById (for access check) returns actor
    const actor = makeActorRow();
    mockQuery.mockResolvedValueOnce({ rows: [actor] } as any);

    const res = await request(createJobsApp(artist)).get(`/api/generation-jobs/${OUTPUT_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('PENDING');
    expect(res.body.image_url).toBeNull();
    expect(res.body.asset_output_id).toBe(OUTPUT_UUID);
  });

  it('200 with SUCCESS status', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    const output = makeOutputRow({
      status: 'SUCCESS',
      image_url: 'https://fal.ai/generated.png',
      cost_credits: 0.05,
    });
    mockQuery.mockResolvedValueOnce({ rows: [output] } as any);
    const actor = makeActorRow();
    mockQuery.mockResolvedValueOnce({ rows: [actor] } as any);

    const res = await request(createJobsApp(artist)).get(`/api/generation-jobs/${OUTPUT_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('SUCCESS');
    expect(res.body.image_url).toBe('https://fal.ai/generated.png');
    expect(res.body.cost_credits).toBe(0.05);
  });

  it('200 with FAILED status and error_message', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    const output = makeOutputRow({
      status: 'FAILED',
      image_url: null,
      error_message: 'Model inference failed: out of memory',
    });
    mockQuery.mockResolvedValueOnce({ rows: [output] } as any);
    const actor = makeActorRow();
    mockQuery.mockResolvedValueOnce({ rows: [actor] } as any);

    const res = await request(createJobsApp(artist)).get(`/api/generation-jobs/${OUTPUT_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('FAILED');
    expect(res.body.error_message).toBe('Model inference failed: out of memory');
    expect(res.body.image_url).toBeNull();
  });

  it('200 returns cost_credits even for FAILED outputs', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    const output = makeOutputRow({
      status: 'FAILED',
      image_url: null,
      error_message: 'Generation error',
      cost_credits: 0.05,
    });
    mockQuery.mockResolvedValueOnce({ rows: [output] } as any);
    const actor = makeActorRow();
    mockQuery.mockResolvedValueOnce({ rows: [actor] } as any);

    const res = await request(createJobsApp(artist)).get(`/api/generation-jobs/${OUTPUT_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('FAILED');
    expect(res.body.cost_credits).toBe(0.05);
  });
});
