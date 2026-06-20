-- Migration 009: Add FK constraint to collection_items.asset_id
-- Ensures referential integrity: deleting an asset removes it from all collections

ALTER TABLE collection_items
  ADD CONSTRAINT fk_collection_items_asset_id
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE;
