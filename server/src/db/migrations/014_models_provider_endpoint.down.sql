-- 014_models_provider_endpoint.down.sql

BEGIN;
ALTER TABLE models DROP COLUMN IF EXISTS provider;
ALTER TABLE models DROP COLUMN IF EXISTS endpoint;
COMMIT;
