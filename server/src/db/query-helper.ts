import { query } from './pool.js';

export interface QueryTableOptions {
  workspaceId?: string;
  filters?: Record<string, unknown>;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  adminBypass?: boolean;
  includeDeleted?: boolean;
}

export interface PaginationInfo {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface QueryTableResult<T = Record<string, unknown>> {
  data: T[];
  pagination: PaginationInfo;
}

/**
 * Query a table with workspace isolation, soft-delete filtering, and pagination.
 *
 * - Always filters by workspace_id (unless adminBypass is true)
 * - Always applies deleted_at IS NULL (unless includeDeleted is true)
 * - All identifiers are sanitized to prevent SQL injection
 * - All user values are passed as parameterized bindings
 */
export async function queryTable<T = Record<string, unknown>>(
  table: string,
  options: QueryTableOptions = {},
): Promise<QueryTableResult<T>> {
  const {
    workspaceId,
    filters = {},
    page = 1,
    pageSize = 20,
    sortBy = 'created_at',
    sortOrder = 'desc',
    adminBypass = false,
    includeDeleted = false,
  } = options;

  const safeTable = sanitizeIdentifier(table);
  const params: unknown[] = [];
  const { whereClause, paramIndex } = buildConditions(
    { workspaceId, adminBypass, includeDeleted, filters },
    params,
  );

  const safeSortBy = sanitizeIdentifier(sortBy);
  const safeSortOrder = sortOrder === 'asc' ? 'ASC' : 'DESC';

  // Count query
  const countSql = `SELECT COUNT(*)::int AS count FROM ${safeTable} ${whereClause}`;
  const countResult = await query(countSql, params);
  const countRow = countResult.rows[0] as { count: unknown } | undefined;
  const totalItems = parseInt(String(countRow?.count ?? '0'), 10);

  // Data query with pagination
  const offset = (page - 1) * pageSize;
  const limitParam = paramIndex + 1;
  const offsetParam = paramIndex + 2;

  const dataSql = `
    SELECT * FROM ${safeTable}
    ${whereClause}
    ORDER BY ${safeSortBy} ${safeSortOrder}
    LIMIT $${limitParam} OFFSET $${offsetParam}
  `;

  const dataParams = [...params, pageSize, offset];
  const dataResult = await query(dataSql, dataParams);

  return {
    data: dataResult.rows as T[],
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages: totalItems > 0 ? Math.ceil(totalItems / pageSize) : 0,
    },
  };
}

interface BuildConditionsInput {
  workspaceId?: string;
  adminBypass: boolean;
  includeDeleted: boolean;
  filters: Record<string, unknown>;
}

interface BuildConditionsOutput {
  whereClause: string;
  paramIndex: number;
}

/**
 * Build SQL WHERE clause conditions with parameterized bindings.
 * Handles workspace isolation, soft-delete filtering, and additional column filters.
 */
function buildConditions(input: BuildConditionsInput, params: unknown[]): BuildConditionsOutput {
  let paramIndex = 0;
  const conditions: string[] = [];

  // Workspace filter — skipped for admin bypass
  if (input.workspaceId && !input.adminBypass) {
    paramIndex++;
    conditions.push(`workspace_id = $${paramIndex}`);
    params.push(input.workspaceId);
  }

  // Soft-delete filter — opt out with includeDeleted
  if (!input.includeDeleted) {
    conditions.push('deleted_at IS NULL');
  }

  // Additional column filters
  const filterEntries = Object.entries(input.filters).filter(
    ([, value]) => value !== undefined && value !== null,
  );

  for (const [key, value] of filterEntries) {
    paramIndex++;
    const safeColumn = sanitizeIdentifier(toSnakeCase(key));
    conditions.push(`${safeColumn} = $${paramIndex}`);
    params.push(value);
  }

  return {
    whereClause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    paramIndex,
  };
}

/**
 * Sanitize a SQL identifier to prevent injection.
 * Only allows alphanumeric characters and underscores.
 */
function sanitizeIdentifier(identifier: string): string {
  return identifier.replace(/[^a-zA-Z0-9_]/g, '');
}

/**
 * Convert camelCase to snake_case.
 * e.g. "assetType" -> "asset_type", "createdAt" -> "created_at"
 */
function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}
