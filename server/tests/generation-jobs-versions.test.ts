import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';

/* eslint-disable @typescript-eslint/no-explicit-any */

const mockQuery = vi.fn();
const mockFindAssetById = vi.fn();
const mockCheckAssetAccess = vi.fn();
const mockGetAssetOutputById = vi.fn();
const mockGetOutputVersions = vi.fn();

vi.mock('../src/db/pool.js', () => ({ query: () => mockQuery(), getClient: vi.fn(), default: {} }));
vi.mock('../src/db/repositories/asset-repo.js', () => ({
  findAssetById: () => mockFindAssetById(),
  checkAssetAccess: () => mockCheckAssetAccess(),
  getAssetOutputById: () => mockGetAssetOutputById(),
  getOutputVersions: () => mockGetOutputVersions(),
}));

import versionsRouter from '../src/routes/asset-versions.js';

const ARTIST_UUID = 'b0000000-0000-4000-8000-000000000001';
const ACTOR_UUID = 'c0000000-0000-4000-8000-000000000001';
const OUTPUT_UUID = 'd0000000-0000-4000-8000-000000000001';

function makeAccount() {
  return {
    id: ARTIST_UUID,
    workspace_id: 'w1',
    name: 'Artist',
    email: 'a@b.com',
    role: 'ARTIST',
    is_api_able: false,
    password_hash: 'x',
    created_at: '2026-06-17T10:00:00Z',
  };
}

function makeWorkspace() {
  return {
    id: 'w1',
    name: 'Ws',
    slug: 'ws',
    workspace_type: 'STUDIO',
    created_at: '2026-06-17T10:00:00Z',
  };
}

function makeAsset() {
  return { id: ACTOR_UUID, asset_type: 'ACTOR', creator_id: ARTIST_UUID, deleted_at: null };
}

function makeCurrentOutput(version = 3) {
  return {
    id: OUTPUT_UUID,
    asset_id: ACTOR_UUID,
    layout_type: 'headshot',
    model: 'flux-pro',
    image_url: 'https://fal.ai/current.png',
    local_backup_url: null,
    cost_credits: 0.05,
    status: 'SUCCESS',
    version,
    is_obsolete: false,
    obsolete_reason: null,
    error_message: null,
    generation_params: { seed: 12345, resolution: '1024x1024', steps: 30 },
    reference_images: [],
    source_asset_outputs: [],
    created_at: '2026-06-16T12:00:00Z',
  };
}

function makeArchivedVersion(version: number) {
  return {
    id: `ver-${version}`,
    asset_output_id: OUTPUT_UUID,
    version,
    image_url: `https://fal.ai/v${version}.png`,
    local_backup_url: null,
    model: 'flux-pro',
    cost_credits: 0.05,
    status: 'SUCCESS',
    generation_params: { seed: 12345, resolution: '1024x1024', steps: 25 + version },
    reference_images: null,
    source_asset_outputs: null,
    error_message: null,
    created_at: `2026-06-${16 - version}T10:00:00Z`,
  };
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).session = {
      accountId: ARTIST_UUID,
      destroy: vi.fn((cb?: (err: unknown) => void) => {
        if (cb) cb();
      }),
    };
    next();
  });
  app.use('/api/assets', versionsRouter);
  return app;
}

function seedSession() {
  mockQuery.mockResolvedValueOnce({ rows: [makeAccount()] } as any);
  mockQuery.mockResolvedValueOnce({ rows: [makeWorkspace()] } as any);
}

beforeEach(() => {
  mockQuery.mockReset();
  mockFindAssetById.mockReset();
  mockCheckAssetAccess.mockReset();
  mockGetAssetOutputById.mockReset();
  mockGetOutputVersions.mockReset();
});

