# Spec: Cast Studio v2

## Objective

Build a multi-tenant digital casting and wardrobe library that enables artists, external clients, and autonomous AI agents to generate, store, and track highly consistent multi-layout actor portfolios, looks, and fashion items — without custom model training.

Success looks like: an Artist in a Studio Workspace can create an Actor with a full portfolio (headshot, fullshot, expressions, character sheet, editorial), create Looks and Fashion Items, and share them with Clients. A Client in their own Client Workspace can browse shared assets, create their own, submit commissions, and premium-unlock approved work. An Admin sees and manages everything across all workspaces.

## Tech Stack

- **Backend**: Node.js + Express, TypeScript ESM
- **Frontend**: React + TypeScript
- **Database**: PostgreSQL
- **Image Generation**: fal.ai API (text_to_image, image_to_image, image_to_text models)
- **Image Storage**: fal.ai URLs (primary) + local server backup (future: AWS S3)
- **Auth**: Session-based for web, API keys for programmatic access
- **Notifications**: In-app + email

## Workspace Model

Cast Studio uses a **two-workspace model** for tenant isolation:

- **Studio Workspace** — where Artists and Admins work. Contains full creation tools, asset library, model management, system prompts.
- **Client Workspace** — where Clients operate. Contains shared assets (filtered view), commission submission, wallet management.
- **Admin** — workspace-agnostic. Sees and manages everything across all workspaces.
- One Client = one Client Workspace. One Studio = one Studio Workspace.
- Connection between workspaces: `asset_permissions` table + commission workflow.

## Roles and Permissions

| Role       | Workspace | Capabilities                                                                                                                                 |
| :--------- | :-------- | :------------------------------------------------------------------------------------------------------------------------------------------- |
| **Admin**  | All       | Manages everything: users, models, system prompts, taxonomy, commissions, sees all workspaces                                                |
| **Artist** | Studio    | Creates assets via all tools, shares assets (private/studio-public/client-shared), executes commissions, studio compute. Can be API-enabled. |
| **Client** | Client    | Creates assets via all tools, pays per wallet credit, limited settings, cannot share. Submits commissions, premium-unlocks.                  |
| **Agent**  | Studio    | Automated via API. Pre-flight escrow workflows, auto-refund on failure. API-enabled Artist role.                                             |

## Asset Types

Three independent asset types, plus one composition:

1. **Actor** — identity/character (created via Actor Designer)
2. **Look** — clothing/styling (created via Look Designer)
3. **Fashion Item** — individual clothing/accessory piece (created via Fashion Item Creator)
4. **Character Sheet** (composition) = Actor + Look

**How Clients Acquire Assets:**

1. **Create their own** — use Designer tools, pay per generation from wallet
2. **Commission** — request custom work from Artist, pay premium on approval
3. **Purchase from marketplace** — buy Actor Packages or Looks (Studio-only listings)

### Actor Designer Flow

1. **Create Actor identity** via 4 entry options:
   - Structured form (dropdowns/sliders for admin-defined properties)
   - Reference photo (vision model builds identity)
   - Raw text prompt (unrestricted, ChatGPT-style)
   - Randomize (grid of random base identities, select one to refine)

2. **Iterate headshot** (anchor image) — generate multiple options, select one
3. **Iterate fullshot** — depends on headshot being locked
4. **Iterate expressions** — depends on fullshot being locked
5. **Generate remaining assets** — character sheet, looks, editorial shots (regenerate or create new)
6. **Name character + fill admin-defined fields** → save to database
7. **Actor page opens** — shows all features, all asset types with generate/regenerate buttons

**Dependency chain:** Headshot > Fullshot > Expressions > Character Sheet / Looks / Editorial

- Editing/regenerating an upstream asset invalidates all downstream assets
- Obsolete assets show an explanatory banner with inline regenerate button
- Only headshot, fullshot, expressions are **editable**. Others are regenerate-only or create-new.

