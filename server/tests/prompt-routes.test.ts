import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Mock pool before importing route modules
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

/** Seed mockQuery so requireSession + requireWorkspace succeed (consumes 2 calls) */
function seedAuthQueries() {
  mockQuery.mockResolvedValueOnce({ rows: [makeAdminRow()] } as any);
  mockQuery.mockResolvedValueOnce({ rows: [makeWorkspaceRow()] } as any);
}

/** Build an Express app with a fake admin session for testing routes */
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
// GET /api/admin/prompts — list system prompts
// ===================================================================
describe('GET /api/admin/prompts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('401 when not authenticated', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/admin', adminRouter);
    const res = await request(app).get('/api/admin/prompts');
    expect(res.status).toBe(401);
  });

  it('returns empty array when no prompts exist', async () => {
    seedAuthQueries();
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createAdminApp()).get('/api/admin/prompts');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns all prompts ordered by task', async () => {
    seedAuthQueries();
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'p1',
          task: 'actor_headshot',
          template: 'Headshot of {{identity_description}}',
          variables: ['identity_description'],
          created_at: '2026-06-17T10:00:00.000Z',
          updated_at: '2026-06-17T10:00:00.000Z',
        },
        {
          id: 'p2',
          task: 'fashion_item',
          template: 'Photo of {{item_description}}',
          variables: ['item_description'],
          created_at: '2026-06-17T11:00:00.000Z',
          updated_at: '2026-06-17T11:00:00.000Z',
        },
      ],
    } as any);

    const res = await request(createAdminApp()).get('/api/admin/prompts');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].task).toBe('actor_headshot');
    expect(res.body[1].task).toBe('fashion_item');
  });
});

