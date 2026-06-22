import {
  listActiveModels,
  findActiveModel,
  findModelByTask,
} from '../../db/repositories/model-repo.js';

/**
 * Resolved model info including provider routing.
 */
export interface ResolvedModel {
  modelId: string;
  provider: string;
  endpoint: string | null;
}

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
 * Resolution order:
 * 1. If a specific model is requested, validate it against active models.
 * 2. If a task is provided, look up the model assigned to that task.
 * 3. Fall back to the first active model.
 * 4. Throw if no models are configured — forces explicit configuration.
 */
export async function resolveModel(requestedModel?: string, task?: string): Promise<ResolvedModel> {
  const activeModels = await listActiveModels();
  const activeModelIds = activeModels.map((m) => m.model_id);

  // 1. Specific model requested — validate it
  let found: (typeof activeModels)[number] | null = null;

  if (requestedModel) {
    found = await findActiveModel(requestedModel);
    if (!found) {
      throw new InvalidModelError(requestedModel, activeModelIds);
    }
  }

  // 2. Task-based lookup — find model assigned to this task
  if (!found && task) {
    found = await findModelByTask(task);
  }

  // 3. First active model
  if (!found && activeModels.length > 0) {
    found = activeModels[0];
  }

  // 4. No models configured — fail fast
  if (!found) {
    throw new Error('No models configured. Please add models in Settings → Models.');
  }

  return {
    modelId: found.model_id,
    provider: found.provider,
    endpoint: found.endpoint,
  };
}
