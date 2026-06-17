import { Request, Response, NextFunction } from 'express';
import { query } from '../db/pool.js';

export interface WorkspaceRow {
  id: string;
  name: string;
  slug: string;
  workspace_type: string;
  created_at: string;
}

/**
 * Middleware that ensures req.workspace is set from req.account.workspace_id.
 * Must be used after requireSession or requireApiKey (req.account must be set).
 * Skips DB query if req.workspace is already loaded.
 */
export async function requireWorkspace(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.account) {
      res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
      return;
    }

    // Already resolved by prior middleware (requireSession / requireApiKey)
    if (req.workspace) {
      next();
      return;
    }

    const result = await query('SELECT * FROM workspaces WHERE id = $1', [
      req.account.workspace_id,
    ]);

    if (result.rows.length === 0) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Workspace not found' },
      });
      return;
    }

    req.workspace = result.rows[0] as WorkspaceRow;
    next();
  } catch (err) {
    console.error('requireWorkspace error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Workspace resolution failed' },
    });
  }
}
