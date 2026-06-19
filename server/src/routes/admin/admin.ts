/**
 * Admin routes — router setup + auth middleware.
 * Sub-routes are mounted from separate files:
 *   - fal-key-routes.ts    fal.ai key management
 *   - fal-models-routes.ts fal.ai model browsing
 *   - model-routes.ts      AI model CRUD
 *   - model-schema-routes.ts model parameter schema
 *   - prompt-routes.ts     system prompts (placeholder)
 *   - taxonomy-routes.ts   taxonomy CRUD
 *
 * All routes require admin session.
 */
import { Router } from 'express';
import { requireSession } from '../../middleware/requireSession.js';
import falKeyRoutes from './fal-key-routes.js';
import falModelsRoutes from './fal-models-routes.js';
import modelRoutes from './model-routes.js';
import modelSchemaRoutes from './model-schema-routes.js';
import promptRoutes from './prompt-routes.js';
import taxonomyRoutes from './taxonomy-routes.js';

const router = Router();

// All admin routes require authentication
router.use(requireSession);

// Mount sub-routers (each handles its own admin role check via middleware)
router.use(falKeyRoutes);
router.use(falModelsRoutes);
router.use(modelRoutes);
router.use(modelSchemaRoutes);
router.use(promptRoutes);
router.use(taxonomyRoutes);

export default router;
