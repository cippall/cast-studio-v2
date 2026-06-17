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
  created_at: string;
}

export interface CommissionAssetRow {
  id: string;
  commission_id: string;
  asset_id: string;
  asset_output_id: string | null;
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
 * Find a single commission by id.
 * Workspace filtering is optional — controlled by adminBypass.
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
 * Find a commission by id without workspace filter (for status transitions
 * where we need the full record regardless of workspace).
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

  // Role-based filtering
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

  // Status filter (optional)
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
 * Update commission status with optional fields (premium_cost, submitted_at, approved_at).
 * Returns null if not found.
 */
export async function updateCommissionStatus(
  id: string,
  status: string,
  extraFields: {
    assignee_id?: string | null;
    premium_cost?: number | null;
    submitted_at?: string | null;
    approved_at?: string | null;
  } = {},
): Promise<CommissionRow | null> {
  const setClauses: string[] = ['status = $1'];
  const params: unknown[] = [status];
  let idx = 2;

  if (extraFields.assignee_id !== undefined) {
    setClauses.push(`assignee_id = $${idx++}`);
    params.push(extraFields.assignee_id);
  }

  if (extraFields.premium_cost !== undefined) {
    setClauses.push(`premium_cost = $${idx++}`);
    params.push(extraFields.premium_cost);
  }

  if (extraFields.submitted_at !== undefined) {
    setClauses.push(`submitted_at = $${idx++}`);
    params.push(extraFields.submitted_at);
  }

  if (extraFields.approved_at !== undefined) {
    setClauses.push(`approved_at = $${idx++}`);
    params.push(extraFields.approved_at);
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
 * Returns null if not found.
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

/**
 * Get all assets linked to a commission.
 */
export async function getCommissionAssets(commissionId: string): Promise<CommissionAssetRow[]> {
  const result = await query(
    'SELECT * FROM commission_assets WHERE commission_id = $1 ORDER BY created_at',
    [commissionId],
  );
  return result.rows as CommissionAssetRow[];
}

/**
 * Link an asset to a commission.
 */
export async function linkAssetToCommission(
  commissionId: string,
  assetId: string,
  assetOutputId?: string | null,
): Promise<CommissionAssetRow> {
  const result = await query(
    `INSERT INTO commission_assets (commission_id, asset_id, asset_output_id)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [commissionId, assetId, assetOutputId ?? null],
  );
  return result.rows[0] as CommissionAssetRow;
}
