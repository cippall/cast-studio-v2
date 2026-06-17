import { Router } from 'express';
import { z } from 'zod';
import { requireSession } from '../middleware/requireSession.js';
import { requireWorkspace } from '../middleware/requireWorkspace.js';
import type { Request, Response } from 'express';
import * as actorService from '../services/actor-service.js';
import { findAssetById, checkAssetAccess } from '../db/repositories/asset-repo.js';

const router = Router();

// --- Zod schemas ---

const createActorSchema = z.discriminatedUnion('entry_method', [
  z.object({
    entry_method: z.literal('FORM'),
    form_data: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({
    entry_method: z.literal('REFERENCE'),
    reference_image: z.string().min(1, 'reference_image is required'),
  }),
  z.object({
    entry_method: z.literal('TEXT'),
    prompt: z.string().min(1, 'prompt is required'),
  }),
  z.object({
    entry_method: z.literal('RANDOMIZE'),
  }),
]);

const updateActorSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  taxonomy_values: z.record(z.string(), z.unknown()).optional(),
});

// --- Helpers ---

/**
 * Parse pagination and filter query params from the request.
 * Known params are extracted; remaining unknown params are treated as taxonomy filters.
 */
function parseActorQuery(req: Request) {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
  const sortBy = (req.query.sortBy as string) || 'created_at';
  const sortOrder = ((req.query.sortOrder as string) || 'desc') as 'asc' | 'desc';
  const creatorId = req.query.creator_id as string | undefined;
  const sharedWithMe = req.query.shared_with_me === 'true' ? req.account?.id : undefined;

  const knownKeys = new Set([
    'page',
    'pageSize',
    'sortBy',
    'sortOrder',
    'creator_id',
    'shared_with_me',
  ]);
  const taxonomyFilters: Record<string, string> = {};

  for (const [key, value] of Object.entries(req.query)) {
    if (!knownKeys.has(key) && typeof value === 'string' && value.length > 0) {
      taxonomyFilters[key] = value;
    }
  }

  return {
    page,
    pageSize,
    sortBy,
    sortOrder,
    creatorId,
    taxonomyFilters,
    sharedWithMeAccountId: sharedWithMe,
  };
}

// --- POST /api/actors — create actor ---

router.post('/', requireSession, requireWorkspace, async (req: Request, res: Response) => {
  try {
    const parsed = createActorSchema.safeParse(req.body);
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

    const actor = await actorService.createActor(parsed.data, req.account!);
    res.status(201).json(actor);
  } catch (err) {
    console.error('Create actor error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create actor' },
    });
  }
});

// --- GET /api/actors — list actors ---

router.get('/', requireSession, requireWorkspace, async (req: Request, res: Response) => {
  try {
    const query = parseActorQuery(req);
    const adminBypass = req.account?.role === 'ADMIN';

    const result = await actorService.listActors(query, req.account!, adminBypass);
    res.json(result);
  } catch (err) {
    console.error('List actors error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list actors' },
    });
  }
});

// --- GET /api/actors/:id — get single actor (with access check) ---

router.get('/:id', requireSession, requireWorkspace, async (req: Request, res: Response) => {
  try {
    const adminBypass = req.account?.role === 'ADMIN';

    // First verify the actor exists and get creator_id for access check
    const asset = await findAssetById(req.params.id, req.account?.workspace_id, adminBypass);
    if (!asset || asset.asset_type !== 'ACTOR') {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Actor not found' },
      });
      return;
    }

    // Check access: creator, admin, or shared via asset_permissions
    const canAccess = await checkAssetAccess(
      asset.id,
      req.account!.id,
      req.account!.role,
      asset.creator_id,
    );

    if (!canAccess) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Actor not found' },
      });
      return;
    }

    const actor = await actorService.getActor(req.params.id, req.account!, adminBypass);

    if (!actor) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Actor not found' },
      });
      return;
    }

    res.json(actor);
  } catch (err) {
    console.error('Get actor error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get actor' },
    });
  }
});

// --- PATCH /api/actors/:id — update actor ---

router.patch('/:id', requireSession, requireWorkspace, async (req: Request, res: Response) => {
  try {
    const parsed = updateActorSchema.safeParse(req.body);
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

    // Require at least one field
    if (Object.keys(parsed.data).length === 0) {
      res.status(422).json({
        error: { code: 'VALIDATION_ERROR', message: 'No fields to update' },
      });
      return;
    }

    const adminBypass = req.account?.role === 'ADMIN';
    const actor = await actorService.updateActor(
      req.params.id,
      parsed.data,
      req.account!,
      adminBypass,
    );

    if (!actor) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Actor not found' },
      });
      return;
    }

    res.json(actor);
  } catch (err) {
    console.error('Update actor error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update actor' },
    });
  }
});

// --- DELETE /api/actors/:id — soft delete ---

router.delete('/:id', requireSession, requireWorkspace, async (req: Request, res: Response) => {
  try {
    const adminBypass = req.account?.role === 'ADMIN';
    const deleted = await actorService.deleteActor(req.params.id, req.account!, adminBypass);

    if (!deleted) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Actor not found' },
      });
      return;
    }

    res.json({ message: 'Actor deleted successfully' });
  } catch (err) {
    console.error('Delete actor error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete actor' },
    });
  }
});

export default router;
