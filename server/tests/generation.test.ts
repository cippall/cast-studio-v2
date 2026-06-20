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

// Mock fal-service to control submitTextToImage behavior
vi.mock('../src/services/fal-service.js', () => ({
  submitTextToImage: vi.fn().mockResolvedValue({ jobId: 'test-job-id', status: 'PENDING' }),
  submitImageToImage: vi.fn(),
  pollJob: vi.fn(),
  cancelJob: vi.fn(),
  imageToText: vi.fn(),
  getWorkspaceApiKey: vi.fn(),
}));

// Mock prompt-service to return a fixed fallback prompt (avoids consuming pool mock seeds)
vi.mock('../src/services/prompt-service.js', () => ({
  resolvePrompt: vi
    .fn()
    .mockResolvedValue('Professional headshot of test actor. Clean background, studio lighting.'),
}));

import * as poolModule from '../src/db/pool.js';
import actorsRouter from '../src/routes/actors.js';
import generationJobsRouter from '../src/routes/generation-jobs.js';
import * as falService from '../src/services/fal-service.js';

const mockQuery = vi.mocked(poolModule.query);
const mockSubmitTextToImage = vi.mocked(falService.submitTextToImage);

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
  mockSubmitTextToImage.mockResolvedValue({ jobId: 'test-job-id', status: 'PENDING' });
}

