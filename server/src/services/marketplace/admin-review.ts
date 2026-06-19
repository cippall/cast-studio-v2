import type { AssetRow } from '../../db/repositories/asset-repo.js';
import { query, getClient } from '../../db/pool.js';
import { dispatchNotification } from '../notification-service.js';
import {
  getActorOutputsForMarketplace,
  type MarketplaceSubmission,
  type AdminSubmissionDetail,
} from './helpers.js';
import { getAssetOutputsBatch } from '../../db/repositories/asset-repo.js';

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
  const conditions: string[] = [];
  let idx = 1;

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
            a.marketplace_status, a.sold_at, a.created_at AS submitted_at,
            acc.name AS creator_name
     FROM assets a
     JOIN accounts acc ON acc.id = a.creator_id
     ${whereClause}
     ORDER BY a.created_at ASC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    dataParams,
  );

  const data: AdminSubmissionDetail[] = [];
  const assetIds = (dataResult.rows as Record<string, unknown>[]).map((r) => r.asset_id as string);
  const outputsMap = await getAssetOutputsBatch(assetIds);
  for (const row of dataResult.rows as Record<string, unknown>[]) {
    const outputs = outputsMap.get(row.asset_id as string) ?? [];
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
  const dbClient = await getClient();
  try {
    await dbClient.query('BEGIN');

    // Lock the asset row to prevent concurrent approvals
    const assetResult = await dbClient.query(
      `SELECT * FROM assets WHERE id = $1 AND marketplace_status = 'MARKETPLACE_PENDING'  FOR UPDATE`,
      [assetId],
    );

    if (assetResult.rows.length === 0) {
      throw Object.assign(new Error('Submission not found or not in pending status'), {
        statusCode: 404,
      });
    }

    const asset = assetResult.rows[0] as AssetRow;

    // 1. Set marketplace_status = APPROVED, freeze asset
    await dbClient.query(
      `UPDATE assets SET marketplace_status = 'MARKETPLACE_APPROVED', is_marketplace_frozen = TRUE WHERE id = $1`,
      [assetId],
    );

    // 2. Create marketplace_listing
    const listingResult = await dbClient.query(
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

    await dbClient.query('COMMIT');

    const listingId = listingResult.rows[0].id as string;

    // 3. Notify the artist (non-blocking, outside transaction)
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
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    dbClient.release();
  }
}

/**
 * Admin rejects a submission: sets REJECTED.
 */
export async function rejectSubmission(
  assetId: string,
): Promise<{ asset_id: string; marketplace_status: string }> {
  const dbClient = await getClient();
  try {
    await dbClient.query('BEGIN');

    const assetResult = await dbClient.query(
      `SELECT * FROM assets WHERE id = $1 AND marketplace_status = 'MARKETPLACE_PENDING'  FOR UPDATE`,
      [assetId],
    );

    if (assetResult.rows.length === 0) {
      throw Object.assign(new Error('Submission not found or not in pending status'), {
        statusCode: 404,
      });
    }

    const asset = assetResult.rows[0] as AssetRow;

    await dbClient.query(
      `UPDATE assets SET marketplace_status = 'MARKETPLACE_REJECTED' WHERE id = $1`,
      [assetId],
    );

    await dbClient.query('COMMIT');

    // Notify the artist (non-blocking, outside transaction)
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
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    dbClient.release();
  }
}
