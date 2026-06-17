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

// --- GET /api/marketplace — Client browses active listings ---

router.get('/', requireSession, requireWorkspace, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
    const sortBy = (req.query.sortBy as string) || 'created_at';
    const sortOrder = (req.query.sortOrder as string) || 'desc';
    const listingType = req.query.listing_type as string | undefined;
    const maxPrice = req.query.max_price
      ? Number.parseFloat(req.query.max_price as string)
      : undefined;
    const creatorId = req.query.creator_id as string | undefined;

    const result = await marketplaceService.listMarketplaceListings({
      listingType,
      maxPrice,
      creatorId,
      page,
      pageSize,
      sortBy,
      sortOrder,
    });
    res.json(result);
  } catch (err) {
    console.error('List marketplace error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list marketplace' },
    });
  }
});

// --- GET /api/marketplace/:id — Client views listing detail ---

router.get('/:id', requireSession, requireWorkspace, async (req: Request, res: Response) => {
  try {
    const listing = await marketplaceService.getMarketplaceListing(req.params.id);
    if (!listing) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Listing not found' },
      });
      return;
    }
    res.json(listing);
  } catch (err) {
    console.error('Get marketplace listing error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get listing' },
    });
  }
});

// --- POST /api/marketplace/:id/purchase — Client purchases a listing ---

router.post(
  '/:id/purchase',
  requireSession,
  requireWorkspace,
  async (req: Request, res: Response) => {
    try {
      const result = await marketplaceService.purchaseListing(req.params.id, req.account!);
      res.json(result);
    } catch (err: unknown) {
      if (err instanceof Error && 'statusCode' in err) {
        const statusCode = (err as Error & { statusCode: number }).statusCode;
        const code =
          statusCode === 404
            ? 'NOT_FOUND'
            : statusCode === 409
              ? 'CONFLICT'
              : statusCode === 402
                ? 'PAYMENT_REQUIRED'
                : 'INTERNAL_ERROR';
        res.status(statusCode).json({
          error: { code, message: err.message },
        });
        return;
      }
      console.error('Purchase error:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to process purchase' },
      });
    }
  },
);

export default router;
