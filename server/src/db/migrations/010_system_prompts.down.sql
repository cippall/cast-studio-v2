-- Migration 010: Drop system_prompts table

BEGIN;
DROP TABLE IF EXISTS system_prompts;
COMMIT;
