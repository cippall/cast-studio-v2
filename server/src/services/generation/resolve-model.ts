import { listActiveModels, findActiveModel } from '../../db/repositories/model-repo.js';
import { DEFAULT_MODEL } from './generation-constants.js';

/**
 * Error thrown when a requested model is not in the workspace's active list.
 */
export class InvalidModelError extends Error {
  statusCode = 422;
  constructor(modelId: string, activeModels: string[]) {
    super(
      `Model "${modelId}" is not available. Active models: ${activeModels.join(', ') || 'none configured'}`,
    );
    this.name = 'InvalidModelError';
  }
}

/**
 * Resolve the model for a generation request.
 *
 * - If no model specified: returns the first active model's model_id,
 *   or DEFAULT_MODEL if no active models are configured.
 * - If model specified: validates it against the active models list.
 *   If found, returns it. If not found, throws InvalidModelError (422).
 */
export async function resolveModel(requestedModel?: string): Promise<string> {
  const activeModels = await listActiveModels();
  const activeModelIds = activeModels.map((m) => m.model_id);

  // No model specified — use default active model
  if (!requestedModel) {
    // If there are active models, use the first one (most recently created)
    if (activeModels.length > 0) {
      return activeModels[0].model_id;
    }
    // Fallback to hardcoded default if no models configured
    return DEFAULT_MODEL;
  }

  // Model specified — validate against active models
  const found = await findActiveModel(requestedModel);
  if (found) {
    return found.model_id;
  }

  // Model not in active list — reject with 422
  throw new InvalidModelError(requestedModel, activeModelIds);
}
