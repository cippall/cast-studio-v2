-- 011_models_enhance.down.sql

BEGIN;
ALTER TABLE models DROP COLUMN IF EXISTS input_schema;
COMMIT;
