/**
 * AI Model CRUD routes.
 * POST /api/admin/models/import — import a fal.ai model
 * GET /api/admin/models — list all models
 * POST /api/admin/models — create a model
 * PATCH /api/admin/models/:id — update a model
 * DELETE /api/admin/models/:id — delete a model
 */
import { Router, Request, Response } from 'express';
import { query } from '../../db/pool.js';
import { randomUUID } from 'node:crypto';
import { importModelSchema, createModelSchema, updateModelSchema } from './validation.js';

const router = Router();

// All model routes require admin role
router.use((req: Request, res: Response, next) => {
  if (req.account?.role !== 'ADMIN') {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } });
    return;
  }
  next();
});

// -------------------------------------------------------------------
// POST /api/admin/models/import — import a fal.ai model into local DB
// -------------------------------------------------------------------
router.post('/models/import', async (req, res) => {
  try {
    const parse = importModelSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'fal_model_id, name, and category are required',
          details: parse.error.flatten().fieldErrors,
        },
      });
      return;
    }
    const { fal_model_id, name, category, parameters } = parse.data;

    const id = randomUUID();
    const result = await query(
      `INSERT INTO models (id, model_id, name, model_type, task, parameters, is_active, created_at)
       VALUES ($1,$2,$3,$4,$5,true,NOW()) RETURNING *`,
      [id, fal_model_id, name, category, category, JSON.stringify(parameters ?? {})],
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
    const parse = createModelSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'model_id and name are required',
          details: parse.error.flatten().fieldErrors,
        },
      });
      return;
    }
    const { model_id, name, model_type, task, parameters } = parse.data;

    const id = randomUUID();
    const result = await query(
      `INSERT INTO models (id, model_id, name, model_type, task, parameters, is_active, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,true,NOW()) RETURNING *`,
      [id, model_id, name, model_type ?? null, task ?? null, JSON.stringify(parameters ?? {})],
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
    const parse = updateModelSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid update payload',
          details: parse.error.flatten().fieldErrors,
        },
      });
      return;
    }
    const { id } = req.params;
    const { name, model_type, task, parameters, is_active } = parse.data;

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
    await query('DELETE FROM models WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete model error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to delete model' } });
  }
});

export default router;
