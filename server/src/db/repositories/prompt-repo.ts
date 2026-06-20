import { query } from '../pool.js';

export interface SystemPromptRow {
  id: string;
  task: string;
  template: string;
  variables: string[];
  updated_at: string;
  created_at: string;
}

export async function listPrompts(): Promise<SystemPromptRow[]> {
  const result = await query('SELECT * FROM system_prompts ORDER BY task');
  return result.rows as SystemPromptRow[];
}

export async function findPromptByTask(task: string): Promise<SystemPromptRow | null> {
  const result = await query('SELECT * FROM system_prompts WHERE task = $1', [task]);
  return (result.rows[0] as SystemPromptRow) ?? null;
}

export async function createPrompt(
  task: string,
  template: string,
  variables: string[],
): Promise<SystemPromptRow> {
  const result = await query(
    `INSERT INTO system_prompts (task, template, variables)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [task, template, JSON.stringify(variables)],
  );
  return result.rows[0] as SystemPromptRow;
}

export async function updatePrompt(
  id: string,
  template: string,
  variables: string[],
): Promise<SystemPromptRow | null> {
  const result = await query(
    `UPDATE system_prompts
     SET template = $1, variables = $2, updated_at = NOW()
     WHERE id = $3
     RETURNING *`,
    [template, JSON.stringify(variables), id],
  );
  return (result.rows[0] as SystemPromptRow) ?? null;
}

export async function deletePrompt(id: string): Promise<boolean> {
  const result = await query('DELETE FROM system_prompts WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}
