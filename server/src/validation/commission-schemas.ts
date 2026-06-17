import { z } from 'zod';

/**
 * Schema for creating a commission request.
 */
export const createCommissionSchema = z.object({
  title: z.string().min(1, 'title is required').max(255),
  brief: z.record(z.string(), z.unknown()),
});

/**
 * Schema for assigning a commission to an artist.
 */
export const assignSchema = z.object({
  assignee_id: z.string().uuid('assignee_id must be a valid UUID'),
});

/**
 * Valid commission status values.
 */
export const VALID_STATUSES = [
  'REQUESTED',
  'ASSIGNED',
  'IN_PROGRESS',
  'SUBMITTED',
  'CHANGES_REQUESTED',
  'APPROVED',
  'CANCELLED',
] as const;

/**
 * Schema for transitioning commission status.
 */
export const statusTransitionSchema = z.object({
  status: z.enum(VALID_STATUSES),
  premium_cost: z.number().positive().optional(),
  asset_ids: z.array(z.string().uuid()).min(1).optional(),
});
