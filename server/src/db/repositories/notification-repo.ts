import { query } from '../pool.js';

// --- Types ---

export interface NotificationRow {
  id: string;
  recipient_id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export type NotificationType =
  | 'COMMISSION_ASSIGNED'
  | 'COMMISSION_SUBMITTED'
  | 'COMMISSION_APPROVED'
  | 'COMMISSION_CHANGES_REQUESTED'
  | 'ASSET_SHARED'
  | 'WORKFLOW_COMPLETED'
  | 'WORKFLOW_FAILED';

export interface CreateNotificationInput {
  recipientId: string;
  type: NotificationType;
  title: string;
  message: string;
}

export interface ListNotificationsOptions {
  recipientId: string;
  isRead?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// --- Repository Functions ---

export async function createNotification(data: CreateNotificationInput): Promise<NotificationRow> {
  const result = await query(
    `INSERT INTO notifications (recipient_id, type, title, message)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [data.recipientId, data.type, data.title, data.message],
  );
  return result.rows[0] as NotificationRow;
}

export async function listNotifications(options: ListNotificationsOptions): Promise<{
  data: NotificationRow[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}> {
  const {
    recipientId,
    isRead,
    page = 1,
    pageSize = 20,
    sortBy = 'created_at',
    sortOrder = 'desc',
  } = options;

  const params: unknown[] = [recipientId];
  const conditions: string[] = ['recipient_id = $1'];
  let idx = 2;

  if (isRead !== undefined) {
    conditions.push(`is_read = $${idx++}`);
    params.push(isRead);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const safeSortBy = sortBy.replace(/[^a-zA-Z0-9_]/g, '');
  const safeSortOrder = sortOrder === 'asc' ? 'ASC' : 'DESC';

  const countSql = `SELECT COUNT(*)::int AS count FROM notifications ${whereClause}`;
  const countResult = await query(countSql, params);
  const countRow = countResult.rows[0] as { count: number } | undefined;
  const totalItems = parseInt(String(countRow?.count ?? '0'), 10);

  const offset = (page - 1) * pageSize;
  const dataSql = `
    SELECT * FROM notifications
    ${whereClause}
    ORDER BY ${safeSortBy} ${safeSortOrder}
    LIMIT $${idx} OFFSET $${idx + 1}
  `;
  const dataParams = [...params, pageSize, offset];
  const dataResult = await query(dataSql, dataParams);

  return {
    data: dataResult.rows as NotificationRow[],
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages: totalItems > 0 ? Math.ceil(totalItems / pageSize) : 0,
    },
  };
}

export async function markNotificationRead(
  id: string,
  recipientId: string,
): Promise<NotificationRow | null> {
  const result = await query(
    `UPDATE notifications SET is_read = TRUE
     WHERE id = $1 AND recipient_id = $2
     RETURNING *`,
    [id, recipientId],
  );
  return (result.rows[0] as NotificationRow) ?? null;
}

export async function markAllNotificationsRead(recipientId: string): Promise<number> {
  const result = await query(
    `UPDATE notifications SET is_read = TRUE
     WHERE recipient_id = $1 AND is_read = FALSE`,
    [recipientId],
  );
  return result.rowCount ?? 0;
}

export async function countUnreadNotifications(recipientId: string): Promise<number> {
  const result = await query(
    `SELECT COUNT(*)::int AS count FROM notifications
     WHERE recipient_id = $1 AND is_read = FALSE`,
    [recipientId],
  );
  const row = result.rows[0] as { count: number } | undefined;
  return parseInt(String(row?.count ?? '0'), 10);
}
