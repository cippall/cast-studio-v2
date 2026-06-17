-- 002_workflow_steps_column.down.sql
-- Remove steps JSONB column from workflows table

BEGIN;

ALTER TABLE workflows
    DROP COLUMN IF EXISTS steps;

COMMIT;
