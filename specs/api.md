# API Design: Cast Studio v2

## Overview

REST API built with Express + TypeScript. All endpoints are workspace-scoped. Auth is session-based for web users and API key-based for programmatic access.

## Auth

### Web (Session)
- Login returns a session cookie (httpOnly, secure)
- Every request resolves the session to an account + workspace
- Middleware: `requireSession` attaches `req.account` and `req.workspace`

### API Key
- Header: `Authorization: Bearer cs_live_...`
- Middleware: `requireApiKey` resolves the key to an account + workspace
- API keys can only be used from API-enabled accounts (Artists only, not Clients)

### Common Auth Rules
- Admin accounts bypass workspace filtering — they see all workspaces
- All other accounts are scoped to their workspace
- Every query filters by `workspace_id`

## Error Format

Every error response follows the same shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email is required",
    "details": { "field": "email" }
  }
}
```

### Status Code Mapping

| Code | Meaning |
|------|---------|
| 400 | Bad request (malformed JSON, missing body) |
| 401 | Not authenticated |
| 403 | Authenticated but not authorized |
| 404 | Resource not found |
| 409 | Conflict (duplicate, state mismatch) |
| 422 | Validation failed (semantically invalid) |
| 500 | Server error (never expose internal details) |

## Pagination

All list endpoints support:

```
GET /api/actors?page=1&pageSize=20&sortBy=createdAt&sortOrder=desc
```

Response:

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 142,
    "totalPages": 8
  }
}
```

Default: `page=1`, `pageSize=20`, `sortBy=createdAt`, `sortOrder=desc`.

---

## 1. Auth Endpoints

### POST /api/auth/register

Create a new account (Admin only for Artist/Client accounts).

**Request:**
```json
{
  "email": "artist@studio.com",
  "password": "securePass123",
  "name": "Jane Artist",
  "role": "ARTIST",
  "workspace_id": "uuid"
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "email": "artist@studio.com",
  "name": "Jane Artist",
  "role": "ARTIST",
  "workspace_id": "uuid",
  "created_at": "2026-06-16T10:00:00Z"
}
```

### POST /api/auth/login

**Request:**
```json
{
  "email": "artist@studio.com",
  "password": "securePass123"
}
```

**Response (200):** Sets session cookie. Returns account object.

### POST /api/auth/logout

**Response (200):** Clears session cookie.

### GET /api/auth/me

Returns the current authenticated account.

**Response (200):**
```json
{
  "id": "uuid",
  "email": "artist@studio.com",
  "name": "Jane Artist",
  "role": "ARTIST",
  "workspace_id": "uuid",
  "is_api_able": true
}
```

---

## 2. Workspace Endpoints (Admin only)

### GET /api/workspaces

List all workspaces.

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Acme Casting",
      "slug": "acme-casting",
      "workspace_type": "STUDIO",
      "created_at": "2026-06-16T10:00:00Z"
    }
  ],
  "pagination": { "page": 1, "pageSize": 20, "totalItems": 5, "totalPages": 1 }
}
```

### POST /api/workspaces

Create a new workspace.

**Request:**
```json
{
  "name": "New Studio",
  "slug": "new-studio",
  "workspace_type": "STUDIO"
}
```

**Response (201):** Workspace object.

### GET /api/workspaces/:id

Get a single workspace.

### PATCH /api/workspaces/:id

Update workspace name/slug.

### DELETE /api/workspaces/:id

Delete a workspace and all its data.

---

## 3. Account Endpoints (Admin only for management)

### GET /api/accounts

List accounts (filterable by workspace_id, role).

**Query params:** `?workspace_id=uuid&role=ARTIST&page=1&pageSize=20`

### POST /api/accounts

Create an account and add to a workspace.

**Request:**
```json
{
  "email": "client@brand.com",
  "password": "tempPass123",
  "name": "Brand Client",
  "role": "CLIENT",
  "workspace_id": "uuid"
}
```

### GET /api/accounts/:id

Get account details.

### PATCH /api/accounts/:id

Update account. Body can include:
```json
{
  "name": "Updated Name",
  "is_api_able": true
}
```

Setting `is_api_able: true` auto-generates the first API key.

### DELETE /api/accounts/:id

Soft-delete account.

---

## 4. API Key Endpoints

### GET /api/api-keys

List API keys for the authenticated account.

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Production Agent",
      "key_hash": "cs_live_abc...xyz",
      "is_active": true,
      "created_at": "2026-06-16T10:00:00Z",
      "last_used_at": "2026-06-16T12:00:00Z"
    }
  ]
}
```

