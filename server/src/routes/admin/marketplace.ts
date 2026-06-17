import { Router } from 'express';
import { z } from 'zod';
import { requireSession } from '../../middleware/requireSession.js';
import { requireWorkspace } from '../../middleware/requireWorkspace.js';
import type { Request, Response } from 'express';
import * as marketplaceService from '../../services/marketplace-service.js';

const router = Router();

// --- Zod schemas ---

const approveSchema = z.object({
  price_credits: z.number().positive('price_credits must be positive'),
});

// --- GET /api/admin/marketplace/submissions — Admin views all pending submissions ---

router.get(
  '/submissions',
  requireSession,
  requireWorkspace,
  async (req: Request, res: Response) => {
    try {
      // Only admins can review all submissions
      if (req.account?.role !== 'ADMIN') {
        res.status(403).json({
          error: { code: 'FORBIDDEN', message: 'Only admins can review marketplace submissions' },
        });
        return;
      }

      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
      const status = req.query.status as string | undefined;

      const result = await marketplaceService.listAllSubmissions({
        status,
        page,
        pageSize,
      });
      res.json(result);
    } catch (err) {
      console.error('List admin submissions error:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to list submissions' },
      });
    }
  },
);

// --- POST /api/admin/marketplace/submissions/:assetId/approve ---

router.post(
  '/submissions/:assetId/approve',
  requireSession,
  requireWorkspace,
  async (req: Request, res: Response) => {
    try {
      if (req.account?.role !== 'ADMIN') {
        res.status(403).json({
          error: { code: 'FORBIDDEN', message: 'Only admins can approve submissions' },
        });
        return;
      }

      const parsed = approveSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(422).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: parsed.error.flatten().fieldErrors,
          },
        });
        return;
      }

      const result = await marketplaceService.approveSubmission(
        req.params.assetId,
        parsed.data.price_credits,
        req.account!.id,
      );
      res.json(result);
    } catch (err: unknown) {
      if (err instanceof Error && 'statusCode' in err) {
        const statusCode = (err as Error & { statusCode: number }).statusCode;
        const code = statusCode === 404 ? 'NOT_FOUND' : 'CONFLICT';
        res.status(statusCode).json({
          error: { code, message: err.message },
        });
        return;
      }
      console.error('Approve submission error:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to approve submission' },
      });
    }
  },
);

// --- POST /api/admin/marketplace/submissions/:assetId/reject ---

router.post(
  '/submissions/:assetId/reject',
  requireSession,
  requireWorkspace,
  async (req: Request, res: Response) => {
    try {
      if (req.account?.role !== 'ADMIN') {
        res.status(403).json({
          error: { code: 'FORBIDDEN', message: 'Only admins can reject submissions' },
        });
        return;
      }

      const result = await marketplaceService.rejectSubmission(req.params.assetId);
      res.json(result);
    } catch (err: unknown) {
      if (err instanceof Error && 'statusCode' in err) {
        const statusCode = (err as Error & { statusCode: number }).statusCode;
        const code = statusCode === 404 ? 'NOT_FOUND' : 'CONFLICT';
        res.status(statusCode).json({
          error: { code, message: err.message },
        });
        return;
      }
      console.error('Reject submission error:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to reject submission' },
      });
    }
  },
);

export default router;
