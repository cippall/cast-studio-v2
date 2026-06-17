import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { QueryResult } from 'pg';

// Mock the pool module
vi.mock('../src/db/pool.js', () => ({
  query: vi.fn(),
  getClient: vi.fn(),
  default: {},
}));

// Import after mocking is hoisted
import { queryTable } from '../src/db/query-helper.js';
import * as poolModule from '../src/db/pool.js';

const mockQuery = vi.mocked(poolModule.query);

interface TestRow {
  id: string;
  workspace_id: string;
  name: string;
  deleted_at: string | null;
  [key: string]: unknown;
}

function makeRow(overrides: Partial<TestRow> = {}): TestRow {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    workspace_id: 'ws-1',
    name: 'test',
    deleted_at: null,
    ...overrides,
  };
}

function makeQueryResult(rows: unknown[]): QueryResult {
  return {
    rows: rows as QueryResult['rows'],
    rowCount: rows.length,
    command: 'SELECT',
    oid: 0,
    fields: [],
  } as QueryResult;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('queryTable — SQL construction', () => {
  it('should build a basic SELECT with workspace filter', async () => {
    mockQuery
      .mockResolvedValueOnce(makeQueryResult([{ count: '0' }]))
      .mockResolvedValueOnce(makeQueryResult([]));

    await queryTable('assets', { workspaceId: 'ws-1' });

    expect(mockQuery).toHaveBeenCalledTimes(2);

    // Count query — SQL includes workspace_id filter
    const countSql = mockQuery.mock.calls[0][0] as string;
    expect(countSql).toContain('FROM assets');
    expect(countSql).toContain('workspace_id = $1');
    expect(countSql).toContain('deleted_at IS NULL');

    // Data query — SQL includes LIMIT/OFFSET
    const dataSql = mockQuery.mock.calls[1][0] as string;
    expect(dataSql).toContain('SELECT * FROM assets');
    expect(dataSql).toContain('LIMIT $2 OFFSET $3');

    // Params match
    expect(mockQuery.mock.calls[0][1]).toEqual(['ws-1']);
    expect(mockQuery.mock.calls[1][1]).toEqual(['ws-1', 20, 0]);
  });

  it('should include deleted_at IS NULL filter by default', async () => {
    mockQuery
      .mockResolvedValueOnce(makeQueryResult([{ count: '0' }]))
      .mockResolvedValueOnce(makeQueryResult([]));

    await queryTable('assets', { workspaceId: 'ws-1' });

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('deleted_at IS NULL');
  });

  it('should omit deleted_at filter when includeDeleted is true', async () => {
    mockQuery
      .mockResolvedValueOnce(makeQueryResult([{ count: '0' }]))
      .mockResolvedValueOnce(makeQueryResult([]));

    await queryTable('assets', { workspaceId: 'ws-1', includeDeleted: true });

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).not.toContain('deleted_at IS NULL');
  });

  it('should skip workspace filter when adminBypass is true', async () => {
    mockQuery
      .mockResolvedValueOnce(makeQueryResult([{ count: '0' }]))
      .mockResolvedValueOnce(makeQueryResult([]));

    await queryTable('assets', { workspaceId: 'ws-1', adminBypass: true });

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).not.toContain('workspace_id');
  });

  it('should keep deleted_at filter even with adminBypass', async () => {
    mockQuery
      .mockResolvedValueOnce(makeQueryResult([{ count: '0' }]))
      .mockResolvedValueOnce(makeQueryResult([]));

    await queryTable('assets', { workspaceId: 'ws-1', adminBypass: true });

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('deleted_at IS NULL');
  });

  it('should apply additional filters', async () => {
    mockQuery
      .mockResolvedValueOnce(makeQueryResult([{ count: '0' }]))
      .mockResolvedValueOnce(makeQueryResult([]));

    await queryTable('assets', {
      workspaceId: 'ws-1',
      filters: { asset_type: 'ACTOR', creator_id: 'user-1' },
    });

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('asset_type = $2');
    expect(sql).toContain('creator_id = $3');
    expect(mockQuery.mock.calls[0][1]).toEqual(['ws-1', 'ACTOR', 'user-1']);
  });

  it('should apply pagination with defaults', async () => {
    mockQuery
      .mockResolvedValueOnce(makeQueryResult([{ count: '42' }]))
      .mockResolvedValueOnce(makeQueryResult([]));

    const result = await queryTable('assets', { workspaceId: 'ws-1' });

    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 20,
      totalItems: 42,
      totalPages: 3,
    });
  });

  it('should respect custom pagination parameters', async () => {
    mockQuery
      .mockResolvedValueOnce(makeQueryResult([{ count: '100' }]))
      .mockResolvedValueOnce(makeQueryResult([]));

    const result = await queryTable('assets', {
      workspaceId: 'ws-1',
      page: 3,
      pageSize: 10,
    });

    expect(result.pagination).toEqual({
      page: 3,
      pageSize: 10,
      totalItems: 100,
      totalPages: 10,
    });

    // LIMIT 10 OFFSET (3-1)*10 = 20
    expect(mockQuery.mock.calls[1][1]).toEqual(['ws-1', 10, 20]);
  });

  it('should apply custom sort order', async () => {
    mockQuery
      .mockResolvedValueOnce(makeQueryResult([{ count: '0' }]))
      .mockResolvedValueOnce(makeQueryResult([]));

    await queryTable('assets', {
      workspaceId: 'ws-1',
      sortBy: 'name',
      sortOrder: 'asc',
    });

    const dataSql = mockQuery.mock.calls[1][0] as string;
    expect(dataSql).toContain('ORDER BY name ASC');
  });

  it('should apply default sort by created_at desc', async () => {
    mockQuery
      .mockResolvedValueOnce(makeQueryResult([{ count: '0' }]))
      .mockResolvedValueOnce(makeQueryResult([]));

    await queryTable('assets', { workspaceId: 'ws-1' });

    const dataSql = mockQuery.mock.calls[1][0] as string;
    expect(dataSql).toContain('ORDER BY created_at DESC');
  });

  it('should handle no results with empty array and zero pagination', async () => {
    mockQuery
      .mockResolvedValueOnce(makeQueryResult([{ count: '0' }]))
      .mockResolvedValueOnce(makeQueryResult([]));

    const result = await queryTable('assets', { workspaceId: 'ws-999' });

    expect(result.data).toEqual([]);
    expect(result.pagination.totalItems).toBe(0);
    expect(result.pagination.totalPages).toBe(0);
  });

  it('should return data rows when results exist', async () => {
    const rows = [makeRow({ id: 'abc', workspace_id: 'ws-1', name: 'Test Actor' })];
    mockQuery
      .mockResolvedValueOnce(makeQueryResult([{ count: '1' }]))
      .mockResolvedValueOnce(makeQueryResult(rows));

    const result = await queryTable('assets', { workspaceId: 'ws-1' });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({ id: 'abc', name: 'Test Actor' });
  });

  it('should convert camelCase filter keys to snake_case', async () => {
    mockQuery
      .mockResolvedValueOnce(makeQueryResult([{ count: '0' }]))
      .mockResolvedValueOnce(makeQueryResult([]));

    await queryTable('assets', {
      workspaceId: 'ws-1',
      filters: { assetType: 'LOOK' },
    });

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('asset_type = $2');
  });
});

describe('queryTable — cross-workspace isolation', () => {
  it('should return different results for different workspace IDs', async () => {
    // Workspace 1 has data
    mockQuery
      .mockResolvedValueOnce(makeQueryResult([{ count: '2' }]))
      .mockResolvedValueOnce(
        makeQueryResult([
          makeRow({ id: 'a1', workspace_id: 'ws-1' }),
          makeRow({ id: 'a2', workspace_id: 'ws-1' }),
        ]),
      );

    const ws1Result = await queryTable('assets', { workspaceId: 'ws-1' });
    expect(ws1Result.data).toHaveLength(2);

    // Workspace 2 has no data
    mockQuery
      .mockResolvedValueOnce(makeQueryResult([{ count: '0' }]))
      .mockResolvedValueOnce(makeQueryResult([]));

    const ws2Result = await queryTable('assets', { workspaceId: 'ws-2' });
    expect(ws2Result.data).toHaveLength(0);
  });
});