Note: `key_hash` is only shown in full on creation. Subsequent lists show a masked version.

### POST /api/api-keys

Create a new API key.

**Request:**
```json
{
  "name": "Dev Script"
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "name": "Dev Script",
  "key_hash": "cs_live_abc123fullkeyhere",
  "is_active": true,
  "created_at": "2026-06-16T10:00:00Z"
}
```

**Important:** The full `key_hash` is only returned once. Store it immediately.

### DELETE /api/api-keys/:id

Revoke (deactivate) an API key.

---

## 5. Asset Endpoints

### 5.1 Actors

#### GET /api/actors

List actors in the workspace.

**Query params:**
- `page`, `pageSize`, `sortBy`, `sortOrder`
- `creator_id` — filter by creator
- `shared_with_me` — boolean, filters to actors shared with the current account
- Any taxonomy key as filter: `?age=young&gender=female`

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Cyberpunk Woman",
      "creator_id": "uuid",
      "asset_type": "ACTOR",
      "seed": 12345,
      "prompt_recipe": { "identity": { "age": 25, "gender": "female" }, "style": "cyberpunk" },
      "headshot_url": "https://fal.ai/...",
      "created_at": "2026-06-16T10:00:00Z"
    }
  ],
  "pagination": { "page": 1, "pageSize": 20, "totalItems": 15, "totalPages": 1 }
}
```

#### POST /api/actors

Create a new actor (step 1: identity only, no generation yet).

**Request:**
```json
{
  "entry_method": "FORM",
  "form_data": { "age": 25, "gender": "female", "ethnicity": "asian", "vibe": "cyberpunk" }
}
```

Or for reference photo:
```json
{
  "entry_method": "REFERENCE",
  "reference_image": "<base64 image>"
}
```

Or for raw text:
```json
{
  "entry_method": "TEXT",
  "prompt": "A young asian woman with cyberpunk aesthetic, neon-lit city background"
}
```

Or for randomize:
```json
{
  "entry_method": "RANDOMIZE"
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "asset_type": "ACTOR",
  "seed": 98765,
  "prompt_recipe": { ... },
  "outputs": [],
  "created_at": "2026-06-16T10:00:00Z"
}
```

#### GET /api/actors/:id

Get actor with all outputs and dependency status.

**Response (200):**
```json
{
  "id": "uuid",
  "name": "Cyberpunk Woman",
  "asset_type": "ACTOR",
  "seed": 12345,
  "prompt_recipe": { ... },
  "outputs": {
    "headshot": {
      "id": "uuid",
      "layout_type": "headshot",
      "image_url": "https://fal.ai/...",
      "model": "flux-pro",
      "status": "SUCCESS",
      "is_obsolete": false,
      "obsolete_reason": null,
      "cost_credits": 0.05
    },
    "fullshot": {
      "id": "uuid",
      "layout_type": "fullshot",
      "image_url": "https://fal.ai/...",
      "model": "flux-pro",
      "status": "SUCCESS",
      "is_obsolete": false,
      "obsolete_reason": null,
      "cost_credits": 0.05
    },
    "expressions": {
      "id": "uuid",
      "layout_type": "expressions_3x4",
      "image_url": null,
      "model": "flux-pro",
      "status": "FAILED",
      "is_obsolete": false,
      "obsolete_reason": null,
      "error_message": "Model timeout",
      "cost_credits": 0.05
    },
    "character_sheet": null,
    "editorial": null
  },
  "taxonomy_values": { "age": 25, "gender": "female", "vibe": "cyberpunk" },
  "created_at": "2026-06-16T10:00:00Z"
}
```

#### PATCH /api/actors/:id

Edit actor name and taxonomy fields.

**Request:**
```json
{
  "name": "Updated Name",
  "taxonomy_values": { "age": 26, "vibe": "steampunk" }
}
```

#### DELETE /api/actors/:id

Delete an actor and all its outputs.

#### POST /api/actors/:id/generate

Generate a specific layout for an actor.

**Request:**
```json
{
  "layout_type": "headshot",
  "model": "flux-pro",
  "options": { "num_outputs": 4 }
}
```

- `model` is optional — defaults to admin-configured default for this task
- `options` is optional — overrides admin defaults within allowed ranges
- For Clients: model is ignored (admin-configured only), options are limited to allowed ranges

**Response (202):**
```json
{
  "outputs": [
    {
      "id": "uuid",
      "layout_type": "headshot",
      "status": "PENDING",
      "model": "flux-pro",
      "cost_credits": 0.05
    }
  ]
}
```

Generation is async. The client polls or waits for notification.

#### POST /api/actors/:id/regenerate

Regenerate a specific layout (marks old outputs as obsolete).

**Request:**
```json
{
  "layout_type": "headshot",
  "model": "flux-pro",
  "options": { "num_outputs": 4 }
}
```

This:
1. Marks all existing non-obsolete outputs of this layout_type as `is_obsolete: true`
2. Marks all downstream outputs as obsolete with reason
3. Creates new PENDING outputs

**Response (202):** Same as generate.

#### POST /api/actors/:id/character-sheet

Generate a character sheet by composing actor + look.

**Request:**
```json
{
  "look_id": "uuid",
  "model": "flux-pro"
}
```

**Response (202):**
```json
{
  "id": "uuid",
  "layout_type": "character_sheet",
  "status": "PENDING",
  "model": "flux-pro",
  "cost_credits": 0.10
}
```

---

### 5.2 Looks

#### GET /api/looks

List looks in the workspace.

**Query params:**
- `page`, `pageSize`, `sortBy`, `sortOrder`
- `creator_id`, `shared_with_me`
- Taxonomy filters: `?gender=women&style=formal&season=summer`

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Black Suit Editorial",
      "creator_id": "uuid",
      "asset_type": "LOOK",
      "image_url": "https://fal.ai/...",
      "taxonomy_values": { "gender": "men", "style": "formal", "season": "all" },
      "created_at": "2026-06-16T10:00:00Z"
    }
  ],
  "pagination": { "page": 1, "pageSize": 20, "totalItems": 8, "totalPages": 1 }
}
```

