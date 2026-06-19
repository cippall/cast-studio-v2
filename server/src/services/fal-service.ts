export type { FalGenerateParams, FalJobResult, FalModel, FalModelSchema } from './fal/types.js';
export {
  submitTextToImage,
  submitImageToImage,
  pollJob,
  cancelJob,
  imageToText,
} from './fal/api.js';
export { fetchFalModels } from './fal/models.js';

/**
 * Get the fal.ai API key for a specific workspace.
 * Reads from the encrypted fal_ai_keys table.
 * Returns undefined if no key configured for this workspace.
 */
export async function getWorkspaceApiKey(workspaceId: string): Promise<string | undefined> {
  const { query } = await import('../db/pool.js');
  const result = await query(
    `SELECT encrypted_key, iv, auth_tag FROM fal_ai_keys
     WHERE workspace_id = $1 AND is_active = TRUE
     LIMIT 1`,
    [workspaceId],
  );

  if (result.rows.length === 0) {
    return undefined;
  }

  const { decrypt } = await import('../utils/encryption.js');
  try {
    return decrypt({
      encrypted: result.rows[0].encrypted_key,
      iv: result.rows[0].iv,
      authTag: result.rows[0].auth_tag,
    });
  } catch {
    return undefined;
  }
}
