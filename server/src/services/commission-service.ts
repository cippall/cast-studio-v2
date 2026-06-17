import {
  createCommission,
  findCommissionById,
  findCommissionByIdUnfiltered,
  listCommissions,
  assignCommission,
  updateCommissionStatus,
} from '../db/repositories/commission-repo.js';
import {
  getCommissionAssets,
  linkAssetToCommission,
} from '../db/repositories/commission-asset-repo.js';
import { setAssetOwnership } from '../db/repositories/asset-repo.js';
import type { CommissionAssetRow } from '../db/repositories/commission-asset-repo.js';
import type { CommissionRow } from '../db/repositories/commission-repo.js';
import type { AccountRow } from '../middleware/requireSession.js';
import {
  InvalidTransitionError,
  PermissionDeniedError,
  findTransition,
  validateTransition,
} from './commission-state-machine.js';
import * as walletRepo from '../db/repositories/wallet-repo.js';
import {
  notifyCommissionAssigned,
  notifyCommissionSubmitted,
  notifyCommissionApproved,
  notifyCommissionChangesRequested,
} from './notification-service.js';

// --- Types ---

export interface CommissionDetail extends CommissionRow {
  assets: CommissionAssetRow[];
}

export { InvalidTransitionError, PermissionDeniedError };

// --- Errors ---

export class InsufficientCreditsError extends Error {
  constructor(
    public currentBalance: number,
    public required: number,
  ) {
    super(`Insufficient credits. Your balance: ${currentBalance}. Required: ${required}.`);
    this.name = 'InsufficientCreditsError';
    Object.assign(this, { statusCode: 402 });
  }
}

// --- Create ---

/**
 * Create a new commission request.
 */
export async function createCommissionRequest(
  input: { title: string; brief: Record<string, unknown> },
  account: AccountRow,
): Promise<CommissionRow> {
  return createCommission({
    client_workspace_id: account.workspace_id,
    studio_workspace_id: account.workspace_id,
    client_id: account.id,
    title: input.title,
    brief: input.brief,
  });
}

/**
 * List commissions filtered by role.
 */