#### POST /api/looks

Create a new look.

**Request (from prompt):**
```json
{
  "entry_method": "PROMPT",
  "prompt": "Black slim-fit suit, editorial fashion photography"
}
```

**Request (from reference):**
```json
{
  "entry_method": "REFERENCE",
  "reference_image": "<base64 image>"
}
```

**Request (from fashion items):**
```json
{
  "entry_method": "COMPOSITE",
  "fashion_item_ids": ["uuid1", "uuid2", "uuid3"]
}
```

**Response (202):**
```json
{
  "id": "uuid",
  "asset_type": "LOOK",
  "outputs": [
    {
      "id": "uuid",
      "image_url": null,
      "status": "PENDING",
      "model": "flux-pro",
      "cost_credits": 0.05
    },
    {
      "id": "uuid",
      "image_url": null,
      "status": "PENDING",
      "model": "flux-pro",
      "cost_credits": 0.05
    },
    {
      "id": "uuid",
      "image_url": null,
      "status": "PENDING",
      "model": "flux-pro",
      "cost_credits": 0.05
    },
    {
      "id": "uuid",
      "image_url": null,
      "status": "PENDING",
      "model": "flux-pro",
      "cost_credits": 0.05
    }
  ],
  "auto_name": "Black Slim Editorial"
}
```

Multiple options are generated. The user selects one via PATCH.

#### PATCH /api/looks/:id

Select an option and optionally rename the look.

**Request:**
```json
{
  "selected_output_id": "uuid",
  "name": "My Custom Name"
}
```

This marks the selected output as `SUCCESS` and the rest as `FAILED`. Sets the look name.

**Response (200):** Look object with final image.

#### GET /api/looks/:id

Get look details.

#### DELETE /api/looks/:id

Delete a look.

---

### 5.3 Fashion Items

#### GET /api/fashion-items

List fashion items in the workspace.

