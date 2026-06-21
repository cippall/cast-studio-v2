/**
 * Integration: Full Actor Generation Flow
 *
 * Tests the complete path:
 *   create actor (POST /api/actors) →
 *   generate (POST /api/actors/:id/generate) →
 *   worker poll (processNow) →
 *   outputs marked SUCCESS
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';

vi.mock('../src/db/pool.js', () => ({
  query: vi.fn(),
  getClient: vi.fn(),
  default: {},
}));

const mockSubmitTextToImage = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ jobId: 'fal-job-123', status: 'PENDING' }),
);
const mockPollJob = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    id: 'fal-job-123',
    status: 'SUCCESS',
    image_url: 'https://fal.ai/generated.png',
    error_message: null,
    cost_credits: 0.05,
  }),
);
const mockGetWorkspaceApiKey = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('../src/services/fal-service.js', () => ({
  submitTextToImage: mockSubmitTextToImage,
  submitImageToImage: vi.fn().mockResolvedValue({ jobId: 'fal-job-456', status: 'PENDING' }),
  pollJob: mockPollJob,
  cancelJob: vi.fn(),
  imageToText: vi.fn(),
  getWorkspaceApiKey: mockGetWorkspaceApiKey,
  fetchFalModels: vi.fn(),
}));

vi.mock('../src/services/prompt-service.js', () => ({
  resolvePrompt: vi.fn().mockResolvedValue('Professional headshot of test actor.'),
}));

const mockListActiveModels = vi.hoisted(() =>
  vi.fn().mockResolvedValue([{ model_id: 'flux-pro', model_name: 'Flux Pro' }]),
);
const mockFindActiveModel = vi.hoisted(() =>
  vi
    .fn()
    .mockImplementation((modelId: string) =>
      modelId === 'flux-pro' ? { model_id: 'flux-pro', model_name: 'Flux Pro' } : null,
    ),
);
const mockFindModelByTask = vi.hoisted(() => vi.fn().mockResolvedValue(null));

vi.mock('../src/db/repositories/model-repo.js', () => ({
  listActiveModels: mockListActiveModels,
  findActiveModel: mockFindActiveModel,
  findModelByTask: mockFindModelByTask,
}));

vi.mock('../src/services/notification-service.js', () => ({
  notifyWorkflowCompleted: vi.fn().mockResolvedValue(undefined),
  notifyWorkflowFailed: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/services/stripe-service.js', () => ({
  createCheckoutSession: vi.fn(),
  verifyWebhookEvent: vi.fn(),
}));

vi.mock('../src/services/email-service.js', () => ({
  sendNotificationEmail: vi.fn().mockResolvedValue(undefined),
}));

import * as poolModule from '../src/db/pool.js';
import actorsRouter from '../src/routes/actors.js';
import { processNow } from '../src/workers/generation-worker.js';

const mockQuery = vi.mocked(poolModule.query);

const WS = 'a0000000-0000-4000-8000-000000000001';
const ARTIST = 'b0000000-0000-4000-8000-000000000001';
const ACTOR = 'c0000000-0000-4000-8000-000000000001';
const OUTPUT_1 = 'o0000000-0000-4000-8000-000000000001';
const OUTPUT_2 = 'o0000000-0000-4000-8000-000000000002';
const WALLET = 'w0000000-0000-4000-8000-000000000001';

function makeArtistAccount() {
  return {
    id: ARTIST,
    workspace_id: WS,
    name: 'Test Artist',
    email: 'artist@studio.com',
    role: 'ARTIST',
    is_api_able: true,
    password_hash: '$2a$10$hashedpassword',
    created_at: '2026-06-17T10:00:00.000Z',
  };
}
function makeWorkspace() {
  return {
    id: WS,
    name: 'Test Workspace',
    slug: 'test-workspace',
    workspace_type: 'STUDIO',
    created_at: '2026-06-17T10:00:00.000Z',
  };
}
function makeActorRow() {
  return {
    id: ACTOR,
    workspace_id: WS,
    creator_id: ARTIST,
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
  };
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).session = {
      accountId: ARTIST,
      destroy: vi.fn((cb?: (err?: unknown) => void) => {
        if (cb) cb();
      }),
    };
    next();
  });
  app.use('/api/actors', actorsRouter);
  return app;
}

describe('Integration: Full Actor Generation Flow', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockQuery.mockResolvedValue({ rows: [] });
    mockSubmitTextToImage.mockClear();
    mockSubmitTextToImage.mockResolvedValue({ jobId: 'fal-job-123', status: 'PENDING' });
    mockPollJob.mockClear();
    mockPollJob.mockResolvedValue({
      id: 'fal-job-123',
      status: 'SUCCESS',
      image_url: 'https://fal.ai/generated.png',
      error_message: null,
      cost_credits: 0.05,
    });
    mockGetWorkspaceApiKey.mockClear();
    mockGetWorkspaceApiKey.mockResolvedValue(undefined);
    mockListActiveModels.mockClear();
    mockListActiveModels.mockResolvedValue([{ model_id: 'flux-pro', model_name: 'Flux Pro' }]);
    mockFindActiveModel.mockClear();
    mockFindActiveModel.mockImplementation((modelId: string) =>
      modelId === 'flux-pro' ? { model_id: 'flux-pro', model_name: 'Flux Pro' } : null,
    );
    mockFindModelByTask.mockClear();
    mockFindModelByTask.mockResolvedValue(null);
  });

  it('creates actor, generates 2 outputs, worker polls to SUCCESS', async () => {
    // ===== STEP 1: POST /api/actors (create actor via FORM mode) =====
    mockQuery.mockResolvedValueOnce({ rows: [makeArtistAccount()] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [makeWorkspace()] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [makeActorRow()] } as any);

    const createRes = await request(createApp())
      .post('/api/actors')
      .send({ entry_method: 'FORM', form_data: { age: 25, gender: 'female' } });

    expect(createRes.status).toBe(201);
    expect(createRes.body.id).toBe(ACTOR);
    expect(createRes.body.asset_type).toBe('ACTOR');

    // ===== STEP 2: POST /api/actors/:id/generate (num_outputs: 2) =====
    mockQuery.mockReset();
    mockQuery.mockResolvedValue({ rows: [] });
    mockSubmitTextToImage.mockClear();
    mockSubmitTextToImage.mockResolvedValue({ jobId: 'fal-job-123', status: 'PENDING' });
    mockGetWorkspaceApiKey.mockClear();
    mockGetWorkspaceApiKey.mockResolvedValue(undefined);
    mockListActiveModels.mockClear();
    mockListActiveModels.mockResolvedValue([{ model_id: 'flux-pro', model_name: 'Flux Pro' }]);
    mockFindActiveModel.mockClear();
    mockFindActiveModel.mockImplementation((modelId: string) =>
      modelId === 'flux-pro' ? { model_id: 'flux-pro', model_name: 'Flux Pro' } : null,
    );
    mockFindModelByTask.mockClear();
    mockFindModelByTask.mockResolvedValue(null);

    // Auth queries
    mockQuery.mockResolvedValueOnce({ rows: [makeArtistAccount()] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [makeWorkspace()] } as any);
    // findAssetById
    mockQuery.mockResolvedValueOnce({ rows: [makeActorRow()] } as any);
    // findWallet
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: WALLET, workspace_id: WS, account_id: ARTIST, balance_credits: 50 }],
    } as any);
    // updateWalletBalance
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: WALLET, balance_credits: 49.9 }],
    } as any);
    // createLedgerEntry
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'ledger-1' }] } as any);
    // createAssetOutput 1
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: OUTPUT_1,
          asset_id: ACTOR,
          layout_type: 'headshot',
          model: 'fal-ai/flux-pro',
          status: 'PENDING',
          cost_credits: 0.05,
          version: 1,
          generation_params: { seed: 12345 },
        },
      ],
    } as any);
    // UPDATE generation_params 1
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);
    // createAssetOutput 2
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: OUTPUT_2,
          asset_id: ACTOR,
          layout_type: 'headshot',
          model: 'fal-ai/flux-pro',
          status: 'PENDING',
          cost_credits: 0.05,
          version: 1,
          generation_params: { seed: 12346 },
        },
      ],
    } as any);
    // UPDATE generation_params 2
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const genRes = await request(createApp())
      .post(`/api/actors/${ACTOR}/generate`)
      .send({ layout_type: 'headshot', model: 'flux-pro', options: { num_outputs: 2 } });

    expect(genRes.status).toBe(202);
    expect(genRes.body.outputs).toHaveLength(2);
    expect(genRes.body.outputs[0].status).toBe('PENDING');
    expect(genRes.body.outputs[1].status).toBe('PENDING');
    expect(genRes.body.outputs[0].id).toBe(OUTPUT_1);
    expect(genRes.body.outputs[1].id).toBe(OUTPUT_2);

    expect(mockSubmitTextToImage).toHaveBeenCalledTimes(2);

    // ===== STEP 3: Simulate worker polling via processNow() =====
    mockQuery.mockReset();
    mockQuery.mockResolvedValue({ rows: [] });
    mockPollJob.mockClear();
    mockPollJob.mockResolvedValue({
      id: 'fal-job-123',
      status: 'SUCCESS',
      image_url: 'https://fal.ai/generated.png',
      error_message: null,
      cost_credits: 0.05,
    });
    mockGetWorkspaceApiKey.mockClear();
    mockGetWorkspaceApiKey.mockResolvedValue(undefined);

    // findPendingOutputs
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: OUTPUT_1,
          asset_id: ACTOR,
          layout_type: 'headshot',
          model: 'flux-pro',
          generation_params: { fal_job_id: 'fal-job-123', seed: 12345 },
        },
        {
          id: OUTPUT_2,
          asset_id: ACTOR,
          layout_type: 'headshot',
          model: 'flux-pro',
          generation_params: { fal_job_id: 'fal-job-123', seed: 12346 },
        },
      ],
    } as any);
    // workspace_id lookup
    mockQuery.mockResolvedValueOnce({ rows: [{ workspace_id: WS }] } as any);
    // updateOutputsStatus × 2
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);
    // notifyAssetCreator × 2
    mockQuery.mockResolvedValueOnce({ rows: [{ creator_id: ARTIST }] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [{ creator_id: ARTIST }] } as any);

    await processNow();

    expect(mockPollJob).toHaveBeenCalledTimes(2);
    expect(mockPollJob).toHaveBeenCalledWith('fal-job-123', 'flux-pro', undefined, 12345);
    expect(mockPollJob).toHaveBeenCalledWith('fal-job-123', 'flux-pro', undefined, 12346);
  });

  it('returns 404 when generating for non-existent actor', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [makeArtistAccount()] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [makeWorkspace()] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createApp())
      .post(`/api/actors/${ACTOR}/generate`)
      .send({ layout_type: 'headshot', model: 'flux-pro' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 422 when model is invalid (not in active models)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [makeArtistAccount()] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [makeWorkspace()] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [makeActorRow()] } as any);

    mockListActiveModels.mockResolvedValueOnce([
      { model_id: 'flux-pro', model_name: 'Flux Pro' },
    ] as any);
    mockFindActiveModel.mockResolvedValueOnce(null);

    const res = await request(createApp())
      .post(`/api/actors/${ACTOR}/generate`)
      .send({ layout_type: 'headshot', model: 'nonexistent-model' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 when insufficient credits', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [makeArtistAccount()] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [makeWorkspace()] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [makeActorRow()] } as any);

    mockQuery.mockResolvedValueOnce({
      rows: [{ id: WALLET, workspace_id: WS, account_id: ARTIST, balance_credits: 0.01 }],
    } as any);

    const res = await request(createApp())
      .post(`/api/actors/${ACTOR}/generate`)
      .send({ layout_type: 'headshot', model: 'flux-pro', options: { num_outputs: 2 } });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('Insufficient credits');
  });
});
