# ADR-046: Encryption Key Rotation Limitation

## Status

Accepted

## Date

2026-06-20

## Context

Cast Studio v2 encrypts fal.ai API keys at rest in the `fal_ai_keys` table using AES-256-GCM via `server/src/utils/encryption.ts`. The encryption key is sourced from the `FAL_KEY_ENCRYPTION_KEY` environment variable (a 64-char hex string, 32 bytes). For development convenience, if `FAL_KEY_ENCRYPTION_KEY` is not set or is not exactly 64 characters, the key is derived from `SESSION_SECRET` using `crypto.scryptSync` with a hardcoded salt.

Each encrypted record stores its own random 16-byte IV and 16-byte GCM auth tag, but the **master key** used for all records is a single static value fixed at process startup.

The encrypted data in the database consists of:

- `encrypted_key` — hex-encoded AES-256-GCM ciphertext (the fal.ai API key)
- `iv` — hex-encoded 16-byte initialization vector (unique per row)
- `auth_tag` — hex-encoded 16-byte GCM authentication tag

At time of writing, approximately 1 fal.ai key per workspace is stored, encrypted with this single master key.

## Decision

The current implementation uses a **single master key with no rotation mechanism**. This is accepted as a known limitation for the initial release.

### Current approach

```
FAL_KEY_ENCRYPTION_KEY (env) ──► AES-256-GCM key ──► encrypt/decrypt fal.ai keys
SESSION_SECRET (fallback)    ──► scrypt derivation ──► AES-256-GCM key
```

- Per-row IVs provide semantic security (same plaintext → different ciphertext each time).
- GCM auth tags provide integrity (tampered ciphertext is rejected on decrypt).
- The single master key means all rows are protected by the same secret.

### Limitation: no key rotation

If `FAL_KEY_ENCRYPTION_KEY` is compromised or needs to be rotated:

1. **All existing encrypted records become unreadable.** The database stores only the ciphertext, IV, and auth tag — not the key. Changing the master key means `decrypt()` will fail on every existing row.
2. **There is no re-encryption path.** The codebase has no function to decrypt with an old key and re-encrypt with a new one.
3. **There is no key versioning.** The `fal_ai_keys` table has no `key_version` column to identify which master key was used for each row.

The only recovery path today is: set the old key back in env, decrypt all keys via the API, rotate the env var, then re-encrypt and re-store. This requires application-level changes and downtime.

## Alternatives Considered

### Key versioning with re-encryption (deferred)

Add a `key_version` column to `fal_ai_keys`. Store multiple master keys in env (e.g., `FAL_KEY_ENCRYPTION_KEY_V1`, `FAL_KEY_ENCRYPTION_KEY_V2`). On decrypt, try the latest key first, fall back to older versions. On encrypt, always use the latest key. A background job re-encrypts old-version rows lazily.

- Pros: Enables zero-downtime rotation; industry standard pattern.
- Cons: Adds complexity to `encryption.ts`, the `fal_ai_keys` table, and env management. Requires a migration.
- **Deferred** to a future iteration when operational key management becomes a priority.

### External KMS (AWS KMS, HashiCorp Vault)

Use a managed key management service with built-in rotation and envelope encryption.

- Pros: Best-in-class key management; automatic rotation; audit logging.
- Cons: Adds infrastructure dependency and cost; overkill for current scale.
- **Deferred** until the project requires compliance-grade key management.

### Per-workspace encryption keys

Derive a unique key per workspace from the master key using HKDF with the workspace ID as context.

- Pros: Limits blast radius of a single key compromise.
- Cons: Still has the same rotation problem at the master key level; adds complexity.
- **Deferred** — does not solve the core rotation problem.

## Consequences

- **Operational risk:** If the encryption key is leaked, all fal.ai API keys in the database are compromised. The only mitigation is to rotate the fal.ai keys themselves (via fal.ai dashboard) and update them in Cast Studio.
- **No zero-downtime rotation:** Rotating the encryption key requires downtime or a manual re-encryption procedure.
- **Development fallback is weak:** The `SESSION_SECRET` fallback uses a hardcoded salt (`fal-key-salt`), which means any developer with access to the source code can derive the dev encryption key if they know the `SESSION_SECRET`. This is acceptable for local development but must not be used in production.
- **Future improvement path:** When key rotation becomes necessary, the recommended approach is key versioning (Alternative 1) — add a `key_version` column, support multiple env keys, and implement lazy re-encryption.

## Related

- `server/src/utils/encryption.ts` — AES-256-GCM encrypt/decrypt implementation
- `server/src/db/migrations/008_fal_ai_keys.up.sql` — Encrypted key storage schema
- `server/src/routes/admin/fal-key-routes.ts` — Key save/disconnect endpoints
- `server/src/services/fal-service.ts` — Key retrieval and decryption for API calls
