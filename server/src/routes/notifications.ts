import { Router } from 'express';
import { requireSession } from '../middleware/requireSession.js';
import type { Request, Response } from 'express';
import * as notificationRepo from '../db/repositories/notification-repo.js';

const router = Router();

// --- GET /api/notifications — list notifications ---
router.get('/', requireSession, async (req: Request, res: Response) => {
  try {
    const isRead = req.query.is_read !== undefined ? req.query.is_read === 'true' : undefined;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
    const sortBy = (req.query.sortBy as string) || 'created_at';
    const sortOrder = ((req.query.sortOrder as string) || 'desc') as 'asc' | 'desc';

    const result = await notificationRepo.listNotifications({
      recipientId: req.account!.id,
      isRead,
      page,
      pageSize,
      sortBy,
      sortOrder,
    });

    res.json(result);
  } catch (err) {
    console.error('List notifications error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list notifications' },
    });
  }
});

// --- GET /api/notifications/unread-count ---
router.get('/unread-count', requireSession, async (req: Request, res: Response) => {
  try {
    const count = await notificationRepo.countUnreadNotifications(req.account!.id);
    res.json({ count });
  } catch (err) {
    console.error('Unread count error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get unread count' },
    });
  }
});

// --- PATCH /api/notifications/:id/read — mark as read ---
router.patch('/:id/read', requireSession, async (req: Request, res: Response) => {
  try {
    const notification = await notificationRepo.markNotificationRead(
      req.params.id,
      req.account!.id,
    );

    if (!notification) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Notification not found' },
      });
      return;
    }

    res.json(notification);
  } catch (err) {
    console.error('Mark notification read error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to mark notification as read' },
    });
  }
});

// --- POST /api/notifications — create a notification (frontend-initiated) ---
router.post('/', requireSession, async (req: Request, res: Response) => {
  try {
    const { recipient_id, type, title, message } = req.body;
    if (!recipient_id || !type || !title || !message) {
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'recipient_id, type, title, and message are required',
        },
      });
      return;
    }
    const notification = await notificationRepo.createNotification({
      recipientId: recipient_id,
      type,
      title,
      message,
    });
    res.status(201).json(notification);
  } catch (err) {
    console.error('Create notification error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create notification' },
    });
  }
});

// --- POST /api/notifications/read-all ---
router.post('/read-all', requireSession, async (req: Request, res: Response) => {
  try {
    const count = await notificationRepo.markAllNotificationsRead(req.account!.id);
    res.json({ marked_read: count });
  } catch (err) {
    console.error('Mark all read error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to mark all as read' },
    });
  }
});

export default router;