**Versioning:** Each asset_output tracks its version. When regenerated, the old version is archived in `asset_output_versions` and the current row is updated with new values and `version + 1`. This keeps the main table lean with only current versions.

**Reproducibility:** Each asset*output stores `generation_params` (the complete JSON body sent to fal.ai — model, seed, resolution, steps, guidance_scale, sampler, num_outputs, prompt, and all API parameters), `reference_images` (uploaded input images stored as `ref*{asset*id}*{version}\_{short_uuid}.png`), and `source_asset_outputs` (links to existing assets used as input). This makes every image exactly reproducible.

**Soft delete:** Assets are never hard-deleted. A `deleted_at` timestamp marks deletion. All queries filter `deleted_at IS NULL`. Only Admin can permanently remove.

### Look Designer Flow

Three input options:

1. **Generate from prompt** — type a description
2. **Extract from reference image** — vision model identifies clothing pieces, user selects which to include
3. **Compose from Fashion Item library** — select existing Fashion Items, system renders them together

All three converge: multiple options generated → user selects one → auto-name generated → user can edit name → save as Look.

Output: single image per Look (system prompt controls layout, angle, background).

### Fashion Item Creator Flow

1. Generate from prompt OR extract from reference image
2. Multiple options generated → user selects one → auto-name → edit name → save

Output: single image per Fashion Item (system prompt controls product-shot layout).

### Character Sheet

- Created on the Actor page by selecting a Look from the library
- Composes Actor identity + Look into a single output
- Stored as an asset_output linked to the Actor

## Marketplace (Studio-only storefront)

The Studio operates an e-commerce storefront where Clients purchase assets. Only Studio Workspace assets can be sold. Clients can only buy and create their own.

### How It Works

1. **Admin defines package rules** in Listings Settings — what outputs are required for each listing type, which generic standard look to use for character sheets/editorials
2. **Artist generates all required assets** (headshot, fullshot, expressions, etc.)
3. **Artist submits to marketplace** from the Asset Page — "Submit to Marketplace" button is only enabled when ALL required outputs have status SUCCESS
4. **Admin reviews** in Submissions — approves or rejects (no reasons, no resubmit flow for now)
5. **Approved assets** get `MARKETPLACE_APPROVED` status → listed on the store → visible on Artist's asset page with status tag
6. **Client purchases** from the store → wallet deducted → `client_id` set → assets appear in Client's library

### Marketplace Submission Statuses

| Status                 | Meaning                                    |
| ---------------------- | ------------------------------------------ |
| `MARKETPLACE_PENDING`  | Submitted by Artist, awaiting Admin review |
| `MARKETPLACE_APPROVED` | Approved by Admin, listed on store         |
| `MARKETPLACE_REJECTED` | Rejected by Admin                          |
| `MARKETPLACE_DELISTED` | Removed from store by Admin                |

### Listing Types

**Actor Package (fixed bundle, defined in Admin Listings Settings):**

- Headshot
- Fullshot
- Expression Sheet
- Character Sheet (using generic standard look — neutral outfit for uniformity)
- Editorial shots (using generic standard look)

**Individual Looks** — standalone, can be applied to any actor for custom character sheets

**Pricing:** Set by Admin at approval time. Sale is one-time — buyer gets rendered images and full ownership (`client_id` set).

**No prompt access:** Purchased assets are final images only. Client does not receive prompt recipe, seed, or generation parameters.

### Agent Marketplace Submission

Agents can submit assets to the marketplace via API only (no UI). Agent receives a brief externally, creates assets, and submits via API endpoint. Not connected to client commissions — Clients have no API access.

### Duplication & Source Tracking

**Artist duplication:** Artist can duplicate any asset they own (or marketplace-frozen asset). The duplicate:

- Inherits all fields (prompt recipe, seed, taxonomy values, outputs)
- Gets a new name
- Has `source_asset_id` pointing to the original
- Has `source_type = 'DUPLICATE'`
- Is fully editable (not marketplace-frozen)

