import { query } from '../pool.js';

export interface ModelRow {
  id: string;
  model_id: string;
  name: string;
  model_type: string;
  task: string;
  parameters: Record<string, unknown>;
  input_schema: Record<string, unknown> | null;
  is_active: boolean;
  created_at: string;
}

/**
 * List all active models in the system.
 * Models are global (not workspace-scoped) — admins configure the catalog,
 * workspaces use whichever active models they want.
 */
export async function listActiveModels(): Promise<ModelRow[]> {
  const result = await query(
    'SELECT * FROM models WHERE is_active = TRUE ORDER BY created_at DESC',
  );
  return result.rows as ModelRow[];
}

/**
 * Find a single active model by its task type (e.g. "actor_generation").
 * Returns the most recently created active model for that task.
 */
export async function findModelByTask(task: string): Promise<ModelRow | null> {
  const result = await query(
    'SELECT * FROM models WHERE task = $1 AND is_active = TRUE ORDER BY created_at DESC LIMIT 1',
    [task],
  );
  return (result.rows[0] as ModelRow) ?? null;
}

/**
 * Find a single active model by its model_id string (e.g. "fal-ai/flux/pro").
 */
export async function findActiveModel(modelId: string): Promise<ModelRow | null> {
  const result = await query('SELECT * FROM models WHERE model_id = $1 AND is_active = TRUE', [
    modelId,
  ]);
  return (result.rows[0] as ModelRow) ?? null;
}

/**
 * Update the input_schema JSON for a model.
 */
export async function updateModelSchema(
  id: string,
  inputSchema: Record<string, unknown>,
): Promise<void> {
  await query('UPDATE models SET input_schema = $1 WHERE id = $2', [id, inputSchema]);
}
