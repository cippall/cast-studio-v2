-- Rollback for migration 006: collections tables
DROP INDEX IF EXISTS idx_collection_items_asset;
DROP INDEX IF EXISTS idx_collection_items_collection_id;
DROP INDEX IF EXISTS idx_collections_workspace_id;
DROP INDEX IF EXISTS idx_collections_user_id;
DROP TABLE IF EXISTS collection_items;
DROP TABLE IF EXISTS collections;
