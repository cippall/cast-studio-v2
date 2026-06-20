import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db/pool.js';
import type { AccountRow } from './requireSession.js';
import type { WorkspaceRow } from './requireWorkspace.js';

/**
 * Middleware that resolves a Bearer API key to an account and workspace.
 * Attaches req.account and req.workspace on success.
 * Returns 401 if no/invalid key, key is inactive, account not found, or account not API-able.
 */
export async function requireApiKey(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Missing or invalid API key' },
      });
      return;
    }

    const key = authHeader.slice('Bearer '.length).trim();
    if (!key) {
      res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Missing API key' },
      });
      return;
    }

    // Fetch all active keys and find one matching via bcrypt compare
    // This is necessary because bcrypt is non-deterministic — we can't
    // pre-hash the incoming key for a WHERE clause lookup.
    const result = await query('SELECT * FROM api_keys WHERE is_active = true');

    if (result.rows.length === 0) {
      res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Invalid API key' },
      });
      return;
    }

    let matchedKey: Record<string, unknown> | null = null;
    for (const row of result.rows) {
      const match = await bcrypt.compare(key, row.key_hash);
      if (match) {
        matchedKey = row;
        break;
      }
    }

    if (!matchedKey) {
      res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Invalid API key' },
      });
      return;
    }

    // Load account
    const accountResult = await query('SELECT * FROM accounts WHERE id = $1 ', [
      matchedKey.account_id,
    ]);

    if (accountResult.rows.length === 0) {
      res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Account not found' },
      });
      return;
    }

    const account = accountResult.rows[0] as AccountRow;

    if (!account.is_api_able) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Account is not API-enabled',
        },
      });
      return;
    }

    req.account = account;

    // Load workspace
    const wsResult = await query('SELECT * FROM workspaces WHERE id = $1', [account.workspace_id]);
    if (wsResult.rows.length > 0) {
      req.workspace = wsResult.rows[0] as WorkspaceRow;
    }

    // Update last_used_at (fire-and-forget)
    query('UPDATE api_keys SET last_used_at = NOW() WHERE id = $1', [matchedKey.id]).catch(
      () => {},
    );

    next();
  } catch (err) {
    console.error('requireApiKey error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Authentication failed' },
    });
  }
}
