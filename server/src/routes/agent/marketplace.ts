import { Router } from 'express';
import { z } from 'zod';
import { requireApiKey } from '../../middleware/requireApiKey.js';
import type { Request, Response } from 'express';
import * as marketplaceService from '../../services/marketplace-service.js';

const router = Router();

// --- Zod schemas ---

const agentSubmitSchema = z.object({
  asset_id: z.string().uuid('asset_id must be a valid UUID'),
});

// --- POST /api/agent/marketplace/submit — Agent submits asset via API key ---

router.post('/submit', requireApiKey, async (req: Request, res: Response) => {
  try {
    const parsed = agentSubmitSchema.safeParse(req.body);
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

    const result = await marketplaceService.submitAssetViaAgent(parsed.data.asset_id, req.account!);
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
    console.error('Agent submit to marketplace error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to submit to marketplace' },
    });
  }
});

export default router;
