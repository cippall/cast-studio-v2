-- Rollback for migration 005: performance indexes
DROP INDEX IF EXISTS idx_asset_outputs_lookup;
DROP INDEX IF EXISTS idx_marketplace_listings_seller_id;
DROP INDEX IF EXISTS idx_notifications_recipient_read;
DROP INDEX IF EXISTS idx_assets_marketplace_status;
DROP INDEX IF EXISTS idx_commissions_client_status;
DROP INDEX IF EXISTS idx_commissions_assignee_status;
DROP INDEX IF EXISTS idx_assets_source_asset_id;
