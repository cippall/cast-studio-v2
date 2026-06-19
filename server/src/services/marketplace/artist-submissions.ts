import { query } from '../../db/pool.js';
import type { AccountRow } from '../../middleware/requireSession.js';
import type { MarketplaceSubmission } from './helpers.js';

/**
 * List artist's own marketplace submissions.
 */
export async function listArtistSubmissions(
  account: AccountRow,
  options: { status?: string; page?: number; pageSize?: number } = {},
): Promise<{
  data: MarketplaceSubmission[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}> {
  const { status, page = 1, pageSize = 20 } = options;
  const params: unknown[] = [account.workspace_id, account.id];
  const conditions: string[] = ['a.workspace_id = $1', 'a.creator_id = $2', ''];
  let idx = 3;

  // Include assets that were ever on marketplace (status is set) OR were sold (sold_at is set)
  conditions.push('(a.marketplace_status IS NOT NULL OR a.sold_at IS NOT NULL)');

  if (status) {
    if (status === 'SOLD') {
      conditions.push(`a.sold_at IS NOT NULL`);
    } else {
      conditions.push(`a.marketplace_status = $${idx++}`);
      params.push(status);
    }
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const countResult = await query(
    `SELECT COUNT(*)::int AS count FROM assets a ${whereClause}`,
    params,
  );
  const countRow = countResult.rows[0] as { count: number } | undefined;
  const totalItems = parseInt(String(countRow?.count ?? '0'), 10);

  const offset = (page - 1) * pageSize;
  const dataParams = [...params, pageSize, offset];
  const dataResult = await query(
    `SELECT a.id AS asset_id, a.name AS asset_name, a.asset_type, a.creator_id,
            a.marketplace_status, a.created_at AS submitted_at
     FROM assets a
     ${whereClause}
     ORDER BY a.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    dataParams,
  );

  const data: MarketplaceSubmission[] = dataResult.rows.map((row: Record<string, unknown>) => ({
    asset_id: row.asset_id as string,
    asset_name: row.asset_name as string | null,
    asset_type: row.asset_type as string,
    creator_id: row.creator_id as string,
    creator_name: account.name,
    marketplace_status: row.marketplace_status as string,
    submitted_at: row.submitted_at as string,
  }));

  return {
    data,
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages: totalItems > 0 ? Math.ceil(totalItems / pageSize) : 0,
    },
  };
}
