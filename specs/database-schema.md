# Database Schema: Cast Studio v2

This schema adheres to predictable naming conventions (UPPER_SNAKE for enum values) and establishes clear data types. Tables are designed to support future additions without breaking existing consumers or requiring destructive modifications.

All tables include `workspace_id` for multi-tenant isolation. Every query MUST filter by workspace.

---

## 1. workspaces

The top-level tenant container. Every entity in the system belongs to a workspace.

Two workspace types exist:
- **STUDIO** — where Artists and Admins work
- **CLIENT** — where Clients operate

| Column | Type | Constraints / Relations | Description |
| :---- | :---- | :---- | :---- |
| id | UUID | Primary Key | Unique identifier for the workspace. |
| name | VARCHAR(255) | Not Null | Human-readable workspace name. |
| slug | VARCHAR(255) | Not Null, Unique | URL-friendly identifier. |
| workspace_type | VARCHAR | Not Null, Default 'STUDIO' | 'STUDIO' or 'CLIENT' |
| created_at | TIMESTAMP | Default NOW() | Standard timestamp tracking. |

---

## 2. accounts

Tracks all users, system actors, and API scopes within a workspace.

| Column | Type | Constraints / Relations | Description |
| :---- | :---- | :---- | :---- |
| id | UUID | Primary Key | Unique identifier for the account. |
| workspace_id | UUID | Foreign Key -> workspaces.id, Not Null | The workspace this account belongs to. |
| name | VARCHAR(255) | Not Null | Display name or system label. |
| email | VARCHAR(255) | Not Null | Email address for login and notifications. |
| role | VARCHAR | Not Null, Default 'ARTIST' | 'ADMIN', 'ARTIST', 'CLIENT', 'AGENT' |
| is_api_able | BOOLEAN | Not Null, Default FALSE | Whether this account can generate API keys. |
| password_hash | VARCHAR | Not Null | Bcrypt hashed password. |
| created_at | TIMESTAMP | Default NOW() | Standard timestamp tracking. |

**Indexes:** `workspace_id`, `role`, unique on `(workspace_id, email)`.

---

## 3. api_keys

Multiple API keys per API-enabled account. Each key tracks cost usage independently.

| Column | Type | Constraints / Relations | Description |
| :---- | :---- | :---- | :---- |
| id | UUID | Primary Key | Unique identifier. |
| account_id | UUID | Foreign Key -> accounts.id, Not Null | The account that owns this key. |
| key_hash | VARCHAR | Not Null, Unique | Hashed API key (display prefix: cs_live_...). |
| name | VARCHAR(255) | Not Null | Human-readable label (e.g., "Production Agent", "Dev Script"). |
| is_active | BOOLEAN | Not Null, Default TRUE | Whether the key is active. |
| created_at | TIMESTAMP | Default NOW() | Standard timestamp tracking. |
| last_used_at | TIMESTAMP | Nullable | Last time this key was used. |

**Indexes:** `account_id`, `key_hash`, `is_active`.

---

## 4. wallets

The master ledger balance for clients, scoped to a workspace.

| Column | Type | Constraints / Relations | Description |
| :---- | :---- | :---- | :---- |
| id | UUID | Primary Key | Unique identifier for the wallet. |
| workspace_id | UUID | Foreign Key -> workspaces.id, Not Null | The workspace this wallet belongs to. |
| account_id | UUID | Foreign Key -> accounts.id, Not Null | The client who owns this wallet. |
| balance_credits | DECIMAL(12,4) | Not Null, Default 0.00 | The current available compute balance. |
| updated_at | TIMESTAMP | Default NOW() | Standard timestamp tracking. |

**Indexes:** `workspace_id`, unique on `(workspace_id, account_id)`.

---

## 5. ledger

The immutable transaction log for real-time pay-per-click tracking and escrows.

| Column | Type | Constraints / Relations | Description |
| :---- | :---- | :---- | :---- |
| id | UUID | Primary Key | Unique transaction ID. |
| workspace_id | UUID | Foreign Key -> workspaces.id, Not Null | The workspace this transaction belongs to. |
| wallet_id | UUID | Foreign Key -> wallets.id, Not Null | The wallet being debited/credited. |
| workflow_id | UUID | Foreign Key -> workflows.id, Nullable | The originating workflow, if applicable. |
| api_key_id | UUID | Foreign Key -> api_keys.id, Nullable | The API key used, if applicable. |
| amount | DECIMAL(12,4) | Not Null | The credit value (positive = credit, negative = debit). |
| type | VARCHAR | Not Null | 'CHARGE', 'TOP_UP', 'ESCROW_HOLD', 'ESCROW_REFUND' |
| created_at | TIMESTAMP | Default NOW() | The exact time of the transaction. |

