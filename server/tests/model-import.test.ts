import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';

/* eslint-disable @typescript-eslint/no-explicit-any */

vi.mock('../src/db/pool.js', () => ({
  query: vi.fn(),
  getClient: vi.fn(),
  default: {},
}));

import * as poolModule from '../src/db/pool.js';
import adminRouter from '../src/routes/admin/admin.js';

const mockQuery = vi.mocked(poolModule.query);

const WORKSPACE_UUID = 'a0000000-0000-4000-8000-000000000001';
const ADMIN_UUID = 'b0000000-0000-4000-8000-000000000001';

function makeAdminRow() {
  return {
    id: ADMIN_UUID,
    workspace_id: WORKSPACE_UUID,
    name: 'Test Admin',
    email: 'admin@studio.com',
    role: 'ADMIN',
    is_api_able: true,
    password_hash: '$2a$10$hashedpassword',
    created_at: '2026-06-17T10:00:00.000Z',
  };
}

function makeWorkspaceRow() {
  return {
    id: WORKSPACE_UUID,
    name: 'Test Workspace',
    slug: 'test',
    workspace_type: 'STUDIO',
    created_at: '2026-06-17T10:00:00.000Z',
  };
}

/** Seed mockQuery so requireSession + requireWorkspace succeed */
function seedAuthQueries() {
  mockQuery.mockResolvedValueOnce({ rows: [makeAdminRow()] } as any);
  mockQuery.mockResolvedValueOnce({ rows: [makeWorkspaceRow()] } as any);
}

function createAdminApp() {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).session = {
      accountId: ADMIN_UUID,
      destroy: vi.fn((cb?: (err?: unknown) => void) => {
        if (cb) cb();
      }),
    };
    next();
  });
  app.use('/api/admin', adminRouter);
  return app;
}

// ===================================================================
// POST /api/admin/models/import — import a fal.ai model
// ===================================================================
describe('POST /api/admin/models/import', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('401 when not authenticated', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/admin', adminRouter);
    const res = await request(app).post('/api/admin/models/import').send({
      fal_model_id: 'fal-ai/flux/schnell',
      name: 'FLUX Schnell',
      category: 'image',
    });
    expect(res.status).toBe(401);
  });

  it('422 when required fields missing', async () => {
    seedAuthQueries();
    const res = await request(createAdminApp()).post('/api/admin/models/import').send({});
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('409 when fal_model_id already exists', async () => {
    seedAuthQueries();
    // duplicate check query
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'existing-id' }] } as any);

    const res = await request(createAdminApp()).post('/api/admin/models/import').send({
      fal_model_id: 'fal-ai/flux/schnell',
      name: 'FLUX Schnell',
      category: 'image',
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('201 and stores schema + defaults when import with full schema', async () => {
    seedAuthQueries();
    // duplicate check returns empty
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const inputSchema = {
      prompt: { type: 'string', required: true },
      image_size: { type: 'string', default: 'landscape_16_9' },
      num_inference_steps: { type: 'integer', default: 4 },
    };
    const defaultParams = {
      image_size: 'landscape_16_9',
      num_inference_steps: 4,
    };

    const mockRow = {
      id: 'new-model-id',
      model_id: 'fal-ai/flux/schnell',
      name: 'FLUX Schnell',
      model_type: 'image',
      task: 'text_to_image',
      input_schema: inputSchema,
      parameters: defaultParams,
      is_active: true,
      created_at: '2026-06-20T12:00:00.000Z',
    };
    mockQuery.mockResolvedValueOnce({ rows: [mockRow] } as any);

    const res = await request(createAdminApp()).post('/api/admin/models/import').send({
      fal_model_id: 'fal-ai/flux/schnell',
      name: 'FLUX Schnell',
      category: 'image',
      task: 'text_to_image',
      input_schema: inputSchema,
      default_parameters: defaultParams,
    });

    expect(res.status).toBe(201);
    expect(res.body.model_id).toBe('fal-ai/flux/schnell');
    expect(res.body.name).toBe('FLUX Schnell');
    expect(res.body.task).toBe('text_to_image');
    expect(res.body.input_schema).toEqual(inputSchema);
    expect(res.body.parameters).toEqual(defaultParams);

    // Verify the INSERT query received correct args
    // mockQuery calls: [0]=auth account, [1]=auth workspace, [2]=duplicate check, [3]=INSERT
    // But since duplicate check resolved with empty rows, the INSERT runs.
    // The first non-auth query call is the duplicate check at index 2, INSERT at index 3.
    const insertCall = mockQuery.mock.calls[3];
    expect(insertCall[0]).toContain('INSERT INTO models');
    const params = insertCall[1];
    expect(params[1]).toBe('fal-ai/flux/schnell');
    expect(params[4]).toBe('text_to_image');
    expect(JSON.parse(params[5])).toEqual(inputSchema);
    expect(JSON.parse(params[6])).toEqual(defaultParams);
  });

  it('201 and sets null schema + empty defaults when import without schema', async () => {
    seedAuthQueries();
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const mockRow = {
      id: 'new-model-id-2',
      model_id: 'fal-ai/flux/pro',
      name: 'FLUX Pro',
      model_type: 'image',
      task: null,
      input_schema: null,
      parameters: {},
      is_active: true,
      created_at: '2026-06-20T12:00:00.000Z',
    };
    mockQuery.mockResolvedValueOnce({ rows: [mockRow] } as any);

    const res = await request(createAdminApp()).post('/api/admin/models/import').send({
      fal_model_id: 'fal-ai/flux/pro',
      name: 'FLUX Pro',
      category: 'image',
    });

    expect(res.status).toBe(201);
    expect(res.body.model_id).toBe('fal-ai/flux/pro');
    expect(res.body.input_schema).toBeNull();
    expect(res.body.parameters).toEqual({});

    // Verify the INSERT received null for input_schema and '{}' for parameters
    const insertCall = mockQuery.mock.calls[3];
    expect(insertCall[1][4]).toBeNull(); // task
    expect(insertCall[1][5]).toBeNull(); // input_schema
    expect(insertCall[1][6]).toBe('{}'); // parameters
  });
});
