# Implementation Plan — Cast Studio v2 Full Build

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-subagent-driven-development (recommended) or superpowers-executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all critical bugs, complete missing features, wire the generation pipeline to actually produce images, and bring Cast Studio v2 to a shippable state.

**Architecture:** Provider-agnostic generation pipeline (fal.ai + OpenRouter via fal.ai router), admin-managed model catalog (zero hardcoded models), dynamic taxonomy-driven filters, workspace-scoped everything.

**Tech Stack:** Node.js + Express + PostgreSQL + React 18 + TypeScript + Tailwind CSS + shadcn/ui + TanStack Query v5 + Zustand

---

## Required Skills

These skills MUST be loaded by the implementing agent at the start of each session:

| Skill                                       | Load Command                                                 | When                                                      |
| ------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------- |
| **taste-skill**                             | `skill_view(name="taste-skill")`                             | Before any frontend/UI code or design decisions           |
| **impeccable**                              | `skill_view(name="impeccable")`                              | Before any frontend layout/styling work — anti-slop rules |
| **shadcn**                                  | `skill_view(name="shadcn")`                                  | Before adding or modifying any UI components              |
| **agent-skills-code-review-and-quality**    | `skill_view(name="agent-skills-code-review-and-quality")`    | Before marking any task complete                          |
| **agent-skills-code-simplification**        | `skill_view(name="agent-skills-code-simplification")`        | After each task, before committing                        |
| **agent-skills-documentation-and-adrs**     | `skill_view(name="agent-skills-documentation-and-adrs")`     | After each architectural decision or API change           |
| **superpowers-subagent-driven-development** | `skill_view(name="superpowers-subagent-driven-development")` | If executing via subagent dispatch                        |
| **superpowers-executing-plans**             | `skill_view(name="superpowers-executing-plans")`             | If executing inline                                       |
| **superpowers-requesting-code-review**      | `skill_view(name="superpowers-requesting-code-review")`      | After each task for review                                |
| **superpowers-receiving-code-review**       | `skill_view(name="superpowers-receiving-code-review")`       | When receiving review feedback                            |

---

## File Map

### Backend (server/src/)

| Directory              | Files                                                                                                                                                  | Responsibility                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| `services/fal/`        | `api.ts`, `models.ts`, `types.ts`                                                                                                                      | fal.ai provider — queue submit, poll, image-to-text |
| `services/openrouter/` | `api.ts` (NEW)                                                                                                                                         | OpenRouter provider via fal.ai router node          |
| `services/generation/` | `generate.ts`, `regenerate.ts`, `character-sheet.ts`, `resolve-model.ts`, `generation-constants.ts`, `generation-types.ts`, `status.ts`                | Generation pipeline orchestration                   |
| `services/`            | `fal-service.ts`, `wallet-service.ts`, `commission-service.ts`, `marketplace/purchase.ts`, `collection-service.ts`, `notification-service.ts`          | Service layer                                       |
| `routes/`              | `actors.ts`, `looks.ts`, `fashion-items.ts`, `commissions.ts`, `collections.ts`, `admin/model-routes.ts`, `admin/taxonomy-routes.ts`, `admin/admin.ts` | HTTP route handlers                                 |
| `workers/`             | `generation-worker.ts`                                                                                                                                 | Background polling worker                           |
| `db/`                  | `pool.ts`, `query-helper.ts`, `migrations/`                                                                                                            | Database layer                                      |
| `db/repositories/`     | `asset-repo.ts`, `model-repo.ts`, `wallet-repo.ts`, `commission-repo.ts`                                                                               | Data access                                         |
| `middleware/`          | `requireSession.ts`, `requireWorkspace.ts`, `requireApiKey.ts`                                                                                         | Auth middleware                                     |
| `server.ts`            | —                                                                                                                                                      | App entry point, session config, worker start       |

### Frontend (client/src/)