// ===================================================================
// POST /api/admin/prompts — create a system prompt
// ===================================================================
describe('POST /api/admin/prompts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('401 when not authenticated', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/admin', adminRouter);
    const res = await request(app)
      .post('/api/admin/prompts')
      .send({ task: 'actor_headshot', template: 'test', variables: ['v1'] });
    expect(res.status).toBe(401);
  });

  it('422 when task is missing', async () => {
    seedAuthQueries();
    const res = await request(createAdminApp())
      .post('/api/admin/prompts')
      .send({
        template: 'Headshot of {{identity_description}}',
        variables: ['identity_description'],
      });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('422 when template is missing', async () => {
    seedAuthQueries();
    const res = await request(createAdminApp())
      .post('/api/admin/prompts')
      .send({ task: 'actor_headshot', variables: ['identity_description'] });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('422 when variables is missing', async () => {
    seedAuthQueries();
    const res = await request(createAdminApp())
      .post('/api/admin/prompts')
      .send({ task: 'actor_headshot', template: 'Headshot of {{identity_description}}' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('422 when task is empty string', async () => {
    seedAuthQueries();
    const res = await request(createAdminApp())
      .post('/api/admin/prompts')
      .send({ task: '', template: 'test', variables: ['v1'] });
    expect(res.status).toBe(422);
  });

  it('422 when template is empty string', async () => {
    seedAuthQueries();
    const res = await request(createAdminApp())
      .post('/api/admin/prompts')
      .send({ task: 'actor_headshot', template: '', variables: ['v1'] });
    expect(res.status).toBe(422);
  });

  it('422 when variables is not an array', async () => {
    seedAuthQueries();
    const res = await request(createAdminApp())
      .post('/api/admin/prompts')
      .send({ task: 'actor_headshot', template: 'test', variables: 'not-an-array' });
    expect(res.status).toBe(422);
  });

  it('201 on successful creation', async () => {
    seedAuthQueries();
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'new-prompt-uuid',
          task: 'actor_headshot',
          template: 'Headshot of {{identity_description}}',
          variables: ['identity_description'],
          created_at: '2026-06-20T12:00:00.000Z',
          updated_at: '2026-06-20T12:00:00.000Z',
        },
      ],
    } as any);

    const res = await request(createAdminApp())
      .post('/api/admin/prompts')
      .send({
        task: 'actor_headshot',
        template: 'Headshot of {{identity_description}}',
        variables: ['identity_description'],
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('new-prompt-uuid');
    expect(res.body.task).toBe('actor_headshot');
    expect(res.body.template).toBe('Headshot of {{identity_description}}');
    expect(res.body.variables).toEqual(['identity_description']);

    // Verify INSERT was called
    expect(mockQuery.mock.calls[2][0]).toContain('INSERT INTO system_prompts');
  });
});

// ===================================================================
// PATCH /api/admin/prompts/:id — update a system prompt
// ===================================================================
describe('PATCH /api/admin/prompts/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('401 when not authenticated', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/admin', adminRouter);
    const res = await request(app)
      .patch('/api/admin/prompts/some-uuid')
      .send({ template: 'updated' });
    expect(res.status).toBe(401);
  });

  it('422 when body has no updatable fields', async () => {
    seedAuthQueries();
    const res = await request(createAdminApp()).patch('/api/admin/prompts/some-uuid').send({});
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('422 when template is empty string', async () => {
    seedAuthQueries();
    const res = await request(createAdminApp())
      .patch('/api/admin/prompts/some-uuid')
      .send({ template: '' });
    expect(res.status).toBe(422);
  });

  it('422 when variables is not an array', async () => {
    seedAuthQueries();
    const res = await request(createAdminApp())
      .patch('/api/admin/prompts/some-uuid')
      .send({ variables: 'not-array' });
    expect(res.status).toBe(422);
  });

  it('404 when prompt not found', async () => {
    seedAuthQueries();
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createAdminApp())
      .patch('/api/admin/prompts/nonexistent-uuid')
      .send({ template: 'Updated template' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('200 on successful update — template only', async () => {
    seedAuthQueries();
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'prompt-uuid',
          task: 'actor_headshot',
          template: 'Updated headshot of {{identity_description}}',
          variables: ['identity_description'],
          created_at: '2026-06-17T10:00:00.000Z',
          updated_at: '2026-06-20T14:00:00.000Z',
        },
      ],
    } as any);

    const res = await request(createAdminApp())
      .patch('/api/admin/prompts/prompt-uuid')
      .send({ template: 'Updated headshot of {{identity_description}}' });

    expect(res.status).toBe(200);
    expect(res.body.template).toBe('Updated headshot of {{identity_description}}');
    expect(mockQuery.mock.calls[2][0]).toContain('UPDATE system_prompts');
  });

  it('200 on successful update — variables only', async () => {
    seedAuthQueries();
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'prompt-uuid',
          task: 'actor_headshot',
          template: 'Headshot of {{identity_description}}',
          variables: ['identity_description', 'age'],
          created_at: '2026-06-17T10:00:00.000Z',
          updated_at: '2026-06-20T14:00:00.000Z',
        },
      ],
    } as any);

    const res = await request(createAdminApp())
      .patch('/api/admin/prompts/prompt-uuid')
      .send({ variables: ['identity_description', 'age'] });

    expect(res.status).toBe(200);
    expect(res.body.variables).toEqual(['identity_description', 'age']);
  });

  it('200 on successful update — both template and variables', async () => {
    seedAuthQueries();
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'prompt-uuid',
          task: 'actor_headshot',
          template: 'New template {{v1}}',
          variables: ['v1', 'v2'],
          created_at: '2026-06-17T10:00:00.000Z',
          updated_at: '2026-06-20T14:00:00.000Z',
        },
      ],
    } as any);

    const res = await request(createAdminApp())
      .patch('/api/admin/prompts/prompt-uuid')
      .send({ template: 'New template {{v1}}', variables: ['v1', 'v2'] });

    expect(res.status).toBe(200);
    expect(res.body.template).toBe('New template {{v1}}');
    expect(res.body.variables).toEqual(['v1', 'v2']);
  });
});

// ===================================================================
// DELETE /api/admin/prompts/:id — delete a system prompt
// ===================================================================
describe('DELETE /api/admin/prompts/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('401 when not authenticated', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/admin', adminRouter);
    const res = await request(app).delete('/api/admin/prompts/some-uuid');
    expect(res.status).toBe(401);
  });

  it('404 when prompt not found', async () => {
    seedAuthQueries();
    mockQuery.mockResolvedValueOnce({ rowCount: 0 } as any);

    const res = await request(createAdminApp()).delete('/api/admin/prompts/nonexistent-uuid');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('200 on successful delete', async () => {
    seedAuthQueries();
    mockQuery.mockResolvedValueOnce({ rowCount: 1 } as any);

    const res = await request(createAdminApp()).delete('/api/admin/prompts/prompt-uuid');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    expect(mockQuery.mock.calls[2][0]).toContain('DELETE FROM system_prompts');
  });
});
