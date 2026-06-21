import {
  listActiveModels,
  findActiveModel,
  findModelByTask,
} from '../../db/repositories/model-repo.js';
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
 * Resolution order:
 * 1. If a specific model is requested, validate it against active models.
 * 2. If a task is provided, look up the model assigned to that task.
 * 3. Fall back to the first active model.
 * 4. Fall back to DEFAULT_MODEL if nothing is configured.
 */
export async function resolveModel(requestedModel?: string, task?: string): Promise<string> {
  const activeModels = await listActiveModels();
  const activeModelIds = activeModels.map((m) => m.model_id);

  // 1. Specific model requested — validate it
  if (requestedModel) {
    const found = await findActiveModel(requestedModel);
    if (found) {
      return found.model_id;
    }
    throw new InvalidModelError(requestedModel, activeModelIds);
  }

  // 2. Task-based lookup — find model assigned to this task
  if (task) {
    const taskModel = await findModelByTask(task);
    if (taskModel) {
      return taskModel.model_id;
    }
  }

  // 3. First active model
  if (activeModels.length > 0) {
    return activeModels[0].model_id;
  }

  // 4. Hardcoded fallback
  return DEFAULT_MODEL;
}