| Directory                    | Files                                                                                                                                                                                                                          | Responsibility              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- |
| `components/actor-designer/` | `Stage1.tsx`, `Stage2.tsx`, `Stage3.tsx`, `StructuredFormPanel.tsx`, `SessionNavigator.tsx`, `useActorDesignerState.ts`, `types.ts`                                                                                            | Actor creation wizard       |
| `components/`                | `Sidebar.tsx`, `NotificationDropdown.tsx`, `AssetCard.tsx`, `AssetCardV2.tsx`, `GenerationStatus.tsx`, `FilterPanel.tsx`, `ModelParameterForm.tsx`, `ui/button.tsx`                                                            | Shared UI components        |
| `components/layout/`         | `PageContainer.tsx`, `PageHeader.tsx`, `LibraryLayout.tsx`, `LibraryToolbar.tsx`, `LibraryPagination.tsx`, `SingleAssetLayout.tsx`, `MultiOutputAssetLayout.tsx`                                                               | Layout components           |
| `pages/actors/`              | `ActorDesigner.tsx`, `ActorPage.tsx`, `ActorLibrary.tsx`, `ActorOutputs.tsx`, `useActorPage.ts`, `useActorPageRender.tsx`                                                                                                      | Actor pages                 |
| `pages/looks/`               | `LookDesigner.tsx`, `LookDesignerStep1.tsx`, `LookDesignerStep2.tsx`, `LookDetail.tsx`, `LookLibrary.tsx`                                                                                                                      | Look pages                  |
| `pages/fashion-items/`       | `FashionItemCreator.tsx`, `FashionItemDetail.tsx`, `FashionItemLibrary.tsx`                                                                                                                                                    | Fashion item pages          |
| `pages/marketplace/`         | `MarketplacePage.tsx`, `MarketplaceDetail.tsx`, `MarketplaceManage.tsx`, `NewListing.tsx`                                                                                                                                      | Marketplace pages           |
| `pages/commissions/`         | `CommissionDetail.tsx`, `CommissionsList.tsx`, `NewCommission.tsx`, `AdminActions.tsx`, `ArtistActions.tsx`, `ClientActions.tsx`                                                                                               | Commission pages            |
| `pages/settings/`            | `SettingsPage.tsx`, `ModelsPage.tsx`, `ConfiguredModels.tsx`, `TaxonomyPage.tsx`, `UsersPage.tsx`, `CommissionFormsPage.tsx`, `PromptsPage.tsx`, `ApiKeysPage.tsx`, `WalletPage.tsx`                                           | Settings pages              |
| `pages/collections/`         | `CollectionsPage.tsx`, `CollectionDetail.tsx`                                                                                                                                                                                  | Collection pages            |
| `hooks/`                     | `useAdminModels.ts`, `useAdminTaxonomy.ts`, `useActors.ts`, `useLooks.ts`, `useFashionItems.ts`, `useCollections.ts`, `useCommissions.ts`, `useMarketplace.ts`, `useWallet.ts`, `useNotifications.ts`, `useActorGeneration.ts` | Data-fetching hooks         |
| `lib/`                       | `api-client.ts`, `navigation.ts`, `query-client.ts`, `utils.ts`                                                                                                                                                                | Shared utilities            |
| `store/`                     | `ui-store.ts`                                                                                                                                                                                                                  | Zustand UI state            |
| `router.tsx`                 | —                                                                                                                                                                                                                              | React Router config         |
| `App.tsx`                    | —                                                                                                                                                                                                                              | App shell, sidebar, routing |

---

## Phase 0: Schema Prerequisite

> **Blocks:** C1 (purchase duplication), C3 (generation versioning)
> **Estimated scope:** XS — 1 migration file, 1 table change
> **Skills needed:** None special

### Task 0: Add UNIQUE constraint to asset_output_versions

**Files:**

- Create: `server/src/db/migrations/012_asset_output_versions_unique.up.sql`
- Create: `server/src/db/migrations/012_asset_output_versions_unique.down.sql`

- [ ] **Step 1: Create migration up**

```sql
-- Migration 012: Add unique constraint to asset_output_versions
-- Required for ON CONFLICT upsert in asset-repo.ts to work correctly
ALTER TABLE asset_output_versions
  ADD CONSTRAINT uq_versions_output UNIQUE (asset_output_id, version);
```

- [ ] **Step 2: Create migration down**

```sql
ALTER TABLE asset_output_versions
  DROP CONSTRAINT IF EXISTS uq_versions_output;
```

- [ ] **Step 3: Run migration**

```bash
cd server && npx tsx src/db/migrate.ts up
```

- [ ] **Step 4: Verify**

```bash
cd server && npx tsx src/db/migrate.ts status
# Should show 012 as applied
```

- [ ] **Step 5: Commit**

```bash
git add server/src/db/migrations/012_asset_output_versions_unique.up.sql server/src/db/migrations/012_asset_output_versions_unique.down.sql
git commit -m "fix: add unique constraint to asset_output_versions for upsert integrity"
```

---

## Phase 1: Critical Bug Fixes

> **Blocks:** Everything else. These are broken core functionality.
> **Estimated scope:** L — ~15 files across frontend + backend
> **Skills needed:** agent-skills-code-review-and-quality

### Task 1: Fix marketplace purchase to duplicate (not transfer)

**Files:**

- Modify: `server/src/services/marketplace/purchase.ts:96-99`
- Test: `server/tests/marketplace.test.ts` (add test case)

- [ ] **Step 1: Write the failing test**

```typescript
it('purchaseListing creates a duplicate asset, does not transfer original', async () => {
  // Create a studio asset with marketplace_status = 'MARKETPLACE_APPROVED'
  // Call purchaseListing with a client account
  // Assert: original asset still has client_id = NULL, is_marketplace_frozen = TRUE
  // Assert: new asset exists with client_id = clientId, source_type = 'MARKETPLACE_PURCHASE'
  // Assert: new asset has same prompt_recipe, seed, generation_params
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server && npx vitest run -- marketplace.test.ts
# Expected: FAIL — purchase transfers instead of duplicating
```

- [ ] **Step 3: Implement the fix**

Replace the `UPDATE assets SET client_id = $1...` with:

1. Call `duplicateAsset(originalAssetId, clientId, 'MARKETPLACE_PURCHASE')` — creates new asset row
2. Call `duplicateAssetOutputs(originalAssetId, newAssetId)` — copies outputs
3. Set `client_id` on the DUPLICATE, not the original
4. Original stays frozen: `is_marketplace_frozen = TRUE`, `marketplace_status = 'MARKETPLACE_APPROVED'`

- [ ] **Step 4: Run test to verify it passes**

```bash
cd server && npx vitest run -- marketplace.test.ts
# Expected: PASS
```

