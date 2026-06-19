-- Migration 008: fal.ai API key storage — rollback

DROP INDEX IF EXISTS idx_fal_ai_keys_active;
DROP INDEX IF EXISTS idx_fal_ai_keys_workspace;
DROP TABLE IF EXISTS fal_ai_keys;
