import { query } from '../pool.js';

// --- Types ---

export interface CommissionAssetRow {
  id: string;
  commission_id: string;
  asset_id: string;
  asset_output_id: string | null;
  created_at: string;
}

// --- Repository Functions ---

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