- [ ] **Step 5: Commit**

```bash
git add server/src/services/marketplace/purchase.ts server/tests/marketplace.test.ts
git commit -m "fix: marketplace purchase duplicates asset instead of transferring original"
```

---

### Task 2: Add idempotency to commission premium unlock

**Files:**

- Modify: `server/src/services/commission-service.ts:230-233`
- Modify: `server/src/db/migrations/013_commission_premium_unlocked.up.sql` (NEW)
- Test: `server/tests/commissions.test.ts`

- [ ] **Step 1: Create migration — add `is_premium_unlocked` column**

```sql
ALTER TABLE commissions ADD COLUMN is_premium_unlocked BOOLEAN NOT NULL DEFAULT FALSE;
```

- [ ] **Step 2: Write failing test**

```typescript
it('unlockCommissionPremium is idempotent — double-call does not double-charge', async () => {
  // Create a commission in SUBMITTED status with premium_cost > 0
  // Call transitionCommissionStatus to APPROVED twice
  // Assert: wallet deducted only once (check ledger entries)
  // Assert: client_id set on assets only once
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd server && npx vitest run -- commissions.test.ts
# Expected: FAIL — double-charge on retry
```

- [ ] **Step 4: Implement the fix**

In `unlockCommissionPremium()`:

1. Check `commission.is_premium_unlocked === true` → return early if already unlocked
2. Wrap wallet deduction + client_id update in a single transaction
3. Set `is_premium_unlocked = true` in the same transaction

- [ ] **Step 5: Run test to verify it passes**

```bash
cd server && npx vitest run -- commissions.test.ts
# Expected: PASS
```

- [ ] **Step 6: Commit**

```bash
git add server/src/services/commission-service.ts server/src/db/migrations/013_commission_premium_unlocked.up.sql server/tests/commissions.test.ts
git commit -m "fix: add idempotency guard to commission premium unlock"
```

---

### Task 3: Fix multi-output generation partial failure

**Files:**

- Modify: `server/src/services/generation/generate.ts:134-204`
- Test: `server/tests/generation.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
it('when output 2 of 3 fails, output 1 is marked FAILED not left PENDING', async () => {
  // Mock fal.submitTextToImage: succeed once, then throw
  // Call generateActorOutput with num_outputs: 3
  // Assert: all 3 outputs have status 'FAILED'
  // Assert: credits refunded for all 3
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server && npx vitest run -- generation.test.ts
# Expected: FAIL — orphan PENDING rows
```

- [ ] **Step 3: Implement the fix**

In the `for` loop at `generate.ts:134`:

1. Store `fal_job_id` BEFORE submit (move the job creation before the try/catch)
2. On any failure in the loop, catch the error, then update ALL remaining outputs (including already-submitted ones) to FAILED
3. Refund credits for ALL outputs, not just the failed one
4. Use a DB transaction for the batch update

- [ ] **Step 4: Run test to verify it passes**

```bash
cd server && npx vitest run -- generation.test.ts
# Expected: PASS
```

- [ ] **Step 5: Commit**

```bash
git add server/src/services/generation/generate.ts server/tests/generation.test.ts
git commit -m "fix: rollback all outputs on multi-output generation partial failure"
```

---

### Task 4: Make library filters dynamic from taxonomy API

**Files:**

- Modify: `client/src/pages/actors/ActorLibrary.tsx:22-61`
- Modify: `client/src/pages/looks/LookLibrary.tsx:22-78`
- Modify: `client/src/pages/fashion-items/FashionItemLibrary.tsx:22-89`
- Modify: `client/src/hooks/useAdminTaxonomy.ts` (add category-specific fetch)

- [ ] **Step 1: Add `useTaxonomyFilters` hook**

Create `client/src/hooks/useTaxonomyFilters.ts`:

```typescript
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export function useTaxonomyFilters(category: string) {
  return useQuery({
    queryKey: ['taxonomy', 'filters', category],
    queryFn: async () => {
      const { data } = await apiClient.get(`/admin/taxonomy?category=${category}`);
      // Transform taxonomy entries into filter groups
      return data.map((entry: any) => ({
        key: entry.key,
        label: entry.label,
        type: entry.input_type,
        options: entry.options || [],
      }));
    },
  });
}
```

- [ ] **Step 2: Replace hardcoded filters in all 3 library pages**

In each of `ActorLibrary.tsx`, `LookLibrary.tsx`, `FashionItemLibrary.tsx`:

1. Import `useTaxonomyFilters`
2. Replace the hardcoded `ACTOR_FILTER_GROUPS` / `LOOK_FILTER_GROUPS` / `FASHION_FILTER_GROUPS` with the hook result
3. Pass the dynamic groups to `<FilterPanel groups={filters} />`
4. Add loading state while filters fetch

- [ ] **Step 3: Verify**

```bash
cd client && npx tsc --noEmit
# Expected: clean
```

- [ ] **Step 4: Commit**

```bash
git add client/src/hooks/useTaxonomyFilters.ts client/src/pages/actors/ActorLibrary.tsx client/src/pages/looks/LookLibrary.tsx client/src/pages/fashion-items/FashionItemLibrary.tsx
git commit -m "feat: replace hardcoded library filters with dynamic taxonomy-driven filters"
```

---

### Task 5: Fix wallet cache invalidation + race condition

**Files:**

