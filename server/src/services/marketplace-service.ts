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

function getRequiredOutputsForType(assetType: string): string[] {
  if (assetType === 'ACTOR') return ACTOR_REQUIRED_OUTPUTS;
  if (assetType === 'LOOK') return ['look_image'];
  if (assetType === 'FASHION_ITEM') return ['item_image'];
  return [];
}

function findMissingOutputs(outputs: AssetOutputRow[], requiredLayouts: string[]): string[] {
  return requiredLayouts.filter((layout) => {
    const output = outputs.find((o) => o.layout_type === layout);
    return !output || output.status !== 'SUCCESS';
  });
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

  const outputs = await getAssetOutputs(assetId);
  const missing = findMissingOutputs(outputs, getRequiredOutputsForType(asset.asset_type));

  if (missing.length > 0) {
    const err = new Error(
      `Asset is missing required outputs for marketplace submission. Missing: ${missing.join(', ')}`,
    );
    (err as Error & { statusCode: number; missing: string[] }).statusCode = 409;
    (err as Error & { statusCode: number; missing: string[] }).missing = missing;
    throw err;
  }

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

// --- Client Browse ---

export interface MarketplaceListingItem {
  id: string;
  listing_type: string;
  asset_id: string;
  asset: {
    id: string;
    name: string | null;
    headshot_url: string | null;
    fullshot_url: string | null;
  };
  seller_id: string;
  seller_name: string;
  price_credits: number;
  is_active: boolean;
  created_at: string;
}

export interface MarketplaceListingDetail {
  id: string;
  listing_type: string;
  asset: {
    id: string;
    name: string | null;
    headshot_url: string | null;
    fullshot_url: string | null;
    expression_sheet_url: string | null;
    character_sheet_url: string | null;
    editorial_urls: string[];
  };
  seller: { id: string; name: string };
  price_credits: number;
  is_active: boolean;
  created_at: string;
}

const LISTING_LIST_COLS = `
  ml.id, ml.listing_type, ml.asset_id, ml.seller_id, ml.price_credits, ml.is_active, ml.created_at,
  a.name AS asset_name,
  ah.image_url AS headshot_url,
  af.image_url AS fullshot_url,
  s.name AS seller_name
`;

function buildListingJoins(): string {
  return `
    LEFT JOIN LATERAL (
      SELECT image_url FROM asset_outputs
      WHERE asset_id = a.id AND layout_type = 'headshot' AND status = 'SUCCESS' AND is_obsolete = FALSE
      LIMIT 1
    ) ah ON true
    LEFT JOIN LATERAL (
      SELECT image_url FROM asset_outputs
      WHERE asset_id = a.id AND layout_type = 'fullshot' AND status = 'SUCCESS' AND is_obsolete = FALSE
      LIMIT 1
    ) af ON true
    JOIN accounts s ON s.id = ml.seller_id
  `;
}

function parseListingRow(row: Record<string, unknown>): MarketplaceListingItem {
  return {
    id: String(row.id),
    listing_type: String(row.listing_type),
    asset_id: String(row.asset_id),
    asset: {
      id: String(row.asset_id),
      name: row.asset_name ? String(row.asset_name) : null,
      headshot_url: row.headshot_url ? String(row.headshot_url) : null,
      fullshot_url: row.fullshot_url ? String(row.fullshot_url) : null,
    },
    seller_id: String(row.seller_id),
    seller_name: String(row.seller_name),
    price_credits: Number(Number.parseFloat(String(row.price_credits)).toFixed(4)),
    is_active: Boolean(row.is_active),
    created_at: String(row.created_at),
  };
}

export async function listMarketplaceListings(
  options: {
    listingType?: string;
    maxPrice?: number;
    creatorId?: string;
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortOrder?: string;
  } = {},
): Promise<{
  data: MarketplaceListingItem[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}> {
  const {
    listingType,
    maxPrice,
    creatorId,
    page = 1,
    pageSize = 20,
    sortBy = 'created_at',
    sortOrder = 'desc',
  } = options;

  const params: unknown[] = [];
  const conditions: string[] = ['ml.is_active = TRUE', 'ml.purchased_by IS NULL'];
  let idx = 1;

  if (listingType) {
    conditions.push(`ml.listing_type = $${idx++}`);
    params.push(listingType);
  }

  if (maxPrice !== undefined) {
    conditions.push(`ml.price_credits <= $${idx++}`);
    params.push(maxPrice);
  }

  if (creatorId) {
    conditions.push(`ml.seller_id = $${idx++}`);
    params.push(creatorId);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const joins = buildListingJoins();
  const safeSortBy = sortBy.replace(/[^a-zA-Z0-9_.]/g, '');
  const safeSortOrder = sortOrder === 'asc' ? 'ASC' : 'DESC';

  const countSql = `SELECT COUNT(*)::int AS count FROM marketplace_listings ml ${whereClause}`;
  const countResult = await query(countSql, params);
  const countRow = countResult.rows[0] as { count: number } | undefined;
  const totalItems = typeof countRow?.count === 'number' ? countRow.count : 0;

  const offset = (page - 1) * pageSize;
  const dataSql = `
    SELECT ${LISTING_LIST_COLS}
    FROM marketplace_listings ml
    JOIN assets a ON a.id = ml.asset_id AND a.deleted_at IS NULL AND a.is_marketplace_frozen = TRUE
    ${joins}
    ${whereClause}
    ORDER BY ml.${safeSortBy} ${safeSortOrder}
    LIMIT $${idx} OFFSET $${idx + 1}
  `;

  const dataResult = await query(dataSql, [...params, pageSize, offset]);
  const data = (dataResult.rows as Record<string, unknown>[]).map(parseListingRow);

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

export async function getMarketplaceListing(
  listingId: string,
): Promise<MarketplaceListingDetail | null> {
  const listingSql = `
    SELECT ml.id, ml.listing_type, ml.asset_id, ml.seller_id, ml.price_credits, ml.is_active, ml.created_at,
           a.name AS asset_name, a.asset_type,
           s.name AS seller_name
    FROM marketplace_listings ml
    JOIN assets a ON a.id = ml.asset_id AND a.deleted_at IS NULL
    JOIN accounts s ON s.id = ml.seller_id
    WHERE ml.id = $1 AND ml.is_active = TRUE AND ml.purchased_by IS NULL
  `;
  const listingResult = await query(listingSql, [listingId]);

  if (listingResult.rows.length === 0) return null;

  const listing = listingResult.rows[0] as Record<string, unknown>;

  // Fetch all successful outputs for the asset
  const outputs = await getAssetOutputs(String(listing.asset_id));

  const pickUrl = (layoutType: string): string | null => {
    const match = outputs.find((o) => o.layout_type === layoutType && o.status === 'SUCCESS');
    return match?.image_url ?? null;
  };

  const editorialUrls = outputs
    .filter((o) => o.layout_type === 'editorial' && o.status === 'SUCCESS')
    .map((o) => o.image_url)
    .filter((u): u is string => u !== null);

  return {
    id: String(listing.id),
    listing_type: String(listing.listing_type),
    asset: {
      id: String(listing.asset_id),
      name: listing.asset_name ? String(listing.asset_name) : null,
      headshot_url: pickUrl('headshot'),
      fullshot_url: pickUrl('fullshot'),
      expression_sheet_url: pickUrl('expressions_3x4'),
      character_sheet_url: pickUrl('character_sheet'),
      editorial_urls: editorialUrls,
    },
    seller: {
      id: String(listing.seller_id),
      name: String(listing.seller_name),
    },
    price_credits: Number(Number.parseFloat(String(listing.price_credits)).toFixed(4)),
    is_active: Boolean(listing.is_active),
    created_at: String(listing.created_at),
  };
}

// --- Client Purchase ---

export interface PurchaseResult {
  listing_id: string;
  purchased_at: string;
  cost_credits: number;
  new_balance: number;
  assets: { layout_type: string; image_url: string | null }[];
}

/**
 * Purchase a marketplace listing.
 * Validates: listing is active and not yet purchased, client has sufficient balance.
 * Creates duplicate asset + outputs in client's workspace, deducts wallet, marks listing purchased.
 */
export async function purchaseListing(
  listingId: string,
  account: AccountRow,
): Promise<PurchaseResult> {
  // 1. Fetch listing with asset info
  const listingSql = `
    SELECT ml.id AS listing_id, ml.asset_id, ml.price_credits, ml.is_active,
           ml.purchased_by, ml.seller_id, a.asset_type
    FROM marketplace_listings ml
    JOIN assets a ON a.id = ml.asset_id
    WHERE ml.id = $1
  `;
  const listingResult = await query(listingSql, [listingId]);

  if (listingResult.rows.length === 0) {
    throw Object.assign(new Error('Listing not found'), { statusCode: 404 });
  }

  const listingRec = listingResult.rows[0] as Record<string, unknown>;

  // 2. Validate listing is active and not purchased
  if (!listingRec.is_active || listingRec.purchased_by) {
    throw Object.assign(new Error('This listing has already been purchased.'), {
      statusCode: 409,
    });
  }

  const priceCredits = Number.parseFloat(String(listingRec.price_credits));
  const sourceAssetId = String(listingRec.asset_id);
  const assetType = String(listingRec.asset_type);

  // 3. Check wallet balance
  const walletResult = await query(
    `SELECT * FROM wallets WHERE workspace_id = $1 AND account_id = $2 LIMIT 1`,
    [account.workspace_id, account.id],
  );

  if (walletResult.rows.length === 0) {
    throw Object.assign(
      new Error(`Insufficient credits. Your balance: 0. Required: ${priceCredits}.`),
      { statusCode: 402 },
    );
  }

  const wallet = walletResult.rows[0] as { id: string; balance_credits: number };
  const currentBalance = Number.parseFloat(String(wallet.balance_credits));

  if (currentBalance < priceCredits) {
    throw Object.assign(
      new Error(
        `Insufficient credits. Your balance: ${currentBalance.toFixed(4)}. Required: ${priceCredits}.`,
      ),
      { statusCode: 402 },
    );
  }

  // 4. Deduct wallet balance
  const newBalance = Number((currentBalance - priceCredits).toFixed(4));
  await query(`UPDATE wallets SET balance_credits = $1, updated_at = NOW() WHERE id = $2`, [
    newBalance,
    wallet.id,
  ]);

  // 5. Create ledger entry (CHARGE)
  await query(
    `INSERT INTO ledger (workspace_id, wallet_id, amount, type) VALUES ($1, $2, $3, $4)`,
    [account.workspace_id, wallet.id, Number((-priceCredits).toFixed(4)), 'CHARGE'],
  );

  // 6. Duplicate the asset into client's workspace
  const sourceAsset = await findAssetById(sourceAssetId);
  if (!sourceAsset) {
    throw Object.assign(new Error('Source asset not found'), { statusCode: 404 });
  }

  const duplicateResult = await query(
    `INSERT INTO assets (workspace_id, creator_id, client_id, asset_type, name, seed, prompt_recipe, source_asset_id, source_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      account.workspace_id,
      account.id,
      account.id,
      assetType,
      sourceAsset.name,
      sourceAsset.seed,
      JSON.stringify(sourceAsset.prompt_recipe),
      sourceAssetId,
      'MARKETPLACE_PURCHASE',
    ],
  );
  const duplicateAssetId = duplicateResult.rows[0].id as string;

  // 7. Duplicate all asset_outputs (same image URLs, new IDs)
  const sourceOutputs = await getAssetOutputs(sourceAssetId);
  const purchasedAssets: { layout_type: string; image_url: string | null }[] = [];

  for (const output of sourceOutputs) {
    await query(
      `INSERT INTO asset_outputs (asset_id, layout_type, model, image_url, local_backup_url, cost_credits, status, version, generation_params, reference_images, source_asset_outputs)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        duplicateAssetId,
        output.layout_type,
        output.model,
        output.image_url,
        output.local_backup_url,
        output.cost_credits,
        output.status,
        output.version,
        output.generation_params ? JSON.stringify(output.generation_params) : null,
        output.reference_images ? JSON.stringify(output.reference_images) : null,
        output.source_asset_outputs ? JSON.stringify(output.source_asset_outputs) : null,
      ],
    );

    purchasedAssets.push({
      layout_type: output.layout_type,
      image_url: output.image_url,
    });
  }

  // 8. Mark listing as purchased
  const purchasedAt = new Date().toISOString();
  await query(
    `UPDATE marketplace_listings SET purchased_by = $1, purchased_at = $2 WHERE id = $3`,
    [account.id, purchasedAt, listingId],
  );

  // 9. Notify the seller
  try {
    const sellerId = String(listingRec.seller_id);
    const assetName = sourceAsset.name ?? assetType;
    await dispatchNotification({
      type: 'WORKFLOW_COMPLETED',
      recipientId: sellerId,
      title: 'Asset Purchased',
      message: `Your asset "${assetName}" was purchased for ${priceCredits} credits.`,
      templateData: { title: assetName },
    });
  } catch {
    // Notification failure is non-blocking
  }

  return {
    listing_id: listingId,
    purchased_at: purchasedAt,
    cost_credits: priceCredits,
    new_balance: newBalance,
    assets: purchasedAssets,
  };
}
