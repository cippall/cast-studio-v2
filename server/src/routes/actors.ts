import { Router } from 'express';
import { z } from 'zod';
import { requireSession } from '../middleware/requireSession.js';
import { requireWorkspace } from '../middleware/requireWorkspace.js';
import type { Request, Response } from 'express';
import * as actorService from '../services/actor-service.js';
import * as generationService from '../services/generation-service.js';
import { findAssetById, checkAssetAccess } from '../db/repositories/asset-repo.js';

const router = Router();

// --- Zod schemas ---

const createActorSchema = z.discriminatedUnion('entry_method', [
  z.object({
    entry_method: z.literal('FORM'),
    form_data: z.record(z.string(), z.unknown()).optional(),
    randomize: z.boolean().optional(),
  }),
  z.object({
    entry_method: z.literal('REFERENCE'),
    reference_images: z.array(z.string()).optional(),
    randomize: z.boolean().optional(),
  }),
  z.object({
    entry_method: z.literal('TEXT'),
    prompt: z.string().min(1, 'prompt is required'),
    randomize: z.boolean().optional(),
  }),
  z.object({
    entry_method: z.literal('RANDOMIZE'),
    randomize: z.boolean().optional(),
  }),
]);

const updateActorSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  taxonomy_values: z.record(z.string(), z.unknown()).optional(),
});

const generateSchema = z.object({
  layout_type: z.enum(['headshot', 'fullshot', 'expressions_3x4', 'character_sheet', 'editorial']),
  model: z.string().min(1).optional(),
  form_data: z.record(z.string(), z.unknown()).optional(),
  reference_images: z.array(z.string()).optional(),
  randomize: z.boolean().optional(),
  options: z
    .object({
      num_outputs: z.number().int().min(1).max(10).optional(),
      prompt: z.string().optional(),
    })
    .optional(),
});

const regenerateSchema = z.object({
  layout_type: z.enum(['headshot', 'fullshot', 'expressions_3x4']),
  model: z.string().min(1).optional(),
  form_data: z.record(z.string(), z.unknown()).optional(),
  reference_images: z.array(z.string()).optional(),
  randomize: z.boolean().optional(),
  options: z
    .object({
      prompt: z.string().optional(),
    })
    .optional(),
});

const characterSheetSchema = z.object({
  look_id: z.string().uuid('look_id must be a valid UUID'),
  model: z.string().min(1).optional(),
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
  } catch (err: unknown) {
    if (err instanceof Error && 'statusCode' in err) {
      const statusCode = (err as Error & { statusCode: number }).statusCode;
      res.status(statusCode).json({
        error: {
          code: statusCode === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
          message: err.message,
        },
      });
      return;
    }
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
  } catch (err: unknown) {
    if (err instanceof Error && 'statusCode' in err) {
      const statusCode = (err as Error & { statusCode: number }).statusCode;
      res.status(statusCode).json({
        error: {
          code: statusCode === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
          message: err.message,
        },
      });
      return;
    }
    console.error('Delete actor error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete actor' },
    });
  }
});

// --- POST /api/actors/:id/generate — generate a layout ---

router.post(
  '/:id/generate',
  requireSession,
  requireWorkspace,
  async (req: Request, res: Response) => {
    try {
      const parsed = generateSchema.safeParse(req.body);
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

      const result = await generationService.generateActorOutput(
        req.params.id,
        req.account!,
        {
          layout_type: parsed.data.layout_type,
          model: parsed.data.model,
          task: inferTaskFromLayout(parsed.data.layout_type),
          num_outputs: parsed.data.options?.num_outputs,
          prompt: parsed.data.options?.prompt,
          form_data: parsed.data.form_data,
          reference_images: parsed.data.reference_images,
          randomize: parsed.data.randomize,
        },
        adminBypass,
      );

      res.status(202).json(result);
    } catch (err: unknown) {
      if (err instanceof Error && 'statusCode' in err) {
        const statusCode = (err as Error & { statusCode: number }).statusCode;
        const code =
          statusCode === 404
            ? 'NOT_FOUND'
            : statusCode === 422
              ? 'VALIDATION_ERROR'
              : statusCode === 502
                ? 'BAD_GATEWAY'
                : 'CONFLICT';
        res.status(statusCode).json({
          error: {
            code,
            message: err.message,
          },
        });
        return;
      }
      console.error('Generate actor output error:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to generate actor output' },
      });
    }
  },
);

// --- POST /api/actors/:id/regenerate — regenerate a layout ---

router.post(
  '/:id/regenerate',
  requireSession,
  requireWorkspace,
  async (req: Request, res: Response) => {
    try {
      const parsed = regenerateSchema.safeParse(req.body);
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

      const result = await generationService.regenerateActorOutput(
        req.params.id,
        parsed.data.layout_type,
        req.account!,
        {
          layout_type: parsed.data.layout_type,
          model: parsed.data.model,
          task: inferTaskFromLayout(parsed.data.layout_type),
          prompt: parsed.data.options?.prompt,
          form_data: parsed.data.form_data,
          reference_images: parsed.data.reference_images,
          randomize: parsed.data.randomize,
        },
        adminBypass,
      );

      res.status(202).json(result);
    } catch (err: unknown) {
      if (err instanceof Error && 'statusCode' in err) {
        const statusCode = (err as Error & { statusCode: number }).statusCode;
        const code =
          statusCode === 404 ? 'NOT_FOUND' : statusCode === 422 ? 'VALIDATION_ERROR' : 'CONFLICT';
        res.status(statusCode).json({
          error: {
            code,
            message: err.message,
          },
        });
        return;
      }
      console.error('Regenerate actor output error:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to regenerate actor output' },
      });
    }
  },
);

// --- POST /api/actors/:id/character-sheet ---

router.post(
  '/:id/character-sheet',
  requireSession,
  requireWorkspace,
  async (req: Request, res: Response) => {
    try {
      const parsed = characterSheetSchema.safeParse(req.body);
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

      const result = await generationService.generateCharacterSheet(
        req.params.id,
        parsed.data.look_id,
        req.account!,
        parsed.data.model,
        adminBypass,
      );

      res.status(202).json(result);
    } catch (err: unknown) {
      if (err instanceof Error && 'statusCode' in err) {
        const statusCode = (err as Error & { statusCode: number }).statusCode;
        const code =
          statusCode === 404 ? 'NOT_FOUND' : statusCode === 422 ? 'VALIDATION_ERROR' : 'CONFLICT';
        res.status(statusCode).json({
          error: {
            code,
            message: err.message,
          },
        });
        return;
      }
      console.error('Generate character sheet error:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to generate character sheet' },
      });
    }
  },
);

export default router;

/**
 * Infer the Cast Studio task from the layout_type for prompt resolution.
 */
function inferTaskFromLayout(layoutType: string): string {
  switch (layoutType) {
    case 'headshot':
      return 'actor_headshot';
    case 'fullshot':
      return 'actor_fullshot';
    case 'expressions_3x4':
      return 'actor_expressions';
    case 'editorial':
      return 'actor_editorial';
    case 'character_sheet':
      return 'actor_character_sheet';
    default:
      return 'actor_headshot';
  }
}