**Query params:**
- `page`, `pageSize`, `sortBy`, `sortOrder`
- `creator_id`, `shared_with_me`
- Taxonomy filters: `?gender=women&item_type=clothing&sub_type=jacket&color=black`

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Leather Jacket Black",
      "creator_id": "uuid",
      "asset_type": "FASHION_ITEM",
      "image_url": "https://fal.ai/...",
      "taxonomy_values": { "gender": "men", "item_type": "clothing", "sub_type": "jacket", "color": "black" },
      "created_at": "2026-06-16T10:00:00Z"
    }
  ],
  "pagination": { "page": 1, "pageSize": 20, "totalItems": 25, "totalPages": 2 }
}
```

#### POST /api/fashion-items

Create a new fashion item.

**Request (from prompt):**
```json
{
  "entry_method": "PROMPT",
  "prompt": "Black leather jacket, product photography, white background"
}
```

**Request (from reference):**
```json
{
  "entry_method": "REFERENCE",
  "reference_image": "<base64 image>"
}
```

**Response (202):**
```json
{
  "id": "uuid",
  "asset_type": "FASHION_ITEM",
  "outputs": [
    { "id": "uuid", "status": "PENDING", "model": "flux-pro", "cost_credits": 0.02 },
    { "id": "uuid", "status": "PENDING", "model": "flux-pro", "cost_credits": 0.02 },
    { "id": "uuid", "status": "PENDING", "model": "flux-pro", "cost_credits": 0.02 },
    { "id": "uuid", "status": "PENDING", "model": "flux-pro", "cost_credits": 0.02 }
  ],
  "auto_name": "Black Leather Jacket"
}
```

#### PATCH /api/fashion-items/:id

Select an option and optionally rename.

**Request:**
```json
{
  "selected_output_id": "uuid",
  "name": "Custom Name"
}
```

#### GET /api/fashion-items/:id

Get fashion item details.

#### DELETE /api/fashion-items/:id

Delete a fashion item.

---

## 6. Generation Job Endpoints

### GET /api/generation-jobs/:id

Poll generation job status.

**Response (200):**
```json
{
  "id": "uuid",
  "asset_id": "uuid",
  "asset_output_id": "uuid",
  "status": "SUCCESS",
  "image_url": "https://fal.ai/...",
  "model": "flux-pro",
  "cost_credits": 0.05,
  "error_message": null,
  "created_at": "2026-06-16T10:00:00Z",
  "completed_at": "2026-06-16T10:00:15Z"
}
```

Statuses: `PENDING`, `SUCCESS`, `FAILED`.

---

## 7. Sharing Endpoints

### POST /api/assets/:id/share

Share an asset with a client.

**Request:**
```json
{
  "grantee_id": "uuid",
  "visibility": "CLIENT_SHARED"
}
```

Creates an `asset_permissions` record.

**Response (201):**
```json
{
  "id": "uuid",
  "asset_id": "uuid",
  "grantee_id": "uuid",
  "granted_at": "2026-06-16T10:00:00Z",
  "revoked_at": null
}
```

### DELETE /api/permissions/:id

Revoke sharing (hard cutoff).

Sets `revoked_at = NOW()`. Immediate effect.

### GET /api/assets/:id/permissions

List all permissions for an asset.

---

## 8. Commission Endpoints

### POST /api/commissions

Client submits a commission request.

**Request:**
```json
{
  "title": "Need cyberpunk actor for editorial",
  "brief": {
    "project_type": "editorial",
    "style": "cyberpunk",
    "reference_images": ["<base64>"],
    "notes": "Looking for a young female actor..."
  }
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "title": "Need cyberpunk actor for editorial",
  "status": "REQUESTED",
  "client_id": "uuid",
  "client_workspace_id": "uuid",
  "studio_workspace_id": "uuid",
  "brief": { ... },
  "created_at": "2026-06-16T10:00:00Z"
}
```

### GET /api/commissions

List commissions (filtered by role):
- Client: sees their own commissions
- Artist: sees commissions assigned to them
- Admin: sees all commissions

**Query params:** `?status=REQUESTED&page=1&pageSize=20`

### GET /api/commissions/:id

Get commission details with linked assets.

**Response (200):**
```json
{
  "id": "uuid",
  "title": "Need cyberpunk actor for editorial",
  "status": "SUBMITTED",
  "brief": { ... },
  "assignee_id": "uuid",
  "premium_cost": 5.00,
  "submitted_at": "2026-06-16T12:00:00Z",
  "assets": [
    {
      "id": "uuid",
      "asset_id": "uuid",
      "asset_output_id": "uuid"
    }
  ]
}
```

### PATCH /api/commissions/:id/assign

Admin assigns commission to an Artist.

**Request:**
```json
{
  "assignee_id": "uuid"
}
```

### PATCH /api/commissions/:id/status

Update commission status.

**Request (Artist submits work):**
```json
{
  "status": "SUBMITTED",
  "premium_cost": 5.00,
  "asset_ids": ["uuid1", "uuid2"]
}
```

**Request (Client requests changes):**
```json
{
  "status": "CHANGES_REQUESTED"
}
```

**Request (Client approves):**
```json
{
  "status": "APPROVED"
}
```

This triggers:
1. Premium unlock: deduct `premium_cost` from client wallet
2. Set `client_id` on linked assets
3. Notify Artist

**Request (Cancel):**
```json
{
  "status": "CANCELLED"
}
```

### DELETE /api/commissions/:id

Cancel/delete a commission.

---

## 9. Wallet Endpoints (Client)

### GET /api/wallet

Get wallet balance.

**Response (200):**
```json
{
  "id": "uuid",
  "balance_credits": 150.50,
  "updated_at": "2026-06-16T12:00:00Z"
}
```

### POST /api/wallet/top-up

Top up wallet.

**Request:**
```json
{
  "amount": 100.00
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "balance_credits": 250.50,
  "updated_at": "2026-06-16T10:00:00Z"
}
```

### GET /api/wallet/transactions

List wallet transactions (ledger entries).

**Query params:** `?type=CHARGE&page=1&pageSize=20`

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "amount": -0.05,
      "type": "CHARGE",
      "created_at": "2026-06-16T10:00:00Z"
    },
    {
      "id": "uuid",
      "amount": 100.00,
      "type": "TOP_UP",
      "created_at": "2026-06-15T10:00:00Z"
    }
  ],
  "pagination": { "page": 1, "pageSize": 20, "totalItems": 50, "totalPages": 3 }
}
```