/** Mock listActiveModels returning empty (so resolveModel falls back to DEFAULT_MODEL) */
function seedNoActiveModels() {
  mockQuery.mockResolvedValueOnce({ rows: [] } as any);
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
    // resolveModel: no active models → falls back to DEFAULT_MODEL
    seedNoActiveModels();
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

  it('502 when fal.ai submission fails, output marked FAILED and credits refunded', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    // findAssetById returns actor
    const actor = makeActorRow();
    mockQuery.mockResolvedValueOnce({ rows: [actor] } as any);
    // resolveModel: no active models → falls back to DEFAULT_MODEL
    seedNoActiveModels();
    // reserveCreditsForGeneration: findWallet, updateWalletBalance, createLedgerEntry
    seedWalletCreditMocks(ARTIST_UUID);
    // createAssetOutput returns PENDING output
    const output = makeOutputRow();
    mockQuery.mockResolvedValueOnce({ rows: [output] } as any);

    // Make fal.ai throw
    mockSubmitTextToImage.mockRejectedValueOnce(new Error('fal.ai API error (500): internal'));

    // updateAssetOutputError: UPDATE asset_outputs SET status = 'FAILED'
    mockQuery.mockResolvedValueOnce({ rowCount: 1 } as any);

    // refundCredits: findWallet (returns wallet with reduced balance)
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'wallet-uuid',
          workspace_id: WORKSPACE_UUID,
          account_id: ARTIST_UUID,
          balance_credits: '999.9500',
          updated_at: '2026-06-17T10:00:00.000Z',
        },
      ],
    } as any);
    // refundCredits: updateWalletBalance
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'wallet-uuid',
          workspace_id: WORKSPACE_UUID,
          account_id: ARTIST_UUID,
          balance_credits: '1000.0000',
          updated_at: '2026-06-17T10:00:00.000Z',
        },
      ],
    } as any);
    // refundCredits: createLedgerEntry (REFUND type)
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'ledger-refund-uuid',
          workspace_id: WORKSPACE_UUID,
          wallet_id: 'wallet-uuid',
          workflow_id: null,
          api_key_id: null,
          amount: 0.05,
          type: 'REFUND',
          created_at: '2026-06-17T10:00:00.000Z',
        },
      ],
    } as any);

    const res = await request(createActorsApp(artist))
      .post(`/api/actors/${ACTOR_UUID}/generate`)
      .send({ layout_type: 'headshot' });

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('BAD_GATEWAY');

    // Verify updateAssetOutputError was called with the output ID and error message
    const updateErrorCall = mockQuery.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].includes("status = 'FAILED'"),
    );
    expect(updateErrorCall).toBeDefined();
    expect(updateErrorCall![1][0]).toBe('fal.ai API error (500): internal');
    expect(updateErrorCall![1][1]).toBe(OUTPUT_UUID);

    // Verify refund ledger entry was created with REFUND type
    const refundLedgerCall = mockQuery.mock.calls.find(
      (call) =>
        typeof call[0] === 'string' &&
        call[0].includes('INSERT INTO ledger') &&
        call[1] &&
        Array.isArray(call[1]) &&
        call[1].includes('REFUND'),
    );
    expect(refundLedgerCall).toBeDefined();
  });

  it('202 creates multiple outputs when num_outputs is specified', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    const actor = makeActorRow();
    mockQuery.mockResolvedValueOnce({ rows: [actor] } as any);
    // resolveModel: no active models → falls back to DEFAULT_MODEL
    seedNoActiveModels();

    // reserveCreditsForGeneration for output 1
    seedWalletCreditMocks(ARTIST_UUID);

    // Two outputs
    const output1 = makeOutputRow({ id: OUTPUT_UUID });
    const output2 = makeOutputRow({ id: SECOND_OUTPUT_UUID });
    mockQuery.mockResolvedValueOnce({ rows: [output1] } as any);
    // UPDATE fal_job_id for output 1 (called after fal submission, before next output)
    mockQuery.mockResolvedValueOnce({ rowCount: 1 } as any);
    mockQuery.mockResolvedValueOnce({ rows: [output2] } as any);
    // UPDATE fal_job_id for output 2
    mockQuery.mockResolvedValueOnce({ rowCount: 1 } as any);

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
    // resolveModel: no active models → falls back to DEFAULT_MODEL
    seedNoActiveModels();
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
    // resolveModel: no active models → falls back to DEFAULT_MODEL
    seedNoActiveModels();

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
    // resolveModel: no active models, no task model → falls back to DEFAULT_MODEL
    seedNoActiveModels();
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

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

// ================================================================
// Model Resolution Tests
// ================================================================
describe('Model resolution in generation', () => {
  beforeEach(() => {
    resetMock();
  });

  // Helper: mock listActiveModels query (called by resolveModel)
  function seedActiveModels(models: Array<{ model_id: string; name: string }>) {
    mockQuery.mockResolvedValueOnce({
      rows: models.map((m) => ({
        id: randomUUID(),
        model_id: m.model_id,
        name: m.name,
        model_type: 'image',
        task: 'text-to-image',
        parameters: {},
        is_active: true,
        created_at: '2026-06-17T10:00:00.000Z',
      })),
    } as any);
  }

  // Helper: mock findActiveModel query (called by resolveModel when model specified)
  function seedFindActiveModel(model: { model_id: string; name: string } | null) {
    if (model) {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: randomUUID(),
            model_id: model.model_id,
            name: model.name,
            model_type: 'image',
            task: 'text-to-image',
            parameters: {},
            is_active: true,
            created_at: '2026-06-17T10:00:00.000Z',
          },
        ],
      } as any);
    } else {
      mockQuery.mockResolvedValueOnce({ rows: [] } as any);
    }
  }

  function randomUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // --- No model specified → uses first active model ---

  it('uses first active model when no model specified', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    // findAssetById returns actor
    const actor = makeActorRow();
    mockQuery.mockResolvedValueOnce({ rows: [actor] } as any);
    // resolveModel: listActiveModels returns one model
    seedActiveModels([{ model_id: 'fal-ai/flux-pro', name: 'Flux Pro' }]);
    seedWalletCreditMocks(ARTIST_UUID);

    const output = makeOutputRow({ model: 'fal-ai/flux-pro' });
    mockQuery.mockResolvedValueOnce({ rows: [output] } as any);

    const res = await request(createActorsApp(artist))
      .post(`/api/actors/${ACTOR_UUID}/generate`)
      .send({ layout_type: 'headshot' });

    expect(res.status).toBe(202);
    expect(res.body.outputs[0].model).toBe('fal-ai/flux-pro');
  });

  it('uses DEFAULT_MODEL when no active models and no model specified', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    // findAssetById returns actor
    const actor = makeActorRow();
    mockQuery.mockResolvedValueOnce({ rows: [actor] } as any);
    // resolveModel: listActiveModels returns empty
    seedActiveModels([]);
    seedWalletCreditMocks(ARTIST_UUID);

    const output = makeOutputRow({ model: 'flux-pro' });
    mockQuery.mockResolvedValueOnce({ rows: [output] } as any);

    const res = await request(createActorsApp(artist))
      .post(`/api/actors/${ACTOR_UUID}/generate`)
      .send({ layout_type: 'headshot' });

    expect(res.status).toBe(202);
    expect(res.body.outputs[0].model).toBe('flux-pro');
  });

  // --- Model specified and valid → uses it ---

  it('uses specified model when it is in active models', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    // findAssetById returns actor
    const actor = makeActorRow();
    mockQuery.mockResolvedValueOnce({ rows: [actor] } as any);
    // resolveModel: listActiveModels (for error message context)
    seedActiveModels([
      { model_id: 'fal-ai/flux-pro', name: 'Flux Pro' },
      { model_id: 'fal-ai/flux-realism', name: 'Flux Realism' },
    ]);
    // resolveModel: findActiveModel returns the model
    seedFindActiveModel({ model_id: 'fal-ai/flux-realism', name: 'Flux Realism' });
    seedWalletCreditMocks(ARTIST_UUID);

    const output = makeOutputRow({ model: 'fal-ai/flux-realism' });
    mockQuery.mockResolvedValueOnce({ rows: [output] } as any);

    const res = await request(createActorsApp(artist))
      .post(`/api/actors/${ACTOR_UUID}/generate`)
      .send({ layout_type: 'headshot', model: 'fal-ai/flux-realism' });

    expect(res.status).toBe(202);
    expect(res.body.outputs[0].model).toBe('fal-ai/flux-realism');
  });

  // --- Model specified but invalid → 422 ---

  it('422 when specified model is not in active models', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    // findAssetById returns actor
    const actor = makeActorRow();
    mockQuery.mockResolvedValueOnce({ rows: [actor] } as any);
    // resolveModel: listActiveModels returns active list
    seedActiveModels([{ model_id: 'fal-ai/flux-pro', name: 'Flux Pro' }]);
    // resolveModel: findActiveModel returns null (not found)
    seedFindActiveModel(null);

    const res = await request(createActorsApp(artist))
      .post(`/api/actors/${ACTOR_UUID}/generate`)
      .send({ layout_type: 'headshot', model: 'nonexistent-model' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('nonexistent-model');
  });

  // --- Regenerate: same model resolution ---

  it('regenerate: 422 when specified model is not in active models', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    // findAssetById returns actor
    const actor = makeActorRow();
    mockQuery.mockResolvedValueOnce({ rows: [actor] } as any);
    // resolveModel: listActiveModels
    seedActiveModels([{ model_id: 'fal-ai/flux-pro', name: 'Flux Pro' }]);
    // resolveModel: findActiveModel returns null
    seedFindActiveModel(null);

    const res = await request(createActorsApp(artist))
      .post(`/api/actors/${ACTOR_UUID}/regenerate`)
      .send({ layout_type: 'headshot', model: 'invalid-model' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('regenerate: uses first active model when no model specified', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    // findAssetById returns actor
    const actor = makeActorRow();
    mockQuery.mockResolvedValueOnce({ rows: [actor] } as any);
    // resolveModel: listActiveModels
    seedActiveModels([{ model_id: 'fal-ai/flux-pro', name: 'Flux Pro' }]);
    seedWalletCreditMocks(ARTIST_UUID);

    // getAssetOutputs for regenerate
    const oldHeadshot = makeOutputRow({
      layout_type: 'headshot',
      status: 'SUCCESS',
      version: 1,
      image_url: 'https://fal.ai/old.png',
    });
    mockQuery.mockResolvedValueOnce({ rows: [oldHeadshot] } as any);
    // archiveAssetOutput: SELECT
    mockQuery.mockResolvedValueOnce({ rows: [oldHeadshot] } as any);
    // archiveAssetOutput: INSERT
    mockQuery.mockResolvedValueOnce({ rowCount: 1 } as any);
    // markDownstreamObsolete
    mockQuery.mockResolvedValueOnce({ rowCount: 1 } as any);
    // createAssetOutput
    const newOutput = makeOutputRow({ model: 'fal-ai/flux-pro', version: 2 });
    mockQuery.mockResolvedValueOnce({ rows: [newOutput] } as any);

    const res = await request(createActorsApp(artist))
      .post(`/api/actors/${ACTOR_UUID}/regenerate`)
      .send({ layout_type: 'headshot' });

    expect(res.status).toBe(202);
    expect(res.body.outputs[0].model).toBe('fal-ai/flux-pro');
  });

  // --- Task-based model resolution (unit test for resolveModel) ---

  it('resolveModel: uses task-based lookup when no model and task provided', async () => {
    const { resolveModel } = await import('../src/services/generation/resolve-model.js');
    // listActiveModels: empty
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);
    // findModelByTask: returns a model
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'model-uuid',
          model_id: 'fal-ai/flux-anime',
          name: 'Flux Anime',
          model_type: 'image',
          task: 'actor_generation',
          parameters: {},
          is_active: true,
          created_at: '2026-06-18T10:00:00.000Z',
        },
      ],
    } as any);

    const result = await resolveModel(undefined, 'workspace-uuid', 'actor_generation');
    expect(result).toBe('fal-ai/flux-anime');
  });

  it('resolveModel: task lookup misses falls through to first active model', async () => {
    const { resolveModel } = await import('../src/services/generation/resolve-model.js');
    // listActiveModels: returns one model
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'model-uuid',
          model_id: 'fal-ai/flux-pro',
          name: 'Flux Pro',
          model_type: 'image',
          task: 'text-to-image',
          parameters: {},
          is_active: true,
          created_at: '2026-06-17T10:00:00.000Z',
        },
      ],
    } as any);
    // findModelByTask: returns null
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const result = await resolveModel(undefined, 'workspace-uuid', 'unconfigured_task');
    expect(result).toBe('fal-ai/flux-pro');
  });

  it('resolveModel: task lookup misses + no active models → DEFAULT_MODEL', async () => {
    const { resolveModel } = await import('../src/services/generation/resolve-model.js');
    // listActiveModels: empty
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);
    // findModelByTask: returns null
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const result = await resolveModel(undefined, 'workspace-uuid', 'unconfigured_task');
    expect(result).toBe('flux-pro'); // DEFAULT_MODEL
  });
});