- Modify: `server/src/services/marketplace/purchase.ts:83-87`
- Modify: `server/src/services/commission-service.ts:319-322`
- Modify: `server/src/db/repositories/wallet-repo.ts:214-241`
- Test: `server/tests/wallet.test.ts`

- [ ] **Step 1: Write failing test for cache**

```typescript
it('purchaseListing invalidates wallet cache after deduction', async () => {
  // Mock wallet cache
  // Call purchaseListing
  // Assert: invalidateWalletCacheEntry was called with the wallet ID
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server && npx vitest run -- wallet.test.ts
# Expected: FAIL — cache not invalidated
```

- [ ] **Step 3: Fix cache invalidation**

In `purchase.ts` and `commission-service.ts`, after the raw `dbClient.query` UPDATE:

```typescript
import { invalidateWalletCacheEntry } from '../db/repositories/wallet-repo.js';
// After balance update:
invalidateWalletCacheEntry(walletId);
```

- [ ] **Step 4: Fix race condition in reserveCreditsForGeneration**

Replace the non-atomic balance check with:

```typescript
const result = await query(
  'UPDATE wallets SET balance_credits = balance_credits - $1 WHERE id = $2 AND balance_credits >= $1 RETURNING balance_credits',
  [amount, walletId],
);
if (result.rowCount === 0) {
  throw new InsufficientCreditsError(currentBalance, amount);
}
```

- [ ] **Step 5: Run tests**

```bash
cd server && npx vitest run -- wallet.test.ts
# Expected: PASS
```

- [ ] **Step 6: Commit**

```bash
git add server/src/services/marketplace/purchase.ts server/src/services/commission-service.ts server/src/db/repositories/wallet-repo.ts server/tests/wallet.test.ts
git commit -m "fix: wallet cache invalidation and atomic credit reservation"
```

---

## Phase 2: Security & Correctness

> **Estimated scope:** M — ~10 files
> **Skills needed:** agent-skills-code-review-and-quality

### Task 6: Security hardening bundle

**Files (all modified):**

- `server/src/services/fal/api.ts` — Remove hardcoded model switch, make fully dynamic
- `server/src/services/generation/generation-constants.ts` — Remove `DEFAULT_MODEL`
- `server/src/routes/admin/admin.ts` — Add router-level admin middleware
- `server/src/routes/admin/model-routes.ts` — Add rowCount check on DELETE
- `server/src/routes/admin/taxonomy-routes.ts` — Add rowCount check on DELETE
- `server/src/server.ts` — Verify SESSION_SECRET enforcement

- [ ] **Step 1: Make `getModelEndpoint()` fully dynamic**

Replace the entire switch statement with:

```typescript
function getModelEndpoint(model: string): string {
  // Any model with a slash is a fully-qualified fal.ai model ID
  if (model.includes('/')) {
    return `https://queue.fal.run/${model}`;
  }
  // Short names — look up from DB or use queue endpoint
  return `https://queue.fal.run/fal-ai/${model}`;
}
```

Remove the `switch` block entirely. Remove `DEFAULT_MODEL` from `generation-constants.ts`. In `resolveModel()`, if no active models exist, throw an error: `'No models configured. Please add models in Settings → Models.'`.

- [ ] **Step 2: Add router-level admin middleware**

In `server/src/routes/admin/admin.ts`, after the existing imports:

```typescript
const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (req.account?.role !== 'ADMIN') {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } });
    return;
  }
  next();
};
router.use(requireAdmin);
```

- [ ] **Step 3: Fix DELETE rowCount checks**

In `model-routes.ts` and `taxonomy-routes.ts`, add after each DELETE:

```typescript
const result = await query('DELETE FROM models WHERE id = $1', [req.params.id]);
if (result.rowCount === 0) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Model not found' } });
  return;
}
```

- [ ] **Step 4: Verify SESSION_SECRET enforcement**

Check `server.ts:39-44` — already throws in production. Verify the error message is clear.

- [ ] **Step 5: Run all server tests**

```bash
cd server && npx vitest run
# Expected: all pass
```

- [ ] **Step 6: Commit**

```bash
git add server/src/services/fal/api.ts server/src/services/generation/generation-constants.ts server/src/routes/admin/admin.ts server/src/routes/admin/model-routes.ts server/src/routes/admin/taxonomy-routes.ts
git commit -m "security: dynamic model endpoints, router-level admin guard, DELETE rowCount checks"
```

---

### Task 7: Fix getAssetOutputs workspace filter + admin DELETE endpoints

**Files:**

- Modify: `server/src/db/repositories/asset-repo.ts:365-371`
- Test: `server/tests/asset-repo-soft-delete.test.ts`

- [ ] **Step 1: Add workspace filter to getAssetOutputs**

```typescript
export async function getAssetOutputs(
  assetId: string,
  workspaceId?: string,
): Promise<AssetOutputRow[]> {
  let sql = `SELECT ao.* FROM asset_outputs ao`;
  const params: string[] = [assetId];
  if (workspaceId) {
    sql += ` JOIN assets a ON ao.asset_id = a.id WHERE ao.asset_id = $1 AND a.workspace_id = $2`;
    params.push(workspaceId);
  } else {
    sql += ` WHERE ao.asset_id = $1`;
  }
  sql += ` ORDER BY ao.created_at DESC LIMIT 100`;
  const result = await query(sql, params);
  return result.rows as AssetOutputRow[];
}
```

- [ ] **Step 2: Update all callers to pass workspaceId**

Search for all `getAssetOutputs(` calls and add the workspaceId parameter.

- [ ] **Step 3: Run tests**

```bash
cd server && npx vitest run -- asset-repo
# Expected: PASS
```

- [ ] **Step 4: Commit**

```bash
git add server/src/db/repositories/asset-repo.ts
git commit -m "fix: add workspace filter to getAssetOutputs"
```

---

## Phase 3: Generation Pipeline — Make Images Actually Work

> **This is the core feature. Without this, the app is a CRUD shell with no images.**
> **Estimated scope:** XL — ~20 files, new provider module, new migration, frontend model selector
> **Skills needed:** agent-skills-code-review-and-quality, agent-skills-documentation-and-adrs

### Task 8: Add `provider` column to models table + seed data

**Files:**

- Create: `server/src/db/migrations/013_models_provider.up.sql`
- Create: `server/src/db/migrations/013_models_provider.down.sql`
- Modify: `server/src/db/repositories/model-repo.ts`
- Modify: `server/src/db/seed.ts` — Add seed models

- [ ] **Step 1: Create migration**

```sql
-- Migration 013: Add provider column to models
ALTER TABLE models ADD COLUMN IF NOT EXISTS provider VARCHAR(50) NOT NULL DEFAULT 'fal';
ALTER TABLE models ADD COLUMN IF NOT EXISTS endpoint VARCHAR(500);
-- Create index for provider lookups
CREATE INDEX IF NOT EXISTS idx_models_provider ON models (provider);
```

- [ ] **Step 2: Update model-repo.ts**

Add `provider` and `endpoint` to the `ModelRow` interface and all query functions.

- [ ] **Step 3: Add seed data for required models**

In `seed.ts`, add:

```typescript
// Generation models (fal.ai)
await query(`INSERT INTO models (model_id, name, model_type, task, provider, is_active, input_schema) VALUES
  ('fal-ai/nano-banana-2', 'Nano Banana 2', 'text_to_image', 'actor_headshot', 'fal', true, '{}'),
  ('fal-ai/nano-banana-pro', 'Nano Banana Pro', 'text_to_image', 'actor_headshot', 'fal', true, '{}'),
  ('fal-ai/chatgpt-image-2', 'ChatGPT Image 2', 'text_to_image', 'actor_headshot', 'fal', true, '{}'),
  ('fal-ai/chatgpt-image-2', 'ChatGPT Image 2 (Edit)', 'image_to_image', 'actor_headshot', 'fal', true, '{}')
  ON CONFLICT DO NOTHING
`);

// Vision model
await query(`INSERT INTO models (model_id, name, model_type, task, provider, is_active, input_schema) VALUES
  ('fal-ai/flux-pro/v1/image-to-text', 'Flux Pro VLM', 'image_to_text', 'reference_extraction', 'fal', true, '{}')
  ON CONFLICT DO NOTHING
`);
```

- [ ] **Step 4: Run migration + seed**

```bash
cd server && npx tsx src/db/migrate.ts up && npx tsx src/db/seed.ts
```

- [ ] **Step 5: Commit**

```bash
git add server/src/db/migrations/013_models_provider.up.sql server/src/db/migrations/013_models_provider.down.sql server/src/db/repositories/model-repo.ts server/src/db/seed.ts
git commit -m "feat: add provider column and seed models (nano-banana, chatgpt-image, VLM)"
```

---

### Task 9: Create OpenRouter provider module

**Files:**

- Create: `server/src/services/openrouter/api.ts`
- Create: `server/src/services/openrouter/types.ts`

- [ ] **Step 1: Create types**

```typescript
// server/src/services/openrouter/types.ts
export interface OpenRouterMessage {
  role: 'user' | 'assistant' | 'system';
  content:
    | string
    | Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }>;
}

export interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  max_tokens?: number;
  temperature?: number;
}

export interface OpenRouterResult {
  id: string;
  status: 'SUCCESS' | 'FAILED';
  image_url: string | null;
  error_message: string | null;
}
```

- [ ] **Step 2: Create OpenRouter API module**

```typescript
// server/src/services/openrouter/api.ts
const FAL_ROUTER_ENDPOINT = 'https://fal.run/openrouter/router';