**Client purchase:** When a Client purchases from the marketplace, a duplicate is created in their workspace:

- Same prompt recipe, seed, outputs (same image URLs)
- `client_id` set to the purchasing Client
- `source_asset_id` pointing to the original marketplace asset
- `source_type = 'MARKETPLACE_PURCHASE'`
- Original stays in Studio workspace, frozen

**Commission unlock:** When a Client premium-unlocks a commission, the asset gets:

- `client_id` set to the Client
- `source_type = 'COMMISSION'`

**Source types:**

| source_type            | Meaning                                     |
| ---------------------- | ------------------------------------------- |
| `ORIGINAL`             | Created from scratch, no source             |
| `MARKETPLACE_PURCHASE` | Bought from marketplace                     |
| `COMMISSION`           | Created via commission and premium unlocked |
| `DUPLICATE`            | Duplicated from another asset               |

### Marketplace Freeze

When `marketplace_status = 'MARKETPLACE_APPROVED'`, the asset becomes frozen:

- `is_marketplace_frozen = TRUE`
- No editing (headshot/fullshot/expressions locked)
- No regenerating
- No deleting
- Artist can still VIEW the asset
- Artist can duplicate it (creates a new editable copy)

### What Clients Can Do with Purchased Assets

- Use as-is (view images)
- Apply own Looks for additional Character Sheets and Editorial Shots
- Commission Artists for custom work based on purchased actors

## Ownership Rule

**`client_id` is the single source of truth. No exceptions.**

| `client_id`                                | Owner  | Artist can do                                 | Client can do                           |
| ------------------------------------------ | ------ | --------------------------------------------- | --------------------------------------- |
| **NULL**                                   | Studio | Full control — edit, regenerate, share, use   | Nothing (unless shared via permissions) |
| **Set** (after purchase or premium unlock) | Client | View only — cannot edit, regenerate, or share | Full control — owns it, can use freely  |

**The only way `client_id` gets set:** Client pays for marketplace purchase or premium unlocks a commission.

**The only way an Artist can use a client-owned asset:** Client commissions them again.

During commission review (before approval/purchase), shared assets are view-only — cannot be used in compositions or other commissions.

## Asset Libraries (e-commerce pattern):

All libraries follow an e-commerce pattern: grid of cards (image + name + tags) + rich sidebar filters.

### Actor Library

- Cards: headshot thumbnail + name + tags
- Filters: admin-defined actor properties (age, gender, ethnicity, etc.), creator, date, tags
- "Shared with Me" filter tag (for Client workspace)

### Look Library

- Cards: look image + name + tags
- Filters: gender/age (men/women/boys/girls), style, season, color palette, occasion, creator, date
- "Shared with Me" filter tag

### Fashion Item Library

- Cards: item image + name + tags
- Filters: gender/age, item type (clothing/shoes/accessories), sub-type (jackets/shirts/pants/etc.), style, color, season, creator, date
- "Shared with Me" filter tag

**All taxonomy is admin-managed** — add/remove categories, types, filter options, properties.

## Actor Page Layout

- **Top**: Actor name + headshot (side by side)
- **Actions**: "Edit Fields" + "Generate Look" (primary action)
- **Middle**: Grouped sections per asset type — each section shows generated images with clearly separated generate/regenerate/create-new buttons
- **Obsolete assets**: explanatory banner — "This asset is based on a previous version of the [Headshot/Fullshot]. Regenerate to update." — with inline Regenerate button
- **Bottom**: Character Sheet section with Look selector from library

## Commission Workflow

A formal workflow connecting Client Workspace → Studio Workspace:

1. **Client** fills commission request form (admin-defined fields) in Client Workspace
2. **Admin** receives request, assigns to Artist (or Agent) in Studio Workspace
3. **Artist/Agent** executes based on the brief
4. **Work submitted** for client review
5. **Client** approves or requests changes
6. **Approved** → premium unlock confirmation dialog → deduct credits from wallet → set `client_id` on asset → asset transferred to Client