---

## 10. Workflow Endpoints (API/Agent)

### POST /api/workflows/start

Agent starts a workflow with pre-flight escrow.

**Request:**
```json
{
  "steps": [
    {
      "task": "actor_headshot",
      "model": "flux-pro",
      "prompt_recipe": { ... },
      "options": { "num_outputs": 4 }
    },
    {
      "task": "actor_fullshot",
      "model": "flux-pro",
      "prompt_recipe": { ... },
      "options": { "num_outputs": 2 }
    }
  ]
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "status": "RUNNING",
  "total_escrow": 0.30,
  "consumed_credits": 0.00,
  "created_at": "2026-06-16T10:00:00Z"
}
```

The system calculates max estimated cost and locks it in escrow.

### GET /api/workflows/:id

Get workflow status and progress.

**Response (200):**
```json
{
  "id": "uuid",
  "status": "RUNNING",
  "total_escrow": 0.30,
  "consumed_credits": 0.15,
  "steps": [
    { "task": "actor_headshot", "status": "SUCCESS", "outputs": ["uuid1", "uuid2", "uuid3", "uuid4"] },
    { "task": "actor_fullshot", "status": "PENDING", "outputs": [] }
  ],
  "error_code": null,
  "error_reason": null
}
```

### POST /api/workflows/:id/cancel

Cancel a running workflow. Unconsumed escrow is auto-refunded.

---

## 11. Notification Endpoints

### GET /api/notifications

List notifications for the authenticated account.

