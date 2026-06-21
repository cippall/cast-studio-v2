import { getClient } from '../../db/pool.js';
import type { AccountRow } from '../../middleware/requireSession.js';
import { dispatchNotification } from '../notification-service.js';
import {
  duplicateAsset,
  duplicateAssetOutputs,
  findAssetById,
} from '../../db/repositories/asset-repo.js';
import type { PurchaseResult } from './helpers.js';

/**
 * Purchase a marketplace listing.
 * Duplicates the asset into the buyer's workspace instead of transferring the original.
 * The original asset stays with the seller (frozen).
 * Validates: listing is active and not yet purchased, client has sufficient balance.
 * All wallet deduction + duplication + listing mark-purchased in single transaction.
 */
export async function purchaseListing(
  listingId: string,
  account: AccountRow,
): Promise<PurchaseResult> {
  const dbClient = await getClient();
  try {
    await dbClient.query('BEGIN');

    // 1. Fetch and lock the listing to prevent concurrent purchases
    const listingSql = `
      SELECT ml.id AS listing_id, ml.asset_id, ml.price_credits, ml.is_active,
             ml.purchased_by, ml.seller_id, a.asset_type, a.name AS asset_name
      FROM marketplace_listings ml
      JOIN assets a ON a.id = ml.asset_id
      WHERE ml.id = $1
      FOR UPDATE OF ml
    `;
    const listingResult = await dbClient.query(listingSql, [listingId]);

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

    // Cannot buy your own listing
    if (String(listingRec.seller_id) === account.id) {
      throw Object.assign(new Error('You cannot purchase your own listing.'), {
        statusCode: 409,
      });
    }

    const priceCredits = Number.parseFloat(String(listingRec.price_credits));
    const sourceAssetId = String(listingRec.asset_id);
    const assetType = String(listingRec.asset_type);

    // 3. Check wallet balance (lock wallet row)
    const walletResult = await dbClient.query(
      `SELECT * FROM wallets WHERE workspace_id = $1 AND account_id = $2 LIMIT 1 FOR UPDATE`,
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
    await dbClient.query(
      `UPDATE wallets SET balance_credits = $1, updated_at = NOW() WHERE id = $2`,
      [newBalance, wallet.id],
    );

    // 5. Create ledger entry (CHARGE)
    await dbClient.query(
      `INSERT INTO ledger (workspace_id, wallet_id, amount, type) VALUES ($1, $2, $3, $4)`,
      [account.workspace_id, wallet.id, Number((-priceCredits).toFixed(4)), 'CHARGE'],
    );

    // 6. Fetch the source asset for duplication
    const sourceAsset = await findAssetById(sourceAssetId, undefined, true);
    if (!sourceAsset) {
      throw Object.assign(new Error('Source asset not found'), { statusCode: 404 });
    }

    // 7. Duplicate asset into buyer's workspace
    const assetName = listingRec.asset_name as string | null;
    const newAsset = await duplicateAsset(sourceAsset, assetName, account.workspace_id, account.id);

    // 8. Duplicate asset outputs to the new asset
    await duplicateAssetOutputs(sourceAssetId, newAsset.id);

    // 9. Freeze the original asset (seller keeps it, frozen)
    await dbClient.query(
      `UPDATE assets SET is_marketplace_frozen = TRUE, sold_at = NOW() WHERE id = $1`,
      [sourceAssetId],
    );

    // 10. Mark listing as purchased
    const purchasedAt = new Date().toISOString();
    await dbClient.query(
      `UPDATE marketplace_listings SET purchased_by = $1, purchased_at = $2 WHERE id = $3`,
      [account.id, purchasedAt, listingId],
    );

    await dbClient.query('COMMIT');

    // 11. Notify the seller (non-blocking, outside transaction)
    try {
      const sellerId = String(listingRec.seller_id);
      const assetName = String(listingRec.asset_name ?? assetType);
      await dispatchNotification({
        type: 'WORKFLOW_COMPLETED',
        recipientId: sellerId,
        title: 'Asset Sold',
        message: `Your asset "${assetName}" was sold for ${priceCredits} credits.`,
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
      assets: [], // Duplicate created in buyer's workspace
    };
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    dbClient.release();
  }
}
