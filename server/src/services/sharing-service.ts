import {
  createAssetPermission,
  findAssetById,
  findAssetPermission,
  listAssetPermissions,
  revokeAssetPermission,
} from '../db/repositories/asset-repo.js';
import type { PermissionRow } from '../db/repositories/asset-repo.js';
import type { AccountRow } from '../middleware/requireSession.js';

// --- Public Service Functions ---

/**
 * Share an asset with a grantee account.
 * - Only the asset creator or admin can share
 * - Cannot share client-owned assets
 * - Cannot share marketplace-frozen assets
 */
export async function shareAsset(
  assetId: string,
  granteeId: string,
  account: AccountRow,
  adminBypass = false,
): Promise<PermissionRow> {
  const asset = await findAssetById(assetId, account.workspace_id, adminBypass);

  if (!asset) {
    throw new SharingError('Asset not found', 'NOT_FOUND');
  }

  if (asset.deleted_at) {
    throw new SharingError('Asset not found', 'NOT_FOUND');
  }

  // Only creator or admin can share
  if (!adminBypass && asset.creator_id !== account.id) {
    throw new SharingError('Only the asset creator can share it', 'FORBIDDEN');
  }

  // Cannot share client-owned assets
  if (asset.client_id) {
    throw new SharingError('Cannot share a client-owned asset', 'FORBIDDEN');
  }

  // Cannot share marketplace-frozen assets
  if (asset.is_marketplace_frozen) {
    throw new SharingError('Cannot share a marketplace-frozen asset', 'FORBIDDEN');
  }

  return createAssetPermission(assetId, granteeId);
}

/**
 * List active permissions for an asset.
 * Only the creator or admin can view permissions.
 */
export async function getAssetPermissions(
  assetId: string,
  account: AccountRow,
  adminBypass = false,
): Promise<PermissionRow[]> {
  const asset = await findAssetById(assetId, account.workspace_id, adminBypass);

  if (!asset || asset.deleted_at) {
    throw new SharingError('Asset not found', 'NOT_FOUND');
  }

  // Only creator or admin can view permissions
  if (!adminBypass && asset.creator_id !== account.id) {
    throw new SharingError('Only the asset creator can view permissions', 'FORBIDDEN');
  }

  return listAssetPermissions(assetId);
}

/**
 * Revoke a permission (set revoked_at = NOW()).
 * Only the asset creator or admin can revoke.
 */
export async function revokePermission(
  permissionId: string,
  account: AccountRow,
  adminBypass = false,
): Promise<void> {
  const permission = await findAssetPermission(permissionId);

  if (!permission) {
    throw new SharingError('Permission not found', 'NOT_FOUND');
  }

  // If not admin, check that the caller owns the asset
  if (!adminBypass) {
    const asset = await findAssetById(permission.asset_id, account.workspace_id, adminBypass);
    if (!asset || asset.creator_id !== account.id) {
      throw new SharingError('Only the asset creator can revoke permissions', 'FORBIDDEN');
    }
  }

  const revoked = await revokeAssetPermission(permissionId);
  if (!revoked) {
    throw new SharingError('Permission not found or already revoked', 'NOT_FOUND');
  }
}

// --- Custom Error ---

export class SharingError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'SharingError';
    this.code = code;
  }
}
