import crypto from 'node:crypto';

const KEY_PREFIX = 'cs_live_';

/**
 * Generate a cryptographically secure API key.
 * Format: cs_live_<64 hex chars> (32 random bytes)
 *
 * @returns The raw key and the prefix for storage/reference.
 */
export function generateApiKey(): { rawKey: string; prefix: string } {
  const bytes = crypto.randomBytes(32);
  const hex = bytes.toString('hex');
  return { rawKey: `${KEY_PREFIX}${hex}`, prefix: KEY_PREFIX };
}
