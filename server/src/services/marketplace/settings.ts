import { query } from '../../db/pool.js';
import type { MarketplaceSettings } from './helpers.js';

const DEFAULT_SETTINGS: MarketplaceSettings = {
  actor_package: {
    required_outputs: ['headshot', 'fullshot', 'expressions_3x4', 'character_sheet', 'editorial'],
    generic_standard_look_id: null,
    editorial_count: 2,
  },
  look_package: {
    required_outputs: ['look_image'],
  },
  fashion_item_package: {
    required_outputs: ['item_image'],
  },
};

/**
 * Get current marketplace settings.
 */
export async function getMarketplaceSettings(): Promise<MarketplaceSettings> {
  const result = await query('SELECT * FROM marketplace_settings LIMIT 1');

  if (result.rows.length === 0) {
    return DEFAULT_SETTINGS;
  }

  const row = result.rows[0] as Record<string, unknown>;
  return {
    actor_package: row.actor_package as MarketplaceSettings['actor_package'],
    look_package: row.look_package as MarketplaceSettings['look_package'],
    fashion_item_package: row.fashion_item_package as MarketplaceSettings['fashion_item_package'],
  };
}

/**
 * Update marketplace settings (Admin only).
 */
export async function updateMarketplaceSettings(
  updates: Partial<MarketplaceSettings>,
): Promise<MarketplaceSettings> {
  const current = await getMarketplaceSettings();
  const merged: MarketplaceSettings = {
    actor_package: updates.actor_package
      ? { ...current.actor_package, ...updates.actor_package }
      : current.actor_package,
    look_package: updates.look_package
      ? { ...current.look_package, ...updates.look_package }
      : current.look_package,
    fashion_item_package: updates.fashion_item_package
      ? { ...current.fashion_item_package, ...updates.fashion_item_package }
      : current.fashion_item_package,
  };

  await query(
    `UPDATE marketplace_settings SET actor_package = $1, look_package = $2, fashion_item_package = $3, updated_at = NOW()`,
    [
      JSON.stringify(merged.actor_package),
      JSON.stringify(merged.look_package),
      JSON.stringify(merged.fashion_item_package),
    ],
  );

  return merged;
}
