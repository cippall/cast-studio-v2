import { Request, Response, NextFunction } from 'express';
import { query } from '../db/pool.js';

// --- Types ---

export interface AccountRow {
  id: string;
  workspace_id: string;
  name: string;
  email: string;
  role: string;
  is_api_able: boolean;
  password_hash: string;
  created_at: string;
}

/**
 * Middleware that resolves a session cookie to an account.
 * Attaches req.account on success.
 * Returns 401 if no session, account not found, or DB error.
 * Workspace loading is handled by requireWorkspace — compose it after
 * this middleware if the route needs req.workspace.
 */
export async function requireSession(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const accountId = req.session?.accountId;

    if (!accountId) {
      res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
      });
      return;
    }

    const result = await query('SELECT * FROM accounts WHERE id = $1', [accountId]);

    if (result.rows.length === 0) {
      req.session.destroy(() => {});
      res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Account not found' },
      });
      return;
    }

    req.account = result.rows[0] as AccountRow;

    next();
  } catch (err) {
    console.error('requireSession error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Authentication failed' },
    });
  }
}
