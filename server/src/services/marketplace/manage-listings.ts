import { query } from '../../db/pool.js';
import type { AccountRow } from '../../middleware/requireSession.js';
import type { ManageableListing } from './helpers.js';

/**
 * List listings for management. Artist sees own, Admin sees all.
 */
export async function listManageableListings(
  account: AccountRow,
  options: {
    isActive?: boolean;
    listingType?: string;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<{
  data: ManageableListing[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}> {
  const { isActive, listingType, page = 1, pageSize = 20 } = options;
  const params: unknown[] = [];
  const conditions: string[] = [];
  let idx = 1;

  if (account.role !== 'ADMIN') {
    conditions.push(`ml.seller_id = $${idx++}`);
    params.push(account.id);
  }

  if (isActive !== undefined) {
    conditions.push(`ml.is_active = $${idx++}`);
    params.push(isActive);
  }

  if (listingType) {
    conditions.push(`ml.listing_type = $${idx++}`);
    params.push(listingType);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await query(
    `SELECT COUNT(*)::int AS count FROM marketplace_listings ml ${whereClause}`,
    params,
  );
  const countRow = countResult.rows[0] as { count: number } | undefined;
  const totalItems = typeof countRow?.count === 'number' ? countRow.count : 0;

  const offset = (page - 1) * pageSize;
  const dataResult = await query(
    `SELECT ml.id, ml.asset_id, ml.listing_type, ml.price_credits, ml.is_active,
            ml.purchased_by, ml.purchased_at, ml.created_at,
            a.name AS asset_name, a.asset_type
     FROM marketplace_listings ml
     JOIN assets a ON a.id = ml.asset_id
     ${whereClause}
     ORDER BY ml.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, pageSize, offset],
  );

  const data: ManageableListing[] = (dataResult.rows as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    asset_id: String(row.asset_id),
    asset_name: row.asset_name ? String(row.asset_name) : null,
    asset_type: String(row.asset_type),
    listing_type: String(row.listing_type),
    price_credits: Number(Number.parseFloat(String(row.price_credits)).toFixed(4)),
    is_active: Boolean(row.is_active),
    purchased_by: row.purchased_by ? String(row.purchased_by) : null,
    purchased_at: row.purchased_at ? String(row.purchased_at) : null,
    created_at: String(row.created_at),
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

/**
 * Update listing price or toggle active status.
 */
export async function updateListing(
  listingId: string,
  account: AccountRow,
  updates: { price_credits?: number; is_active?: boolean },
): Promise<ManageableListing> {
  // Fetch listing and verify ownership
  const listingResult = await query(
    `SELECT ml.*, a.name AS asset_name, a.asset_type
     FROM marketplace_listings ml
     JOIN assets a ON a.id = ml.asset_id
     WHERE ml.id = $1`,
    [listingId],
  );

  if (listingResult.rows.length === 0) {
    throw Object.assign(new Error('Listing not found'), { statusCode: 404 });
  }

  const listing = listingResult.rows[0] as Record<string, unknown>;

  if (account.role !== 'ADMIN' && String(listing.seller_id) !== account.id) {
    throw Object.assign(new Error('You can only manage your own listings'), { statusCode: 403 });
  }

  const setClauses: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (updates.price_credits !== undefined) {
    setClauses.push(`price_credits = $${idx++}`);
    params.push(updates.price_credits);
  }

  if (updates.is_active !== undefined) {
    setClauses.push(`is_active = $${idx++}`);
    params.push(updates.is_active);
  }

  if (setClauses.length === 0) {
    throw Object.assign(new Error('No valid fields to update'), { statusCode: 422 });
  }

  params.push(listingId);
  const updateResult = await query(
    `UPDATE marketplace_listings SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
    params,
  );

  const updated = updateResult.rows[0] as Record<string, unknown>;
  return {
    id: String(updated.id),
    asset_id: String(updated.asset_id),
    asset_name: listing.asset_name ? String(listing.asset_name) : null,
    asset_type: String(listing.asset_type),
    listing_type: String(updated.listing_type),
    price_credits: Number(Number.parseFloat(String(updated.price_credits)).toFixed(4)),
    is_active: Boolean(updated.is_active),
    purchased_by: updated.purchased_by ? String(updated.purchased_by) : null,
    purchased_at: updated.purchased_at ? String(updated.purchased_at) : null,
    created_at: String(updated.created_at),
  };
}

/**
 * Remove a listing (soft-delete by setting is_active = false, status = DELISTED).
 */
export async function deleteListing(
  listingId: string,
  account: AccountRow,
): Promise<{ id: string; is_active: boolean }> {
  const listingResult = await query('SELECT * FROM marketplace_listings WHERE id = $1', [
    listingId,
  ]);

  if (listingResult.rows.length === 0) {
    throw Object.assign(new Error('Listing not found'), { statusCode: 404 });
  }

  const listing = listingResult.rows[0] as Record<string, unknown>;

  if (account.role !== 'ADMIN' && String(listing.seller_id) !== account.id) {
    throw Object.assign(new Error('You can only manage your own listings'), { statusCode: 403 });
  }

  await query('UPDATE marketplace_listings SET is_active = FALSE WHERE id = $1', [listingId]);

  return { id: listingId, is_active: false };
}
