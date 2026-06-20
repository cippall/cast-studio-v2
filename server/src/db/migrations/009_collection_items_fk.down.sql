-- Migration 009: Remove FK constraint from collection_items.asset_id

ALTER TABLE collection_items
  DROP CONSTRAINT IF EXISTS fk_collection_items_asset_id;
