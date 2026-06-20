import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Get the encryption key from env. Must be a 32-byte hex string (64 hex chars).
 * Falls back to a derived key from SESSION_SECRET for dev convenience.
 */
function getEncryptionKey(): Buffer {
  const envKey = process.env.FAL_KEY_ENCRYPTION_KEY;
  if (envKey && envKey.length === 64) {
    return Buffer.from(envKey, 'hex');
  }
  // Derive a 32-byte key from SESSION_SECRET for development
  if (!envKey) {
    console.warn(
      '[WARN] FAL_KEY_ENCRYPTION_KEY not set — deriving encryption key from SESSION_SECRET. ' +
        'Changing SESSION_SECRET will invalidate all encrypted fal.ai keys.',
    );
  }
  const secret = process.env.SESSION_SECRET || 'cast-studio-dev-secret';
  return crypto.scryptSync(secret, 'fal-key-salt', KEY_LENGTH);
}

export interface EncryptedData {
  encrypted: string;
  iv: string;
  authTag: string;
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns hex-encoded encrypted data, IV, and auth tag.
 */
export function encrypt(plaintext: string): EncryptedData {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

/**
 * Decrypt an encrypted payload using AES-256-GCM.
 * Returns the original plaintext string.
 */
export function decrypt(data: EncryptedData): string {
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(data.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(data.authTag, 'hex'));

  let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
