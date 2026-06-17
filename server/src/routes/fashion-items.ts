import { Router } from 'express';
import { z } from 'zod';
import { requireSession } from '../middleware/requireSession.js';
import { requireWorkspace } from '../middleware/requireWorkspace.js';
import type { Request, Response } from 'express';
import * as fashionItemService from '../services/fashion-item-service.js';

const router = Router();

// --- Zod schemas ---

const createFashionItemSchema = z.discriminatedUnion('entry_method', [
  z.object({
    entry_method: z.literal('PROMPT'),
    prompt: z.string().min(1, 'prompt is required'),
  }),
  z.object({
    entry_method: z.literal('REFERENCE'),
    reference_image: z.string().min(1, 'reference_image is required'),
  }),
]);

const updateFashionItemSchema = z
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
function parseFashionItemQuery(req: Request) {
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

// --- POST /api/fashion-items — create fashion item ---

router.post('/', requireSession, requireWorkspace, async (req: Request, res: Response) => {
  try {
    const parsed = createFashionItemSchema.safeParse(req.body);
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

    const result = await fashionItemService.createFashionItem(parsed.data, req.account!);
    res.status(202).json(result);
  } catch (err) {
    console.error('Create fashion item error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create fashion item' },
    });
  }
});

// --- GET /api/fashion-items — list fashion items ---

router.get('/', requireSession, requireWorkspace, async (req: Request, res: Response) => {
  try {
    const query = parseFashionItemQuery(req);
    const adminBypass = req.account?.role === 'ADMIN';

    const result = await fashionItemService.listFashionItems(query, req.account!, adminBypass);
    res.json(result);
  } catch (err) {
    console.error('List fashion items error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list fashion items' },
    });
  }
});

// --- GET /api/fashion-items/:id — get single fashion item ---

router.get('/:id', requireSession, requireWorkspace, async (req: Request, res: Response) => {
  try {
    const adminBypass = req.account?.role === 'ADMIN';
    const item = await fashionItemService.getFashionItem(req.params.id, req.account!, adminBypass);

    if (!item) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Fashion item not found' },
      });
      return;
    }

    res.json(item);
  } catch (err) {
    console.error('Get fashion item error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get fashion item' },
    });
  }
});

// --- PATCH /api/fashion-items/:id — update fashion item ---

router.patch('/:id', requireSession, requireWorkspace, async (req: Request, res: Response) => {
  try {
    const parsed = updateFashionItemSchema.safeParse(req.body);
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
    const item = await fashionItemService.updateFashionItem(
      req.params.id,
      parsed.data,
      req.account!,
      adminBypass,
    );

    if (!item) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Fashion item not found or output not found' },
      });
      return;
    }

    res.json(item);
  } catch (err) {
    console.error('Update fashion item error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update fashion item' },
    });
  }
});

// --- DELETE /api/fashion-items/:id — soft delete ---

router.delete('/:id', requireSession, requireWorkspace, async (req: Request, res: Response) => {
  try {
    const adminBypass = req.account?.role === 'ADMIN';
    const deleted = await fashionItemService.deleteFashionItem(
      req.params.id,
      req.account!,
      adminBypass,
    );

    if (!deleted) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Fashion item not found' },
      });
      return;
    }

    res.json({ message: 'Fashion item deleted successfully' });
  } catch (err) {
    console.error('Delete fashion item error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete fashion item' },
    });
  }
});

export default router;