**Indexes:** `workspace_id`, `wallet_id`, `workflow_id`, `api_key_id`, `created_at`.

---

## 6. assets (The Core Engine)

The zero-duplication table that stores prompt recipes and handles visibility bridging.

| Column | Type | Constraints / Relations | Description |
| :---- | :---- | :---- | :---- |
| id | UUID | Primary Key | Unique identifier for the core asset. |
| workspace_id | UUID | Foreign Key -> workspaces.id, Not Null | The workspace this asset belongs to. |
| creator_id | UUID | Foreign Key -> accounts.id, Not Null | The artist, client, or agent who made it. |
| client_id | UUID | Foreign Key -> accounts.id, Nullable | Ownership pointer (Null = Studio owned). Set on premium unlock. |
| asset_type | VARCHAR | Not Null | 'ACTOR', 'LOOK', 'FASHION_ITEM' |
| name | VARCHAR(255) | Nullable | Auto-generated or user-edited name (for Look and Fashion Item). |
| seed | BIGINT | Not Null | The deterministic generation seed. |
| prompt_recipe | JSONB | Not Null | The master system prompt configuration (structured JSON). |
| created_at | TIMESTAMP | Default NOW() | Standard timestamp tracking. |

**Indexes:** `workspace_id`, `creator_id`, `client_id`, `asset_type`.

**Note on visibility:** Visibility is managed via the `asset_permissions` table, not a column on this table.

---

## 7. asset_permissions

Dynamic permission layer controlling who can see what. Replaces a rigid ENUM visibility column.

| Column | Type | Constraints / Relations | Description |
| :---- | :---- | :---- | :---- |
| id | UUID | Primary Key | Unique identifier. |
| asset_id | UUID | Foreign Key -> assets.id, Not Null | The asset being shared. |
| grantee_id | UUID | Foreign Key -> accounts.id, Not Null | The account receiving access. |
| granted_at | TIMESTAMP | Default NOW() | When access was granted. |
| revoked_at | TIMESTAMP | Nullable | When access was revoked (NULL = still active). |

**Indexes:** `asset_id`, `grantee_id`, unique on `(asset_id, grantee_id)` where `revoked_at IS NULL`.

**Hard Cutoff:** Revoking access is a single UPDATE setting `revoked_at = NOW()`. All queries filter `revoked_at IS NULL` for active grants.

---

## 8. asset_outputs (The Child Table)

Stores the generated images for each asset. Tracks model used, cost charged, and dependency chain status.

| Column | Type | Constraints / Relations | Description |
| :---- | :---- | :---- | :---- |
| id | UUID | Primary Key | Unique identifier for the specific image. |
| asset_id | UUID | Foreign Key -> assets.id, Not Null | Link to the parent asset. |
| layout_type | VARCHAR(100) | Not Null | e.g., 'headshot', 'fullshot', 'expressions_3x4', 'editorial', 'character_sheet'. |
| model | VARCHAR(100) | Not Null | The inference model used (e.g., 'flux-pro', 'sdxl-turbo'). |
| image_url | VARCHAR | Nullable | URL to the generated image (fal.ai primary, local backup). |
| local_backup_url | VARCHAR | Nullable | Local server backup URL. |
| cost_credits | DECIMAL(12,4) | Not Null, Default 0.00 | The credit cost charged for this specific output. |
| status | VARCHAR | Not Null, Default 'PENDING' | 'PENDING', 'SUCCESS', 'FAILED' |
| is_obsolete | BOOLEAN | Not Null, Default FALSE | TRUE when upstream asset was edited/regenerated. |
| obsolete_reason | VARCHAR | Nullable | e.g., "Headshot was regenerated. Regenerate to update." |
| error_message | TEXT | Nullable | Error details if status = 'FAILED'. |
| created_at | TIMESTAMP | Default NOW() | Standard timestamp tracking. |

**Indexes:** `asset_id`, `status`, `(asset_id, status)`, `is_obsolete`.

---

## 9. workflows (The Agent Telemetry)

