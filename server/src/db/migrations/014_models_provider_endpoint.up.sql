-- 014_models_provider_endpoint.up.sql
-- Add provider and endpoint columns for multi-provider routing

BEGIN;

ALTER TABLE models
  ADD COLUMN IF NOT EXISTS provider VARCHAR(50) NOT NULL DEFAULT 'fal',
  ADD COLUMN IF NOT EXISTS endpoint VARCHAR(500);

CREATE INDEX IF NOT EXISTS idx_models_provider ON models (provider);

COMMIT;