### Commission Statuses

```
Requested → Assigned → In Progress → Submitted → Changes Requested → Approved → Cancelled
```

### Sidebar (all roles)

- **Client**: Commissions page showing submitted commissions with status
- **Artist**: Commissions page showing assigned commissions with status
- **Admin**: Commissions page showing all commissions, with ability to assign to Artists/Agents

## Model Management (fal.ai)

- Admin connects fal.ai API key
- System fetches available models from fal.ai API
- Models categorized by type: `text_to_image`, `image_to_image`, `image_to_text` (vision)
- Admin selects which models are available per task
- fal.ai API returns parameter schema → UI renders dynamic configuration form
- Admin configures parameters (image size, outputs, quality, etc.)

### Model Permissions

| Role       | Model Access                                                                      |
| :--------- | :-------------------------------------------------------------------------------- |
| **Admin**  | Picks models + configures all parameters                                          |
| **Artist** | Chooses from admin-approved models + adjusts settings within admin-defined ranges |
| **Client** | Adjusts settings only — no model choice                                           |

## API Key Management

- Available only to **Admin** and **API-enabled Artists**
- Admin marks an Artist as "API able" → auto-generates first API key
- Artists can create **multiple API keys** in Settings → API Keys
- Each key tracks cost usage independently (credits consumed, generations run)
- API keys are workspace-scoped, draw from **studio compute** (not wallet)
- **Clients never get API keys**

## System Prompts

Admin manages system prompt templates for every generation step:

- Actor generation (headshot, fullshot, expressions, character sheet, editorial)
- Look generation
- Fashion Item generation
- Reference extraction (vision model prompt for identifying clothing pieces)
- Character Sheet composition (actor + look combined prompt)

Each prompt template defines: shot type, background, pose, lighting, style. Artists and Clients fill in variables (actor description, clothing details) but the Admin controls the structure.

## Image Storage

- **Primary**: fal.ai URLs stored in `asset_outputs.image_url`
- **Backup**: async download to local server on every successful generation
- **Future**: migrate to AWS S3 — storage is abstracted behind an interface for swappable backends

## Notifications

Both **in-app** and **email** for all key events:

| Role       | Notification Events                                         |
| :--------- | :---------------------------------------------------------- |
| **Artist** | Commission assigned, commission approved, changes requested |
| **Client** | Work submitted for review, commission status change         |
| **Admin**  | New commission request, assignment needed                   |

## Generation UX

- **Async across all pages** — user hits generate, navigates freely, gets notified when done
- `asset_output` starts as `PENDING` → system polls fal.ai → updates to `SUCCESS` or `FAILED`
- **FAILED state**: red indicator on asset card + error message + Retry button
- Failed generations **still cost credits** (pay-per-click model — spec says clients absorb cost of bad rolls)

## Premium Unlock Flow

- Client reviews submitted work → clicks "Approve"
- Confirmation dialog shows premium cost
- Client confirms → credits deducted from wallet → `client_id` set on asset → asset appears in Client's library as owned
- If insufficient wallet balance → prompted to top up first

## Dashboards

| Role       | Content                                                                          |
| :--------- | :------------------------------------------------------------------------------- |
| **Artist** | Quick actions (New Actor, New Look, New Fashion Item) + recent activity (capped) |
| **Client** | Quick actions + recent activity (capped) + wallet balance                        |
| **Admin**  | Overview + recent activity across workspace + workspace stats                    |

## Sidebar Navigation

### Artist

- Dashboard
- Tools (Actor Designer | Look Designer | Fashion Item Creator)
- Library (Actors | Looks | Fashion Items)
- Marketplace
- Commissions
- Settings (profile, API keys if API-enabled)

### Client

