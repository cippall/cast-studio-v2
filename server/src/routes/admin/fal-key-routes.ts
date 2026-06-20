/**
 * fal.ai API key management routes.
 * POST/DELETE /api/admin/fal-key — save/disconnect encrypted key
 * POST /api/admin/fal-key/test — test connection
 * GET /api/admin/fal-key/status — check if key is configured
 */
import { Router } from 'express';
import { query } from '../../db/pool.js';
import { encrypt } from '../../utils/encryption.js';
import { saveFalKeySchema, testFalKeySchema } from './validation.js';

const router = Router();

// -------------------------------------------------------------------
// POST /api/admin/fal-key — save encrypted key
// -------------------------------------------------------------------
router.post('/fal-key', async (req, res) => {
  try {
    const parse = saveFalKeySchema.safeParse(req.body);
    if (!parse.success) {
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'api_key is required',
          details: parse.error.flatten().fieldErrors,
        },
      });
      return;
    }
    const { api_key } = parse.data;

    const workspaceId = req.workspace?.id;
    if (!workspaceId) {
      res.status(400).json({
        error: { code: 'BAD_REQUEST', message: 'Workspace not found' },
      });
      return;
    }

    const encrypted = encrypt(api_key);

    // Upsert: deactivate old keys, insert new one
    await query('UPDATE fal_ai_keys SET is_active = FALSE WHERE workspace_id = $1', [workspaceId]);

    const result = await query(
      `INSERT INTO fal_ai_keys (workspace_id, encrypted_key, iv, auth_tag, is_active)
       VALUES ($1, $2, $3, $4, TRUE)
       RETURNING id, workspace_id, is_active, created_at, updated_at`,
      [workspaceId, encrypted.encrypted, encrypted.iv, encrypted.authTag],
    );

    res.status(201).json({
      data: {
        id: result.rows[0].id,
        connected: true,
        created_at: result.rows[0].created_at,
      },
    });
  } catch (err) {
    console.error('Save fal-key error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to save API key' },
    });
  }
});

// -------------------------------------------------------------------
// POST /api/admin/fal-key/test — test connection
// -------------------------------------------------------------------
router.post('/fal-key/test', async (req, res) => {
  try {
    const parse = testFalKeySchema.safeParse(req.body);
    if (!parse.success) {
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'api_key is required',
          details: parse.error.flatten().fieldErrors,
        },
      });
      return;
    }
    const { api_key } = parse.data;

    // Test against fal.ai by submitting a minimal generation request
    const testResponse = await fetch('https://queue.fal.run/fal-ai/flux-pro', {
      method: 'POST',
      headers: {
        Authorization: `Key ${api_key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'test',
        seed: 12345,
        num_images: 1,
      }),
    });

    if (testResponse.ok) {
      res.json({ data: { status: 'connected', message: 'API key is valid' } });
      return;
    }

    // 401/403 = auth failure
    if (testResponse.status === 401 || testResponse.status === 403) {
      res.status(401).json({
        error: { code: 'AUTH_FAILED', message: 'Invalid fal.ai API key' },
      });
      return;
    }

    // Other errors (404, 422, 500) mean the key works but model/params may differ
    res.json({ data: { status: 'connected', message: 'API key accepted' } });
  } catch (err) {
    console.error('Test fal-key error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to test API key' },
    });
  }
});

// -------------------------------------------------------------------
// DELETE /api/admin/fal-key — disconnect
// -------------------------------------------------------------------
router.delete('/fal-key', async (req, res) => {
  try {
    const workspaceId = req.workspace?.id;
    if (!workspaceId) {
      res.status(400).json({
        error: { code: 'BAD_REQUEST', message: 'Workspace not found' },
      });
      return;
    }

    await query('UPDATE fal_ai_keys SET is_active = FALSE WHERE workspace_id = $1', [workspaceId]);

    res.json({ data: { connected: false } });
  } catch (err) {
    console.error('Delete fal-key error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to disconnect API key' },
    });
  }
});

// -------------------------------------------------------------------
// GET /api/admin/fal-key/status — check if key is configured
// -------------------------------------------------------------------
router.get('/fal-key/status', async (req, res) => {
  try {
    const workspaceId = req.workspace?.id;
    if (!workspaceId) {
      res.status(400).json({
        error: { code: 'BAD_REQUEST', message: 'Workspace not found' },
      });
      return;
    }

    const result = await query(
      `SELECT id, created_at, updated_at
       FROM fal_ai_keys
       WHERE workspace_id = $1 AND is_active = TRUE
       LIMIT 1`,
      [workspaceId],
    );

    if (result.rows.length === 0) {
      res.json({ data: { connected: false } });
      return;
    }

    res.json({
      data: {
        connected: true,
        created_at: result.rows[0].created_at,
        updated_at: result.rows[0].updated_at,
      },
    });
  } catch (err) {
    console.error('Get fal-key status error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to check API key status' },
    });
  }
});

export default router;
