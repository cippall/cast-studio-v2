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
import sharingRouter from '../src/routes/sharing.js';

const mockQuery = vi.mocked(poolModule.query);

// Valid UUIDs
const WORKSPACE_UUID = 'a0000000-0000-4000-8000-000000000001';
const ARTIST_UUID = 'b0000000-0000-4000-8000-000000000001';
const CLIENT_UUID = 'c0000000-0000-4000-8000-000000000002';
const ADMIN_UUID = 'd0000000-0000-4000-8000-000000000003';
const ASSET_UUID = 'e0000000-0000-4000-8000-000000000004';
const PERMISSION_UUID = 'f0000000-0000-4000-8000-000000000005';

// --- Factories ---

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

function makeAssetRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ASSET_UUID,
    workspace_id: WORKSPACE_UUID,
    creator_id: ARTIST_UUID,
    client_id: null,
    asset_type: 'ACTOR',
    name: 'Test Actor',
    seed: 12345,
    prompt_recipe: { identity: { age: 25 } },
    marketplace_status: null,
    is_marketplace_frozen: false,
    source_asset_id: null,
    source_type: 'ORIGINAL',
    deleted_at: null,
    created_at: '2026-06-17T10:00:00.000Z',
    ...overrides,
  };
}

function makePermissionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: PERMISSION_UUID,
    asset_id: ASSET_UUID,
    grantee_id: CLIENT_UUID,
    granted_at: '2026-06-17T10:00:00.000Z',
    revoked_at: null,
    ...overrides,
  };
}

// --- Test setup helpers ---

function seedRequireSessionQueries(accountRow: Record<string, unknown>) {
  mockQuery.mockResolvedValueOnce({ rows: [accountRow] } as any);
  mockQuery.mockResolvedValueOnce({ rows: [makeWorkspaceRow()] } as any);
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
  app.use('/api', sharingRouter);
  return app;
}

function resetMock() {
  mockQuery.mockReset();
}

// ================================================================
// POST /api/assets/:id/share
// ================================================================
describe('POST /api/assets/:id/share', () => {
  beforeEach(() => {
    resetMock();
  });

  it('401 when not authenticated', async () => {
    const res = await request(createRouteApp())
      .post(`/api/assets/${ASSET_UUID}/share`)
      .send({ grantee_id: CLIENT_UUID });
    expect(res.status).toBe(401);
  });

  it('404 when asset not found', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    // findAssetById returns empty
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createRouteApp(artist))
      .post(`/api/assets/${ASSET_UUID}/share`)
      .send({ grantee_id: CLIENT_UUID });
    expect(res.status).toBe(404);
  });

  it('403 when sharing client-owned asset', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    // Asset has client_id set (client-owned)
    mockQuery.mockResolvedValueOnce({
      rows: [makeAssetRow({ client_id: CLIENT_UUID })],
    } as any);

    const res = await request(createRouteApp(artist))
      .post(`/api/assets/${ASSET_UUID}/share`)
      .send({ grantee_id: CLIENT_UUID });
    expect(res.status).toBe(403);
  });

  it('403 when asset is marketplace-frozen', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    mockQuery.mockResolvedValueOnce({
      rows: [makeAssetRow({ is_marketplace_frozen: true })],
    } as any);

    const res = await request(createRouteApp(artist))
      .post(`/api/assets/${ASSET_UUID}/share`)
      .send({ grantee_id: CLIENT_UUID });
    expect(res.status).toBe(403);
  });

  it('422 when grantee_id is missing', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    mockQuery.mockResolvedValueOnce({
      rows: [makeAssetRow()],
    } as any);

    const res = await request(createRouteApp(artist))
      .post(`/api/assets/${ASSET_UUID}/share`)
      .send({});
    expect(res.status).toBe(422);
  });

  it('201 creates permission successfully', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    // findAssetById
    mockQuery.mockResolvedValueOnce({ rows: [makeAssetRow()] } as any);

    // INSERT INTO asset_permissions
    mockQuery.mockResolvedValueOnce({
      rows: [makePermissionRow()],
    } as any);

    const res = await request(createRouteApp(artist))
      .post(`/api/assets/${ASSET_UUID}/share`)
      .send({ grantee_id: CLIENT_UUID });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: PERMISSION_UUID,
      asset_id: ASSET_UUID,
      grantee_id: CLIENT_UUID,
    });
    expect(res.body).toHaveProperty('granted_at');
    expect(res.body.revoked_at).toBeNull();

    // Verify INSERT query
    const insertCall = mockQuery.mock.calls[3] as [string, unknown[]];
    expect(insertCall[0]).toContain('INSERT INTO asset_permissions');
    expect(insertCall[1]).toContain(ASSET_UUID);
    expect(insertCall[1]).toContain(CLIENT_UUID);
  });

  it('201 admin can share any workspace asset', async () => {
    const admin = makeAccountRow({ id: ADMIN_UUID, role: 'ADMIN' });
    seedRequireSessionQueries(admin);

    mockQuery.mockResolvedValueOnce({ rows: [makeAssetRow()] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [makePermissionRow()] } as any);

    const res = await request(createRouteApp(admin))
      .post(`/api/assets/${ASSET_UUID}/share`)
      .send({ grantee_id: CLIENT_UUID });
    expect(res.status).toBe(201);
  });
});