export async function submitOpenRouterRequest(
  model: string,
  messages: OpenRouterMessage[],
  apiKey: string,
): Promise<OpenRouterResult> {
  const response = await fetch(FAL_ROUTER_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, messages }),
  });
  if (!response.ok) {
    const text = await response.text();
    return {
      id: '',
      status: 'FAILED',
      image_url: null,
      error_message: `OpenRouter error (${response.status}): ${text}`,
    };
  }
  const data = await response.json();
  // Extract image URL from OpenAI-compatible response
  const content = data.choices?.[0]?.message?.content;
  return {
    id: data.id || `or_${Date.now()}`,
    status: 'SUCCESS',
    image_url: content || null,
    error_message: null,
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add server/src/services/openrouter/api.ts server/src/services/openrouter/types.ts
git commit -m "feat: add OpenRouter provider module via fal.ai router node"
```

---

### Task 10: Wire provider routing into generation pipeline

**Files:**

- Modify: `server/src/services/generation/generate.ts` — Route to correct provider
- Modify: `server/src/services/generation/resolve-model.ts` — Return provider info
- Modify: `server/src/workers/generation-worker.ts` — Handle OpenRouter (synchronous)
- Modify: `server/src/services/fal-service.ts` — Export provider resolution

- [ ] **Step 1: Update resolve-model.ts to return provider**

```typescript
export interface ResolvedModel {
  modelId: string;
  provider: 'fal' | 'openrouter';
  endpoint: string;
}

export async function resolveModel(requestedModel?: string, task?: string): Promise<ResolvedModel> {
  // ... existing logic to find model from DB ...
  // Return { modelId: found.model_id, provider: found.provider || 'fal', endpoint: found.endpoint || getModelEndpoint(found.model_id) }
  // If no model found, throw error (no more DEFAULT_MODEL fallback)
}
```

- [ ] **Step 2: Update generate.ts to route by provider**

```typescript
const resolved = await resolveModel(options.model, task);
// ...
if (resolved.provider === 'openrouter') {
  const result = await openrouterApi.submitOpenRouterRequest(
    resolved.modelId, messages, workspaceKey
  );
  // Store result directly — no queue polling needed
  outputGenerationParams['openrouter_result'] = result;
  await updateOutputStatus(output.id, result.status, result.image_url, result.error_message);
} else {
  // Existing fal.ai path
  const result = await fal.submitTextToImage({ ... }, workspaceKey);
  // ... existing polling-based flow
}
```

- [ ] **Step 3: Update generation-worker.ts for OpenRouter**

```typescript
// In processSingleOutput:
if (generationParams['openrouter_result']) {
  // Already resolved synchronously — just update status
  const result = generationParams['openrouter_result'];
  await updateOutputsStatus(output.asset_id, [output.id], result.status, {
    image_url: result.image_url,
    error_message: result.error_message,
  });
  return;
}
// Existing fal.ai polling path...
```

- [ ] **Step 4: Run tests**

```bash
cd server && npx vitest run
# Expected: all pass
```

- [ ] **Step 5: Commit**

```bash
git add server/src/services/generation/generate.ts server/src/services/generation/resolve-model.ts server/src/workers/generation-worker.ts server/src/services/fal-service.ts
git commit -m "feat: wire provider routing into generation pipeline (fal.ai + OpenRouter)"
```

---

### Task 11: Frontend model selector in Actor Designer

**Files:**

- Modify: `client/src/components/actor-designer/Stage2.tsx`
- Modify: `client/src/components/actor-designer/useActorDesignerState.ts`
- Modify: `client/src/pages/actors/ActorDesigner.tsx`

- [ ] **Step 1: Add model selector to Stage2**

At the top of Stage 2 (above the stepper), add a `<Select>` dropdown:

- Label: "Model"
- Options: active models from `useAdminModels()`
- Default: first active model
- When no models: show warning "No models configured. Go to Settings → Models."
- On change: update `selectedModel` state in `useActorDesignerState`

- [ ] **Step 2: Pass model in generate/regenerate mutations**

In `useActorDesignerState.ts`, the `generateMutation` and `regenerateMutation` already send `model: selectedModel`. Verify this is wired correctly.

- [ ] **Step 3: Verify TypeScript**

```bash
cd client && npx tsc --noEmit
# Expected: clean
```

- [ ] **Step 4: Commit**

```bash
git add client/src/components/actor-designer/Stage2.tsx client/src/components/actor-designer/useActorDesignerState.ts client/src/pages/actors/ActorDesigner.tsx
git commit -m "feat: add model selector to Actor Designer Stage 2"
```

---

### Task 12: Look Designer reference extraction — wire vision model

**Files:**

- Create: `server/src/routes/looks.ts` — Add `POST /api/looks/extract-reference` endpoint
- Modify: `client/src/pages/looks/LookDesignerStep1.tsx:75`
- Modify: `server/src/services/fal/api.ts` — Verify `imageToText()` works

- [ ] **Step 1: Add extract-reference endpoint**

```typescript
// In server/src/routes/looks.ts
router.post('/extract-reference', requireSession, requireWorkspace, async (req, res) => {
  const { image_url, prompt } = req.body;
  if (!image_url) {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'image_url required' } });
    return;
  }
  const workspaceKey = await getWorkspaceApiKey(req.workspace!.id);
  if (!workspaceKey) {
    res.status(400).json({ error: { code: 'NO_API_KEY', message: 'No fal.ai key configured' } });
    return;
  }
  const extractionPrompt =
    prompt ||
    'List all clothing items, accessories, and footwear visible in this image. Return as a simple list.';
  const result = await fal.imageToText(image_url, extractionPrompt, workspaceKey);
  // Parse the text response into individual items
  const items = result
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  res.json({ items, raw: result });
});
```

- [ ] **Step 2: Update LookDesignerStep1.tsx**

Replace the hardcoded `['Jacket', 'Shirt', 'Pants', 'Shoes', 'Watch']` with:

1. On reference image upload, call `POST /api/looks/extract-reference` with the image URL
2. Show loading state while extracting
3. Populate extracted pieces checkboxes with the API response
4. User can toggle pieces on/off before generating

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/looks.ts client/src/pages/looks/LookDesignerStep1.tsx
git commit -m "feat: wire vision model for reference extraction in Look Designer"
```

