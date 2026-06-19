import type { AssetRow } from '../../db/repositories/asset-repo.js';
import { getClient } from '../../db/pool.js';
import type { AccountRow } from '../../middleware/requireSession.js';
import {
  getRequiredOutputsForType,
  findMissingOutputs,
  type MarketplaceSubmission,
} from './helpers.js';
import { getAssetOutputs } from '../../db/repositories/asset-repo.js';

/**
 * Submit an asset for marketplace review.
 * Validates: asset belongs to artist's workspace, all required outputs SUCCESS,
 * no existing pending/approved marketplace status.
 */
export async function submitAssetForMarketplace(
  assetId: string,
  account: AccountRow,
): Promise<MarketplaceSubmission> {
  const dbClient = await getClient();
  try {
    await dbClient.query('BEGIN');

    // Lock the asset row to prevent concurrent submissions
    const assetResult = await dbClient.query(`SELECT * FROM assets WHERE id = $1  FOR UPDATE`, [
      assetId,
    ]);
    const asset = assetResult.rows[0] as AssetRow | undefined;

    if (!asset) {
      throw Object.assign(new Error('Asset not found'), { statusCode: 404 });
    }

    // Verify workspace isolation
    if (asset.workspace_id !== account.workspace_id && account.role !== 'ADMIN') {
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

    await dbClient.query(
      `UPDATE assets SET marketplace_status = 'MARKETPLACE_PENDING' WHERE id = $1`,
      [assetId],
    );

    await dbClient.query('COMMIT');

    return {
      asset_id: asset.id,
      asset_name: asset.name,
      asset_type: asset.asset_type,
      creator_id: asset.creator_id,
      creator_name: account.name,
      marketplace_status: 'MARKETPLACE_PENDING',
      submitted_at: new Date().toISOString(),
    };
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    dbClient.release();
  }
}

/**
 * Submit an asset to marketplace via API key auth.
 * Same validation as artist submission, but uses agent account.
 */
export async function submitAssetViaAgent(
  assetId: string,
  account: AccountRow,
): Promise<MarketplaceSubmission> {
  return submitAssetForMarketplace(assetId, account);
}
