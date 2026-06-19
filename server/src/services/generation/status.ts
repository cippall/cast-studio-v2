import { getAssetOutputById } from '../../db/repositories/asset-repo.js';
import type { AssetOutputRow } from '../../db/repositories/asset-repo.js';

/**
 * Get the current status of a generation job (asset output).
 */
export async function getGenerationStatus(outputId: string): Promise<AssetOutputRow | null> {
  return getAssetOutputById(outputId);
}
