-- Migration 007: Add sold_at to assets for single purchase model
-- When a marketplace asset is purchased, sold_at is set on the original asset
-- to mark the exact moment of ownership transfer.

ALTER TABLE assets ADD COLUMN IF NOT EXISTS sold_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_assets_sold_at ON assets (sold_at);
