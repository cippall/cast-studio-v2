import { Router } from 'express';
import { z } from 'zod';
import { requireSession } from '../middleware/requireSession.js';
import { requireWorkspace } from '../middleware/requireWorkspace.js';
import type { Request, Response } from 'express';
import {
  findAssetById,
  checkAssetAccess,
  getAssetOutputById,
  getOutputVersions,
} from '../db/repositories/asset-repo.js';
import * as actorService from '../services/actor-service.js';

const router = Router();

const duplicateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
});

router.get(
  '/:id/outputs/:outputId/versions',
  requireSession,
  requireWorkspace,
  async (req: Request, res: Response) => {
    try {
      const adminBypass = req.account?.role === 'ADMIN';

      const asset = await findAssetById(req.params.id, req.account?.workspace_id, adminBypass);
      if (!asset) {
        res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'Asset not found' },
        });
        return;
      }

      const canAccess = await checkAssetAccess(
        asset.id,
        req.account!.id,
        req.account!.role,
        asset.creator_id,
      );

      if (!canAccess) {
        res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'Asset not found' },
        });
        return;
      }

      const current = await getAssetOutputById(req.params.outputId);
      if (!current) {
        res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'Output not found' },
        });
        return;
      }

      const archivedVersions = await getOutputVersions(req.params.outputId);

      const versions = archivedVersions.map((v) => ({
        version: v.version,
        image_url: v.image_url,
        model: v.model,
        status: v.status,
        generation_params: v.generation_params,
        archived_at: v.created_at,
      }));

      res.json({
        current: {
          id: current.id,
          version: current.version,
          image_url: current.image_url,
          model: current.model,
          status: current.status,
          generation_params: current.generation_params,
          reference_images: current.reference_images,
          source_asset_outputs: current.source_asset_outputs,
          created_at: current.created_at,
        },
        versions,
      });
    } catch (err) {
      console.error('Get output versions error:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to load version history' },
      });
    }
  },
);

// --- POST /api/assets/:id/duplicate — duplicate an asset ---

router.post(
  '/:id/duplicate',
  requireSession,
  requireWorkspace,
  async (req: Request, res: Response) => {
    try {
      const parsed = duplicateSchema.safeParse(req.body);
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

      const adminBypass = req.account?.role === 'ADMIN';
      const newName = parsed.data.name ?? null;

      const result = await actorService.duplicateActor(
        req.params.id,
        req.account!,
        newName,
        adminBypass,
      );

      res.status(201).json(result);
    } catch (err: unknown) {
      if (err instanceof Error && 'statusCode' in err) {
        const statusCode = (err as Error & { statusCode: number }).statusCode;
        const code = statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR';
        res.status(statusCode).json({
          error: { code, message: err.message },
        });
        return;
      }
      console.error('Duplicate asset error:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to duplicate asset' },
      });
    }
  },
);

export default router;
