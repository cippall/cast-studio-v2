import type { CommissionRow } from '../db/repositories/commission-repo.js';
import type { AccountRow } from '../middleware/requireSession.js';

// --- Status Constants ---

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

// --- Transition Rule ---

interface TransitionRule {
  from: CommissionStatus;
  to: CommissionStatus;
  allowedRoles: string[];
  mustBeOwner?: boolean;
  mustBeAssignee?: boolean;
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

// --- Validation ---

/**
 * Find the transition rule for a given from/to status pair.
 */
export function findTransition(from: string, to: string): TransitionRule | null {
  return TRANSITIONS.find((t) => t.from === from && t.to === to) ?? null;
}

/**
 * Validate that the actor is allowed to perform a transition.
 * Throws PermissionDeniedError or InvalidTransitionError if invalid.
 */
export function validateTransition(
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