**Query params:** `?is_read=false&page=1&pageSize=20`

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "type": "COMMISSION_ASSIGNED",
      "title": "New Commission Assigned",
      "message": "You have been assigned 'Need cyberpunk actor'",
      "is_read": false,
      "created_at": "2026-06-16T10:00:00Z"
    }
  ],
  "pagination": { "page": 1, "pageSize": 20, "totalItems": 5, "totalPages": 1 }
}
```

### PATCH /api/notifications/:id/read

Mark notification as read.

### POST /api/notifications/read-all

Mark all notifications as read.

---

## 12. Admin Endpoints

### 12.1 Models

#### GET /api/admin/models

List all configured models.

#### POST /api/admin/models

Add a model from fal.ai.

**Request:**
```json
{
  "model_id": "fal-ai/flux-pro",
  "name": "Flux Pro",
  "model_type": "TEXT_TO_IMAGE",
  "task": "actor_headshot",
  "parameters": { "image_size": "square_hd", "num_outputs": 4 },
  "is_active": true
}
```

#### PATCH /api/admin/models/:id

Update model configuration.

#### DELETE /api/admin/models/:id

Remove a model.

#### POST /api/admin/models/discover

Fetch available models from fal.ai API (requires admin to have configured fal.ai key).

**Response (200):**
```json
{
  "models": [
    {
      "model_id": "fal-ai/flux-pro",
      "name": "Flux Pro",
      "model_type": "TEXT_TO_IMAGE",
      "schema": { "image_size": { "type": "enum", "options": ["square", "landscape_4_3"] }, "num_outputs": { "type": "integer", "min": 1, "max": 4 } }
    }
  ]
}
```

### 12.2 System Prompts

#### GET /api/admin/prompts

List all system prompt templates.

#### POST /api/admin/prompts

Create a prompt template.

**Request:**
```json
{
  "task": "actor_headshot",
  "template": "Professional headshot of {identity.description}, {style.lighting} lighting, {style.background} background, shot on 85mm lens"
}
```

#### PATCH /api/admin/prompts/:id

Update a prompt template.

#### DELETE /api/admin/prompts/:id

Delete a prompt template.

### 12.3 Taxonomy

#### GET /api/admin/taxonomy

List taxonomy entries. Filterable by category.

**Query params:** `?category=ACTOR_PROPERTY&is_active=true`

#### POST /api/admin/taxonomy

Create a taxonomy entry.

**Request:**
```json
{
  "category": "ACTOR_PROPERTY",
  "key": "body_type",
  "label": "Body Type",
  "input_type": "DROPDOWN",
  "options": [{ "value": "slim", "label": "Slim" }, { "value": "athletic", "label": "Athletic" }, { "value": "average", "label": "Average" }],
  "is_required": false,
  "sort_order": 5
}
```

#### PATCH /api/admin/taxonomy/:id

Update taxonomy entry.

#### DELETE /api/admin/taxonomy/:id

Delete taxonomy entry.

### 12.4 Commission Form Templates

#### GET /api/admin/commission-forms

List commission form templates.

#### POST /api/admin/commission-forms

Create a commission form template.

**Request:**
```json
{
  "name": "Actor Commission",
  "fields": [
    { "key": "project_type", "label": "Project Type", "input_type": "DROPDOWN", "options": [{ "value": "editorial", "label": "Editorial" }, { "value": "commercial", "label": "Commercial" }], "is_required": true },
    { "key": "reference_images", "label": "Reference Images", "input_type": "FILE_UPLOAD", "is_required": false },
    { "key": "notes", "label": "Notes", "input_type": "TEXT", "is_required": false }
  ]
}
```

#### PATCH /api/admin/commission-forms/:id

Update form template.

#### DELETE /api/admin/commission-forms/:id

Delete form template.

---

## 14. Marketplace Endpoints

### GET /api/marketplace

List marketplace listings available to the authenticated Client.

**Query params:**
- `page`, `pageSize`, `sortBy`, `sortOrder`
- `listing_type` — 'ACTOR_PACKAGE', 'LOOK'
- `max_price` — filter by maximum price
- `creator_id` — filter by artist

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "listing_type": "ACTOR_PACKAGE",
      "asset_id": "uuid",
      "asset": {
        "id": "uuid",
        "name": "Cyberpunk Woman",
        "headshot_url": "https://fal.ai/...",
        "fullshot_url": "https://fal.ai/..."
      },
      "seller_id": "uuid",
      "seller_name": "Jane Artist",
      "price_credits": 10.00,
      "is_active": true,
      "created_at": "2026-06-16T10:00:00Z"
    }
  ],
  "pagination": { "page": 1, "pageSize": 20, "totalItems": 12, "totalPages": 1 }
}
```

### GET /api/marketplace/:id

Get a single listing detail.

**Response (200):**
```json
{
  "id": "uuid",
  "listing_type": "ACTOR_PACKAGE",
  "asset": {
    "id": "uuid",
    "name": "Cyberpunk Woman",
    "headshot_url": "https://fal.ai/...",
    "fullshot_url": "https://fal.ai/...",
    "expression_sheet_url": "https://fal.ai/...",
    "character_sheet_url": "https://fal.ai/...",
    "editorial_urls": ["https://fal.ai/...", "https://fal.ai/..."]
  },
  "seller": { "id": "uuid", "name": "Jane Artist" },
  "price_credits": 10.00,
  "is_active": true,
  "created_at": "2026-06-16T10:00:00Z"
}
```

### POST /api/marketplace/:id/purchase

Client purchases a listing.

**Response (200):**
```json
{
  "listing_id": "uuid",
  "purchased_at": "2026-06-16T10:00:00Z",
  "cost_credits": 10.00,
  "new_balance": 140.50,
  "assets": [
    { "layout_type": "headshot", "image_url": "https://fal.ai/..." },
    { "layout_type": "fullshot", "image_url": "https://fal.ai/..." },
    { "layout_type": "expressions_3x4", "image_url": "https://fal.ai/..." },
    { "layout_type": "character_sheet", "image_url": "https://fal.ai/..." },
    { "layout_type": "editorial", "image_url": "https://fal.ai/..." },
    { "layout_type": "editorial", "image_url": "https://fal.ai/..." }
  ]
}
```

This triggers:
1. Deduct `price_credits` from client wallet (ledger entry: CHARGE)
2. Create a duplicate asset in Client's workspace with `client_id` set, `source_asset_id` pointing to original, `source_type = 'MARKETPLACE_PURCHASE'`
3. Duplicate all asset_outputs (new rows, same image URLs)
4. Set `purchased_by` and `purchased_at` on the listing
5. Notify the seller (Artist)

**Error (402):** Insufficient balance — "Insufficient credits. Your balance: X. Required: Y. [Top Up]"
**Error (409):** Already purchased — "This listing has already been purchased."

---

### 14.1 Asset Duplication

