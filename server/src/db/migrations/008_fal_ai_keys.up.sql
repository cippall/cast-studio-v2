-- Migration 008: fal.ai API key storage (encrypted at rest)
-- Stores one key per workspace. Encrypted with AES-256-GCM using FAL_KEY_ENCRYPTION_KEY env.

CREATE TABLE IF NOT EXISTS fal_ai_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    encrypted_key TEXT NOT NULL,
    iv TEXT NOT NULL,
    auth_tag TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fal_ai_keys_workspace ON fal_ai_keys (workspace_id);
CREATE INDEX IF NOT EXISTS idx_fal_ai_keys_active ON fal_ai_keys (workspace_id, is_active);
