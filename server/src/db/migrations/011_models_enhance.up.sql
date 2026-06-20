-- 011_models_enhance.up.sql
-- Add input_schema column to store fal.ai parameter schema for UI rendering

BEGIN;

ALTER TABLE models
  ADD COLUMN IF NOT EXISTS input_schema JSONB NOT NULL DEFAULT '{}';

-- Migrate existing rows: move the raw fal.ai schema out of parameters into input_schema
-- Existing parameters column may have been used for both schema and values; reset to empty JSONB
-- Admins will re-configure parameters through the UI after this migration
UPDATE models SET parameters = '{}' WHERE parameters::text LIKE '%"type"%';

COMMIT;
