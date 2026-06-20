/**
 * fal.ai model browsing routes.
 * GET /api/admin/fal-models — browse available models from fal.ai
 */
import { Router } from 'express';

const router = Router();

// -------------------------------------------------------------------
// GET /api/admin/fal-models — browse available models from fal.ai
// -------------------------------------------------------------------
router.get('/fal-models', async (req, res) => {
  try {
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

export default router;
