import { Router } from 'express';
import { z } from 'zod';
import { requireSession } from '../middleware/requireSession.js';
import { requireWorkspace } from '../middleware/requireWorkspace.js';
import type { Request, Response } from 'express';
import * as marketplaceService from '../services/marketplace-service.js';

const router = Router();

// --- Zod schemas ---

const submitSchema = z.object({
  asset_id: z.string().uuid('asset_id must be a valid UUID'),
});

// --- POST /api/marketplace/submit — Artist submits asset for review ---

router.post('/submit', requireSession, requireWorkspace, async (req: Request, res: Response) => {
  try {
    const parsed = submitSchema.safeParse(req.body);
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

    const result = await marketplaceService.submitAssetForMarketplace(
      parsed.data.asset_id,
      req.account!,
    );
    res.status(201).json(result);
  } catch (err: unknown) {
    if (err instanceof Error && 'statusCode' in err) {
      const statusCode = (err as Error & { statusCode: number }).statusCode;
      const code = statusCode === 404 ? 'NOT_FOUND' : statusCode === 403 ? 'FORBIDDEN' : 'CONFLICT';
      res.status(statusCode).json({
        error: {
          code,
          message: err.message,
          ...(statusCode === 409 && 'missing' in err
            ? { details: { missing: (err as Error & { missing: string[] }).missing } }
            : {}),
        },
      });
      return;
    }
    console.error('Submit to marketplace error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to submit to marketplace' },
    });
  }
});

// --- GET /api/marketplace/submissions — Artist views own submissions ---

router.get(
  '/submissions',
  requireSession,
  requireWorkspace,
  async (req: Request, res: Response) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
      const status = req.query.status as string | undefined;

      const result = await marketplaceService.listArtistSubmissions(req.account!, {
        status,
        page,
        pageSize,
      });
      res.json(result);
    } catch (err) {
      console.error('List submissions error:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to list submissions' },
      });
    }
  },
);

export default router;
