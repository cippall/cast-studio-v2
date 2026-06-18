/**
 * Admin routes — Users & Roles, Models, System Prompts, Taxonomy, Commission Forms, Dashboard.
 * All routes require admin session.
 */
import { Router, Request, Response } from 'express';
import { query } from '../../db/pool.js';
import { requireSession } from '../../middleware/requireSession.js';
import { randomUUID } from 'node:crypto';

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
// GET /api/admin/models — list all AI models
// -------------------------------------------------------------------
router.get('/models', async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const result = await query('SELECT * FROM models ORDER BY created_at DESC');
    res.json(result.rows);
  } catch {
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
  } catch {
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
  } catch {
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
  } catch {
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
  } catch {
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
    res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'System prompts not yet implemented' } });
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
    res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'System prompts not yet implemented' } });
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
    res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'System prompts not yet implemented' } });
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
  } catch {
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
    const { workspace_id, category, key, label, input_type, options, is_required, sort_order } = req.body;
    const id = randomUUID();
    const result = await query(
      `INSERT INTO taxonomy (id, workspace_id, category, key, label, input_type, options, is_required, sort_order, is_active, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,NOW()) RETURNING *`,
      [id, workspace_id, category, key, label, input_type, JSON.stringify(options), is_required, sort_order],
    );
    res.status(201).json(result.rows[0]);
  } catch {
    console.error('Create taxonomy error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create taxonomy entry' } });
  }
});

// -------------------------------------------------------------------
// PATCH /api/admin/taxonomy/:id — update taxonomy entry
// -------------------------------------------------------------------
router.patch('/taxonomy/:id', async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const { id } = req.params;
    const { category, key, label, input_type, options, is_required, sort_order, is_active } = req.body;
    const result = await query(
      `UPDATE taxonomy SET category=$1, key=$2, label=$3, input_type=$4, options=$5,
        is_required=$6, sort_order=$7, is_active=$8
       WHERE id=$9 RETURNING *`,
      [category, key, label, input_type, JSON.stringify(options), is_required, sort_order, is_active, id],
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Taxonomy entry not found' } });
      return;
    }
    res.json(result.rows[0]);
  } catch {
    console.error('Update taxonomy error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update taxonomy entry' } });
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
  } catch {
    console.error('Delete taxonomy error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to delete taxonomy entry' } });
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
  } catch {
    console.error('List commission forms error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to load commission forms' } });
  }
});

// -------------------------------------------------------------------
// POST /api/admin/commission-forms
// -------------------------------------------------------------------
router.post('/commission-forms', async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Commission forms not yet implemented' } });
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
    res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Commission forms not yet implemented' } });
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
    res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Commission forms not yet implemented' } });
  } catch {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed' } });
  }
});

export default router;