### POST /api/assets/:id/duplicate

Duplicate an asset (Artist only, for assets they own or marketplace-frozen assets).

**Request:**
```json
{
  "name": "Cyberpunk Woman v2"
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "name": "Cyberpunk Woman v2",
  "source_asset_id": "uuid",
  "source_type": "DUPLICATE",
  "asset_type": "ACTOR",
  "seed": 12345,
  "prompt_recipe": { ... },
  "outputs": [
    { "id": "uuid", "layout_type": "headshot", "image_url": "https://fal.ai/...", "status": "SUCCESS" },
    { "id": "uuid", "layout_type": "fullshot", "image_url": "https://fal.ai/...", "status": "SUCCESS" }
  ],
  "created_at": "2026-06-16T10:00:00Z"
}
```

The duplicate inherits all fields from the original. New asset_outputs are created with new IDs but same image URLs. The duplicate is fully editable.

---

### 14.3 Artist/Admin Marketplace Management

### GET /api/marketplace/manage

List all listings (Artist sees own, Admin sees all).

**Query params:** `?is_active=true&listing_type=ACTOR_PACKAGE&page=1&pageSize=20`

### POST /api/marketplace/manage

Create a new listing (Artist/Admin only).

**Request (Actor Package):**
```json
{
  "asset_id": "uuid",
  "listing_type": "ACTOR_PACKAGE",
  "price_credits": 10.00
}
```

The system automatically generates the package outputs using the generic standard look for character sheet and editorial shots.

**Request (Look):**
```json
{
  "asset_id": "uuid",
  "listing_type": "LOOK",
  "price_credits": 5.00
}
```

**Response (201):** Listing object.

### PATCH /api/marketplace/manage/:id

Update listing price or toggle active.

**Request:**
```json
{
  "price_credits": 12.00,
  "is_active": true
}
```

### DELETE /api/marketplace/manage/:id

Remove a listing.

---

### 14.4 Artist Marketplace Submission

### POST /api/marketplace/submit

Artist submits an asset for marketplace review.

**Request:**
```json
{
  "asset_id": "uuid"
}
```

**Validation:**
- Asset must belong to the Artist's workspace
- Asset must have all required outputs (as defined in Admin Listings Settings) with status SUCCESS
- Asset must not already have a pending or approved marketplace status

**Response (201):**
```json
{
  "asset_id": "uuid",
  "marketplace_status": "MARKETPLACE_PENDING",
  "submitted_at": "2026-06-16T10:00:00Z"
}
```

**Error (409):** "Asset is missing required outputs for marketplace submission. Required: headshot, fullshot, expressions, character_sheet, editorial."
**Error (409):** "Asset already has an active marketplace submission."

### GET /api/marketplace/submissions

List Artist's own submissions with status.

**Query params:** `?status=MARKETPLACE_PENDING&page=1&pageSize=20`

**Response (200):**
```json
{
  "data": [
    {
      "asset_id": "uuid",
      "asset_name": "Cyberpunk Woman",
      "asset_type": "ACTOR",
      "marketplace_status": "MARKETPLACE_PENDING",
      "submitted_at": "2026-06-16T10:00:00Z"
    }
  ],
  "pagination": { "page": 1, "pageSize": 20, "totalItems": 3, "totalPages": 1 }
}
```

---

### 14.5 Admin Marketplace Review

### GET /api/admin/marketplace/submissions

List all submissions for Admin review.

**Query params:** `?status=MARKETPLACE_PENDING&page=1&pageSize=20`

**Response (200):**
```json
{
  "data": [
    {
      "asset_id": "uuid",
      "asset_name": "Cyberpunk Woman",
      "asset_type": "ACTOR",
      "creator_name": "Jane Artist",
      "marketplace_status": "MARKETPLACE_PENDING",
      "submitted_at": "2026-06-16T10:00:00Z",
      "outputs": {
        "headshot": { "status": "SUCCESS", "image_url": "https://..." },
        "fullshot": { "status": "SUCCESS", "image_url": "https://..." },
        "expressions": { "status": "SUCCESS", "image_url": "https://..." },
        "character_sheet": { "status": "SUCCESS", "image_url": "https://..." },
        "editorial": { "status": "SUCCESS", "image_url": "https://..." }
      }
    }
  ],
  "pagination": { "page": 1, "pageSize": 20, "totalItems": 5, "totalPages": 1 }
}
```

### POST /api/admin/marketplace/submissions/:assetId/approve

Admin approves a submission and creates a listing.

**Request:**
```json
{
  "price_credits": 10.00
}
```

