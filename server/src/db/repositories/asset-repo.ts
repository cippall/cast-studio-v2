import { query } from '../pool.js';

// --- Types ---

export interface AssetRow {
  id: string;
  workspace_id: string;
  creator_id: string;
  client_id: string | null;
  asset_type: string;
  name: string | null;
  seed: number;
  prompt_recipe: Record<string, unknown>;
  marketplace_status: string | null;
  is_marketplace_frozen: boolean;
  source_asset_id: string | null;
  source_type: string;
  deleted_at: string | null;
  created_at: string;
  /** Populated via LEFT JOIN in list queries */
  headshot_url?: string | null;
}

export interface AssetOutputRow {
  id: string;
  asset_id: string;
  layout_type: string;
  model: string;
  image_url: string | null;
  local_backup_url: string | null;
  cost_credits: number;
  status: string;
  version: number;
  is_obsolete: boolean;
  obsolete_reason: string | null;
  error_message: string | null;
  generation_params: Record<string, unknown> | null;
  reference_images: Record<string, unknown> | null;
  source_asset_outputs: Record<string, unknown> | null;
  created_at: string;
}

export interface CreateAssetInput {
  workspace_id: string;
  creator_id: string;
  asset_type: string;
  name?: string | null;
  seed: number;
  prompt_recipe: Record<string, unknown>;
  source_asset_id?: string | null;
  source_type?: string;
}

export interface UpdateAssetInput {
  name?: string | null;
  prompt_recipe?: Record<string, unknown>;
}

export interface ListAssetOptions {
  workspaceId?: string;
  assetType: string;
  creatorId?: string;
  taxonomyFilters?: Record<string, string>;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  adminBypass?: boolean;
  includeDeleted?: boolean;
  /** When set, filters to assets shared with this account via asset_permissions */
  sharedWithMeAccountId?: string;
}

// --- Repository Functions ---

/**
 * Create a new asset record.
 */
