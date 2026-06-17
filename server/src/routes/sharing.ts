import { Router } from 'express';
import { z } from 'zod';
import { requireSession } from '../middleware/requireSession.js';
import { requireWorkspace } from '../middleware/requireWorkspace.js';
import type { Request, Response } from 'express';
import {
  shareAsset,
  getAssetPermissions,
  revokePermission,
  SharingError,
} from '../services/sharing-service.js';

const router = Router();

// --- Zod schemas ---

const shareAssetSchema = z.object({
  grantee_id: z.string().uuid('grantee_id must be a valid UUID'),
});

// --- POST /api/assets/:assetId/share — share asset with client ---

router.post(
  '/assets/:assetId/share',
  requireSession,
  requireWorkspace,
  async (req: Request, res: Response) => {
    try {
      const parsed = shareAssetSchema.safeParse(req.body);
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
      const result = await shareAsset(
        req.params.assetId,
        parsed.data.grantee_id,
        req.account!,
        adminBypass,
      );

      res.status(201).json(result);
    } catch (err) {
      if (err instanceof SharingError) {
        const status = err.code === 'NOT_FOUND' ? 404 : 403;
        res.status(status).json({
          error: { code: err.code, message: err.message },
        });
        return;
      }
      console.error('Share asset error:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to share asset' },
      });
    }
  },
);

// --- GET /api/assets/:assetId/permissions — list permissions ---

router.get(
  '/assets/:assetId/permissions',
  requireSession,
  requireWorkspace,
  async (req: Request, res: Response) => {
    try {
      const adminBypass = req.account?.role === 'ADMIN';
      const permissions = await getAssetPermissions(req.params.assetId, req.account!, adminBypass);

      res.json({ data: permissions });
    } catch (err) {
      if (err instanceof SharingError) {
        const status = err.code === 'NOT_FOUND' ? 404 : 403;
        res.status(status).json({
          error: { code: err.code, message: err.message },
        });
        return;
      }
      console.error('Get permissions error:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get permissions' },
      });
    }
  },
);

// --- DELETE /api/permissions/:permissionId — revoke permission ---

router.delete(
  '/permissions/:permissionId',
  requireSession,
  requireWorkspace,
  async (req: Request, res: Response) => {
    try {
      const adminBypass = req.account?.role === 'ADMIN';
      await revokePermission(req.params.permissionId, req.account!, adminBypass);

      res.json({ message: 'Permission revoked successfully' });
    } catch (err) {
      if (err instanceof SharingError) {
        const status = err.code === 'NOT_FOUND' ? 404 : 403;
        res.status(status).json({
          error: { code: err.code, message: err.message },
        });
        return;
      }
      console.error('Revoke permission error:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to revoke permission' },
      });
    }
  },
);

export default router;
