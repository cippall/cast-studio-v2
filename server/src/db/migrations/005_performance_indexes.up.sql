-- Migration 005: Add missing composite indexes for hot query paths
-- Addresses performance audit findings: sequential scans on filtered queries

-- asset_outputs: covers the LATERAL JOIN in listAssets that filters by layout_type + status
CREATE INDEX IF NOT EXISTS idx_asset_outputs_lookup
  ON asset_outputs (asset_id, layout_type, status, is_obsolete);

-- marketplace_listings: covers listManageableListings filter by seller_id
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_seller_id
  ON marketplace_listings (seller_id);

-- notifications: covers listNotifications + countUnreadNotifications
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_read
  ON notifications (recipient_id, is_read);

-- assets.marketplace_status: covers marketplace submission queries (partial index for non-null)
CREATE INDEX IF NOT EXISTS idx_assets_marketplace_status
  ON assets (marketplace_status) WHERE marketplace_status IS NOT NULL;

-- commissions: covers common filter combinations
CREATE INDEX IF NOT EXISTS idx_commissions_client_status
  ON commissions (client_id, status);

CREATE INDEX IF NOT EXISTS idx_commissions_assignee_status
  ON commissions (assignee_id, status);

-- assets.source_asset_id: covers duplicateAsset + duplicateAssetOutputs lookups
CREATE INDEX IF NOT EXISTS idx_assets_source_asset_id
  ON assets (source_asset_id);