export async function createAsset(input: CreateAssetInput): Promise<AssetRow> {
  const result = await query(
    `INSERT INTO assets (workspace_id, creator_id, asset_type, name, seed, prompt_recipe, source_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      input.workspace_id,
      input.creator_id,
      input.asset_type,
      input.name ?? null,
      input.seed,
      JSON.stringify(input.prompt_recipe),
      input.source_type ?? 'ORIGINAL',
    ],
  );
  return result.rows[0] as AssetRow;
}

/**
 * Find a single asset by id with workspace isolation.
 */
export async function findAssetById(
  id: string,
  workspaceId?: string,
  adminBypass = false,
  includeDeleted = false,
): Promise<AssetRow | null> {
  const conditions: string[] = ['id = $1'];
  const params: unknown[] = [id];
  let idx = 2;

  if (workspaceId && !adminBypass) {
    conditions.push(`workspace_id = $${idx++}`);
    params.push(workspaceId);
  }

  if (!includeDeleted) {
    conditions.push('deleted_at IS NULL');
  }

  const result = await query(`SELECT * FROM assets WHERE ${conditions.join(' AND ')}`, params);

  return (result.rows[0] as AssetRow) ?? null;
}

/**
 * List assets with workspace isolation, soft-delete filtering,
 * pagination, and taxonomy (JSONB) filtering.
 */
export async function listAssets(options: ListAssetOptions): Promise<{
  data: AssetRow[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}> {
  const {
    workspaceId,
    assetType,
    creatorId,
    taxonomyFilters = {},
    page = 1,
    pageSize = 20,
    sortBy = 'created_at',
    sortOrder = 'desc',
    adminBypass = false,
    includeDeleted = false,
    sharedWithMeAccountId,
  } = options;

  const params: unknown[] = [];
  const conditions: string[] = [];
  const joins: string[] = [];
  let idx = 1;

  // Asset type filter
  conditions.push(`a.asset_type = $${idx++}`);
  params.push(assetType);

  // Workspace filter
  if (workspaceId && !adminBypass) {
    conditions.push(`a.workspace_id = $${idx++}`);
    params.push(workspaceId);
  }

  // Soft delete filter
  if (!includeDeleted) {
    conditions.push('a.deleted_at IS NULL');
  }

  // Creator filter
  if (creatorId) {
    conditions.push(`a.creator_id = $${idx++}`);
    params.push(creatorId);
  }

  // Shared with me filter — only show assets shared via asset_permissions
  if (sharedWithMeAccountId) {
    joins.push(`INNER JOIN asset_permissions ap ON ap.asset_id = a.id`);
    conditions.push(`ap.grantee_id = $${idx++}`);
    conditions.push('ap.revoked_at IS NULL');
    params.push(sharedWithMeAccountId);
  }

  // Taxonomy filters (JSONB path queries)
  const taxEntries = Object.entries(taxonomyFilters).filter(
    ([, value]) => value !== undefined && value !== null && value !== '',
  );
  for (const [key, value] of taxEntries) {
    conditions.push(`a.prompt_recipe -> 'identity' ->> $${idx} = $${idx + 1}`);
    params.push(key, value);
    idx += 2;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const fromClause = `FROM assets a ${joins.join(' ')}`;

  // Sanitize sort column
  const safeSortBy = sortBy.replace(/[^a-zA-Z0-9_]/g, '');
  const safeSortOrder = sortOrder === 'asc' ? 'ASC' : 'DESC';

  // Count query
  const countSql = `SELECT COUNT(*)::int AS count ${fromClause} ${whereClause}`;
  const countResult = await query(countSql, params);
  const countRow = countResult.rows[0] as { count: number } | undefined;
  const totalItems = parseInt(String(countRow?.count ?? '0'), 10);

  // Data query with headshot_url join
  const dataSql = `
    SELECT a.*, h.image_url AS headshot_url
    ${fromClause}
    LEFT JOIN LATERAL (
      SELECT image_url FROM asset_outputs
      WHERE asset_id = a.id
        AND layout_type = 'headshot'
        AND status = 'SUCCESS'
        AND is_obsolete = FALSE
      LIMIT 1
    ) h ON true
    ${whereClause}
    ORDER BY a.${safeSortBy} ${safeSortOrder}
    LIMIT $${idx} OFFSET $${idx + 1}
  `;

  const offset = (page - 1) * pageSize;
  const dataParams = [...params, pageSize, offset];
  const dataResult = await query(dataSql, dataParams);

  return {
    data: dataResult.rows as AssetRow[],
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages: totalItems > 0 ? Math.ceil(totalItems / pageSize) : 0,
    },
  };
}

/**
 * Update an asset with workspace isolation (soft-delete aware).
 * Returns null if not found or already deleted.
 */
export async function updateAsset(
  id: string,
  workspaceId: string,
  data: UpdateAssetInput,
  adminBypass = false,
): Promise<AssetRow | null> {
  const setClauses: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (data.name !== undefined) {
    setClauses.push(`name = $${idx++}`);
    params.push(data.name);
  }

  if (data.prompt_recipe !== undefined) {
    setClauses.push(`prompt_recipe = $${idx++}`);
    params.push(JSON.stringify(data.prompt_recipe));
  }

  if (setClauses.length === 0) {
    return null;
  }

  const conditions: string[] = [`id = $${idx++}`];
  params.push(id);

  if (!adminBypass) {
    conditions.push(`workspace_id = $${idx++}`);
    params.push(workspaceId);
  }

  conditions.push('deleted_at IS NULL');

  const result = await query(
    `UPDATE assets SET ${setClauses.join(', ')} WHERE ${conditions.join(' AND ')} RETURNING *`,
    params,
  );

  return (result.rows[0] as AssetRow) ?? null;
}

/**
 * Soft-delete an asset by setting deleted_at.
 * Returns true if a row was updated.
 */
export async function softDeleteAsset(
  id: string,
  workspaceId: string,
  adminBypass = false,
): Promise<boolean> {
  const conditions: string[] = ['id = $1'];
  const params: unknown[] = [id];
  let idx = 2;

  if (!adminBypass) {
    conditions.push(`workspace_id = $${idx++}`);
    params.push(workspaceId);
  }

  conditions.push('deleted_at IS NULL');

  const result = await query(
    `UPDATE assets SET deleted_at = NOW() WHERE ${conditions.join(' AND ')} RETURNING id`,
    params,
  );

  return result.rows.length > 0;
}

/**
 * Get all non-deleted (i.e. current) outputs for an asset.
 */
export async function getAssetOutputs(assetId: string): Promise<AssetOutputRow[]> {
  const result = await query(
    `SELECT * FROM asset_outputs WHERE asset_id = $1 ORDER BY created_at DESC`,
    [assetId],
  );
  return result.rows as AssetOutputRow[];
}

// --- Permission Functions ---

export interface PermissionRow {
  id: string;
  asset_id: string;
  grantee_id: string;
  granted_at: string;
  revoked_at: string | null;
  /** Populated via JOIN in list queries */
  grantee_name?: string;
  grantee_email?: string;
}

/**
 * Create an asset_permissions record.
 */
export async function createAssetPermission(
  assetId: string,
  granteeId: string,
): Promise<PermissionRow> {
  const result = await query(
    `INSERT INTO asset_permissions (asset_id, grantee_id)
     VALUES ($1, $2)
     RETURNING *`,
    [assetId, granteeId],
  );
  return result.rows[0] as PermissionRow;
}

/**
 * Find a single permission by id (active only).
 */
export async function findAssetPermission(permissionId: string): Promise<PermissionRow | null> {
  const result = await query(
    `SELECT * FROM asset_permissions WHERE id = $1 AND revoked_at IS NULL`,
    [permissionId],
  );
  return (result.rows[0] as PermissionRow) ?? null;
}

/**
 * List active (non-revoked) permissions for an asset,
 * joined with accounts table for grantee info.
 */
export async function listAssetPermissions(assetId: string): Promise<PermissionRow[]> {
  const result = await query(
    `SELECT ap.*, a.name AS grantee_name, a.email AS grantee_email
     FROM asset_permissions ap
     JOIN accounts a ON a.id = ap.grantee_id
     WHERE ap.asset_id = $1 AND ap.revoked_at IS NULL
     ORDER BY ap.granted_at DESC`,
    [assetId],
  );
  return result.rows as PermissionRow[];
}

/**
 * Revoke a permission by setting revoked_at = NOW().
 * Returns true if a row was updated.
 */
export async function revokeAssetPermission(permissionId: string): Promise<boolean> {
  const result = await query(
    `UPDATE asset_permissions SET revoked_at = NOW()
     WHERE id = $1 AND revoked_at IS NULL
     RETURNING id`,
    [permissionId],
  );
  return result.rows.length > 0;
}

/**
 * Check if an account has explicit access to an asset via asset_permissions.
 * Also checks if the account is the creator or an admin.
 */
export async function checkAssetAccess(
  assetId: string,
  accountId: string,
  accountRole: string,
  creatorId: string,
): Promise<boolean> {
  // Admin can access everything
  if (accountRole === 'ADMIN') {
    return true;
  }

  // Creator can always access their own
  if (accountId === creatorId) {
    return true;
  }

  // Check for explicit permission
  const result = await query(
    `SELECT id FROM asset_permissions
     WHERE asset_id = $1 AND grantee_id = $2 AND revoked_at IS NULL
     LIMIT 1`,
    [assetId, accountId],
  );

  return result.rows.length > 0;
}

/**
 * Create a single asset output row.
 */
export async function createAssetOutput(input: CreateAssetOutputInput): Promise<AssetOutputRow> {
  const result = await query(
    `INSERT INTO asset_outputs (asset_id, layout_type, model, status, cost_credits, generation_params)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      input.asset_id,
      input.layout_type,
      input.model,
      input.status ?? 'PENDING',
      input.cost_credits ?? 0,
      input.generation_params ? JSON.stringify(input.generation_params) : null,
    ],
  );
  return result.rows[0] as AssetOutputRow;
}

