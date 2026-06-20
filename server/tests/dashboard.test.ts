import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Mock pool before importing modules that use it
vi.mock('../src/db/pool.js', () => {
  const mockPoolClient = {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    release: vi.fn(),
    on: vi.fn(),
  };
  return {
    query: vi.fn(),
    getClient: vi.fn().mockResolvedValue(mockPoolClient),
    default: { connect: vi.fn().mockResolvedValue(mockPoolClient) },
  };
});

import * as poolModule from '../src/db/pool.js';
import dashboardRouter from '../src/routes/dashboard.js';

const mockQuery = vi.mocked(poolModule.query);

const WORKSPACE_UUID = 'a0000000-0000-4000-8000-000000000001';
const ADMIN_UUID = 'b0000000-0000-4000-8000-000000000001';
const ARTIST_UUID = 'b0000000-0000-4000-8000-000000000002';
const CLIENT_UUID = 'b0000000-0000-4000-8000-000000000003';

function makeAccountRow(id: string, role: string) {
  return {
    id,
    workspace_id: WORKSPACE_UUID,
    name: `Test ${role}`,
    email: `${role.toLowerCase()}@test.com`,
    role,
    is_api_able: false,
    password_hash: '$2a$10$hashed',
    created_at: '2026-06-17T10:00:00.000Z',
  };
}

function makeWorkspaceRow() {
  return {
    id: WORKSPACE_UUID,
    name: 'Test Workspace',
    slug: 'test-ws',
    workspace_type: 'STUDIO',
    created_at: '2026-06-17T10:00:00.000Z',
  };
}

function seedSession(account: ReturnType<typeof makeAccountRow>) {
  mockQuery.mockResolvedValueOnce({ rows: [account] } as any);
  mockQuery.mockResolvedValueOnce({ rows: [makeWorkspaceRow()] } as any);
}

function resetMock() {
  mockQuery.mockReset();
}

function createDashboardApp(accountOverride?: Record<string, unknown>) {
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
  app.use('/api', dashboardRouter);
  return app;
}