---

## Phase 4: Feature Completion

> **Estimated scope:** L — ~20 files
> **Skills needed:** taste-skill, impeccable, shadcn (for frontend tasks), agent-skills-code-review-and-quality

### Task 13: Actor Page missing features

**Files:**

- Modify: `client/src/pages/actors/useActorPage.ts:101` — Fix marketplace required outputs check
- Create: `client/src/components/ObsoleteBanner.tsx` — NEW component
- Modify: `client/src/pages/actors/useActorPageRender.tsx` — Add obsolete banner + DELISTED status
- Modify: `client/src/pages/actors/ActorPage.tsx` — Add Character Sheet Look selector

- [ ] **Step 1: Create ObsoleteBanner component**

```tsx
// client/src/components/ObsoleteBanner.tsx
import { AlertTriangle } from 'lucide-react';

export function ObsoleteBanner({
  reason,
  onRegenerate,
}: {
  reason: string;
  onRegenerate: () => void;
}) {
  return (
    <div className="flex items-center gap-3 border border-border bg-surface-container-low p-4 mb-4">
      <AlertTriangle className="size-5 text-warning shrink-0" />
      <p className="text-sm text-text-secondary flex-1">{reason}</p>
      <button onClick={onRegenerate} className="btn-sm btn-outline">
        Regenerate
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Add banner to useActorPageRender**

When `output.is_obsolete === true`, render `<ObsoleteBanner reason={output.obsolete_reason} onRegenerate={...} />` above the output images.

- [ ] **Step 3: Add MARKETPLACE_DELISTED to statusBadge**

Add case for `MARKETPLACE_DELISTED` → gray badge with "Delisted" text.

- [ ] **Step 4: Add Character Sheet Look selector**

On the Actor page, add a `<Select>` populated from the workspace Look library. On selection + Generate click, call `POST /api/actors/:id/character-sheet` with the `look_id`.

- [ ] **Step 5: Fix marketplace required outputs check**

Replace the hardcoded `['headshot', 'fullshot', 'expressions_3x4']` with a fetch of `marketplace_settings.actor_package.required_outputs` and check against those.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/ObsoleteBanner.tsx client/src/pages/actors/useActorPageRender.tsx client/src/pages/actors/ActorPage.tsx client/src/pages/actors/useActorPage.ts
git commit -m "feat: obsolete banner, DELISTED status, Look selector, dynamic marketplace check"
```

---

### Task 14: Stage 3 taxonomy fields editable + Randomize entry method

**Files:**

- Modify: `client/src/components/actor-designer/Stage3.tsx:46-54`
- Modify: `client/src/components/actor-designer/Stage1.tsx:12-31`
- Modify: `client/src/components/actor-designer/types.ts`

- [ ] **Step 1: Make Stage 3 fields editable**

Replace the read-only display with an editable form using `ActorFormFields` component. The form should work for all entry methods (FORM, TEXT, REFERENCE), not just FORM.

- [ ] **Step 2: Add Randomize entry method**

Add 4th option card to Stage1 grid:

```tsx
{ value: 'RANDOMIZE', label: 'Randomize', icon: Shuffle, description: 'Generate random identities to pick from' }
```

Update `EntryMethod` type to include `'RANDOMIZE'`. In `useActorDesignerState`, when `entryMethod === 'RANDOMIZE'`, generate random form values and proceed to Stage 2.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/actor-designer/Stage3.tsx client/src/components/actor-designer/Stage1.tsx client/src/components/actor-designer/types.ts
git commit -m "feat: editable Stage 3 taxonomy fields, Randomize entry method"
```

---

### Task 15: Admin features — Commission Forms + Users management

**Files:**

- Create: `server/src/routes/admin/commission-form-routes.ts`
- Create: `server/src/services/commission-form-service.ts`
- Create: `server/src/db/migrations/014_commission_forms.up.sql`
- Modify: `client/src/pages/settings/CommissionFormsPage.tsx`
- Modify: `client/src/pages/settings/UsersPage.tsx`

- [ ] **Step 1: Create commission_forms table + migration**

```sql
CREATE TABLE IF NOT EXISTS commission_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  fields JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

- [ ] **Step 2: Build CRUD service + routes**

Standard CRUD: GET /admin/commission-forms, POST, PATCH, DELETE.

- [ ] **Step 3: Enable "New Form" button in frontend**

Replace the disabled "Coming Soon" button with a working form builder that calls the new API.

- [ ] **Step 4: Add Users management to admin**

Build a user list page with role filter, workspace filter, and ability to toggle `is_api_able`.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/admin/commission-form-routes.ts server/src/services/commission-form-service.ts server/src/db/migrations/014_commission_forms.up.sql client/src/pages/settings/CommissionFormsPage.tsx client/src/pages/settings/UsersPage.tsx
git commit -m "feat: commission form templates CRUD, admin user management"
```

---

### Task 16: Frontend code quality — deduplication + design tokens

**Files:**

- Modify: `client/src/pages/looks/LookDetail.tsx`
- Modify: `client/src/pages/fashion-items/FashionItemDetail.tsx`
- Modify: `client/src/components/actor-designer/Stage3.tsx`
- Modify: `client/src/components/SchemaField.tsx`
- Delete: `client/src/components/TopBar.tsx`

- [ ] **Step 1: Deduplicate LookDetail + FashionItemDetail**

Extract shared `SingleAssetDetail` component. Both pages already use `SingleAssetLayout`. The only differences are the data source hook and the page title.

- [ ] **Step 2: Fix hardcoded colors**

In `Stage3.tsx:47-53`, replace `neutral-200/500/900` with `border-border`, `text-muted-foreground`, `text-foreground`.

In `SchemaField.tsx`, replace `#A8A29E`, `#57534E`, `#D6D3D1` with CSS variables.