describe('GET /api/assets/:id/outputs/:outputId/versions', () => {
  it('401 when missing session', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/assets', versionsRouter);
    const res = await request(app).get(`/api/assets/${ACTOR_UUID}/outputs/${OUTPUT_UUID}/versions`);
    expect(res.status).toBe(401);
  });

  it('404 when asset missing', async () => {
    seedSession();
    mockFindAssetById.mockReturnValue(null);

    const res = await request(createApp()).get(
      `/api/assets/${ACTOR_UUID}/outputs/${OUTPUT_UUID}/versions`,
    );
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('404 when access denied', async () => {
    seedSession();
    mockFindAssetById.mockReturnValue(makeAsset());
    mockCheckAssetAccess.mockReturnValue(false);

    const res = await request(createApp()).get(
      `/api/assets/${ACTOR_UUID}/outputs/${OUTPUT_UUID}/versions`,
    );
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('404 when output not found', async () => {
    seedSession();
    mockFindAssetById.mockReturnValue(makeAsset());
    mockCheckAssetAccess.mockReturnValue(true);
    mockGetAssetOutputById.mockReturnValue(null);

    const res = await request(createApp()).get(
      `/api/assets/${ACTOR_UUID}/outputs/${OUTPUT_UUID}/versions`,
    );
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.message).toBe('Output not found');
  });

  it('200 returns current + empty versions when no archives', async () => {
    seedSession();
    mockFindAssetById.mockReturnValue(makeAsset());
    mockCheckAssetAccess.mockReturnValue(true);
    mockGetAssetOutputById.mockReturnValue(makeCurrentOutput(1));
    mockGetOutputVersions.mockReturnValue([]);

    const res = await request(createApp()).get(
      `/api/assets/${ACTOR_UUID}/outputs/${OUTPUT_UUID}/versions`,
    );
    expect(res.status).toBe(200);
    expect(res.body.current).toBeDefined();
    expect(res.body.current.id).toBe(OUTPUT_UUID);
    expect(res.body.current.version).toBe(1);
    expect(res.body.current.model).toBe('flux-pro');
    expect(res.body.current.status).toBe('SUCCESS');
    expect(res.body.current.image_url).toBe('https://fal.ai/current.png');
    expect(res.body.current.generation_params).toEqual({
      seed: 12345,
      resolution: '1024x1024',
      steps: 30,
    });
    expect(res.body.current.reference_images).toEqual([]);
    expect(res.body.current.source_asset_outputs).toEqual([]);
    expect(res.body.versions).toEqual([]);
  });

  it('200 returns current + archived versions sorted desc', async () => {
    seedSession();
    mockFindAssetById.mockReturnValue(makeAsset());
    mockCheckAssetAccess.mockReturnValue(true);
    mockGetAssetOutputById.mockReturnValue(makeCurrentOutput(3));
    mockGetOutputVersions.mockReturnValue([makeArchivedVersion(2), makeArchivedVersion(1)]);

    const res = await request(createApp()).get(
      `/api/assets/${ACTOR_UUID}/outputs/${OUTPUT_UUID}/versions`,
    );
    expect(res.status).toBe(200);
    expect(res.body.current.version).toBe(3);
    expect(res.body.versions).toHaveLength(2);
    expect(res.body.versions[0].version).toBe(2);
    expect(res.body.versions[1].version).toBe(1);
  });

  it('archived versions include archived_at from created_at', async () => {
    seedSession();
    mockFindAssetById.mockReturnValue(makeAsset());
    mockCheckAssetAccess.mockReturnValue(true);
    mockGetAssetOutputById.mockReturnValue(makeCurrentOutput(3));
    mockGetOutputVersions.mockReturnValue([makeArchivedVersion(2), makeArchivedVersion(1)]);

    const res = await request(createApp()).get(
      `/api/assets/${ACTOR_UUID}/outputs/${OUTPUT_UUID}/versions`,
    );
    expect(res.status).toBe(200);
    expect(res.body.versions[0].archived_at).toBe('2026-06-14T10:00:00Z');
    expect(res.body.versions[1].archived_at).toBe('2026-06-15T10:00:00Z');
  });

  it('archived versions preserve generation_params, model, status, image_url', async () => {
    seedSession();
    mockFindAssetById.mockReturnValue(makeAsset());
    mockCheckAssetAccess.mockReturnValue(true);
    mockGetAssetOutputById.mockReturnValue(makeCurrentOutput(2));
    mockGetOutputVersions.mockReturnValue([makeArchivedVersion(1)]);

    const res = await request(createApp()).get(
      `/api/assets/${ACTOR_UUID}/outputs/${OUTPUT_UUID}/versions`,
    );
    expect(res.status).toBe(200);
    const v1 = res.body.versions[0];
    expect(v1.image_url).toBe('https://fal.ai/v1.png');
    expect(v1.model).toBe('flux-pro');
    expect(v1.status).toBe('SUCCESS');
    expect(v1.generation_params).toEqual({ seed: 12345, resolution: '1024x1024', steps: 26 });
  });

  it('current output includes all spec fields', async () => {
    seedSession();
    mockFindAssetById.mockReturnValue(makeAsset());
    mockCheckAssetAccess.mockReturnValue(true);
    mockGetAssetOutputById.mockReturnValue(makeCurrentOutput(3));
    mockGetOutputVersions.mockReturnValue([]);

    const res = await request(createApp()).get(
      `/api/assets/${ACTOR_UUID}/outputs/${OUTPUT_UUID}/versions`,
    );
    expect(res.status).toBe(200);
    const current = res.body.current;
    expect(current).toHaveProperty('id');
    expect(current).toHaveProperty('version');
    expect(current).toHaveProperty('image_url');
    expect(current).toHaveProperty('model');
    expect(current).toHaveProperty('status');
    expect(current).toHaveProperty('generation_params');
    expect(current).toHaveProperty('reference_images');
    expect(current).toHaveProperty('source_asset_outputs');
    expect(current).toHaveProperty('created_at');
  });

  it('admin bypass can access any workspace asset', async () => {
    const adminApp = express();
    adminApp.use(express.json());
    adminApp.use((req: Request, _res: Response, next: NextFunction) => {
      (req as any).session = {
        accountId: 'admin-uuid',
        destroy: vi.fn((cb?: (err: unknown) => void) => {
          if (cb) cb();
        }),
      };
      next();
    });
    adminApp.use('/api/assets', versionsRouter);

    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'admin-uuid',
          workspace_id: 'w2',
          name: 'Admin',
          email: 'admin@test.com',
          role: 'ADMIN',
          is_api_able: false,
          password_hash: 'x',
          created_at: '2026-06-17T10:00:00Z',
        },
      ],
    } as any);
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'w2',
          name: 'AdminWs',
          slug: 'admin-ws',
          workspace_type: 'STUDIO',
          created_at: '2026-06-17T10:00:00Z',
        },
      ],
    } as any);

    mockFindAssetById.mockReturnValue(makeAsset());
    mockCheckAssetAccess.mockReturnValue(true);
    mockGetAssetOutputById.mockReturnValue(makeCurrentOutput(1));
    mockGetOutputVersions.mockReturnValue([]);

    const res = await request(adminApp).get(
      `/api/assets/${ACTOR_UUID}/outputs/${OUTPUT_UUID}/versions`,
    );
    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
    expect(res.body.current).toBeDefined();
  });

  it('response does not contain assetId or outputId at top level (spec shape)', async () => {
    seedSession();
    mockFindAssetById.mockReturnValue(makeAsset());
    mockCheckAssetAccess.mockReturnValue(true);
    mockGetAssetOutputById.mockReturnValue(makeCurrentOutput(1));
    mockGetOutputVersions.mockReturnValue([]);

    const res = await request(createApp()).get(
      `/api/assets/${ACTOR_UUID}/outputs/${OUTPUT_UUID}/versions`,
    );
    expect(res.status).toBe(200);
    expect(res.body.assetId).toBeUndefined();
    expect(res.body.outputId).toBeUndefined();
    expect(res.body.current).toBeDefined();
    expect(res.body.versions).toBeDefined();
  });
});