Tracks autonomous loops, handles the Pre-Flight Escrow budget, and logs structured errors.

| Column | Type | Constraints / Relations | Description |
| :---- | :---- | :---- | :---- |
| id | UUID | Primary Key | Unique workflow session identifier. |
| workspace_id | UUID | Foreign Key -> workspaces.id, Not Null | The workspace this workflow belongs to. |
| agent_id | UUID | Foreign Key -> accounts.id, Not Null | The agent running the workflow. |
| wallet_id | UUID | Foreign Key -> wallets.id, Not Null | The wallet the escrow is held against. |
| total_escrow | DECIMAL(12,4) | Not Null | The maximum budget frozen at launch. |
| consumed_credits | DECIMAL(12,4) | Not Null, Default 0.00 | Credits consumed so far. |
| status | VARCHAR | Not Null, Default 'RUNNING' | 'RUNNING', 'COMPLETED', 'FAILED' |
| error_code | VARCHAR(100) | Nullable | Machine-readable error (e.g., 'MODEL_TIMEOUT'). |
| error_reason | TEXT | Nullable | Human-readable context for the failure. |
| created_at | TIMESTAMP | Default NOW() | Start time of the workflow. |
| completed_at | TIMESTAMP | Nullable | End time of the workflow. |

**Indexes:** `workspace_id`, `agent_id`, `wallet_id`, `status`.

---

## 10. commissions

Tracks commission requests from Client Workspace to Studio Workspace.

| Column | Type | Constraints / Relations | Description |
| :---- | :---- | :---- | :---- |
| id | UUID | Primary Key | Unique commission identifier. |
| client_workspace_id | UUID | Foreign Key -> workspaces.id, Not Null | The Client Workspace that submitted the request. |
| studio_workspace_id | UUID | Foreign Key -> workspaces.id, Not Null | The Studio Workspace assigned to execute. |
| client_id | UUID | Foreign Key -> accounts.id, Not Null | The client who submitted the request. |
| assignee_id | UUID | Foreign Key -> accounts.id, Nullable | The artist or agent assigned to execute. |
| title | VARCHAR(255) | Not Null | Short description of the commission. |
| brief | JSONB | Not Null | The full request data (admin-defined form fields). |
| status | VARCHAR | Not Null, Default 'REQUESTED' | 'REQUESTED', 'ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'CHANGES_REQUESTED', 'APPROVED', 'CANCELLED' |
| premium_cost | DECIMAL(12,4) | Nullable | The premium unlock cost (set when work is submitted). |
| submitted_at | TIMESTAMP | Nullable | When work was submitted for client review. |
| approved_at | TIMESTAMP | Nullable | When client approved. |
| created_at | TIMESTAMP | Default NOW() | Standard timestamp tracking. |

**Indexes:** `client_workspace_id`, `studio_workspace_id`, `client_id`, `assignee_id`, `status`.

---

## 11. commission_assets

Links generated assets to a commission (the work submitted for review).

| Column | Type | Constraints / Relations | Description |
| :---- | :---- | :---- | :---- |
| id | UUID | Primary Key | Unique identifier. |
| commission_id | UUID | Foreign Key -> commissions.id, Not Null | The commission this work belongs to. |
| asset_id | UUID | Foreign Key -> assets.id, Not Null | The asset created for this commission. |
| asset_output_id | UUID | Foreign Key -> asset_outputs.id, Nullable | The specific output submitted. |
| created_at | TIMESTAMP | Default NOW() | Standard timestamp tracking. |

**Indexes:** `commission_id`, `asset_id`.

---

## 12. notifications

In-app notifications for all key events.

| Column | Type | Constraints / Relations | Description |
| :---- | :---- | :---- | :---- |
| id | UUID | Primary Key | Unique identifier. |
| recipient_id | UUID | Foreign Key -> accounts.id, Not Null | The account receiving the notification. |
| type | VARCHAR | Not Null | 'COMMISSION_ASSIGNED', 'COMMISSION_SUBMITTED', 'COMMISSION_APPROVED', 'COMMISSION_CHANGES_REQUESTED', 'ASSET_SHARED', 'WORKFLOW_COMPLETED', 'WORKFLOW_FAILED' |
| title | VARCHAR(255) | Not Null | Short notification title. |
| message | TEXT | Not Null | Full notification body. |
| is_read | BOOLEAN | Not Null, Default FALSE | Whether the notification has been read. |
| created_at | TIMESTAMP | Default NOW() | Standard timestamp tracking. |

