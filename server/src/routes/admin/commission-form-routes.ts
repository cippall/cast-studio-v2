/**
 * Commission Form CRUD routes.
 * GET    /api/admin/commission-forms — list all commission form templates
 * POST   /api/admin/commission-forms — create a commission form template
 * PATCH  /api/admin/commission-forms/:id — update a commission form template
 * DELETE /api/admin/commission-forms/:id — delete a commission form template
 */
import { Router } from 'express';
import { query } from '../../db/pool.js';
import { randomUUID } from 'node:crypto';
import { createCommissionFormSchema, updateCommissionFormSchema } from './validation.js';

const router = Router();

// -------------------------------------------------------------------
// GET /api/admin/commission-forms — list all commission form templates
// -------------------------------------------------------------------
router.get('/commission-forms', async (req, res) => {
  try {
    const result = await query('SELECT * FROM commission_forms ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('List commission forms error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to load commission forms' },
    });
  }
});

// -------------------------------------------------------------------
// POST /api/admin/commission-forms — create a commission form template
// -------------------------------------------------------------------
router.post('/commission-forms', async (req, res) => {
  try {
    const parse = createCommissionFormSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'name and fields are required',
          details: parse.error.flatten().fieldErrors,
        },
      });
      return;
    }
    const { name, fields, is_active } = parse.data;

    const id = randomUUID();
    const result = await query(
      `INSERT INTO commission_forms (id, name, fields, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING *`,
      [id, name, JSON.stringify(fields), is_active ?? true],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create commission form error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create commission form' },
    });
  }
});

// -------------------------------------------------------------------
// PATCH /api/admin/commission-forms/:id — update a commission form template
// -------------------------------------------------------------------
router.patch('/commission-forms/:id', async (req, res) => {
  try {
    const parse = updateCommissionFormSchema.safeParse(req.body);
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
    const { name, fields, is_active } = parse.data;

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (fields !== undefined) {
      setClauses.push(`fields = $${paramIndex++}`);
      values.push(JSON.stringify(fields));
    }
    if (is_active !== undefined) {
      setClauses.push(`is_active = $${paramIndex++}`);
      values.push(is_active);
    }

    if (setClauses.length === 0) {
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'No fields to update',
        },
      });
      return;
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(id);

    const result = await query(
      `UPDATE commission_forms SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Commission form not found' },
      });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update commission form error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update commission form' },
    });
  }
});

// -------------------------------------------------------------------
// DELETE /api/admin/commission-forms/:id — delete a commission form template
// -------------------------------------------------------------------
router.delete('/commission-forms/:id', async (req, res) => {
  try {
    const result = await query('DELETE FROM commission_forms WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Commission form not found' },
      });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Delete commission form error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete commission form' },
    });
  }
});

export default router;
