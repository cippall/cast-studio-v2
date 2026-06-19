-- Rollback for migration 007: Remove sold_at column
DROP INDEX IF EXISTS idx_assets_sold_at;
ALTER TABLE assets DROP COLUMN IF EXISTS sold_at;
