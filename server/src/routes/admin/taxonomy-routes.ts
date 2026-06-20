/**
 * Taxonomy CRUD routes.
 * GET /api/admin/taxonomy — list taxonomy entries
 * POST /api/admin/taxonomy — create taxonomy entry
 * PATCH /api/admin/taxonomy/:id — update taxonomy entry
 * DELETE /api/admin/taxonomy/:id — delete taxonomy entry
 */
import { Router } from 'express';
import { query } from '../../db/pool.js';
import { randomUUID } from 'node:crypto';
import { createTaxonomySchema, updateTaxonomySchema } from './validation.js';

const router = Router();

// -------------------------------------------------------------------
// GET /api/admin/taxonomy — list taxonomy entries, optionally filtered by category
// -------------------------------------------------------------------
router.get('/taxonomy', async (req, res) => {
  try {
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
    const parse = createTaxonomySchema.safeParse(req.body);
    if (!parse.success) {
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'category, key, and label are required',
          details: parse.error.flatten().fieldErrors,
        },
      });
      return;
    }
    const { workspace_id, category, key, label, input_type, options, is_required, sort_order } =
      parse.data;

    const id = randomUUID();
    const result = await query(
      `INSERT INTO taxonomy (id, workspace_id, category, key, label, input_type, options, is_required, sort_order, is_active, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,NOW()) RETURNING *`,
      [
        id,
        workspace_id ?? null,
        category,
        key,
        label,
        input_type ?? null,
        JSON.stringify(options),
        is_required ?? false,
        sort_order ?? 0,
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
    const parse = updateTaxonomySchema.safeParse(req.body);
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
    const { category, key, label, input_type, options, is_required, sort_order, is_active } =
      parse.data;

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
    const result = await query('DELETE FROM taxonomy WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Taxonomy entry not found' } });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Delete taxonomy error:', err);
    res
      .status(500)
      .json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to delete taxonomy entry' } });
  }
});

export default router;
