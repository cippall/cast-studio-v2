-- 004_marketplace_settings.up.sql
-- Admin-configurable marketplace package settings

BEGIN;

CREATE TABLE IF NOT EXISTS marketplace_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_package JSONB NOT NULL DEFAULT '{
        "required_outputs": ["headshot", "fullshot", "expressions_3x4", "character_sheet", "editorial"],
        "generic_standard_look_id": null,
        "editorial_count": 2
    }'::jsonb,
    look_package JSONB NOT NULL DEFAULT '{
        "required_outputs": ["look_image"]
    }'::jsonb,
    fashion_item_package JSONB NOT NULL DEFAULT '{
        "required_outputs": ["item_image"]
    }'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed default row
INSERT INTO marketplace_settings (id)
VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

COMMIT;
