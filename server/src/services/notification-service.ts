import * as notificationRepo from '../db/repositories/notification-repo.js';
import type { NotificationType } from '../db/repositories/notification-repo.js';
import { sendNotificationEmail } from './email-service.js';
import { query } from '../db/pool.js';

// --- Re-export types ---
export type { NotificationType };
export { notificationRepo };

// --- Notification Event Types ---

export interface NotificationEvent {
  type: NotificationType;
  recipientId?: string; // If not provided, resolved from context
  title: string;
  message: string;
  email?: string; // If not provided, looked up from DB
  templateData?: Record<string, string>;
}

// --- Resolve recipient email ---

async function resolveRecipientEmail(recipientId: string): Promise<string | null> {
  const result = await query('SELECT email FROM accounts WHERE id = $1', [recipientId]);
  const row = result.rows[0] as { email: string } | undefined;
  return row?.email ?? null;
}

// --- Public API ---

/**
 * Dispatch a notification: create in-app notification and send email.
 * Email sending is async and non-blocking -- failures are logged, never thrown.
 */
export async function dispatchNotification(event: NotificationEvent): Promise<void> {
  if (!event.recipientId) {
    console.error('[notification-service] Cannot dispatch notification: recipientId is required');
    return;
  }

  // 1. Create in-app notification
  try {
    await notificationRepo.createNotification({
      recipientId: event.recipientId,
      type: event.type,
      title: event.title,
      message: event.message,
    });
  } catch (err) {
    console.error('[notification-service] Failed to create in-app notification:', err);
    return;
  }

  // 2. Send email (fire-and-forget, non-blocking)
  const email = event.email ?? (await resolveRecipientEmail(event.recipientId));
  if (email) {
    sendNotificationEmail({
      to: email,
      type: event.type,
      title: event.title,
      message: event.message,
      templateData: event.templateData,
    }).catch((err) => {
      console.error('[notification-service] Email dispatch error:', err);
    });
  }
}

/**
 * Convenience helpers for each notification type
 */

export function notifyCommissionAssigned(data: {
  recipientId: string;
  assigneeEmail?: string;
  title: string;
  commissionId: string;
}): Promise<void> {
  return dispatchNotification({
    type: 'COMMISSION_ASSIGNED',
    recipientId: data.recipientId,
    title: 'New Commission Assigned',
    message: `You have been assigned a commission: "${data.title}"`,
    email: data.assigneeEmail,
    templateData: { title: data.title },
  });
}

export function notifyCommissionSubmitted(data: {
  recipientId: string;
  clientEmail?: string;
  title: string;
  commissionId: string;
}): Promise<void> {
  return dispatchNotification({
    type: 'COMMISSION_SUBMITTED',
    recipientId: data.recipientId,
    title: 'Work Submitted for Review',
    message: `Work has been submitted for your commission: "${data.title}". Review and approve to unlock.`,
    email: data.clientEmail,
    templateData: { title: data.title },
  });
}

export function notifyCommissionApproved(data: {
  recipientId: string;
  assigneeEmail?: string;
  title: string;
  commissionId: string;
}): Promise<void> {
  return dispatchNotification({
    type: 'COMMISSION_APPROVED',
    recipientId: data.recipientId,
    title: 'Commission Approved',
    message: `Your commission "${data.title}" has been approved! Assets are now unlocked.`,
    email: data.assigneeEmail,
    templateData: { title: data.title },
  });
}

export function notifyCommissionChangesRequested(data: {
  recipientId: string;
  assigneeEmail?: string;
  title: string;
  commissionId: string;
}): Promise<void> {
  return dispatchNotification({
    type: 'COMMISSION_CHANGES_REQUESTED',
    recipientId: data.recipientId,
    title: 'Changes Requested',
    message: `Changes have been requested for "${data.title}". Please review the feedback and resubmit.`,
    email: data.assigneeEmail,
    templateData: { title: data.title },
  });
}

export function notifyAssetShared(data: {
  recipientId: string;
  granteeEmail?: string;
  assetName: string;
  assetType: string;
}): Promise<void> {
  const typeLabel =
    data.assetType === 'ACTOR' ? 'actor' : data.assetType === 'LOOK' ? 'look' : 'fashion item';
  return dispatchNotification({
    type: 'ASSET_SHARED',
    recipientId: data.recipientId,
    title: 'Asset Shared With You',
    message: `A ${typeLabel} "${data.assetName}" has been shared with you.`,
    email: data.granteeEmail,
    templateData: { asset_name: data.assetName },
  });
}

export function notifyWorkflowCompleted(data: {
  recipientId: string;
  email?: string;
  title: string;
}): Promise<void> {
  return dispatchNotification({
    type: 'WORKFLOW_COMPLETED',
    recipientId: data.recipientId,
    title: 'Workflow Completed',
    message: `Your workflow "${data.title}" has completed successfully.`,
    email: data.email,
    templateData: { title: data.title },
  });
}

export function notifyWorkflowFailed(data: {
  recipientId: string;
  email?: string;
  title: string;
  reason?: string;
}): Promise<void> {
  return dispatchNotification({
    type: 'WORKFLOW_FAILED',
    recipientId: data.recipientId,
    title: 'Workflow Failed',
    message: `Your workflow "${data.title}" has failed.${data.reason ? ` Reason: ${data.reason}` : ''} Any escrowed credits have been refunded.`,
    email: data.email,
    templateData: { title: data.title },
  });
}
