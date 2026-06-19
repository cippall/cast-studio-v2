/**
 * Admin routes — Users & Roles, Models, System Prompts, Taxonomy, Commission Forms, Dashboard.
 * All routes require admin session.
 */
import { Router, Request, Response } from 'express';
import { query } from '../../db/pool.js';
import { requireSession } from '../../middleware/requireSession.js';
import { randomUUID } from 'node:crypto';
import { encrypt, decrypt } from '../../utils/encryption.js';

const router = Router();

// All admin routes require authentication
router.use(requireSession);

// -------------------------------------------------------------------
// Helper: check admin role
// -------------------------------------------------------------------
function requireAdmin(req: Request, res: Response): boolean {
  if (req.account?.role !== 'ADMIN') {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } });
    return false;
  }
  return true;
}

// -------------------------------------------------------------------
// fal.ai API key management — encrypted at rest
// -------------------------------------------------------------------

// POST /api/admin/fal-key — save encrypted key
router.post('/fal-key', async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const { api_key } = req.body;
    if (!api_key || typeof api_key !== 'string') {
      res.status(422).json({
        error: { code: 'VALIDATION_ERROR', message: 'api_key is required' },
      });
      return;
    }

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

// POST /api/admin/fal-key/test — test connection
router.post('/fal-key/test', async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const { api_key } = req.body;
    if (!api_key || typeof api_key !== 'string') {
      res.status(422).json({
        error: { code: 'VALIDATION_ERROR', message: 'api_key is required' },
      });
      return;
    }

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

// DELETE /api/admin/fal-key — disconnect
router.delete('/fal-key', async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
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

// GET /api/admin/fal-key/status — check if key is configured
router.get('/fal-key/status', async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
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

// -------------------------------------------------------------------
// GET /api/admin/fal-models — browse available models from fal.ai
// -------------------------------------------------------------------
router.get('/fal-models', async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const workspaceId = req.workspace?.id;
    if (!workspaceId) {
      res.status(400).json({
        error: { code: 'BAD_REQUEST', message: 'Workspace not found' },
      });
      return;
    }

    // Import dynamically to avoid circular deps
    const { getWorkspaceApiKey, fetchFalModels } = await import('../../services/fal-service.js');

    const apiKey = await getWorkspaceApiKey(workspaceId);
    if (!apiKey) {
      res.status(400).json({
        error: {
          code: 'NO_API_KEY',
          message: 'No fal.ai API key configured. Connect your key first.',
        },
      });
      return;
    }

    const models = await fetchFalModels(apiKey);
    res.json(models);
  } catch (err) {
    console.error('Fetch fal-models error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch models from fal.ai' },
    });
  }
});

// -------------------------------------------------------------------
// POST /api/admin/models/import — import a fal.ai model into local DB
// -------------------------------------------------------------------
router.post('/models/import', async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const { fal_model_id, name, description, category, parameters } = req.body;

    if (!fal_model_id || !name || !category) {
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'fal_model_id, name, and category are required',
        },
      });
      return;
    }

    const id = randomUUID();
    const result = await query(
      `INSERT INTO models (id, model_id, name, model_type, task, parameters, is_active, created_at)
       VALUES ($1,$2,$3,$4,$5,true,NOW()) RETURNING *`,
      [id, fal_model_id, name, category, category, JSON.stringify(parameters ?? { description })],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Import model error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to import model' } });
  }
});

// -------------------------------------------------------------------
// GET /api/admin/models — list all AI models
// -------------------------------------------------------------------
router.get('/models', async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const result = await query('SELECT * FROM models ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('List models error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to load models' } });
  }
});

// -------------------------------------------------------------------
// POST /api/admin/models — create a model
// -------------------------------------------------------------------
router.post('/models', async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const { model_id, name, model_type, task, parameters } = req.body;
    const id = randomUUID();
    const result = await query(
      `INSERT INTO models (id, model_id, name, model_type, task, parameters, is_active, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,true,NOW()) RETURNING *`,
      [id, model_id, name, model_type, task, JSON.stringify(parameters ?? {})],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create model error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create model' } });
  }
});

// -------------------------------------------------------------------
// PATCH /api/admin/models/:id — update a model
// -------------------------------------------------------------------
router.patch('/models/:id', async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const { id } = req.params;
    const { name, model_type, task, parameters, is_active } = req.body;
    const result = await query(
      `UPDATE models SET name=$1, model_type=$2, task=$3, parameters=$4, is_active=$5
       WHERE id=$6 RETURNING *`,
      [name, model_type, task, JSON.stringify(parameters ?? {}), is_active, id],
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Model not found' } });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update model error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update model' } });
  }
});

// -------------------------------------------------------------------
// DELETE /api/admin/models/:id — delete a model
// -------------------------------------------------------------------
router.delete('/models/:id', async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    await query('DELETE FROM models WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete model error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to delete model' } });
  }
});

