-- 002_workflow_steps_column.up.sql
-- Add steps JSONB column to workflows table for agent workflow step tracking

BEGIN;

ALTER TABLE workflows
    ADD COLUMN IF NOT EXISTS steps JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMIT;
