# Session Resume Prompt

Copy this prompt to resume a new session without losing context:

---

I'm building Cast Studio v2 — a multi-tenant digital casting and wardrobe library. The spec documents are at `specs/` in this repo. Read them all before doing anything:

1. `specs/spec.md` — system spec (roles, flows, marketplace, ownership, versioning)
2. `specs/database-schema.md` — 16 tables (assets, outputs, versions, marketplace, commissions, etc.)
3. `specs/api.md` — ~65 REST endpoints
4. `specs/ui.md` — 10+ pages, 30+ components

## Key Decisions Already Made

### Workspace Model
- One Studio Workspace (Artists + Admins) + multiple Client Workspaces (one per client)
- Admin sees all workspaces
- Connection: asset_permissions table + commission workflow

### Roles
- **Admin**: manages everything, sees all workspaces
- **Artist**: Studio Workspace, creates/shares assets, executes commissions, can be API-enabled
- **Client**: own Client Workspace, creates assets (pays per credit), buys from marketplace, submits commissions
- **Agent**: API-only, automated via API keys

### Three Asset Types + One Composition
1. Actor (identity/character) — Actor Designer
2. Look (clothing/styling) — Look Designer
3. Fashion Item (individual piece) — Fashion Item Creator
4. Character Sheet = Actor + Look (composition)

### Actor Creation Flow
- 4 entry options: structured form / reference photo / raw text / randomize
- Iterate headshot (anchor) → fullshot → expressions (editable)
- Generate character sheet, editorial (regenerate or create-new)
- Dependency: Headshot > Fullshot > Expressions > others
- Name + admin fields → save → actor page opens

### Look Designer (3 input options)
1. Generate from prompt
2. Extract from reference (vision model identifies pieces, user selects)
3. Compose from Fashion Item library
- Multiple options → select one → auto-name → save

### Fashion Item Creator
- Generate from prompt OR extract from reference
- Multiple options → select one → auto-name → save

### Marketplace (Studio-only storefront)
- Artist creates assets → "Submit to Marketplace" button (enabled when ALL required outputs are SUCCESS)
- Admin defines package composition in Listings Settings (required outputs, generic standard look)
- Admin reviews in Submissions queue → approves (sets price) or rejects
- Marketplace statuses: MARKETPLACE_PENDING, APPROVED, REJECTED, DELISTED
- Client purchases → duplicate created in their workspace with source tracking
- Agent can submit via API only (no UI)
- Actor Package (fixed): headshot, fullshot, expressions, character sheet (generic look), editorial shots (generic look)
- Individual Looks: standalone, can be applied to any actor

### Ownership Rule
- `client_id = NULL` → Studio owns (Artist has full control)
- `client_id = set` → Client owns (Artist can view only)
- Only way to set: marketplace purchase or commission premium unlock

### Duplication & Source Tracking
- Artist can duplicate any asset → new name, same everything, source_asset_id points to original
- Client purchase creates duplicate with source_asset_id + source_type = MARKETPLACE_PURCHASE
- Source types: ORIGINAL, MARKETPLACE_PURCHASE, COMMISSION, DUPLICATE

### Versioning
- Each asset_output has a version number
- Regenerate: old row → asset_output_versions (archive), current row updated with version + 1
- Downstream assets marked obsolete when upstream changes

### Reproducibility
- `generation_params` = complete JSON body sent to fal.ai (model, seed, resolution, steps, guidance_scale, sampler, num_outputs, prompt, all API params)
- `reference_images` = uploaded input images, stored as `ref_{asset_id}_{version}_{short_uuid}.png`
- `source_asset_outputs` = links to existing assets used as input

### Soft Delete
- Assets: `deleted_at` timestamp, all queries filter `deleted_at IS NULL`
- Only Admin can hard-delete

### Commission Workflow
- Client submits → Admin assigns → Artist/Agent executes → Client reviews → approve/changes → premium unlock
- Statuses: Requested → Assigned → In Progress → Submitted → Changes Requested → Approved → Cancelled

### Model Management (fal.ai)
- Admin connects fal.ai API, selects models per task, configures parameters
- Admin picks models + params | Artist chooses approved models + settings | Client settings only

### API Key Management
- Admin and API-enabled Artists only
- Multiple keys per account, each tracks cost independently
- Clients never get API keys

### Image Storage
- Primary: fal.ai URLs | Backup: local server | Future: AWS S3

### Notifications
- In-app + email for all key events

### Tech Stack
- Backend: Node.js + Express, TypeScript ESM
- Frontend: React + TypeScript
- Database: PostgreSQL
- Image Generation: fal.ai API

## What's Next
The specs are complete. The next step is implementation planning — breaking the full scope into ordered, verifiable tasks. Ask me what to do next.
