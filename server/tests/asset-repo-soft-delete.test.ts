import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/db/pool.js', () => ({
  query: vi.fn(),
  getClient: vi.fn(),
  default: {},
}));

import { query } from '../src/db/pool.js';
import { listAssets, findAssetById } from '../src/db/repositories/asset-repo.js';

const mockQuery = vi.mocked(query);

const WORKSPACE = 'a0000000-0000-4000-8000-000000000001';
const ARTIST = 'b0000000-0000-4000-8000-000000000001';
const ASSET_ID = 'c0000000-0000-4000-8000-000000000001';

beforeEach(() => {
  mockQuery.mockReset();
});

describe('findAssetById — soft-delete filter', () => {
  it('excludes soft-deleted assets by default', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await findAssetById(ASSET_ID, WORKSPACE);

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('deleted_at IS NULL');
  });

  it('includes soft-deleted assets when includeDeleted=true', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: ASSET_ID, deleted_at: '2025-01-01' }],
      rowCount: 1,
    } as never);

    await findAssetById(ASSET_ID, WORKSPACE, false, true);

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).not.toContain('deleted_at');
  });
});

describe('listAssets — soft-delete filter', () => {
  it('excludes soft-deleted assets by default', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] } as never);
    mockQuery.mockResolvedValueOnce({ rows: [] } as never);

    await listAssets({
      assetType: 'actor',
      workspaceId: WORKSPACE,
      creatorId: ARTIST,
    });

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('a.deleted_at IS NULL');
  });

  it('includes soft-deleted assets when includeDeleted=true', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] } as never);
    mockQuery.mockResolvedValueOnce({ rows: [] } as never);

    await listAssets({
      assetType: 'actor',
      workspaceId: WORKSPACE,
      includeDeleted: true,
    });

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).not.toContain('deleted_at');
  });
});