- Dashboard
- Tools (Actor Designer | Look Designer | Fashion Item Creator)
- Library (Actors | Looks | Fashion Items — each with "Shared with Me" filter)
- Marketplace
- Commissions
- Settings (profile, wallet/top-up)

### Admin

- Dashboard
- Tools (Actor Designer | Look Designer | Fashion Item Creator)
- Library (Actors | Looks | Fashion Items)
- Marketplace
  - Store
  - Submissions
  - Listings Settings
- Commissions
- Settings:
  - Users & Roles (artists, clients, agents/API)
  - Models (fal.ai integration, model selection per task)
  - System Prompts (templates for each generation step)
  - Actor Properties (feature taxonomy — add/remove fields)
  - Look Taxonomy (gender/age, style, season, etc.)
  - Fashion Item Taxonomy (item types, sub-types, etc.)
  - Commission Form Templates (fields, required fields, options)

## Sharing Model

For Artist-created assets (before purchase):

| Visibility                                          | Who Can See                                       |
| :-------------------------------------------------- | :------------------------------------------------ |
| **Private**                                         | Creating Artist + Admins                          |
| **Studio Public**                                   | All Artists in the same Studio Workspace + Admins |
| **Client Shared** (via commission, before approval) | Specific Client + Admins — view only              |

After marketplace purchase or commission premium unlock, `client_id` is set and the asset is fully owned by the Client. See Ownership Rule above.

## Billing

| API Key Type             | Billing Source                                                                         |
| :----------------------- | :------------------------------------------------------------------------------------- |
| **Studio Key**           | Studio compute (Artist)                                                                |
| **Client Key**           | Client wallet (Client)                                                                 |
| **Agent**                | Pre-flight escrow — max estimated cost locked before execution, auto-refund on failure |
| **Marketplace Purchase** | Client wallet — one-time credit deduction, `client_id` set on purchase                 |
| **Premium Unlock**       | Client wallet — deducted on commission approval, `client_id` set                       |

## Database Schema

See `draft_api.md` for the full database schema with all tables, columns, types, constraints, indexes, and ER diagram.

## Boundaries

- **Always do:** Run tests before commits, follow naming conventions, validate inputs, filter all queries by workspace_id
- **Ask first:** Database schema changes, adding dependencies, changing system prompts, modifying taxonomy
- **Never do:** Commit secrets, edit vendor directories, remove failing tests without approval, modify Hermes own files

## Out of Scope

- Automated quality telemetry filters (clients/agents absorb cost of bad rolls)
- Soft-lock data archiving (hard cutoff on revocation)
- Custom model training / LoRA pipelines
- Data export (Day One)
- Public self-registration (accounts created by Admin or invited)

## Open Questions

- **Image storage migration path**: When to move from fal.ai + local backup to AWS S3
- **Inference provider beyond fal.ai**: Whether to support multiple providers (Replicate, etc.) in the future
- **Webhook reliability**: How to handle external payment/top-up failures mid-agent-loop
- **Multiple workspaces per user**: Currently one Client = one workspace; may need to support freelance artists working across studios

## Success Criteria

- [ ] Artist can create a full Actor portfolio (headshot → fullshot → expressions → character sheet → editorial)
- [ ] Artist can create Looks via prompt, reference extraction, or Fashion Item composition
- [ ] Artist can create Fashion Items via prompt or reference extraction
- [ ] Client can browse shared assets, create their own, and submit commissions
- [ ] Commission workflow functions end-to-end: request → assign → execute → review → approve → unlock
- [ ] Admin can manage models, system prompts, taxonomy, users, and commissions
- [ ] API-enabled Artists can generate and use multiple API keys with cost tracking
- [ ] Dependency chain works: editing headshot invalidates downstream assets with clear UI indication
- [ ] Obsolete assets show explanatory banner with inline regenerate
- [ ] Notifications fire in-app and via email for all key events
- [ ] Workspace isolation is complete: Studio and Client workspaces cannot see each other's data except via sharing