export interface CreateAssetOutputInput {
  asset_id: string;
  layout_type: string;
  model: string;
  status?: string;
  cost_credits?: number;
  generation_params?: Record<string, unknown> | null;
}

/**
 * Update the status of asset outputs for a given asset_id and layout_type.
 * Used when selecting one output and marking the rest as FAILED.
 */
export async function updateOutputsStatus(
  assetId: string,
  outputIdsToUpdate: string[],
  status: string,
  additionalFields?: Record<string, unknown>,
): Promise<void> {
  if (outputIdsToUpdate.length === 0) return;

  const setClauses: string[] = [`status = $1`];
  const params: unknown[] = [status];
  let idx = 2;

  if (additionalFields) {
    for (const [key, value] of Object.entries(additionalFields)) {
      if (key === 'image_url') {
        setClauses.push(`image_url = $${idx++}`);
        params.push(value as string);
      }
    }
  }

  const placeholders = outputIdsToUpdate.map((_, i) => `$${idx + i}`).join(', ');
  params.push(...outputIdsToUpdate);

  const sql = `UPDATE asset_outputs SET ${setClauses.join(', ')} WHERE id IN (${placeholders}) AND asset_id = $${idx + outputIdsToUpdate.length}`;
  params.push(assetId);

  await query(sql, params);
}
