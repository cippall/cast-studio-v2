import { findAssetById, getAssetOutputs } from '../db/repositories/asset-repo.js';
import type { AssetRow, AssetOutputRow } from '../db/repositories/asset-repo.js';
import { query } from '../db/pool.js';
import type { AccountRow } from '../middleware/requireSession.js';
import { dispatchNotification } from './notification-service.js';

// --- Constants ---

const ACTOR_REQUIRED_OUTPUTS = [
  'headshot',
  'fullshot',
  'expressions_3x4',
  'character_sheet',
  'editorial',
];

// --- Types ---

export interface MarketplaceSubmission {
  asset_id: string;
  asset_name: string | null;
  asset_type: string;
  creator_id: string;
  creator_name: string;
  marketplace_status: string;
  submitted_at: string;
}

export interface AdminSubmissionDetail extends MarketplaceSubmission {
  outputs: Record<string, { status: string; image_url: string | null }>;
}

export interface MarketplaceListing {
  id: string;
  asset_id: string;
  seller_id: string;
  price_credits: number;
  listing_type: string;
  is_active: boolean;
  purchased_by: string | null;
  purchased_at: string | null;
  created_at: string;
}

// --- Helpers ---

function getActorOutputsForMarketplace(
  outputs: AssetOutputRow[],
): Record<string, { status: string; image_url: string | null }> {
  const result: Record<string, { status: string; image_url: string | null }> = {};
  for (const layout of ACTOR_REQUIRED_OUTPUTS) {
    const found = outputs.find((o) => o.layout_type === layout);
    result[layout] = found
      ? { status: found.status, image_url: found.image_url }
      : { status: 'MISSING', image_url: null };
  }
  return result;
}

// --- Artist Submission ---

/**
 * Submit an asset for marketplace review.
 * Validates: asset belongs to artist's workspace, all required outputs SUCCESS,
 * no existing pending/approved marketplace status.
 */