**Indexes:** `recipient_id`, `is_read`, `created_at`.

---

## 13. models

Admin-configured fal.ai models available for generation tasks.

| Column | Type | Constraints / Relations | Description |
| :---- | :---- | :---- | :---- |
| id | UUID | Primary Key | Unique identifier. |
| model_id | VARCHAR(255) | Not Null, Unique | The fal.ai model identifier (e.g., 'fal-ai/flux-pro'). |
| name | VARCHAR(255) | Not Null | Human-readable model name. |
| model_type | VARCHAR | Not Null | 'TEXT_TO_IMAGE', 'IMAGE_TO_IMAGE', 'IMAGE_TO_TEXT' |
| task | VARCHAR(100) | Not Null | The task this model is used for (e.g., 'actor_headshot', 'look_generation', 'fashion_item', 'reference_extraction'). |
| parameters | JSONB | Not Null, Default '{}' | Admin-configured parameters (from fal.ai schema). |
| is_active | BOOLEAN | Not Null, Default TRUE | Whether this model is available for use. |
| created_at | TIMESTAMP | Default NOW() | Standard timestamp tracking. |

**Indexes:** `model_type`, `task`, `is_active`.

---

## 14. taxonomy

Admin-managed taxonomy for all configurable categories and properties.

| Column | Type | Constraints / Relations | Description |
| :---- | :---- | :---- | :---- |
| id | UUID | Primary Key | Unique identifier. |
| workspace_id | UUID | Foreign Key -> workspaces.id, Nullable | NULL = global (all workspaces), otherwise workspace-specific. |
| category | VARCHAR(100) | Not Null | 'ACTOR_PROPERTY', 'LOOK_TAXONOMY', 'FASHION_ITEM_TAXONOMY', 'COMMISSION_FIELD' |
| key | VARCHAR(100) | Not Null | The property key (e.g., 'age', 'style', 'item_type'). |
| label | VARCHAR(255) | Not Null | Human-readable label. |
| input_type | VARCHAR | Not Null | 'DROPDOWN', 'SLIDER', 'TEXT', 'MULTI_SELECT', 'CHECKBOX' |
| options | JSONB | Nullable | For DROPDOWN/MULTI_SELECT: array of {value, label}. For SLIDER: {min, max, step}. |
| is_required | BOOLEAN | Not Null, Default FALSE | Whether this field is required. |
| sort_order | INTEGER | Not Null, Default 0 | Display order within category. |
| is_active | BOOLEAN | Not Null, Default TRUE | Whether this taxonomy entry is active. |
| created_at | TIMESTAMP | Default NOW() | Standard timestamp tracking. |

**Indexes:** `workspace_id`, `category`, `key`, `is_active`.

---

## Entity Relationship Summary

```
workspaces
  |
  +-- accounts (workspace_id)
  |     |
  |     +-- api_keys (account_id)
  |     +-- wallets (account_id, workspace_id)
  |     +-- assets (creator_id, client_id, workspace_id)
  |     |     |
  |     |     +-- asset_outputs (asset_id)
  |     |     |
  |     |     +-- asset_permissions (asset_id, grantee_id)
  |     |
  |     +-- workflows (agent_id, workspace_id)
  |     |     |
  |     |     +-- ledger (workflow_id)
  |     |
  |     +-- commissions (client_id, assignee_id)
  |           |
  |           +-- commission_assets (commission_id, asset_id)
  |
  +-- notifications (recipient_id)
  +-- models (workspace_id)
  +-- taxonomy (workspace_id)
  +-- ledger (workspace_id)
  +-- wallets (workspace_id)
  +-- workflows (workspace_id)
  +-- assets (workspace_id)
```

## Migration Notes

- Use `CREATE TABLE IF NOT EXISTS` for idempotent migrations.
- Add `ON DELETE CASCADE` where child rows should vanish with parent (asset_outputs -> assets, asset_permissions -> assets, api_keys -> accounts).
- Add `ON DELETE SET NULL` where child rows should survive parent deletion (assets.client_id -> accounts).
- For development: drop and recreate tables. For production: use ALTER TABLE migrations.
- UUID generation: use `gen_random_uuid()` (pgcrypto extension).
- Image storage: fal.ai URLs are primary, local backup is async. Storage interface is abstracted for future S3 migration.
