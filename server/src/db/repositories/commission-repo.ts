import { query } from '../pool.js';

// --- Types ---
export interface CommissionRow {
  id: string;
  client_workspace_id: string;
  studio_workspace_id: string;
  client_id: string;
  assignee_id: string | null;
  title: string;
  brief: Record<string, unknown>;
  status: string;
  premium_cost: number | null;
  submitted_at: string | null;
  approved_at: string | null;
  is_premium_unlocked: boolean;
  created_at: string;
}

export interface ListCommissionsOptions {
  clientWorkspaceId?: string;
  assigneeId?: string;
  clientId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  adminBypass?: boolean;
}

// --- Repository Functions ---

/**
 * Create a new commission.
 */
export async function createCommission(data: {
  client_workspace_id: string;
  studio_workspace_id: string;
  client_id: string;
  title: string;
  brief: Record<string, unknown>;
}): Promise<CommissionRow> {
  const result = await query(
    `INSERT INTO commissions (client_workspace_id, studio_workspace_id, client_id, title, brief)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      data.client_workspace_id,
      data.studio_workspace_id,
      data.client_id,
      data.title,
      JSON.stringify(data.brief),
    ],
  );
  return result.rows[0] as CommissionRow;
}

/**
 * Find a single commission by id with optional workspace filtering.
 */
export async function findCommissionById(
  id: string,
  clientWorkspaceId?: string,
  adminBypass = false,
): Promise<CommissionRow | null> {
  const params: unknown[] = [id];
  const conditions: string[] = ['id = $1'];
  let idx = 2;
  if (clientWorkspaceId && !adminBypass) {
    conditions.push(`client_workspace_id = $${idx++}`);
    params.push(clientWorkspaceId);
  }
  const result = await query(`SELECT * FROM commissions WHERE ${conditions.join(' AND ')}`, params);
  return (result.rows[0] as CommissionRow) ?? null;
}

/**
 * Find a commission by id without any workspace filter.
 */
export async function findCommissionByIdUnfiltered(id: string): Promise<CommissionRow | null> {
  const result = await query('SELECT * FROM commissions WHERE id = $1', [id]);
  return (result.rows[0] as CommissionRow) ?? null;
}

/**
 * List commissions with role-based filtering and pagination.
 */
export async function listCommissions(options: ListCommissionsOptions): Promise<{
  data: CommissionRow[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}> {
  const {
    clientWorkspaceId,
    assigneeId,
    clientId,
    status,
    page = 1,
    pageSize = 20,
    sortBy = 'created_at',
    sortOrder = 'desc',
    adminBypass = false,
  } = options;
  const params: unknown[] = [];
  const conditions: string[] = [];
  let idx = 1;
  if (clientWorkspaceId && !adminBypass) {
    conditions.push(`client_workspace_id = $${idx++}`);
    params.push(clientWorkspaceId);
  }
  if (assigneeId && !adminBypass) {
    conditions.push(`assignee_id = $${idx++}`);
    params.push(assigneeId);
  }
  if (clientId && !adminBypass) {
    conditions.push(`client_id = $${idx++}`);
    params.push(clientId);
  }
  if (status) {
    conditions.push(`status = $${idx++}`);
    params.push(status);
  }
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const safeSortBy = sortBy.replace(/[^a-zA-Z0-9_]/g, '');
  const safeSortOrder = sortOrder === 'asc' ? 'ASC' : 'DESC';
  // Count query
  const countSql = `SELECT COUNT(*)::int AS count FROM commissions ${whereClause}`;
  const countResult = await query(countSql, params);
  const countRow = countResult.rows[0] as { count: number } | undefined;
  const totalItems = parseInt(String(countRow?.count ?? '0'), 10);
  // Data query with pagination
  const offset = (page - 1) * pageSize;
  const dataSql = `
    SELECT * FROM commissions
    ${whereClause}
    ORDER BY ${safeSortBy} ${safeSortOrder}
    LIMIT $${idx} OFFSET $${idx + 1}
  `;
  const dataParams = [...params, pageSize, offset];
  const dataResult = await query(dataSql, dataParams);
  return {
    data: dataResult.rows as CommissionRow[],
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages: totalItems > 0 ? Math.ceil(totalItems / pageSize) : 0,
    },
  };
}

/**
 * Update commission status with optional extra fields.
 * Returns null if not found.
 */
export async function updateCommissionStatus(
  id: string,
  status: string,
  extraFields: Record<string, unknown> = {},
): Promise<CommissionRow | null> {
  const setClauses: string[] = ['status = $1'];
  const params: unknown[] = [status];
  let idx = 2;
  for (const [key, value] of Object.entries(extraFields)) {
    if (value !== undefined) {
      setClauses.push(`${key} = $${idx++}`);
      params.push(value);
    }
  }
  params.push(id);
  const result = await query(
    `UPDATE commissions SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
    params,
  );
  return (result.rows[0] as CommissionRow) ?? null;
}

/**
 * Assign a commission to an artist (sets assignee_id and status to ASSIGNED).
 */
export async function assignCommission(
  id: string,
  assigneeId: string,
): Promise<CommissionRow | null> {
  const result = await query(
    `UPDATE commissions SET assignee_id = $1, status = 'ASSIGNED' WHERE id = $2 RETURNING *`,
    [assigneeId, id],
  );
  return (result.rows[0] as CommissionRow) ?? null;
}
