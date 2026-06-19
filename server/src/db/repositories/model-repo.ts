import { query } from '../pool.js';

export interface ModelRow {
  id: string;
  model_id: string;
  name: string;
  model_type: string;
  task: string;
  parameters: Record<string, unknown>;
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
 * Find a single active model by its model_id string (e.g. "fal-ai/flux/pro").
 */
export async function findActiveModel(modelId: string): Promise<ModelRow | null> {
  const result = await query('SELECT * FROM models WHERE model_id = $1 AND is_active = TRUE', [
    modelId,
  ]);
  return (result.rows[0] as ModelRow) ?? null;
}
