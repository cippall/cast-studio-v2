import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { requireSession } from '../middleware/requireSession.js';

const router = Router();

// --- Validation schemas ---

const updateAccountSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    is_api_able: z.boolean().optional(),
  })
  .refine((data) => data.name !== undefined || data.is_api_able !== undefined, {
    message: 'At least one field (name or is_api_able) must be provided',
  });

const accountParamsSchema = z.object({
  id: z.string().uuid('Invalid account ID'),
});

/**
 * Strip the password_hash field from an account object.
 */
function stripHash(account: Record<string, unknown>): Record<string, unknown> {
  const { password_hash: _pw, ...rest } = account;
  void _pw;
  return rest;
}

// --- PATCH /api/accounts/:id — Update account (name, is_api_able) ---

router.patch('/:id', requireSession, async (req, res) => {
  try {
    const parsedParams = accountParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid account ID',
          details: parsedParams.error.flatten().fieldErrors,
        },
      });
      return;
    }

    const parsed = updateAccountSchema.safeParse(req.body);
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

    const { id } = parsedParams.data;
    const { name, is_api_able } = parsed.data;
    const currentAccount = req.account!;

    // Admin can update any account; non-admin can only update their own name
    const isAdmin = currentAccount.role === 'ADMIN';
    const isOwnAccount = currentAccount.id === id;

    if (!isAdmin && !isOwnAccount) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Not authorized to update this account',
        },
      });
      return;
    }

    // Only admins can toggle is_api_able
    if (is_api_able !== undefined && !isAdmin) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Only admins can toggle API access',
        },
      });
      return;
    }

    // Fetch the current account row to verify it exists
    const targetResult = await query(
      'SELECT id, workspace_id, role, is_api_able FROM accounts WHERE id = $1 AND deleted_at IS NULL',
      [id],
    );

    if (targetResult.rows.length === 0) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Account not found' },
      });
      return;
    }

    const targetAccount = targetResult.rows[0];

    // Build update SET clause
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      values.push(name);
    }

    if (is_api_able !== undefined) {
      setClauses.push(`is_api_able = $${paramIndex++}`);
      values.push(is_api_able);
    }

    if (setClauses.length === 0) {
      res.status(200).json(stripHash(targetAccount));
      return;
    }

    values.push(id);
    const result = await query(
      `UPDATE accounts SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, name, email, role, workspace_id, is_api_able, created_at`,
      values,
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update account error:', err);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update account',
      },
    });
  }
});

export default router;