// ================================================================
// GET /api/assets/:id/permissions
// ================================================================
describe('GET /api/assets/:id/permissions', () => {
  beforeEach(() => {
    resetMock();
  });

  it('401 when not authenticated', async () => {
    const res = await request(createRouteApp()).get(`/api/assets/${ASSET_UUID}/permissions`);
    expect(res.status).toBe(401);
  });

  it('404 when asset not found', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createRouteApp(artist)).get(`/api/assets/${ASSET_UUID}/permissions`);
    expect(res.status).toBe(404);
  });

  it('200 returns empty list when no permissions', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    // findAssetById
    mockQuery.mockResolvedValueOnce({ rows: [makeAssetRow()] } as any);
    // Permissions query
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createRouteApp(artist)).get(`/api/assets/${ASSET_UUID}/permissions`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('200 lists active permissions with grantee info', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    mockQuery.mockResolvedValueOnce({ rows: [makeAssetRow()] } as any);

    const permission = makePermissionRow({
      grantee_name: 'Test Client',
      grantee_email: 'client@brand.com',
    });
    mockQuery.mockResolvedValueOnce({ rows: [permission] } as any);

    const res = await request(createRouteApp(artist)).get(`/api/assets/${ASSET_UUID}/permissions`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      id: PERMISSION_UUID,
      asset_id: ASSET_UUID,
      grantee_id: CLIENT_UUID,
    });
  });
});

// ================================================================
// DELETE /api/permissions/:id
// ================================================================
describe('DELETE /api/permissions/:id', () => {
  beforeEach(() => {
    resetMock();
  });

  it('401 when not authenticated', async () => {
    const res = await request(createRouteApp()).delete(`/api/permissions/${PERMISSION_UUID}`);
    expect(res.status).toBe(401);
  });

  it('404 when permission not found', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    // findAssetPermission returns null
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createRouteApp(artist)).delete(`/api/permissions/${PERMISSION_UUID}`);
    expect(res.status).toBe(404);
  });

  it('403 when non-creator, non-admin tries to revoke', async () => {
    const otherArtist = makeAccountRow({
      id: 'other-artist-0000-0000-0000-000000000001',
    });
    seedRequireSessionQueries(otherArtist);

    // findAssetPermission returns permission
    mockQuery.mockResolvedValueOnce({
      rows: [makePermissionRow({ grantee_id: CLIENT_UUID })],
    } as any);

    // findAssetById returns asset with creator_id = ARTIST_UUID (not otherArtist)
    mockQuery.mockResolvedValueOnce({
      rows: [makeAssetRow({ creator_id: ARTIST_UUID })],
    } as any);

    const res = await request(createRouteApp(otherArtist)).delete(
      `/api/permissions/${PERMISSION_UUID}`,
    );
    expect(res.status).toBe(403);
  });

  it('200 creator can revoke permission', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);

    // findAssetPermission
    mockQuery.mockResolvedValueOnce({
      rows: [makePermissionRow()],
    } as any);

    // findAssetById returns asset owned by this artist
    mockQuery.mockResolvedValueOnce({
      rows: [makeAssetRow({ creator_id: ARTIST_UUID })],
    } as any);

    // REVOKE UPDATE
    mockQuery.mockResolvedValueOnce({ rows: [{ id: PERMISSION_UUID }] } as any);

    const res = await request(createRouteApp(artist)).delete(`/api/permissions/${PERMISSION_UUID}`);
    expect(res.status).toBe(200);

    // Verify the revoked_at is being set
    const revokeCall = mockQuery.mock.calls[4] as [string, unknown[]];
    expect(revokeCall[0]).toContain('UPDATE asset_permissions');
    expect(revokeCall[0]).toContain('revoked_at = NOW()');
    expect(revokeCall[1]).toContain(PERMISSION_UUID);
  });

  it('200 admin can revoke any permission', async () => {
    const admin = makeAccountRow({ id: ADMIN_UUID, role: 'ADMIN' });
    seedRequireSessionQueries(admin);

    mockQuery.mockResolvedValueOnce({ rows: [makePermissionRow()] } as any);
    // Admin bypass: no findAssetById needed, or uses adminBypass
    mockQuery.mockResolvedValueOnce({ rows: [makeAssetRow()] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [{ id: PERMISSION_UUID }] } as any);

    const res = await request(createRouteApp(admin)).delete(`/api/permissions/${PERMISSION_UUID}`);
    expect(res.status).toBe(200);
  });
});