- [ ] **Step 3: Remove unused TopBar**

```bash
rm client/src/components/TopBar.tsx
```

- [ ] **Step 4: Fix window.location.href → navigate()**

In `MarketplacePage.tsx:127` and `LibraryLayout.tsx:103`, replace `window.location.href` with `useNavigate()`.

- [ ] **Step 5: Fix multi-value filter in all 3 libraries**

Replace `if (vals.length === 1) result[key] = vals[0]` with `result[key] = vals`.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/looks/LookDetail.tsx client/src/pages/fashion-items/FashionItemDetail.tsx client/src/components/actor-designer/Stage3.tsx client/src/components/SchemaField.tsx client/src/pages/marketplace/MarketplacePage.tsx client/src/components/layout/LibraryLayout.tsx client/src/pages/actors/ActorLibrary.tsx client/src/pages/looks/LookLibrary.tsx client/src/pages/fashion-items/FashionItemLibrary.tsx
git rm client/src/components/TopBar.tsx
git commit -m "refactor: deduplicate detail pages, fix design tokens, remove dead code"
```

---

## Phase 5: Polish

> **Estimated scope:** S — ~5 files
> **Skills needed:** agent-skills-code-simplification

### Task 17: Final cleanup bundle

**Files:**

- `client/src/pages/Dashboard.tsx` — Fix Quick Actions grid (show all, not slice(0,3)), fix dead "View All" button, fix duplicate JSDoc
- `client/src/components/NotificationDropdown.tsx:95-99` — Add handlers for MARKETPLACE, COLLECTION notification types
- `client/src/pages/marketplace/MarketplaceManage.tsx:97` — Add FASHION_ITEM case
- `client/src/pages/admin/AdminSubmissions.tsx:100` — Add FASHION_ITEM case
- `client/src/pages/settings/TaxonomyPage.tsx:39-44` — Add SLIDER and MULTI_SELECT input types
- `client/src/pages/actors/useActorPageRender.tsx:108` — Already done in Task 13, verify

- [ ] **Step 1: Fix Dashboard**

- Show all Quick Actions (remove `slice(0, 3)`)
- Wire "View All" button to navigate to full activity page
- Fix duplicate `/**` comment

- [ ] **Step 2: Fix notification navigation**

Add cases for `MARKETPLACE_` and `COLLECTION_` prefixes in the notification click handler.

- [ ] **Step 3: Fix FASHION_ITEM handling**

Add `FASHION_ITEM` case to `MarketplaceManage.tsx` and `AdminSubmissions.tsx` type checks.

- [ ] **Step 4: Add SLIDER + MULTI_SELECT to TaxonomyPage**

Add to `INPUT_TYPES` constant. Add corresponding render cases in `ActorFormFields.tsx`.

- [ ] **Step 5: Run full test suite**

```bash
cd server && npx vitest run && cd ../client && npx vitest run
# Expected: all pass
```

- [ ] **Step 6: Run typecheck**

```bash
cd server && npx tsc --noEmit && cd ../client && npx tsc --noEmit
# Expected: clean
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: final cleanup — dashboard, notifications, FASHION_ITEM handling, taxonomy types"
```

---

## Execution Order & Dependencies

```
Phase 0: Task 0 (schema prerequisite)
  │
  ▼
Phase 1: Tasks 1-5 (critical bugs — can run in parallel after Task 0)
  │
  ▼
Phase 2: Tasks 6-7 (security — can run in parallel)
  │
  ▼
Phase 3: Tasks 8→12 (generation pipeline — sequential: 8→9→10→11→12)
  │
  ▼
Phase 4: Tasks 13-16 (features — can run mostly in parallel)
  │
  ▼
Phase 5: Task 17 (polish — depends on everything)
```

## Session Grouping (for 256K context window)

Each group fits in a single session with context to spare:

| Session | Tasks       | Est. Files | Complexity |
| ------- | ----------- | ---------- | ---------- |
| 1       | Task 0      | 2          | XS         |
| 2       | Tasks 1-2   | 5          | M          |
| 3       | Tasks 3-5   | 8          | M          |
| 4       | Tasks 6-7   | 10         | M          |
| 5       | Tasks 8-10  | 12         | L          |
| 6       | Tasks 11-12 | 6          | M          |
| 7       | Tasks 13-14 | 8          | M          |
| 8       | Tasks 15-16 | 12         | L          |
| 9       | Task 17     | 6          | S          |

## Total Issue Count

| Severity  | Count  | Tasks                                   |
| --------- | ------ | --------------------------------------- |
| Critical  | 5      | T1-T5                                   |
| Important | 11     | T6-T7 (bundle 6 issues into 2 tasks)    |
| Medium    | 10     | T8-T12 (generation), T13-T16 (features) |
| Minor     | 8      | T17 (bundle)                            |
| **Total** | **34** | **17 tasks**                            |
