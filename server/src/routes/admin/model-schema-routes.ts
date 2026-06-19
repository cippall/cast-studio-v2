/**
 * Model schema routes.
 * GET /api/admin/models/:id/schema — fetch parameter schema from fal.ai
 */
import { Router, Request, Response } from 'express';
import { query } from '../../db/pool.js';

const router = Router();

// All model schema routes require admin role
router.use((req: Request, res: Response, next) => {
  if (req.account?.role !== 'ADMIN') {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } });
    return;
  }
  next();
});

// -------------------------------------------------------------------
// GET /api/admin/models/:id/schema — fetch parameter schema from fal.ai
// -------------------------------------------------------------------
router.get('/models/:id/schema', async (req, res) => {
  try {
    const { id } = req.params;

    // Look up the model to get its model_id
    const modelResult = await query('SELECT model_id FROM models WHERE id = $1', [id]);
    if (modelResult.rows.length === 0) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Model not found' } });
      return;
    }

    const modelId = modelResult.rows[0].model_id;

    // Fetch schema from fal.ai REST API
    const { getWorkspaceApiKey } = await import('../../services/fal-service.js');
    const workspaceId = req.workspace?.id;
    if (!workspaceId) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Workspace not found' } });
      return;
    }

    const apiKey = await getWorkspaceApiKey(workspaceId);
    if (!apiKey) {
      res.status(400).json({
        error: { code: 'NO_API_KEY', message: 'No fal.ai API key configured' },
      });
      return;
    }

    const schemaRes = await fetch(`https://rest.fal.ai/${modelId}/schema`, {
      headers: { Authorization: `Key ${apiKey}` },
    });

    if (!schemaRes.ok) {
      // If schema endpoint fails, return empty schema (model may not expose one)
      res.json({ input: {}, output: {} });
      return;
    }

    const schemaData = (await schemaRes.json()) as {
      input?: { properties?: Record<string, unknown> };
      output?: { properties?: Record<string, unknown> };
    };

    res.json({
      input: schemaData.input?.properties ?? {},
      output: schemaData.output?.properties ?? {},
    });
  } catch (err) {
    console.error('Fetch model schema error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch model schema' },
    });
  }
});

export default router;
