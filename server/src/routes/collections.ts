import { Router } from 'express';
import { z } from 'zod';
import { requireSession } from '../middleware/requireSession.js';
import { requireWorkspace } from '../middleware/requireWorkspace.js';
import type { Request, Response } from 'express';
import * as collectionService from '../services/collection-service.js';
import { DuplicateItemError } from '../services/collection-service.js';

const router = Router();

// --- Zod schemas ---

const createCollectionSchema = z.object({
  name: z.string().min(1, 'name is required').max(255),
});

const updateCollectionSchema = z.object({
  name: z.string().min(1, 'name is required').max(255),
});

const addItemSchema = z.object({
  asset_type: z.string().min(1, 'asset_type is required'),
  asset_id: z.string().min(1, 'asset_id is required'),
});

// --- GET /api/collections — list user's collections with item counts ---

router.get('/', requireSession, requireWorkspace, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
    const search = (req.query.search as string) || undefined;
    const result = await collectionService.listCollectionsService(
      { page, pageSize, search },
      req.account!,
    );
    res.json(result);
  } catch (err) {
    console.error('List collections error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list collections' },
    });
  }
});

// --- POST /api/collections — create collection ---

router.post('/', requireSession, requireWorkspace, async (req: Request, res: Response) => {
  try {
    const parsed = createCollectionSchema.safeParse(req.body);
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

    const collection = await collectionService.createCollectionService(
      parsed.data.name,
      req.account!,
    );
    res.status(201).json(collection);
  } catch (err) {
    console.error('Create collection error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create collection' },
    });
  }
});

// --- GET /api/collections/:id — get single collection ---

router.get('/:id', requireSession, requireWorkspace, async (req: Request, res: Response) => {
  try {
    const collection = await collectionService.findCollectionById(
      req.params.id,
      req.account!.id,
      req.account!.workspace_id,
    );

    if (!collection) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Collection not found' },
      });
      return;
    }

    res.json(collection);
  } catch (err) {
    console.error('Get collection error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get collection' },
    });
  }
});

// --- GET /api/collections/:id/items — get collection items with asset details ---

router.get('/:id/items', requireSession, requireWorkspace, async (req: Request, res: Response) => {
  try {
    const items = await collectionService.getCollectionItemsWithAssets(
      req.params.id,
      req.account!.id,
      req.account!.workspace_id,
    );
    res.json(items);
  } catch (err) {
    console.error('Get collection items error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get collection items' },
    });
  }
});

// --- PUT /api/collections/:id — rename collection ---

router.put('/:id', requireSession, requireWorkspace, async (req: Request, res: Response) => {
  try {
    const parsed = updateCollectionSchema.safeParse(req.body);
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

    const collection = await collectionService.updateCollectionService(
      req.params.id,
      parsed.data.name,
      req.account!,
    );

    if (!collection) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Collection not found' },
      });
      return;
    }

    res.json(collection);
  } catch (err) {
    console.error('Update collection error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update collection' },
    });
  }
});

// --- DELETE /api/collections/:id — delete collection + items ---

router.delete('/:id', requireSession, requireWorkspace, async (req: Request, res: Response) => {
  try {
    const deleted = await collectionService.deleteCollectionService(req.params.id, req.account!);

    if (!deleted) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Collection not found' },
      });
      return;
    }

    res.json({ message: 'Collection deleted successfully' });
  } catch (err) {
    console.error('Delete collection error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete collection' },
    });
  }
});

// --- POST /api/collections/:id/items — add asset to collection ---

router.post('/:id/items', requireSession, requireWorkspace, async (req: Request, res: Response) => {
  try {
    const parsed = addItemSchema.safeParse(req.body);
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

    const item = await collectionService.addItemToCollectionService(
      req.params.id,
      parsed.data.asset_type,
      parsed.data.asset_id,
      req.account!,
    );

    if (!item) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Collection not found' },
      });
      return;
    }

    res.status(201).json(item);
  } catch (err) {
    if (err instanceof DuplicateItemError) {
      res.status(409).json({
        error: { code: 'DUPLICATE_ITEM', message: 'Asset already in collection' },
      });
      return;
    }
    console.error('Add collection item error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to add item to collection' },
    });
  }
});

// --- DELETE /api/collections/:id/items/:itemId — remove asset from collection ---

router.delete(
  '/:id/items/:itemId',
  requireSession,
  requireWorkspace,
  async (req: Request, res: Response) => {
    try {
      const removed = await collectionService.removeItemFromCollectionService(
        req.params.id,
        req.params.itemId,
        req.account!,
      );

      if (!removed) {
        res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'Collection item not found' },
        });
        return;
      }

      res.json({ message: 'Item removed from collection' });
    } catch (err) {
      console.error('Remove collection item error:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to remove item from collection' },
      });
    }
  },
);

export default router;
