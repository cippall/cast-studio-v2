-- 001_initial_schema.up.sql
-- Initial schema for Cast Studio v2
-- All 16 tables with indexes, constraints, and ON DELETE rules

BEGIN;

-- ============================================================================
-- Enable UUID generation
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- 1. workspaces
-- ============================================================================
CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    workspace_type VARCHAR NOT NULL DEFAULT 'STUDIO',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspaces_type ON workspaces (workspace_type);

-- ============================================================================
-- 2. accounts
-- ============================================================================
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    role VARCHAR NOT NULL DEFAULT 'ARTIST',
    is_api_able BOOLEAN NOT NULL DEFAULT FALSE,
    password_hash VARCHAR NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_workspace_email
    ON accounts (workspace_id, email);
CREATE INDEX IF NOT EXISTS idx_accounts_workspace_id ON accounts (workspace_id);
CREATE INDEX IF NOT EXISTS idx_accounts_role ON accounts (role);

-- ============================================================================
-- 3. api_keys
-- ============================================================================
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    key_hash VARCHAR NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_api_keys_account_id ON api_keys (account_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys (key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys (is_active);

-- ============================================================================
-- 4. wallets
-- ============================================================================
CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    balance_credits DECIMAL(12,4) NOT NULL DEFAULT 0.00,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_wallets_workspace_account
    ON wallets (workspace_id, account_id);
CREATE INDEX IF NOT EXISTS idx_wallets_workspace_id ON wallets (workspace_id);

-- ============================================================================
-- 5. ledger
-- ============================================================================
CREATE TABLE IF NOT EXISTS ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    workflow_id UUID,  -- FK added after workflows table
    api_key_id UUID,   -- FK added after api_keys table
    amount DECIMAL(12,4) NOT NULL,
    type VARCHAR NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_workspace_id ON ledger (workspace_id);
CREATE INDEX IF NOT EXISTS idx_ledger_wallet_id ON ledger (wallet_id);
CREATE INDEX IF NOT EXISTS idx_ledger_workflow_id ON ledger (workflow_id);
CREATE INDEX IF NOT EXISTS idx_ledger_api_key_id ON ledger (api_key_id);
CREATE INDEX IF NOT EXISTS idx_ledger_created_at ON ledger (created_at);

-- ============================================================================
-- 6. assets (The Core Engine)
-- ============================================================================
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    client_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    asset_type VARCHAR NOT NULL,
    name VARCHAR(255),
    seed BIGINT NOT NULL,
    prompt_recipe JSONB NOT NULL,
    marketplace_status VARCHAR,
    is_marketplace_frozen BOOLEAN NOT NULL DEFAULT FALSE,
    source_asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
    source_type VARCHAR NOT NULL DEFAULT 'ORIGINAL',
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assets_workspace_id ON assets (workspace_id);
CREATE INDEX IF NOT EXISTS idx_assets_creator_id ON assets (creator_id);
CREATE INDEX IF NOT EXISTS idx_assets_client_id ON assets (client_id);
CREATE INDEX IF NOT EXISTS idx_assets_asset_type ON assets (asset_type);
CREATE INDEX IF NOT EXISTS idx_assets_deleted_at ON assets (deleted_at);

-- ============================================================================
-- 7. asset_permissions
-- ============================================================================
CREATE TABLE IF NOT EXISTS asset_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    grantee_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    revoked_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_asset_permissions_asset_id ON asset_permissions (asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_permissions_grantee_id ON asset_permissions (grantee_id);
-- Unique active permission: only one active (non-revoked) grant per (asset, grantee)
CREATE UNIQUE INDEX IF NOT EXISTS idx_asset_permissions_active
    ON asset_permissions (asset_id, grantee_id)
    WHERE revoked_at IS NULL;

-- ============================================================================
-- 8. asset_outputs
-- ============================================================================
CREATE TABLE IF NOT EXISTS asset_outputs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    layout_type VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    image_url VARCHAR,
    local_backup_url VARCHAR,
    cost_credits DECIMAL(12,4) NOT NULL DEFAULT 0.00,
    status VARCHAR NOT NULL DEFAULT 'PENDING',
    version INTEGER NOT NULL DEFAULT 1,
    is_obsolete BOOLEAN NOT NULL DEFAULT FALSE,
    obsolete_reason VARCHAR,
    error_message TEXT,
    generation_params JSONB,
    reference_images JSONB,
    source_asset_outputs JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_outputs_asset_id ON asset_outputs (asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_outputs_status ON asset_outputs (status);
CREATE INDEX IF NOT EXISTS idx_asset_outputs_asset_status
    ON asset_outputs (asset_id, status);
CREATE INDEX IF NOT EXISTS idx_asset_outputs_is_obsolete ON asset_outputs (is_obsolete);
CREATE INDEX IF NOT EXISTS idx_asset_outputs_version ON asset_outputs (version);

-- ============================================================================
-- 9. asset_output_versions
-- ============================================================================
CREATE TABLE IF NOT EXISTS asset_output_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_output_id UUID NOT NULL,  -- soft reference, no FK to allow archiving
    version INTEGER NOT NULL,
    image_url VARCHAR,
    local_backup_url VARCHAR,
    model VARCHAR(100) NOT NULL,
    cost_credits DECIMAL(12,4) NOT NULL,
    status VARCHAR NOT NULL,
    generation_params JSONB,
    reference_images JSONB,
    source_asset_outputs JSONB,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_output_versions_output_id
    ON asset_output_versions (asset_output_id);
CREATE INDEX IF NOT EXISTS idx_asset_output_versions_version
    ON asset_output_versions (version);
CREATE INDEX IF NOT EXISTS idx_asset_output_versions_output_version
    ON asset_output_versions (asset_output_id, version);

-- ============================================================================
-- 10. workflows
-- ============================================================================
CREATE TABLE IF NOT EXISTS workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    total_escrow DECIMAL(12,4) NOT NULL,
    consumed_credits DECIMAL(12,4) NOT NULL DEFAULT 0.00,
    status VARCHAR NOT NULL DEFAULT 'RUNNING',
    error_code VARCHAR(100),
    error_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_workflows_workspace_id ON workflows (workspace_id);
CREATE INDEX IF NOT EXISTS idx_workflows_agent_id ON workflows (agent_id);
CREATE INDEX IF NOT EXISTS idx_workflows_wallet_id ON workflows (wallet_id);
CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows (status);

-- ============================================================================
-- 11. commissions
-- ============================================================================
CREATE TABLE IF NOT EXISTS commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    studio_workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    assignee_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    brief JSONB NOT NULL,
    status VARCHAR NOT NULL DEFAULT 'REQUESTED',
    premium_cost DECIMAL(12,4),
    submitted_at TIMESTAMP WITH TIME ZONE,
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commissions_client_workspace
    ON commissions (client_workspace_id);
CREATE INDEX IF NOT EXISTS idx_commissions_studio_workspace
    ON commissions (studio_workspace_id);
CREATE INDEX IF NOT EXISTS idx_commissions_client_id ON commissions (client_id);
CREATE INDEX IF NOT EXISTS idx_commissions_assignee_id ON commissions (assignee_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON commissions (status);

-- ============================================================================
-- 12. commission_assets
-- ============================================================================
CREATE TABLE IF NOT EXISTS commission_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    commission_id UUID NOT NULL REFERENCES commissions(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    asset_output_id UUID REFERENCES asset_outputs(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commission_assets_commission_id
    ON commission_assets (commission_id);
CREATE INDEX IF NOT EXISTS idx_commission_assets_asset_id
    ON commission_assets (asset_id);

-- ============================================================================
-- 13. notifications
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    type VARCHAR NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id ON notifications (recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications (is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications (created_at);

-- ============================================================================
-- 14. models
-- ============================================================================
CREATE TABLE IF NOT EXISTS models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    model_type VARCHAR NOT NULL,
    task VARCHAR(100) NOT NULL,
    parameters JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_models_model_type ON models (model_type);
CREATE INDEX IF NOT EXISTS idx_models_task ON models (task);
CREATE INDEX IF NOT EXISTS idx_models_is_active ON models (is_active);

-- ============================================================================
-- 15. taxonomy
-- ============================================================================
CREATE TABLE IF NOT EXISTS taxonomy (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL,
    key VARCHAR(100) NOT NULL,
    label VARCHAR(255) NOT NULL,
    input_type VARCHAR NOT NULL,
    options JSONB,
    is_required BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_taxonomy_workspace_id ON taxonomy (workspace_id);
CREATE INDEX IF NOT EXISTS idx_taxonomy_category ON taxonomy (category);
CREATE INDEX IF NOT EXISTS idx_taxonomy_key ON taxonomy (key);
CREATE INDEX IF NOT EXISTS idx_taxonomy_is_active ON taxonomy (is_active);

-- ============================================================================
-- 16. marketplace_listings
-- ============================================================================
CREATE TABLE IF NOT EXISTS marketplace_listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    price_credits DECIMAL(12,4) NOT NULL,
    listing_type VARCHAR NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    purchased_by UUID REFERENCES accounts(id) ON DELETE SET NULL,
    purchased_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_listings_asset_id
    ON marketplace_listings (asset_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_listing_type
    ON marketplace_listings (listing_type);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_is_active
    ON marketplace_listings (is_active);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_purchased_by
    ON marketplace_listings (purchased_by);

-- ============================================================================
-- Add FK for ledger.workflow_id -> workflows.id and ledger.api_key_id -> api_keys.id
-- These FKs are added after their referenced tables exist.
-- ============================================================================
-- Drop existing FKs if re-running migration
ALTER TABLE ledger DROP CONSTRAINT IF EXISTS fk_ledger_workflow;
ALTER TABLE ledger DROP CONSTRAINT IF EXISTS fk_ledger_api_key;

ALTER TABLE ledger
    ADD CONSTRAINT fk_ledger_workflow
    FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE SET NULL;

ALTER TABLE ledger
    ADD CONSTRAINT fk_ledger_api_key
    FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE SET NULL;

COMMIT;