describe('GET /api/dashboard', () => {
  beforeEach(() => {
    resetMock();
  });

  describe('ADMIN role', () => {
    it('returns global stats', async () => {
      const account = makeAccountRow(ADMIN_UUID, 'ADMIN');
      seedSession(account);
      mockQuery.mockResolvedValueOnce({ rows: [{ count: 42 }] } as any);
      mockQuery.mockResolvedValueOnce({ rows: [{ count: 15 }] } as any);
      mockQuery.mockResolvedValueOnce({ rows: [{ count: 8 }] } as any);
      mockQuery.mockResolvedValueOnce({ rows: [{ count: 25 }] } as any);
      mockQuery.mockResolvedValueOnce({ rows: [{ count: 3 }] } as any);

      const res = await request(createDashboardApp(account)).get('/api/dashboard');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        totalActors: 42,
        totalLooks: 15,
        totalFashionItems: 8,
        activeMembers: 25,
        pendingCommissions: 3,
      });
    });

    it('returns zeros when tables are empty', async () => {
      const account = makeAccountRow(ADMIN_UUID, 'ADMIN');
      seedSession(account);
      mockQuery.mockResolvedValueOnce({ rows: [{ count: 0 }] } as any);
      mockQuery.mockResolvedValueOnce({ rows: [{ count: 0 }] } as any);
      mockQuery.mockResolvedValueOnce({ rows: [{ count: 0 }] } as any);
      mockQuery.mockResolvedValueOnce({ rows: [{ count: 0 }] } as any);
      mockQuery.mockResolvedValueOnce({ rows: [{ count: 0 }] } as any);

      const res = await request(createDashboardApp(account)).get('/api/dashboard');

      expect(res.status).toBe(200);
      expect(res.body.totalActors).toBe(0);
      expect(res.body.pendingCommissions).toBe(0);
    });
  });

  describe('ARTIST role', () => {
    it('returns artist-specific stats with recent submissions', async () => {
      const account = makeAccountRow(ARTIST_UUID, 'ARTIST');
      seedSession(account);
      mockQuery.mockResolvedValueOnce({ rows: [{ count: 5 }] } as any);
      mockQuery.mockResolvedValueOnce({ rows: [{ count: 3 }] } as any);
      mockQuery.mockResolvedValueOnce({ rows: [{ count: 2 }] } as any);
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'a1',
            asset_type: 'ACTOR',
            name: 'Actor 1',
            thumbnail_url: 'http://example.com/1.jpg',
            action: 'Generated',
            created_at: '2026-06-18T10:00:00.000Z',
          },
          {
            id: 'a2',
            asset_type: 'LOOK',
            name: 'Look 1',
            thumbnail_url: null,
            action: 'Generated',
            created_at: '2026-06-17T10:00:00.000Z',
          },
        ],
      } as any);

      const res = await request(createDashboardApp(account)).get('/api/dashboard');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        myActors: 5,
        myLooks: 3,
        myItems: 2,
        recentSubmissions: [
          {
            id: 'a1',
            asset_type: 'ACTOR',
            name: 'Actor 1',
            thumbnail_url: 'http://example.com/1.jpg',
            action: 'Generated',
            created_at: '2026-06-18T10:00:00.000Z',
          },
          {
            id: 'a2',
            asset_type: 'LOOK',
            name: 'Look 1',
            thumbnail_url: null,
            action: 'Generated',
            created_at: '2026-06-17T10:00:00.000Z',
          },
        ],
      });
    });

    it('returns empty submissions when artist has no assets', async () => {
      const account = makeAccountRow(ARTIST_UUID, 'ARTIST');
      seedSession(account);
      mockQuery.mockResolvedValueOnce({ rows: [{ count: 0 }] } as any);
      mockQuery.mockResolvedValueOnce({ rows: [{ count: 0 }] } as any);
      mockQuery.mockResolvedValueOnce({ rows: [{ count: 0 }] } as any);
      mockQuery.mockResolvedValueOnce({ rows: [] } as any);

      const res = await request(createDashboardApp(account)).get('/api/dashboard');

      expect(res.status).toBe(200);
      expect(res.body.myActors).toBe(0);
      expect(res.body.recentSubmissions).toEqual([]);
    });
  });

  describe('CLIENT role', () => {
    it('returns wallet balance, active commissions, and recent purchases', async () => {
      const account = makeAccountRow(CLIENT_UUID, 'CLIENT');
      seedSession(account);
      mockQuery.mockResolvedValueOnce({ rows: [{ balance_credits: 250.75 }] } as any);
      mockQuery.mockResolvedValueOnce({ rows: [{ count: 2 }] } as any);
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'p1',
            asset_type: 'ACTOR',
            name: 'Actor X',
            thumbnail_url: 'http://example.com/p1.jpg',
            action: 'Purchased',
            created_at: '2026-06-19T10:00:00.000Z',
          },
        ],
      } as any);

      const res = await request(createDashboardApp(account)).get('/api/dashboard');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        walletBalance: 250.75,
        activeCommissions: 2,
        recentPurchases: [
          {
            id: 'p1',
            asset_type: 'ACTOR',
            name: 'Actor X',
            thumbnail_url: 'http://example.com/p1.jpg',
            action: 'Purchased',
            created_at: '2026-06-19T10:00:00.000Z',
          },
        ],
      });
    });

    it('returns zero balance when wallet row is missing', async () => {
      const account = makeAccountRow(CLIENT_UUID, 'CLIENT');
      seedSession(account);
      mockQuery.mockResolvedValueOnce({ rows: [] } as any);
      mockQuery.mockResolvedValueOnce({ rows: [{ count: 0 }] } as any);
      mockQuery.mockResolvedValueOnce({ rows: [] } as any);

      const res = await request(createDashboardApp(account)).get('/api/dashboard');

      expect(res.status).toBe(200);
      expect(res.body.walletBalance).toBe(0);
      expect(res.body.activeCommissions).toBe(0);
      expect(res.body.recentPurchases).toEqual([]);
    });
  });

  describe('unauthenticated', () => {
    it('returns 401 without session', async () => {
      const app = express();
      app.use(express.json());
      app.use((req: Request, _res: Response, next: NextFunction) => {
        (req as any).session = {};
        next();
      });
      app.use('/api', dashboardRouter);

      const res = await request(app).get('/api/dashboard');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});
