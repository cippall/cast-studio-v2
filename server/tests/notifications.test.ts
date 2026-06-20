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
import notificationsRouter from '../src/routes/notifications.js';

const mockQuery = vi.mocked(poolModule.query);

// Valid v4 UUIDs
const WORKSPACE_UUID = 'a0000000-0000-4000-8000-000000000001';
const ARTIST_UUID = 'c0000000-0000-4000-8000-000000000002';
const NOTIFICATION_UUID = 'n0000000-0000-4000-8000-000000000001';
const NOTIFICATION_UUID_2 = 'n0000000-0000-4000-8000-000000000002';

// --- Test data factories ---

function makeArtistRow() {
  return {
    id: ARTIST_UUID,
    workspace_id: WORKSPACE_UUID,
    name: 'Test Artist',
    email: 'artist@studio.com',
    role: 'ARTIST',
    is_api_able: false,
    password_hash: '$2a$10$hashedpassword',
    created_at: '2026-06-17T10:00:00.000Z',
  };
}

function makeWorkspaceRow() {
  return {
    id: WORKSPACE_UUID,
    name: 'Test Workspace',
    slug: 'test-workspace',
    workspace_type: 'STUDIO',
    created_at: '2026-06-17T10:00:00.000Z',
  };
}

function makeNotificationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: NOTIFICATION_UUID,
    recipient_id: ARTIST_UUID,
    type: 'COMMISSION_ASSIGNED',
    title: 'New Commission Assigned',
    message: 'You have been assigned "Cyberpunk actor"',
    is_read: false,
    created_at: '2026-06-17T10:00:00.000Z',
    ...overrides,
  };
}

// --- Test setup helpers ---

function seedRequireSessionQueries(accountRow: Record<string, unknown>) {
  mockQuery.mockResolvedValueOnce({ rows: [accountRow] } as any);
}

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
  app.use('/api/notifications', notificationsRouter);
  return app;
}

function resetMock() {
  mockQuery.mockReset();
}

// ================================================================
// GET /api/notifications
// ================================================================
describe('GET /api/notifications', () => {
  beforeEach(() => {
    resetMock();
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(createRouteApp()).get('/api/notifications');
    expect(res.status).toBe(401);
  });

  it('returns paginated notifications for the authenticated user', async () => {
    const artist = makeArtistRow();
    seedRequireSessionQueries(artist);

    const n1 = makeNotificationRow();
    const n2 = makeNotificationRow({
      id: NOTIFICATION_UUID_2,
      type: 'COMMISSION_APPROVED',
      title: 'Commission Approved',
      message: 'Your commission has been approved',
    });

    mockQuery.mockResolvedValueOnce({ rows: [{ count: 2 }] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [n1, n2] } as any);

    const res = await request(createRouteApp(artist)).get('/api/notifications');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].type).toBe('COMMISSION_ASSIGNED');
    expect(res.body.data[1].type).toBe('COMMISSION_APPROVED');
    expect(res.body.pagination).toMatchObject({
      page: 1,
      pageSize: 20,
      totalItems: 2,
      totalPages: 1,
    });
  });

  it('filters by is_read=false', async () => {
    const artist = makeArtistRow();
    seedRequireSessionQueries(artist);

    const unread = makeNotificationRow({ is_read: false });
    mockQuery.mockResolvedValueOnce({ rows: [{ count: 1 }] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [unread] } as any);

    const res = await request(createRouteApp(artist))
      .get('/api/notifications')
      .query({ is_read: 'false' });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].is_read).toBe(false);
  });

  it('returns empty list when no notifications', async () => {
    const artist = makeArtistRow();
    seedRequireSessionQueries(artist);

    mockQuery.mockResolvedValueOnce({ rows: [{ count: 0 }] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createRouteApp(artist)).get('/api/notifications');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.pagination.totalItems).toBe(0);
  });

  it('supports custom page and pageSize', async () => {
    const artist = makeArtistRow();
    seedRequireSessionQueries(artist);

    mockQuery.mockResolvedValueOnce({ rows: [{ count: 5 }] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [makeNotificationRow()] } as any);

    const res = await request(createRouteApp(artist))
      .get('/api/notifications')
      .query({ page: 2, pageSize: 1 });
    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(2);
    expect(res.body.pagination.pageSize).toBe(1);
    expect(res.body.pagination.totalPages).toBe(5);
  });
});

