/**
 * System prompt routes (placeholder — not yet implemented).
 * GET/POST/PATCH/DELETE /api/admin/prompts — stub endpoints
 */
import { Router } from 'express';

const router = Router();

// -------------------------------------------------------------------
// GET /api/admin/prompts — list system prompts
// -------------------------------------------------------------------
router.get('/prompts', async (_req, res) => {
  // No system_prompts table exists yet — return empty array
  res.json([]);
});

// -------------------------------------------------------------------
// POST /api/admin/prompts
// -------------------------------------------------------------------
router.post('/prompts', async (_req, res) => {
  res
    .status(501)
    .json({ error: { code: 'NOT_IMPLEMENTED', message: 'System prompts not yet implemented' } });
});

// -------------------------------------------------------------------
// PATCH /api/admin/prompts/:id
// -------------------------------------------------------------------
router.patch('/prompts/:id', async (_req, res) => {
  res
    .status(501)
    .json({ error: { code: 'NOT_IMPLEMENTED', message: 'System prompts not yet implemented' } });
});

// -------------------------------------------------------------------
// DELETE /api/admin/prompts/:id
// -------------------------------------------------------------------
router.delete('/prompts/:id', async (_req, res) => {
  res
    .status(501)
    .json({ error: { code: 'NOT_IMPLEMENTED', message: 'System prompts not yet implemented' } });
});

export default router;
