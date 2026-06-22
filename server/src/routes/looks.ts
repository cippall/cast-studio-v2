import { Router } from 'express';
import { z } from 'zod';
import { requireSession } from '../middleware/requireSession.js';
import { requireWorkspace } from '../middleware/requireWorkspace.js';
import type { Request, Response } from 'express';
import * as lookService from '../services/look-service.js';
import { imageToText, getWorkspaceApiKey } from '../services/fal-service.js';

const router = Router();

// --- Zod schemas ---

const createLookSchema = z.discriminatedUnion('entry_method', [
  z.object({
    entry_method: z.literal('PROMPT'),
    prompt: z.string().min(1, 'prompt is required'),
  }),
  z.object({
    entry_method: z.literal('REFERENCE'),
    reference_image: z.string().min(1, 'reference_image is required'),
  }),
  z.object({
    entry_method: z.literal('COMPOSITE'),
    fashion_item_ids: z.array(z.string().min(1)).min(1, 'At least one fashion_item_id is required'),
  }),
]);

const updateLookSchema = z
  .object({
    selected_output_id: z.string().min(1).optional(),
    name: z.string().min(1).max(255).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

// --- Helpers ---

/**
 * Parse pagination and filter query params from the request.
 * Known params are extracted; remaining unknown params are treated as taxonomy filters.
 */
function parseLookQuery(req: Request) {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
  const sortBy = (req.query.sortBy as string) || 'created_at';
  const sortOrder = ((req.query.sortOrder as string) || 'desc') as 'asc' | 'desc';
  const creatorId = req.query.creator_id as string | undefined;

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

  return { page, pageSize, sortBy, sortOrder, creatorId, taxonomyFilters };
}

// --- POST /api/looks — create look ---

router.post('/', requireSession, requireWorkspace, async (req: Request, res: Response) => {
  try {
    const parsed = createLookSchema.safeParse(req.body);
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

    const result = await lookService.createLook(parsed.data, req.account!);
    res.status(202).json(result);
  } catch (err) {
    console.error('Create look error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create look' },
    });
  }
});

// --- GET /api/looks — list looks ---

router.get('/', requireSession, requireWorkspace, async (req: Request, res: Response) => {
  try {
    const query = parseLookQuery(req);
    const adminBypass = req.account?.role === 'ADMIN';

    const result = await lookService.listLooks(query, req.account!, adminBypass);
    res.json(result);
  } catch (err) {
    console.error('List looks error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list looks' },
    });
  }
});

// --- GET /api/looks/:id — get single look ---

router.get('/:id', requireSession, requireWorkspace, async (req: Request, res: Response) => {
  try {
    const adminBypass = req.account?.role === 'ADMIN';
    const look = await lookService.getLook(req.params.id, req.account!, adminBypass);

    if (!look) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Look not found' },
      });
      return;
    }

    res.json(look);
  } catch (err) {
    console.error('Get look error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get look' },
    });
  }
});

// --- PATCH /api/looks/:id — update look ---

router.patch('/:id', requireSession, requireWorkspace, async (req: Request, res: Response) => {
  try {
    const parsed = updateLookSchema.safeParse(req.body);
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
    const look = await lookService.updateLook(
      req.params.id,
      parsed.data,
      req.account!,
      adminBypass,
    );

    if (!look) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Look not found or output not found' },
      });
      return;
    }

    res.json(look);
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
    console.error('Update look error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update look' },
    });
  }
});

// --- DELETE /api/looks/:id — soft delete ---

router.delete('/:id', requireSession, requireWorkspace, async (req: Request, res: Response) => {
  try {
    const adminBypass = req.account?.role === 'ADMIN';
    const deleted = await lookService.deleteLook(req.params.id, req.account!, adminBypass);

    if (!deleted) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Look not found' },
      });
      return;
    }

    res.json({ message: 'Look deleted successfully' });
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
    console.error('Delete look error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete look' },
    });
  }
});

// --- POST /api/looks/extract-reference — extract clothing categories from image ---

const extractReferenceSchema = z.object({
  image_url: z.string().min(1, 'image_url is required'),
});

router.post(
  '/extract-reference',
  requireSession,
  requireWorkspace,
  async (req: Request, res: Response) => {
    try {
      const parsed = extractReferenceSchema.safeParse(req.body);
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

      const { image_url } = parsed.data;
      const apiKey = await getWorkspaceApiKey(req.account!.workspace_id);

      const prompt =
        'List all clothing items and accessories visible in this image. Return them as a comma-separated list (e.g. "Jacket, Shirt, Pants, Shoes"). Only list clothing and accessories, nothing else.';
      const result = await imageToText(image_url, prompt, apiKey);

      const categories = result
        .split(',')
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0);

      res.json({ categories });
    } catch (err) {
      console.error('Extract reference error:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to extract reference data' },
      });
    }
  },
);

export default router;