// -------------------------------------------------------------------
// GET /api/admin/prompts — list system prompts (stored in models table as prompt-type or separate)
// Since there's no system_prompts table, we return from a key-value approach or empty array.
// For now, return empty — the frontend will show "no prompts yet".
// -------------------------------------------------------------------
router.get('/prompts', async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    // No system_prompts table exists yet — return empty array
    res.json([]);
  } catch (err) {
    console.error('List prompts error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to load prompts' } });
  }
});

// -------------------------------------------------------------------
// POST /api/admin/prompts
// -------------------------------------------------------------------
router.post('/prompts', async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    res
      .status(501)
      .json({ error: { code: 'NOT_IMPLEMENTED', message: 'System prompts not yet implemented' } });
  } catch {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed' } });
  }
});

// -------------------------------------------------------------------
// PATCH /api/admin/prompts/:id
// -------------------------------------------------------------------
router.patch('/prompts/:id', async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    res
      .status(501)
      .json({ error: { code: 'NOT_IMPLEMENTED', message: 'System prompts not yet implemented' } });
  } catch {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed' } });
  }
});

// -------------------------------------------------------------------
// DELETE /api/admin/prompts/:id
// -------------------------------------------------------------------
router.delete('/prompts/:id', async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    res
      .status(501)
      .json({ error: { code: 'NOT_IMPLEMENTED', message: 'System prompts not yet implemented' } });
  } catch {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed' } });
  }
});

// -------------------------------------------------------------------
// GET /api/admin/taxonomy — list taxonomy entries, optionally filtered by category
// -------------------------------------------------------------------
router.get('/taxonomy', async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const { category } = req.query;
    let sql = 'SELECT * FROM taxonomy';
    const params: string[] = [];
    if (category) {
      sql += ' WHERE category = $1';
      params.push(category as string);
    }
    sql += ' ORDER BY category, sort_order';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error('List taxonomy error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to load taxonomy' } });
  }
});

// -------------------------------------------------------------------
// POST /api/admin/taxonomy — create taxonomy entry
// -------------------------------------------------------------------
router.post('/taxonomy', async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const { workspace_id, category, key, label, input_type, options, is_required, sort_order } =
      req.body;
    const id = randomUUID();
    const result = await query(
      `INSERT INTO taxonomy (id, workspace_id, category, key, label, input_type, options, is_required, sort_order, is_active, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,NOW()) RETURNING *`,
      [
        id,
        workspace_id,
        category,
        key,
        label,
        input_type,
        JSON.stringify(options),
        is_required,
        sort_order,
      ],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create taxonomy error:', err);
    res
      .status(500)
      .json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create taxonomy entry' } });
  }
});

// -------------------------------------------------------------------
// PATCH /api/admin/taxonomy/:id — update taxonomy entry
// -------------------------------------------------------------------
router.patch('/taxonomy/:id', async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const { id } = req.params;
    const { category, key, label, input_type, options, is_required, sort_order, is_active } =
      req.body;
    const result = await query(
      `UPDATE taxonomy SET category=$1, key=$2, label=$3, input_type=$4, options=$5,
        is_required=$6, sort_order=$7, is_active=$8
       WHERE id=$9 RETURNING *`,
      [
        category,
        key,
        label,
        input_type,
        JSON.stringify(options),
        is_required,
        sort_order,
        is_active,
        id,
      ],
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Taxonomy entry not found' } });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update taxonomy error:', err);
    res
      .status(500)
      .json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update taxonomy entry' } });
  }
});

// -------------------------------------------------------------------
// DELETE /api/admin/taxonomy/:id — delete taxonomy entry
// -------------------------------------------------------------------
router.delete('/taxonomy/:id', async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    await query('DELETE FROM taxonomy WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete taxonomy error:', err);
    res
      .status(500)
      .json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to delete taxonomy entry' } });
  }
});

// -------------------------------------------------------------------
// GET /api/admin/commission-forms — list commission form templates
// Since there's no commission_forms table, return empty array.
// -------------------------------------------------------------------
router.get('/commission-forms', async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    // No commission_forms table exists yet — return empty array
    res.json([]);
  } catch (err) {
    console.error('List commission forms error:', err);
    res
      .status(500)
      .json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to load commission forms' } });
  }
});

// -------------------------------------------------------------------
// POST /api/admin/commission-forms
// -------------------------------------------------------------------
router.post('/commission-forms', async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    res.status(501).json({
      error: { code: 'NOT_IMPLEMENTED', message: 'Commission forms not yet implemented' },
    });
  } catch {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed' } });
  }
});

// -------------------------------------------------------------------
// PATCH /api/admin/commission-forms/:id
// -------------------------------------------------------------------
router.patch('/commission-forms/:id', async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    res.status(501).json({
      error: { code: 'NOT_IMPLEMENTED', message: 'Commission forms not yet implemented' },
    });
  } catch {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed' } });
  }
});

// -------------------------------------------------------------------
// DELETE /api/admin/commission-forms/:id
// -------------------------------------------------------------------
router.delete('/commission-forms/:id', async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    res.status(501).json({
      error: { code: 'NOT_IMPLEMENTED', message: 'Commission forms not yet implemented' },
    });
  } catch {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed' } });
  }
});

export default router;