This:
1. Sets `assets.marketplace_status = 'MARKETPLACE_APPROVED'`
2. Creates a `marketplace_listings` record with the price
3. Notifies the Artist

**Response (200):**
```json
{
  "asset_id": "uuid",
  "marketplace_status": "MARKETPLACE_APPROVED",
  "listing_id": "uuid",
  "price_credits": 10.00,
  "approved_at": "2026-06-16T10:00:00Z"
}
```

### POST /api/admin/marketplace/submissions/:assetId/reject

Admin rejects a submission.

This sets `assets.marketplace_status = 'MARKETPLACE_REJECTED'`. Notifies the Artist.

**Response (200):**
```json
{
  "asset_id": "uuid",
  "marketplace_status": "MARKETPLACE_REJECTED"
}
```

---

### 14.6 Agent Marketplace Submission (API only)

### POST /api/agent/marketplace/submit

Agent submits assets to the marketplace via API. No UI for this.

**Headers:** `Authorization: Bearer <api_key>`

**Request:**
```json
{
  "asset_id": "uuid"
}
```

Same validation as Artist submission. Agent must have API key access and the asset must be in the Agent's workspace.

**Response (201):** Same as Artist submission.

---

### 14.7 Listings Settings (Admin)

### GET /api/admin/marketplace/settings

Get current marketplace package configuration.

**Response (200):**
```json
{
  "actor_package": {
    "required_outputs": ["headshot", "fullshot", "expressions", "character_sheet", "editorial"],
    "generic_standard_look_id": "uuid",
    "editorial_count": 2
  },
  "look_package": {
    "required_outputs": ["look_image"]
  },
  "fashion_item_package": {
    "required_outputs": ["item_image"]
  }
}
```

### PUT /api/admin/marketplace/settings

Update marketplace package configuration.

**Request:**
```json
{
  "actor_package": {
    "required_outputs": ["headshot", "fullshot", "expressions", "character_sheet", "editorial"],
    "generic_standard_look_id": "uuid",
    "editorial_count": 3
  }
}
```

This defines:
- What outputs are required for each listing type
- Which Look to use as the generic standard look for Actor Packages
- How many editorial shots to include

---

## 15. Dashboard Endpoints

### GET /api/dashboard

Returns dashboard data for the authenticated role.

**Artist response (200):**
```json
{
  "recent_activity": [
    { "type": "asset_created", "actor_name": "Cyberpunk Woman", "created_at": "2026-06-16T10:00:00Z" },
    { "type": "generation_completed", "actor_name": "Cyberpunk Woman", "layout_type": "headshot", "completed_at": "2026-06-16T10:00:15Z" }
  ],
  "commissions": [
    { "id": "uuid", "title": "Need cyberpunk actor", "status": "IN_PROGRESS" }
  ],
  "marketplace_sales": [
    { "listing_id": "uuid", "asset_name": "Cyberpunk Woman", "buyer_name": "Brand Client", "price_credits": 10.00, "purchased_at": "2026-06-15T10:00:00Z" }
  ]
}
```

**Client response (200):**
```json
{
  "wallet_balance": 140.50,
  "recent_activity": [ ... ],
  "commissions": [
    { "id": "uuid", "title": "Need cyberpunk actor", "status": "SUBMITTED" }
  ],
  "purchases": [
    { "listing_id": "uuid", "asset_name": "Cyberpunk Woman", "price_credits": 10.00, "purchased_at": "2026-06-15T10:00:00Z" }
  ]
}
```

**Admin response (200):**
```json
{
  "stats": {
    "total_actors": 150,
    "total_looks": 80,
    "total_fashion_items": 200,
    "active_members": 25,
    "pending_commissions": 5,
    "active_listings": 30,
    "total_sales_credits": 1250.00
  },
  "recent_activity": [ ... ],
  "commissions": [
    { "id": "uuid", "title": "Need cyberpunk actor", "status": "REQUESTED", "client_name": "Brand Client" }
  ]
}
```

---

## API Conventions Summary

| Convention | Rule |
|---|---|
| Base URL | `/api` |
| Auth (web) | Session cookie |
| Auth (api) | `Authorization: Bearer cs_live_...` |
| Naming | Plural nouns, camelCase fields |
| Pagination | `page`, `pageSize`, `sortBy`, `sortOrder` |
| Errors | `{ error: { code, message, details? } }` |
| Timestamps | ISO 8601 UTC |
| IDs | UUID v4 |
| Workspace | All queries filtered by workspace_id |
| Validation | At API boundary only (Zod schemas) |
| Async jobs | Return 202 with PENDING status, poll for result |
