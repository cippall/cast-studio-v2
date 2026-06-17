import {
  createCommission,
  findCommissionById,
  findCommissionByIdUnfiltered,
  listCommissions,
  assignCommission,
  updateCommissionStatus,
  getCommissionAssets,
  linkAssetToCommission,
} from '../db/repositories/commission-repo.js';
import type { CommissionRow, CommissionAssetRow } from '../db/repositories/commission-repo.js';
import type { AccountRow } from '../middleware/requireSession.js';

// --- Constants ---

export const COMMISSION_STATUSES = {
  REQUESTED: 'REQUESTED',
  ASSIGNED: 'ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  SUBMITTED: 'SUBMITTED',
  CHANGES_REQUESTED: 'CHANGES_REQUESTED',
  APPROVED: 'APPROVED',
  CANCELLED: 'CANCELLED',
} as const;

export type CommissionStatus = (typeof COMMISSION_STATUSES)[keyof typeof COMMISSION_STATUSES];

/** Role-based permission for each transition */
interface TransitionRule {
  from: CommissionStatus;
  to: CommissionStatus;
  /** Roles allowed to perform this transition */
  allowedRoles: string[];
  /** Whether the actor must own the commission (client) or be the assignee (artist) */
  mustBeOwner?: boolean;
  mustBeAssignee?: boolean;
  /** Whether premium_cost and asset_ids are required */
  requiresPremiumCost?: boolean;
  requiresAssetIds?: boolean;
}

const TRANSITIONS: TransitionRule[] = [
  // Admin: assign commission
  { from: 'REQUESTED', to: 'ASSIGNED', allowedRoles: ['ADMIN'] },
  { from: 'REQUESTED', to: 'CANCELLED', allowedRoles: ['ARTIST', 'CLIENT', 'ADMIN'] },
  // Artist or Admin: start work
  { from: 'ASSIGNED', to: 'IN_PROGRESS', allowedRoles: ['ARTIST', 'ADMIN'], mustBeAssignee: true },
  { from: 'ASSIGNED', to: 'CANCELLED', allowedRoles: ['ARTIST', 'CLIENT', 'ADMIN'] },
  // Artist: submit work
  {
    from: 'IN_PROGRESS',
    to: 'SUBMITTED',
    allowedRoles: ['ARTIST', 'ADMIN'],
    mustBeAssignee: true,
    requiresPremiumCost: true,
    requiresAssetIds: true,
  },
  { from: 'IN_PROGRESS', to: 'CANCELLED', allowedRoles: ['ARTIST', 'CLIENT', 'ADMIN'] },
  // Client: request changes
  {
    from: 'SUBMITTED',
    to: 'CHANGES_REQUESTED',
    allowedRoles: ['CLIENT', 'ADMIN'],
    mustBeOwner: true,
  },
  // Client or Admin: approve
  { from: 'SUBMITTED', to: 'APPROVED', allowedRoles: ['CLIENT', 'ADMIN'], mustBeOwner: true },
  { from: 'SUBMITTED', to: 'CANCELLED', allowedRoles: ['ARTIST', 'CLIENT', 'ADMIN'] },
  // Artist: resume work after changes requested
  {
    from: 'CHANGES_REQUESTED',
    to: 'IN_PROGRESS',
    allowedRoles: ['ARTIST', 'ADMIN'],
    mustBeAssignee: true,
  },
  { from: 'CHANGES_REQUESTED', to: 'CANCELLED', allowedRoles: ['ARTIST', 'CLIENT', 'ADMIN'] },
  { from: 'CANCELLED', to: 'REQUESTED', allowedRoles: ['ADMIN'] },
];

// --- Error Types ---

export class InvalidTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Cannot transition from ${from} to ${to}`);
    this.name = 'InvalidTransitionError';
  }
}

export class PermissionDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermissionDeniedError';
  }
}

// --- Types ---

export interface CommissionDetail extends CommissionRow {
  assets: CommissionAssetRow[];
}

export interface SubmitWorkParams {
  premium_cost: number;
  asset_ids: string[];
}

// --- Helpers ---

/**
 * Find the transition rule for a given from/to status pair.
 */
function findTransition(from: string, to: string): TransitionRule | null {
  return TRANSITIONS.find((t) => t.from === from && t.to === to) ?? null;
}

/**
 * Validate that the actor is allowed to perform the transition.
 */
function validateTransitionPermission(
  commission: CommissionRow,
  rule: TransitionRule,
  account: AccountRow,
): void {
  // Admin can do everything
  if (account.role === 'ADMIN') {
    return;
  }

  // Check role is allowed
  if (!rule.allowedRoles.includes(account.role)) {
    throw new PermissionDeniedError(
      `Role ${account.role} is not allowed to transition from ${commission.status}`,
    );
  }

  // Must be the client who owns the commission
  if (rule.mustBeOwner && commission.client_id !== account.id) {
    throw new PermissionDeniedError('Only the commission owner can perform this action');
  }

  // Must be the assigned artist
  if (rule.mustBeAssignee && commission.assignee_id !== account.id) {
    throw new PermissionDeniedError('Only the assigned artist can perform this action');
  }
}

// --- Service Functions ---

/**
 * Create a new commission request.
 */
export async function createCommissionRequest(
  input: {
    title: string;
    brief: Record<string, unknown>;
  },
  account: AccountRow,
): Promise<CommissionRow> {
  // Find a studio workspace to assign the commission to
  // For now, we use the same workspace for both client and studio
  // In a multi-workspace setup, the studio_workspace_id would be looked up
  const studioWorkspaceId = account.workspace_id;

  return createCommission({
    client_workspace_id: account.workspace_id,
    studio_workspace_id: studioWorkspaceId,
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
    // Admin sees all — no additional filter
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
  // Only admin can assign
  if (!adminBypass && account.role !== 'ADMIN') {
    throw new PermissionDeniedError('Only admins can assign commissions');
  }

  const commission = await findCommissionByIdUnfiltered(id);

  if (!commission) {
    throw new Error('Commission not found');
  }

  // Must be in REQUESTED status
  if (commission.status !== 'REQUESTED') {
    throw new InvalidTransitionError(commission.status, 'ASSIGNED');
  }

  const updated = await assignCommission(id, assigneeId);

  if (!updated) {
    throw new Error('Failed to assign commission');
  }

  return updated;
}

/**
 * Transition a commission to a new status with full validation.
 */
export async function transitionCommissionStatus(
  id: string,
  toStatus: string,
  account: AccountRow,
  extra?: {
    premium_cost?: number;
    asset_ids?: string[];
  },
  adminBypass = false,
): Promise<CommissionDetail> {
  const commission = await findCommissionByIdUnfiltered(id);

  if (!commission) {
    throw new Error('Commission not found');
  }

  // Find the transition rule
  const rule = findTransition(commission.status, toStatus);

  if (!rule) {
    throw new InvalidTransitionError(commission.status, toStatus);
  }

  // Validate permissions
  if (!adminBypass) {
    validateTransitionPermission(commission, rule, account);
  }

  // Validate required fields for SUBMITTED
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
    // If not already set, set submitted_at
    if (!commission.submitted_at) {
      updateFields.submitted_at = new Date().toISOString();
    }
  }

  // Perform the update
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

  // Get assets for response
  const assets = await getCommissionAssets(id);

  return { ...updated, assets };
}