export async function submitAssetForMarketplace(
  assetId: string,
  account: AccountRow,
): Promise<MarketplaceSubmission> {
  const asset = await findAssetById(assetId, account.workspace_id);

  if (!asset) {
    throw Object.assign(new Error('Asset not found'), { statusCode: 404 });
  }

  if (asset.creator_id !== account.id && account.role !== 'ADMIN') {
    throw Object.assign(new Error('You can only submit your own assets'), { statusCode: 403 });
  }

  if (asset.marketplace_status === 'MARKETPLACE_PENDING') {
    throw Object.assign(new Error('Asset already has an active marketplace submission'), {
      statusCode: 409,
    });
  }

  if (asset.marketplace_status === 'MARKETPLACE_APPROVED') {
    throw Object.assign(new Error('Asset is already listed on the marketplace'), {
      statusCode: 409,
    });
  }

  // Validate required outputs
  const outputs = await getAssetOutputs(assetId);
  const missing: string[] = [];

  if (asset.asset_type === 'ACTOR') {
    for (const layout of ACTOR_REQUIRED_OUTPUTS) {
      const output = outputs.find((o) => o.layout_type === layout);
      if (!output || output.status !== 'SUCCESS') {
        missing.push(layout);
      }
    }
  } else if (asset.asset_type === 'LOOK') {
    const lookOutput = outputs.find((o) => o.layout_type === 'look_image');
    if (!lookOutput || lookOutput.status !== 'SUCCESS') {
      missing.push('look_image');
    }
  } else if (asset.asset_type === 'FASHION_ITEM') {
    const itemOutput = outputs.find((o) => o.layout_type === 'item_image');
    if (!itemOutput || itemOutput.status !== 'SUCCESS') {
      missing.push('item_image');
    }
  }

  if (missing.length > 0) {
    const err = new Error(
      `Asset is missing required outputs for marketplace submission. Missing: ${missing.join(', ')}`,
    );
    (err as Error & { statusCode: number; missing: string[] }).statusCode = 409;
    (err as Error & { statusCode: number; missing: string[] }).missing = missing;
    throw err;
  }

  // Set marketplace_status to PENDING
  await query(
    `UPDATE assets SET marketplace_status = 'MARKETPLACE_PENDING' WHERE id = $1 AND deleted_at IS NULL`,
    [assetId],
  );

  return {
    asset_id: asset.id,
    asset_name: asset.name,
    asset_type: asset.asset_type,
    creator_id: asset.creator_id,
    creator_name: account.name,
    marketplace_status: 'MARKETPLACE_PENDING',
    submitted_at: new Date().toISOString(),
  };
}

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
  const conditions: string[] = ['a.workspace_id = $1', 'a.creator_id = $2', 'a.deleted_at IS NULL'];
  let idx = 3;

  conditions.push('a.marketplace_status IS NOT NULL');

  if (status) {
    conditions.push(`a.marketplace_status = $${idx++}`);
    params.push(status);
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

// --- Admin Review ---

/**
 * List all marketplace submissions for admin review.
 */
export async function listAllSubmissions(
  options: { status?: string; page?: number; pageSize?: number } = {},
): Promise<{
  data: AdminSubmissionDetail[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}> {
  const { status, page = 1, pageSize = 20 } = options;
  const params: unknown[] = [];
  const conditions: string[] = ['a.deleted_at IS NULL'];
  let idx = 1;

  conditions.push('a.marketplace_status IS NOT NULL');

  if (status) {
    conditions.push(`a.marketplace_status = $${idx++}`);
    params.push(status);
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
            a.marketplace_status, a.created_at AS submitted_at,
            acc.name AS creator_name
     FROM assets a
     JOIN accounts acc ON acc.id = a.creator_id
     ${whereClause}
     ORDER BY a.created_at ASC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    dataParams,
  );

  const data: AdminSubmissionDetail[] = [];
  for (const row of dataResult.rows as Record<string, unknown>[]) {
    const outputs = await getAssetOutputs(row.asset_id as string);
    data.push({
      asset_id: row.asset_id as string,
      asset_name: row.asset_name as string | null,
      asset_type: row.asset_type as string,
      creator_id: row.creator_id as string,
      creator_name: row.creator_name as string,
      marketplace_status: row.marketplace_status as string,
      submitted_at: row.submitted_at as string,
      outputs: getActorOutputsForMarketplace(outputs),
    });
  }

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
 * Admin approves a submission: sets APPROVED, freezes asset, creates marketplace_listing.
 */
export async function approveSubmission(
  assetId: string,
  priceCredits: number,
  sellerId: string,
): Promise<{
  asset_id: string;
  marketplace_status: string;
  listing_id: string;
  price_credits: number;
}> {
  // Check asset is in PENDING state
  const assetResult = await query(
    `SELECT * FROM assets WHERE id = $1 AND marketplace_status = 'MARKETPLACE_PENDING' AND deleted_at IS NULL`,
    [assetId],
  );

  if (assetResult.rows.length === 0) {
    throw Object.assign(new Error('Submission not found or not in pending status'), {
      statusCode: 404,
    });
  }

  const asset = assetResult.rows[0] as AssetRow;

  // 1. Set marketplace_status = APPROVED, freeze asset
  await query(
    `UPDATE assets SET marketplace_status = 'MARKETPLACE_APPROVED', is_marketplace_frozen = TRUE WHERE id = $1`,
    [assetId],
  );

  // 2. Create marketplace_listing
  const listingResult = await query(
    `INSERT INTO marketplace_listings (asset_id, seller_id, price_credits, listing_type)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [
      assetId,
      sellerId,
      priceCredits,
      asset.asset_type === 'ACTOR' ? 'ACTOR_PACKAGE' : asset.asset_type,
    ],
  );

  const listingId = listingResult.rows[0].id as string;

  // 3. Notify the artist
  try {
    await dispatchNotification({
      type: 'WORKFLOW_COMPLETED',
      recipientId: asset.creator_id,
      title: 'Marketplace Submission Approved',
      message: `Your asset "${asset.name ?? asset.asset_type}" has been approved for the marketplace at ${priceCredits} credits.`,
      templateData: { title: asset.name ?? asset.asset_type },
    });
  } catch {
    // Notification failure is non-blocking
  }

  return {
    asset_id: assetId,
    marketplace_status: 'MARKETPLACE_APPROVED',
    listing_id: listingId,
    price_credits: priceCredits,
  };
}

/**
 * Admin rejects a submission: sets REJECTED.
 */
export async function rejectSubmission(
  assetId: string,
): Promise<{ asset_id: string; marketplace_status: string }> {
  const assetResult = await query(
    `SELECT * FROM assets WHERE id = $1 AND marketplace_status = 'MARKETPLACE_PENDING' AND deleted_at IS NULL`,
    [assetId],
  );

  if (assetResult.rows.length === 0) {
    throw Object.assign(new Error('Submission not found or not in pending status'), {
      statusCode: 404,
    });
  }

  const asset = assetResult.rows[0] as AssetRow;

  await query(`UPDATE assets SET marketplace_status = 'MARKETPLACE_REJECTED' WHERE id = $1`, [
    assetId,
  ]);

  // Notify the artist
  try {
    await dispatchNotification({
      type: 'WORKFLOW_FAILED',
      recipientId: asset.creator_id,
      title: 'Marketplace Submission Rejected',
      message: `Your asset "${asset.name ?? asset.asset_type}" was not approved for the marketplace. You can edit and resubmit.`,
      templateData: { title: asset.name ?? asset.asset_type },
    });
  } catch {
    // Notification failure is non-blocking
  }

  return {
    asset_id: assetId,
    marketplace_status: 'MARKETPLACE_REJECTED',
  };
}
