import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { requireSession } from '../middleware/requireSession.js';
import type { Request, Response } from 'express';

const router = Router();

// --- Validation schemas ---

const createWorkspaceSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  workspace_type: z.enum(['STUDIO', 'CLIENT']).default('STUDIO'),
});

const updateWorkspaceSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  workspace_type: z.enum(['STUDIO', 'CLIENT']).optional(),
});

// --- Helpers ---

/** Reject non-admin callers with 403. Returns false when blocked. */
function requireAdmin(req: Request, res: Response): boolean {
  if (req.account?.role !== 'ADMIN') {
    res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Only admins can manage workspaces' },
    });
    return false;
  }
  return true;
}

// --- GET /api/workspaces — list all workspaces (admin only)  ---

router.get('/', requireSession, async (req: Request, res: Response) => {
  try {
    if (!requireAdmin(req, res)) return;

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
    const offset = (page - 1) * pageSize;

    const countResult = await query('SELECT COUNT(*)::int AS count FROM workspaces', []);
    const totalItems = (countResult.rows[0] as { count: number }).count;

    const result = await query(
      'SELECT * FROM workspaces ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [pageSize, offset],
    );

    res.json({
      data: result.rows,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: totalItems > 0 ? Math.ceil(totalItems / pageSize) : 0,
      },
    });
  } catch (err) {
    console.error('List workspaces error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list workspaces' },
    });
  }
});

// --- POST /api/workspaces — create workspace (admin only) ---

router.post('/', requireSession, async (req: Request, res: Response) => {
  try {
    if (!requireAdmin(req, res)) return;

    const parsed = createWorkspaceSchema.safeParse(req.body);
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

    const { name, slug, workspace_type } = parsed.data;

    // Check slug uniqueness
    const existing = await query('SELECT id FROM workspaces WHERE slug = $1', [slug]);
    if (existing.rows.length > 0) {
      res.status(409).json({
        error: { code: 'CONFLICT', message: 'A workspace with this slug already exists' },
      });
      return;
    }

    const result = await query(
      `INSERT INTO workspaces (name, slug, workspace_type)
       VALUES ($1, $2, $3)
       RETURNING id, name, slug, workspace_type, created_at`,
      [name, slug, workspace_type],
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create workspace error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create workspace' },
    });
  }
});

// --- GET /api/workspaces/:id — get single workspace (admin only) ---

router.get('/:id', requireSession, async (req: Request, res: Response) => {
  try {
    if (!requireAdmin(req, res)) return;

    const result = await query('SELECT * FROM workspaces WHERE id = $1', [req.params.id]);

    if (result.rows.length === 0) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Workspace not found' },
      });
      return;
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get workspace error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get workspace' },
    });
  }
});

// --- PATCH /api/workspaces/:id — update workspace (admin only) ---

router.patch('/:id', requireSession, async (req: Request, res: Response) => {
  try {
    if (!requireAdmin(req, res)) return;

    const parsed = updateWorkspaceSchema.safeParse(req.body);
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

    // Verify workspace exists before attempting update
    const existing = await query('SELECT id FROM workspaces WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Workspace not found' },
      });
      return;
    }

    const { name, slug, workspace_type } = parsed.data;

    // Check slug uniqueness if changing slug
    if (slug) {
      const slugCheck = await query('SELECT id FROM workspaces WHERE slug = $1 AND id != $2', [
        slug,
        req.params.id,
      ]);
      if (slugCheck.rows.length > 0) {
        res.status(409).json({
          error: { code: 'CONFLICT', message: 'A workspace with this slug already exists' },
        });
        return;
      }
    }

    // Build dynamic SET clause from provided fields
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (name !== undefined) {
      setClauses.push(`name = $${idx++}`);
      values.push(name);
    }
    if (slug !== undefined) {
      setClauses.push(`slug = $${idx++}`);
      values.push(slug);
    }
    if (workspace_type !== undefined) {
      setClauses.push(`workspace_type = $${idx++}`);
      values.push(workspace_type);
    }

    if (setClauses.length === 0) {
      res.status(422).json({
        error: { code: 'VALIDATION_ERROR', message: 'No fields to update' },
      });
      return;
    }

    values.push(req.params.id);
    const result = await query(
      `UPDATE workspaces SET ${setClauses.join(', ')} WHERE id = $${idx}
       RETURNING id, name, slug, workspace_type, created_at`,
      values,
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update workspace error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update workspace' },
    });
  }
});

// --- DELETE /api/workspaces/:id — delete workspace (admin only, hard delete cascades) ---

router.delete('/:id', requireSession, async (req: Request, res: Response) => {
  try {
    if (!requireAdmin(req, res)) return;

    const existing = await query('SELECT id FROM workspaces WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Workspace not found' },
      });
      return;
    }

    await query('DELETE FROM workspaces WHERE id = $1', [req.params.id]);

    res.json({ message: 'Workspace deleted successfully' });
  } catch (err) {
    console.error('Delete workspace error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete workspace' },
    });
  }
});

export default router;