// ================================================================
// GET /api/notifications/unread-count
// ================================================================
describe('GET /api/notifications/unread-count', () => {
  beforeEach(() => {
    resetMock();
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(createRouteApp()).get('/api/notifications/unread-count');
    expect(res.status).toBe(401);
  });

  it('returns unread count', async () => {
    const artist = makeArtistRow();
    seedRequireSessionQueries(artist);

    mockQuery.mockResolvedValueOnce({ rows: [{ count: 3 }] } as any);

    const res = await request(createRouteApp(artist)).get('/api/notifications/unread-count');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(3);
  });

  it('returns 0 when no unread notifications', async () => {
    const artist = makeArtistRow();
    seedRequireSessionQueries(artist);

    mockQuery.mockResolvedValueOnce({ rows: [{ count: 0 }] } as any);

    const res = await request(createRouteApp(artist)).get('/api/notifications/unread-count');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
  });
});

// ================================================================
// PATCH /api/notifications/:id/read
// ================================================================
describe('PATCH /api/notifications/:id/read', () => {
  beforeEach(() => {
    resetMock();
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(createRouteApp()).patch(
      `/api/notifications/${NOTIFICATION_UUID}/read`,
    );
    expect(res.status).toBe(401);
  });

  it('marks notification as read', async () => {
    const artist = makeArtistRow();
    seedRequireSessionQueries(artist);

    const updated = makeNotificationRow({ is_read: true });
    mockQuery.mockResolvedValueOnce({ rows: [updated] } as any);

    const res = await request(createRouteApp(artist)).patch(
      `/api/notifications/${NOTIFICATION_UUID}/read`,
    );
    expect(res.status).toBe(200);
    expect(res.body.is_read).toBe(true);
    expect(res.body.id).toBe(NOTIFICATION_UUID);
  });

  it('returns 404 when notification not found', async () => {
    const artist = makeArtistRow();
    seedRequireSessionQueries(artist);

    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createRouteApp(artist)).patch(
      `/api/notifications/${NOTIFICATION_UUID}/read`,
    );
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('cannot mark another users notification as read', async () => {
    const artist = makeArtistRow();
    seedRequireSessionQueries(artist);

    // The query includes recipient_id = $2, so if it doesn't match, returns empty
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createRouteApp(artist)).patch(
      `/api/notifications/${NOTIFICATION_UUID}/read`,
    );
    expect(res.status).toBe(404);
  });
});

// ================================================================
// POST /api/notifications/read-all
// ================================================================
describe('POST /api/notifications/read-all', () => {
  beforeEach(() => {
    resetMock();
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(createRouteApp()).post('/api/notifications/read-all');
    expect(res.status).toBe(401);
  });

  it('marks all notifications as read', async () => {
    const artist = makeArtistRow();
    seedRequireSessionQueries(artist);

    mockQuery.mockResolvedValueOnce({ rowCount: 5 } as any);

    const res = await request(createRouteApp(artist)).post('/api/notifications/read-all');
    expect(res.status).toBe(200);
    expect(res.body.marked_read).toBe(5);
  });

  it('returns 0 when no unread notifications', async () => {
    const artist = makeArtistRow();
    seedRequireSessionQueries(artist);

    mockQuery.mockResolvedValueOnce({ rowCount: 0 } as any);

    const res = await request(createRouteApp(artist)).post('/api/notifications/read-all');
    expect(res.status).toBe(200);
    expect(res.body.marked_read).toBe(0);
  });
});
