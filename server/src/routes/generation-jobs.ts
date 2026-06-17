import { Router } from 'express';
import { requireSession } from '../middleware/requireSession.js';
import { requireWorkspace } from '../middleware/requireWorkspace.js';
import type { Request, Response } from 'express';
import { getGenerationStatus } from '../services/generation-service.js';
import { findAssetById, checkAssetAccess } from '../db/repositories/asset-repo.js';

const router = Router();

// --- GET /api/generation-jobs/:outputId — poll generation status ---

router.get('/:outputId', requireSession, requireWorkspace, async (req: Request, res: Response) => {
  try {
    const output = await getGenerationStatus(req.params.outputId);

    if (!output) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Generation job not found' },
      });
      return;
    }

    // Check access: user must have access to the parent asset
    const adminBypass = req.account?.role === 'ADMIN';
    const asset = await findAssetById(output.asset_id, req.account?.workspace_id, adminBypass);

    if (!asset) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Generation job not found' },
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
        error: { code: 'NOT_FOUND', message: 'Generation job not found' },
      });
      return;
    }

    res.json({
      id: output.id,
      asset_id: output.asset_id,
      asset_output_id: output.id,
      status: output.status,
      image_url: output.image_url,
      model: output.model,
      cost_credits: output.cost_credits,
      error_message: output.error_message,
      created_at: output.created_at,
    });
  } catch (err) {
    console.error('Get generation job error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get generation job' },
    });
  }
});

export default router;
