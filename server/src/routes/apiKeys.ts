import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { requireSession } from '../middleware/requireSession.js';
import { generateApiKey } from '../utils/keyGeneration.js';

const router = Router();

// --- Validation schemas ---

const createKeySchema = z.object({
  name: z.string().min(1, 'Key name is required').max(255),
});

const apiKeyParamsSchema = z.object({
  id: z.string().uuid('Invalid API key ID'),
});

// --- POST /api/api-keys — Create a new API key ---

router.post('/', requireSession, async (req, res) => {
  try {
    const account = req.account!;

    if (!account.is_api_able) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Account is not API-enabled',
        },
      });
      return;
    }

    const parsed = createKeySchema.safeParse(req.body);
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

    const { name } = parsed.data;
    const { rawKey } = generateApiKey();
    const keyHash = await bcrypt.hash(rawKey, 10);

    const result = await query(
      `INSERT INTO api_keys (account_id, key_hash, name, is_active)
       VALUES ($1, $2, $3, TRUE)
       RETURNING id, name, is_active, created_at, account_id`,
      [account.id, keyHash, name],
    );

    const created = result.rows[0];

    res.status(201).json({
      id: created.id,
      name: created.name,
      key: rawKey, // Full key — only returned once
      is_active: created.is_active,
      created_at: created.created_at,
    });
  } catch (err) {
    console.error('Create API key error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create API key' },
    });
  }
});

// --- GET /api/api-keys — List all keys for the authenticated account ---

router.get('/', requireSession, async (req, res) => {
  try {
    const account = req.account!;

    const result = await query(
      `SELECT id, name, key_hash, is_active, created_at, last_used_at
       FROM api_keys
       WHERE account_id = $1
       ORDER BY created_at DESC`,
      [account.id],
    );

    const data = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      key: 'cs_live_...xxxx', // Masked — full key only shown on creation
      is_active: row.is_active,
      created_at: row.created_at,
      last_used_at: row.last_used_at,
    }));

    res.json({ data });
  } catch (err) {
    console.error('List API keys error:', err);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to list API keys',
      },
    });
  }
});

// --- DELETE /api/api-keys/:id — Revoke an API key ---

router.delete('/:id', requireSession, async (req, res) => {
  try {
    const account = req.account!;
    const parsed = apiKeyParamsSchema.safeParse(req.params);

    if (!parsed.success) {
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid API key ID',
          details: parsed.error.flatten().fieldErrors,
        },
      });
      return;
    }

    const { id } = parsed.data;

    const result = await query(
      `UPDATE api_keys SET is_active = FALSE
       WHERE id = $1 AND account_id = $2
       RETURNING id, name, is_active`,
      [id, account.id],
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'API key not found' },
      });
      return;
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Revoke API key error:', err);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to revoke API key',
      },
    });
  }
});

export default router;