export async function listCommissionRequests(
  options: {
    status?: string;
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  },
  account: AccountRow,
  adminBypass = false,
): Promise<{
  data: CommissionRow[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}> {
  const listOptions: Record<string, unknown> = { ...options, adminBypass };

  if (!adminBypass) {
    if (account.role === 'CLIENT') {
      listOptions.clientId = account.id;
    } else if (account.role === 'ARTIST') {
      listOptions.assigneeId = account.id;
    }
  }

  return listCommissions(listOptions as any);
}

/**
 * Get a single commission with linked assets.
 */
export async function getCommissionDetail(
  id: string,
  account: AccountRow,
  adminBypass = false,
): Promise<CommissionDetail | null> {
  const commission = await findCommissionById(
    id,
    adminBypass ? undefined : account.workspace_id,
    adminBypass,
  );

  if (!commission) {
    return null;
  }

  // Non-admin role-based visibility
  if (!adminBypass) {
    if (account.role === 'CLIENT' && commission.client_id !== account.id) {
      return null;
    }
    if (account.role === 'ARTIST' && commission.assignee_id !== account.id) {
      return null;
    }
  }

  const assets = await getCommissionAssets(id);
  return { ...commission, assets };
}

/**
 * Assign a commission to an artist (Admin only).
 */
export async function assignCommissionToArtist(
  id: string,
  assigneeId: string,
  account: AccountRow,
  adminBypass = false,
): Promise<CommissionRow> {
  if (!adminBypass && account.role !== 'ADMIN') {
    throw new PermissionDeniedError('Only admins can assign commissions');
  }

  const commission = await findCommissionByIdUnfiltered(id);

  if (!commission) {
    throw new Error('Commission not found');
  }

  if (commission.status !== 'REQUESTED') {
    throw new InvalidTransitionError(commission.status, 'ASSIGNED');
  }

  const updated = await assignCommission(id, assigneeId);

  if (!updated) {
    throw new Error('Failed to assign commission');
  }

  // Notify the assigned artist (fire-and-forget)
  notifyCommissionAssigned({
    recipientId: assigneeId,
    title: updated.title,
    commissionId: id,
  }).catch((err) => {
    console.error('[commission-service] Failed to notify assignee:', err);
  });

  return updated;
}

/**
 * Transition a commission to a new status with full validation.
 */
export async function transitionCommissionStatus(
  id: string,
  toStatus: string,
  account: AccountRow,
  extra?: { premium_cost?: number; asset_ids?: string[] },
  adminBypass = false,
): Promise<CommissionDetail> {
  const commission = await findCommissionByIdUnfiltered(id);

  if (!commission) {
    throw new Error('Commission not found');
  }

  const rule = findTransition(commission.status, toStatus);

  if (!rule) {
    throw new InvalidTransitionError(commission.status, toStatus);
  }

  // Validate permissions
  if (!adminBypass) {
    validateTransition(commission, rule, account);
  }

  // Validate required fields
  if (rule.requiresPremiumCost && (!extra?.premium_cost || extra.premium_cost <= 0)) {
    throw new Error('Premium cost is required and must be greater than 0');
  }

  if (rule.requiresAssetIds && (!extra?.asset_ids || extra.asset_ids.length === 0)) {
    throw new Error('At least one asset_id is required');
  }

  // Build update fields
  const updateFields: Record<string, unknown> = {};
  if (toStatus === 'SUBMITTED') {
    updateFields.premium_cost = extra?.premium_cost;
    updateFields.submitted_at = new Date().toISOString();
  }
  if (toStatus === 'APPROVED') {
    updateFields.approved_at = new Date().toISOString();
    if (!commission.submitted_at) {
      updateFields.submitted_at = new Date().toISOString();
    }
  }

  // Premium unlock: deduct wallet + transfer asset ownership
  if (toStatus === 'APPROVED') {
    await unlockCommissionPremium(commission, id);
  }

  const updated = await updateCommissionStatus(id, toStatus, updateFields as any);
  if (!updated) {
    throw new Error('Failed to update commission status');
  }
  // Link assets if SUBMITTED
  if (toStatus === 'SUBMITTED' && extra?.asset_ids) {
    for (const assetId of extra.asset_ids) {
      await linkAssetToCommission(id, assetId, null);
    }
  }
  const assets = await getCommissionAssets(id);
  const result = { ...updated, assets };

  // Dispatch notifications based on the transition (fire-and-forget)
  dispatchCommissionNotification(toStatus, commission, updated).catch((err) => {
    console.error('[commission-service] Failed to dispatch notification:', err);
  });

  return result;
}

/**
 * Dispatch the appropriate notification for a commission status transition.
 */
function dispatchCommissionNotification(
  toStatus: string,
  commission: CommissionRow,
  updated: CommissionRow,
): Promise<void> {
  switch (toStatus) {
    case 'SUBMITTED':
      return notifyCommissionSubmitted({
        recipientId: commission.client_id,
        title: updated.title,
        commissionId: commission.id,
      });
    case 'APPROVED':
      return notifyCommissionApproved({
        recipientId: commission.assignee_id ?? '',
        title: updated.title,
        commissionId: commission.id,
      });
    case 'CHANGES_REQUESTED':
      return notifyCommissionChangesRequested({
        recipientId: commission.assignee_id ?? '',
        title: updated.title,
        commissionId: commission.id,
      });
    default:
      return Promise.resolve();
  }
}

/**
 * Deduct premium cost from client wallet and transfer asset ownership.
 * Throws InsufficientCreditsError if balance is too low.
 */
async function unlockCommissionPremium(
  commission: CommissionRow,
  commissionId: string,
): Promise<void> {
  const premiumCost = commission.premium_cost ?? 0;
  if (premiumCost <= 0) return;

  const wallet = await walletRepo.findWallet({
    workspaceId: commission.client_workspace_id,
    accountId: commission.client_id,
  });
  if (!wallet) {
    throw new InsufficientCreditsError(0, premiumCost);
  }

  const balance = Number.parseFloat(String(wallet.balance_credits));
  if (balance < premiumCost) {
    throw new InsufficientCreditsError(balance, premiumCost);
  }

  const newBalance = Number((balance - premiumCost).toFixed(4));
  await walletRepo.updateWalletBalance(wallet.id, newBalance);
  await walletRepo.createLedgerEntry({
    workspaceId: commission.client_workspace_id,
    walletId: wallet.id,
    amount: Number((-premiumCost).toFixed(4)),
    type: 'CHARGE',
  });

  const linkedAssets = await getCommissionAssets(commissionId);
  for (const link of linkedAssets) {
    await setAssetOwnership(link.asset_id, commission.client_id, 'COMMISSION');
  }
}
