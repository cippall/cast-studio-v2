/**
 * System prompt CRUD routes.
 * GET    /api/admin/prompts      — list all system prompts
 * POST   /api/admin/prompts      — create a system prompt
 * PATCH  /api/admin/prompts/:id  — update a system prompt
 * DELETE /api/admin/prompts/:id  — delete a system prompt
 */
import { Router } from 'express';
import {
  listPrompts,
  createPrompt,
  updatePrompt,
  deletePrompt,
} from '../../db/repositories/prompt-repo.js';
import { createPromptSchema, updatePromptSchema } from './validation.js';

const router = Router();

// -------------------------------------------------------------------
// GET /api/admin/prompts — list all system prompts
// -------------------------------------------------------------------
router.get('/prompts', async (_req, res) => {
  try {
    const prompts = await listPrompts();
    res.json(prompts);
  } catch (err) {
    console.error('List prompts error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to load prompts' } });
  }
});

// -------------------------------------------------------------------
// POST /api/admin/prompts — create a system prompt
// -------------------------------------------------------------------
router.post('/prompts', async (req, res) => {
  try {
    const parse = createPromptSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'task, template, and variables are required',
          details: parse.error.flatten().fieldErrors,
        },
      });
      return;
    }
    const { task, template, variables } = parse.data;

    const prompt = await createPrompt(task, template, variables);
    res.status(201).json(prompt);
  } catch (err) {
    console.error('Create prompt error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create prompt' } });
  }
});

// -------------------------------------------------------------------
// PATCH /api/admin/prompts/:id — update a system prompt
// -------------------------------------------------------------------
router.patch('/prompts/:id', async (req, res) => {
  try {
    const parse = updatePromptSchema.safeParse(req.body);
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
    const { template, variables } = parse.data;

    const updateParams: { template?: string; variables?: string[] } = {};
    if (template !== undefined) updateParams.template = template;
    if (variables !== undefined) updateParams.variables = variables;

    const prompt = await updatePrompt(
      id,
      updateParams.template ?? '',
      updateParams.variables ?? [],
    );
    if (!prompt) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Prompt not found' } });
      return;
    }
    res.json(prompt);
  } catch (err) {
    console.error('Update prompt error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update prompt' } });
  }
});

// -------------------------------------------------------------------
// DELETE /api/admin/prompts/:id — delete a system prompt
// -------------------------------------------------------------------
router.delete('/prompts/:id', async (req, res) => {
  try {
    const deleted = await deletePrompt(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Prompt not found' } });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Delete prompt error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to delete prompt' } });
  }
});

export default router;
