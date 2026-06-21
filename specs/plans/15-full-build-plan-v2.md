# Implementation Plan — Cast Studio v2 Full Build v2

> **For agentic workers:** Use superpowers-subagent-driven-development or superpowers-executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all critical bugs, complete missing features, wire the generation pipeline to actually produce images, and bring Cast Studio v2 to a shippable state.

**Architecture:** Provider-agnostic generation pipeline (fal.ai primary, OpenRouter via fal.ai router), admin-managed model catalog (zero hardcoded models), dynamic taxonomy-driven filters, workspace-scoped everything.

**Tech Stack:** Node.js + Express + PostgreSQL + React 18 + TypeScript + Tailwind CSS + shadcn/ui + TanStack Query v5 + Zustand

---

## Key Differences from Plan 14

This plan corrects several issues in plan 14:

- **Migration numbering:** Plan 14 used 012 and 013 which conflict with existing migrations. This plan uses 013+ sequentially.
- **Task 0 removed:** The unique constraint on `asset_output_versions` already exists as a unique index from migration 001. No new migration needed.
- **Task 1 (purchase):** Fixed to use actual `duplicateAsset()` signature: `(sourceAsset: AssetRow, newName, newWorkspaceId, newCreatorId)`. The duplicate goes into the buyer's workspace.
- **Task 6 (admin security):** Admin middleware and DELETE rowCount checks already exist. Task reduced to only the dynamic model endpoint fix and DEFAULT_MODEL removal.
- **Task 5 (wallet cache):** `invalidateWalletCacheEntry` already exists in wallet-repo.ts. The fix is to call it after raw `dbClient.query` UPDATE in purchase.ts.
- **OpenRouter endpoint:** Corrected to `https://fal.run/openrouter` (not `/router`).
- **Task sizing:** Split Phase 3 (generation pipeline) into smaller, independently verifiable tasks.
- **Frontend/backend split:** Each task touches either frontend OR backend, never both.

---

## Required Skills

| Skill                                       | Load Command                                                 | When                                  |
| ------------------------------------------- | ------------------------------------------------------------ | ------------------------------------- |
| **taste-skill**                             | `skill_view(name="taste-skill")`                             | Before any frontend/UI code           |
| **impeccable**                              | `skill_view(name="impeccable")`                              | Before any frontend layout/styling    |
| **shadcn**                                  | `skill_view(name="shadcn")`                                  | Before adding/modifying UI components |
| **agent-skills-code-review-and-quality**    | `skill_view(name="agent-skills-code-review-and-quality")`    | Before marking any task complete      |
| **agent-skills-code-simplification**        | `skill_view(name="agent-skills-code-simplification")`        | After each task, before committing    |
| **agent-skills-documentation-and-adrs**     | `skill_view(name="agent-skills-documentation-and-adrs")`     | After each architectural decision     |
| **superpowers-subagent-driven-development** | `skill_view(name="superpowers-subagent-driven-development")` | If executing via subagent dispatch    |
| **superpowers-executing-plans**             | `skill_view(name="superpowers-executing-plans")`             | If executing inline                   |

---

## File Map

### Backend (server/src/)

| Directory              | Files                                                                                                                                                  | Responsibility               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- |
| `services/fal/`        | `api.ts`, `models.ts`, `types.ts`                                                                                                                      | fal.ai provider              |
| `services/openrouter/` | `api.ts` (NEW), `types.ts` (NEW)                                                                                                                       | OpenRouter via fal.ai router |
| `services/generation/` | `generate.ts`, `regenerate.ts`, `character-sheet.ts`, `resolve-model.ts`, `generation-constants.ts`, `generation-types.ts`, `status.ts`                | Generation pipeline          |
| `services/`            | `fal-service.ts`, `wallet-service.ts`, `commission-service.ts`, `marketplace/purchase.ts`, `collection-service.ts`, `notification-service.ts`          | Service layer                |
| `routes/`              | `actors.ts`, `looks.ts`, `fashion-items.ts`, `commissions.ts`, `collections.ts`, `admin/model-routes.ts`, `admin/taxonomy-routes.ts`, `admin/admin.ts` | HTTP route handlers          |
| `workers/`             | `generation-worker.ts`                                                                                                                                 | Background polling worker    |
| `db/`                  | `pool.ts`, `query-helper.ts`, `migrations/`                                                                                                            | Database layer               |
| `db/repositories/`     | `asset-repo.ts`, `model-repo.ts`, `wallet-repo.ts`, `commission-repo.ts`                                                                               | Data access                  |
| `middleware/`          | `requireSession.ts`, `requireWorkspace.ts`, `requireApiKey.ts`                                                                                         | Auth middleware              |
| `server.ts`            | —                                                                                                                                                      | App entry point              |

### Frontend (client/src/)

| Directory                    | Files                                                                                                                                                                                                                          | Responsibility        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------- |
| `components/actor-designer/` | `Stage1.tsx`, `Stage2.tsx`, `Stage3.tsx`, `StructuredFormPanel.tsx`, `SessionNavigator.tsx`, `useActorDesignerState.ts`, `types.ts`                                                                                            | Actor creation wizard |
| `components/`                | `Sidebar.tsx`, `NotificationDropdown.tsx`, `AssetCard.tsx`, `AssetCardV2.tsx`, `GenerationStatus.tsx`, `FilterPanel.tsx`, `ModelParameterForm.tsx`, `ui/button.tsx`                                                            | Shared UI components  |
| `components/layout/`         | `PageContainer.tsx`, `PageHeader.tsx`, `LibraryLayout.tsx`, `LibraryToolbar.tsx`, `LibraryPagination.tsx`, `SingleAssetLayout.tsx`, `MultiOutputAssetLayout.tsx`                                                               | Layout components     |
| `pages/actors/`              | `ActorDesigner.tsx`, `ActorPage.tsx`, `ActorLibrary.tsx`, `ActorOutputs.tsx`, `useActorPage.ts`, `useActorPageRender.tsx`                                                                                                      | Actor pages           |
| `pages/looks/`               | `LookDesigner.tsx`, `LookDesignerStep1.tsx`, `LookDesignerStep2.tsx`, `LookDetail.tsx`, `LookLibrary.tsx`                                                                                                                      | Look pages            |
| `pages/fashion-items/`       | `FashionItemCreator.tsx`, `FashionItemDetail.tsx`, `FashionItemLibrary.tsx`                                                                                                                                                    | Fashion item pages    |
| `pages/marketplace/`         | `MarketplacePage.tsx`, `MarketplaceDetail.tsx`, `MarketplaceManage.tsx`, `NewListing.tsx`                                                                                                                                      | Marketplace pages     |
| `pages/commissions/`         | `CommissionDetail.tsx`, `CommissionsList.tsx`, `NewCommission.tsx`, `AdminActions.tsx`, `ArtistActions.tsx`, `ClientActions.tsx`                                                                                               | Commission pages      |
| `pages/settings/`            | `SettingsPage.tsx`, `ModelsPage.tsx`, `ConfiguredModels.tsx`, `TaxonomyPage.tsx`, `UsersPage.tsx`, `CommissionFormsPage.tsx`, `PromptsPage.tsx`, `ApiKeysPage.tsx`, `WalletPage.tsx`                                           | Settings pages        |
| `pages/collections/`         | `CollectionsPage.tsx`, `CollectionDetail.tsx`                                                                                                                                                                                  | Collection pages      |
| `hooks/`                     | `useAdminModels.ts`, `useAdminTaxonomy.ts`, `useActors.ts`, `useLooks.ts`, `useFashionItems.ts`, `useCollections.ts`, `useCommissions.ts`, `useMarketplace.ts`, `useWallet.ts`, `useNotifications.ts`, `useActorGeneration.ts` | Data-fetching hooks   |
| `lib/`                       | `api-client.ts`, `navigation.ts`, `query-client.ts`, `utils.ts`                                                                                                                                                                | Shared utilities      |
| `store/`                     | `ui-store.ts`                                                                                                                                                                                                                  | Zustand UI state      |
| `router.tsx`                 | —                                                                                                                                                                                                                              | React Router config   |
| `App.tsx`                    | —                                                                                                                                                                                                                              | App shell             |

---

## Phase 1: Critical Bug Fixes

> **Blocks:** Everything else. These are broken core functions.
> **Estimated scope:** L — ~12 files across frontend + backend

### Task 1: Fix marketplace purchase to duplicate (not transfer)

**Current behavior:** `purchaseListing()` transfers the original asset's `client_id` to the buyer (line 96-99 of purchase.ts). The seller loses their asset.

**Expected behavior:** The original asset stays with the seller (frozen). A new duplicate asset is created in the buyer's workspace with `source_type = 'MARKETPLACE_PURCHASE'`.

**Files:**

- Modify: `server/src/services/marketplace/purchase.ts:95-99`
- Test: `server/tests/marketplace.test.ts` (add test case)

**Actual `duplicateAsset()` signature** (from asset-repo.ts:106):

```typescript
duplicateAsset(
  sourceAsset: AssetRow,  // full source asset row
  newName: string | null,  // name for the duplicate
  newWorkspaceId: string,  // buyer's workspace
  newCreatorId: string,    // buyer's account id
): Promise<AssetRow>
```

- [ ] **Step 1: Write the failing test**

```typescript
it('purchaseListing creates a duplicate asset in buyer workspace, does not transfer original', async () => {
  // Create a studio asset with marketplace_status = 'MARKETPLACE_APPROVED'
  // Call purchaseListing with a client account (different workspace)
  // Assert: original asset still has creator_id = seller, is_marketplace_frozen = TRUE
  // Assert: new asset exists with creator_id = buyer, workspace_id = buyer's workspace, source_type = 'MARKETPLACE_PURCHASE'
  // Assert: new asset has same prompt_recipe, seed as original
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server && npx vitest run -- marketplace.test.ts
# Expected: FAIL — purchase transfers instead of duplicating
```

- [ ] **Step 3: Implement the fix**

Replace lines 95-99 in `purchase.ts` (the `UPDATE assets SET client_id = $1...` block):

```typescript
// 6. Duplicate the asset for the buyer (instead of transferring original)
const sourceAsset = await findAssetById(sourceAssetId);
if (!sourceAsset) {
  throw Object.assign(new Error('Source asset not found'), { statusCode: 404 });
}
const duplicatedAsset = await duplicateAsset(
  sourceAsset,
  sourceAsset.name,
  account.workspace_id, // buyer's workspace
  account.id, // buyer is the new creator
);
await duplicateAssetOutputs(sourceAssetId, duplicatedAsset.id);

// 7. Mark original as frozen (not transferred)
await dbClient.query(`UPDATE assets SET is_marketplace_frozen = TRUE WHERE id = $1`, [
  sourceAssetId,
]);
```

Note: `findAssetById` and `duplicateAsset` and `duplicateAssetOutputs` are already imported/available from asset-repo.ts. Add imports if missing.

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

**Current behavior:** `unlockCommissionPremium()` has no idempotency guard. If `transitionCommissionStatus` is called twice with `APPROVED`, the wallet is double-charged and assets are double-transferred.

**Files:**

- Modify: `server/src/services/commission-service.ts:230-233` (the `if (toStatus === 'APPROVED')` block)
- Modify: `server/src/services/commission-service.ts:292-349` (`unlockCommissionPremium()`)
- Create: `server/src/db/migrations/013_commission_premium_unlocked.up.sql`
- Create: `server/src/db/migrations/013_commission_premium_unlocked.down.sql`
- Test: `server/tests/commissions.test.ts`

- [ ] **Step 1: Create migration 013**

```sql
-- Migration 013: Add idempotency guard to commissions
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS is_premium_unlocked BOOLEAN NOT NULL DEFAULT FALSE;
```

Down:

```sql
ALTER TABLE commissions DROP COLUMN IF EXISTS is_premium_unlocked;
```

- [ ] **Step 2: Run migration**

```bash
cd server && npx tsx src/db/migrate.ts up
```

- [ ] **Step 3: Write failing test**

```typescript
it('unlockCommissionPremium is idempotent — double-call does not double-charge', async () => {
  // Create a commission in SUBMITTED status with premium_cost > 0
  // Call transitionCommissionStatus to APPROVED twice
  // Assert: wallet deducted only once (check ledger entries count)
  // Assert: is_premium_unlocked = true after first call
});
```

- [ ] **Step 4: Run test to verify it fails**

```bash
cd server && npx vitest run -- commissions.test.ts
# Expected: FAIL — double-charge on retry
```

- [ ] **Step 5: Implement the fix**

In `unlockCommissionPremium()` (line 292), add at the top:

```typescript
// Idempotency guard: if already unlocked, skip
if (commission.is_premium_unlocked) return;
```

After the successful COMMIT (after line 342), add:

```typescript
// Mark as unlocked to prevent double-charge on retry
await query('UPDATE commissions SET is_premium_unlocked = TRUE WHERE id = $1', [commissionId]);
```

- [ ] **Step 6: Run test to verify it passes**

```bash
cd server && npx vitest run -- commissions.test.ts
# Expected: PASS
```

- [ ] **Step 7: Commit**

```bash
git add server/src/services/commission-service.ts server/src/db/migrations/013_commission_premium_unlocked.up.sql server/src/db/migrations/013_commission_premium_unlocked.down.sql server/tests/commissions.test.ts
git commit -m "fix: add idempotency guard to commission premium unlock"
```

---

### Task 3: Fix multi-output generation partial failure

**Current behavior:** When output 2 of 3 fails in the `for` loop in `generate.ts:134`, the loop throws and outputs that were already submitted to fal.ai are left as PENDING forever. The worker will poll them but they'll never be marked FAILED.

**Files:**

- Modify: `server/src/services/generation/generate.ts:134-213`
- Test: `server/tests/generation.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
it('when output 2 of 3 fails, all 3 outputs are marked FAILED', async () => {
  // Mock fal.submitTextToImage: succeed once, then throw on second call
  // Call generateActorOutput with num_outputs: 3
  // Assert: all 3 outputs have status 'FAILED'
  // Assert: credits refunded for all 3 (not just the failed one)
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server && npx vitest run -- generation.test.ts
# Expected: FAIL — orphan PENDING rows
```

- [ ] **Step 3: Implement the fix**

In the `for` loop at `generate.ts:134`, wrap the entire loop in try-catch. On any failure:

1. Catch the error
2. Mark the current output as FAILED (already done)
3. Mark all remaining outputs (not yet submitted) as FAILED with error "Aborted due to failure in sibling output"
4. Refund credits for ALL outputs (submitted + remaining), not just the failed one
5. Re-throw the error

```typescript
const createdOutputs: Array<{
  id: string;
  layout_type: string;
  status: string;
  model: string;
  cost_credits: number;
}> = [];
let submissionError: Error | null = null;

for (let i = 0; i < numOutputs; i++) {
  if (submissionError) {
    // A previous output failed — mark this one as FAILED without submitting
    const input: CreateAssetOutputInput = {
      asset_id: assetId,
      layout_type: options.layout_type,
      model,
      status: 'FAILED',
      cost_credits: DEFAULT_COST,
      generation_params: {
        ...generationParams,
        seed: seed + i,
        error: 'Aborted: sibling output failed',
      },
    };
    const output = await createAssetOutput(input);
    createdOutputs.push({
      id: output.id,
      layout_type: output.layout_type,
      status: 'FAILED',
      model: output.model,
      cost_credits: output.cost_credits,
    });
    continue;
  }
  // ... existing submission logic ...
  try {
    // ... existing fal.ai submit logic ...
  } catch (err) {
    submissionError = err instanceof Error ? err : new Error('Unknown error');
    // Mark current output as FAILED
    const errorMessage = submissionError.message;
    await updateAssetOutputError(output.id, errorMessage);
    // Refund all created outputs (including this one)
    for (const o of createdOutputs) {
      await refundCredits(account.workspace_id, account.id, DEFAULT_COST);
    }
    throw Object.assign(new Error(errorMessage), { statusCode: 502 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd server && npx vitest run -- generation.test.ts
# Expected: PASS
```

- [ ] **Step 5: Commit**

```bash
git add server/src/services/generation/generate.ts server/tests/generation.test.ts
git commit -m "fix: mark all remaining outputs FAILED on multi-output generation partial failure"
```

---

### Task 4: Fix wallet cache invalidation in purchase.ts

**Current behavior:** `purchase.ts` uses raw `dbClient.query` for the wallet UPDATE, bypassing `updateWalletBalance()` which calls `invalidateWalletCacheEntry`. The wallet cache stays stale after purchase.

**Files:**

- Modify: `server/src/services/marketplace/purchase.ts:82-87`

- [ ] **Step 1: Add cache invalidation after wallet deduction**

After line 87 (the `UPDATE wallets SET balance_credits` query), add:

```typescript
// Invalidate wallet cache since we used raw dbClient.query
import { invalidateWalletCacheEntry } from '../../db/repositories/wallet-repo.js';
// ... after line 87:
invalidateWalletCacheEntry(account.workspace_id, account.id);
```

- [ ] **Step 2: Add the import**

At the top of `purchase.ts`, add:

```typescript
import { invalidateWalletCacheEntry } from '../../db/repositories/wallet-repo.js';
```

- [ ] **Step 3: Run existing wallet tests**

```bash
cd server && npx vitest run -- wallet.test.ts
# Expected: PASS
```

- [ ] **Step 4: Commit**

```bash
git add server/src/services/marketplace/purchase.ts
git commit -m "fix: invalidate wallet cache after purchase deduction"
```

---

### Task 5: Fix wallet credit reservation race condition

**Current behavior:** `reserveCreditsForGeneration` in wallet-repo.ts reads the wallet, checks balance, then updates. Two concurrent requests can both read the same balance and both pass the check, resulting in overdraft.

**Files:**

- Modify: `server/src/db/repositories/wallet-repo.ts:214-241`

- [ ] **Step 1: Replace read-then-check with atomic UPDATE**

Replace the balance check in `reserveCreditsForGeneration`:

```typescript
export async function reserveCreditsForGeneration(
  workspaceId: string,
  account: AccountRow,
  amount: number,
): Promise<{ wallet: WalletRow; ledger: LedgerRow }> {
  // Atomic check-and-deduct: only succeeds if balance >= amount
  const result = await query(
    `UPDATE wallets SET balance_credits = balance_credits - $1, updated_at = NOW()
     WHERE workspace_id = $2 AND account_id = $3 AND balance_credits >= $1
     RETURNING *`,
    [Number(amount.toFixed(4)), workspaceId, account.id],
  );

  if (result.rowCount === 0) {
    // Either wallet doesn't exist or insufficient balance
    const wallet = await findWallet({ workspaceId, accountId: account.id });
    if (!wallet) {
      throw Object.assign(new Error('Wallet not found'), { statusCode: 404 });
    }
    throw new InsufficientCreditsError(wallet.balance_credits, amount);
  }

  const wallet = asWalletRow(result.rows[0] as Record<string, unknown>);
  // Invalidate cache
  invalidateWalletCacheEntry(workspaceId, account.id);

  const ledger = await createLedgerEntry({
    workspaceId,
    walletId: wallet.id,
    amount: Number((-amount).toFixed(4)),
    type: 'CHARGE',
  });

  return { wallet, ledger };
}
```

- [ ] **Step 2: Run wallet tests**

```bash
cd server && npx vitest run -- wallet.test.ts
# Expected: PASS
```

- [ ] **Step 3: Commit**

```bash
git add server/src/db/repositories/wallet-repo.ts
git commit -m "fix: atomic credit reservation to prevent race condition"
```

---

## Checkpoint: After Phase 1

- [ ] All server tests pass: `cd server && npx vitest run`
- [ ] Server builds clean: `cd server && npx tsc --noEmit`
- [ ] Marketplace purchase creates duplicate (verified by test)
- [ ] Commission premium unlock is idempotent (verified by test)
- [ ] Multi-output failure marks all outputs FAILED (verified by test)
- [ ] Wallet cache invalidated after purchase
- [ ] Wallet credit reservation is atomic

---

## Phase 2: Security & Correctness

> **Estimated scope:** S — ~4 files
> **Note:** Admin middleware and DELETE rowCount checks already exist in the codebase. This phase only addresses remaining issues.

### Task 6: Remove hardcoded DEFAULT_MODEL + make model endpoints fully dynamic

**Current behavior:** `generation-constants.ts` exports `DEFAULT_MODEL = 'fal-ai/flux-pro'`. `resolveModel()` falls back to this if no models are configured. `fal/api.ts` has a switch statement for short model names.

**Expected behavior:** No hardcoded fallback. If no models are configured, throw a clear error. The `getModelEndpoint()` switch is already partially dynamic (handles `/`-containing IDs), but the default case should not fall back to `flux-pro`.

**Files:**

- Modify: `server/src/services/generation/generation-constants.ts`
- Modify: `server/src/services/generation/resolve-model.ts:56-57`
- Modify: `server/src/services/fal/api.ts:15-26`

- [ ] **Step 1: Remove DEFAULT_MODEL**

In `generation-constants.ts`, remove the `DEFAULT_MODEL` export. The file should only contain `DEFAULT_COST`.

- [ ] **Step 2: Update resolveModel() to throw instead of fallback**

In `resolve-model.ts:56-57`, replace the `return DEFAULT_MODEL` fallback:

```typescript
// 4. No models configured — throw clear error
throw new Error('No models configured. Please add models in Settings → Models.');
```

- [ ] **Step 3: Update getModelEndpoint() default case**

In `fal/api.ts:24-26`, replace the default case:

```typescript
default:
  return `${FAL_API_BASE}/${model}`;
```

This keeps backward compatibility for short names without hardcoding `flux-pro`.

- [ ] **Step 4: Remove unused import**

In `resolve-model.ts`, remove the `import { DEFAULT_MODEL } from './generation-constants.js'` line.

- [ ] **Step 5: Run tests**

```bash
cd server && npx vitest run
# Expected: all pass
```

- [ ] **Step 6: Commit**

```bash
git add server/src/services/generation/generation-constants.ts server/src/services/generation/resolve-model.ts server/src/services/fal/api.ts
git commit -m "security: remove hardcoded DEFAULT_MODEL, throw error when no models configured"
```

---

### Task 7: Add workspace filter to getAssetOutputs

**Current behavior:** `getAssetOutputs()` in asset-repo.ts takes only `assetId` with no workspace filter. Any workspace can read any asset's outputs.

**Files:**

- Modify: `server/src/db/repositories/asset-repo.ts:365-371`
- Test: `server/tests/asset-repo-soft-delete.test.ts`

- [ ] **Step 1: Add workspace filter parameter**

```typescript
export async function getAssetOutputs(
  assetId: string,
  workspaceId?: string,
): Promise<AssetOutputRow[]> {
  let sql = `SELECT ao.* FROM asset_outputs ao`;
  const params: unknown[] = [assetId];
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

Search for all `getAssetOutputs(` calls in the codebase. For each caller that has access to a `workspaceId`, add it as the second argument. Key callers:

- `regenerate.ts:110` — has `account.workspace_id`
- `character-sheet.ts:91,96` — has workspace context
- `look-service.ts:271,298,328,337` — has workspace context
- `marketplace/listings.ts:108` — has workspace context
- `marketplace/helpers.ts` — has workspace context
- `marketplace/submissions.ts:55` — admin context, may skip
- `actor-service.ts` — has workspace context

For callers that are admin-only or don't have workspace context (e.g., admin-review.ts using `getAssetOutputsBatch`), omit the workspaceId parameter.

- [ ] **Step 3: Run tests**

```bash
cd server && npx vitest run
# Expected: all pass
```

- [ ] **Step 4: Commit**

```bash
git add server/src/db/repositories/asset-repo.ts server/src/services/generation/regenerate.ts server/src/services/generation/character-sheet.ts server/src/services/look-service.ts server/src/services/marketplace/listings.ts server/src/services/marketplace/helpers.ts server/src/services/marketplace/submissions.ts server/src/services/actor-service.ts
git commit -m "fix: add workspace filter to getAssetOutputs"
```

---

## Checkpoint: After Phase 2

- [ ] All server tests pass
- [ ] Server builds clean
- [ ] No hardcoded model fallbacks remain
- [ ] getAssetOutputs requires workspace context

---

## Phase 3: Generation Pipeline — Make Images Actually Work

> **This is the core feature. Without this, the app is a CRUD shell with no images.**
> **Estimated scope:** L — ~15 files, new provider module, new migration, frontend model selector

### Task 8: Add `provider` column to models table + seed data

**Files:**

- Create: `server/src/db/migrations/014_models_provider.up.sql`
- Create: `server/src/db/migrations/014_models_provider.down.sql`
- Modify: `server/src/db/repositories/model-repo.ts`
- Modify: `server/src/db/seed.ts`

- [ ] **Step 1: Create migration 014**

```sql
-- Migration 014: Add provider column to models
ALTER TABLE models ADD COLUMN IF NOT EXISTS provider VARCHAR(50) NOT NULL DEFAULT 'fal';
ALTER TABLE models ADD COLUMN IF NOT EXISTS endpoint VARCHAR(500);
CREATE INDEX IF NOT EXISTS idx_models_provider ON models (provider);
```

Down:

```sql
DROP INDEX IF EXISTS idx_models_provider;
ALTER TABLE models DROP COLUMN IF EXISTS endpoint;
ALTER TABLE models DROP COLUMN IF EXISTS provider;
```

- [ ] **Step 2: Update model-repo.ts**

Add `provider` and `endpoint` to the `ModelRow` interface and all query functions that insert/update:

```typescript
export interface ModelRow {
  id: string;
  model_id: string;
  name: string;
  model_type: string;
  task: string;
  parameters: Record<string, unknown>;
  input_schema: Record<string, unknown> | null;
  is_active: boolean;
  created_at: string;
  provider: string; // NEW
  endpoint: string | null; // NEW
}
```

Update the INSERT statements in import/create functions to include `provider` and `endpoint`.

- [ ] **Step 3: Add seed data**

In `seed.ts`, add default models:

```typescript
// Generation models (fal.ai)
await query(`INSERT INTO models (model_id, name, model_type, task, provider, is_active, input_schema) VALUES
  ('fal-ai/flux-pro', 'Flux Pro', 'text_to_image', 'actor_headshot', 'fal', true, '{}'),
  ('fal-ai/flux-pro', 'Flux Pro (Fullshot)', 'text_to_image', 'actor_fullshot', 'fal', true, '{}')
  ON CONFLICT (model_id, task) DO NOTHING
`);
```

- [ ] **Step 4: Run migration + seed**

```bash
cd server && npx tsx src/db/migrate.ts up && npx tsx src/db/seed.ts
```

- [ ] **Step 5: Commit**

```bash
git add server/src/db/migrations/014_models_provider.up.sql server/src/db/migrations/014_models_provider.down.sql server/src/db/repositories/model-repo.ts server/src/db/seed.ts
git commit -m "feat: add provider column and seed models"
```

---

### Task 9: Create OpenRouter provider module

**Files:**

- Create: `server/src/services/openrouter/types.ts`
- Create: `server/src/services/openrouter/api.ts`

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

The fal.ai router endpoint for OpenRouter is `https://fal.run/openrouter`:

```typescript
// server/src/services/openrouter/api.ts
import type { OpenRouterMessage, OpenRouterResult } from './types.js';

const FAL_ROUTER_ENDPOINT = 'https://fal.run/openrouter';

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
  const imageUrl = typeof content === 'string' && content.startsWith('http') ? content : null;
  return {
    id: data.id || `or_${Date.now()}`,
    status: imageUrl ? 'SUCCESS' : 'FAILED',
    image_url: imageUrl,
    error_message: imageUrl ? null : 'No image URL in response',
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add server/src/services/openrouter/types.ts server/src/services/openrouter/api.ts
git commit -m "feat: add OpenRouter provider module via fal.ai router"
```

---

### Task 10: Wire provider routing into generation pipeline

**Files:**

- Modify: `server/src/services/generation/resolve-model.ts`
- Modify: `server/src/services/generation/generate.ts`
- Modify: `server/src/workers/generation-worker.ts`

- [ ] **Step 1: Update resolve-model.ts to return provider info**

```typescript
export interface ResolvedModel {
  modelId: string;
  provider: string;
  endpoint: string | null;
}

export async function resolveModel(requestedModel?: string, task?: string): Promise<ResolvedModel> {
  // ... existing logic to find model from DB ...
  // Return { modelId: found.model_id, provider: found.provider || 'fal', endpoint: found.endpoint }
  // If no model found, throw error (no more DEFAULT_MODEL fallback — handled in Task 6)
}
```

- [ ] **Step 2: Update generate.ts to route by provider**

After resolving the model, branch on `resolved.provider`:

```typescript
if (resolved.provider === 'openrouter') {
  // OpenRouter path — synchronous response, no queue polling
  const { submitOpenRouterRequest } = await import('../openrouter/api.js');
  const messages = buildOpenRouterMessages(resolvedPrompt, options);
  const result = await submitOpenRouterRequest(resolved.modelId, messages, workspaceKey);
  await updateOutputStatus(output.id, result.status, result.image_url, result.error_message);
} else {
  // Existing fal.ai path (queue-based polling)
  // ... existing submitTextToImage/submitImageToImage logic ...
}
```

- [ ] **Step 3: Update generation-worker.ts for OpenRouter**

In `processSingleOutput`, check if the output was already resolved synchronously:

```typescript
// If generation_params has openrouter_result, it was already resolved
if (generationParams['openrouter_result']) {
  // Already handled synchronously — skip polling
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
git add server/src/services/generation/resolve-model.ts server/src/services/generation/generate.ts server/src/workers/generation-worker.ts
git commit -m "feat: wire provider routing into generation pipeline (fal.ai + OpenRouter)"
```

---

### Task 11: Frontend model selector in Actor Designer

**Files:**

- Modify: `client/src/components/actor-designer/Stage2.tsx`
- Modify: `client/src/components/actor-designer/useActorDesignerState.ts`

- [ ] **Step 1: Add model selector to Stage2**

At the top of Stage2 (above the stepper), add a `<Select>` dropdown:

- Label: "Model"
- Options: active models from `useAdminModels()` hook
- Default: first active model from the list
- When no models: show inline warning "No models configured. Go to Settings → Models."
- On change: update `selectedModel` state in `useActorDesignerState`

- [ ] **Step 2: Verify model is passed in generate/regenerate mutations**

In `useActorDesignerState.ts`, verify the `generateMutation` and `regenerateMutation` send `model: selectedModel` in the request body.

- [ ] **Step 3: Verify TypeScript**

```bash
cd client && npx tsc --noEmit
# Expected: clean (only the pre-existing Sidebar.tsx error)
```

- [ ] **Step 4: Commit**

```bash
git add client/src/components/actor-designer/Stage2.tsx client/src/components/actor-designer/useActorDesignerState.ts
git commit -m "feat: add model selector to Actor Designer Stage 2"
```

---

### Task 12: Wire vision model for Look Designer reference extraction

**Current behavior:** `LookDesignerStep1.tsx:79` hardcodes `['Jacket', 'Shirt', 'Pants', 'Shoes', 'Watch']` as extracted pieces.

**Files:**

- Modify: `server/src/routes/looks.ts` — Add `POST /api/looks/extract-reference` endpoint
- Modify: `client/src/pages/looks/LookDesignerStep1.tsx:75-82`

- [ ] **Step 1: Add extract-reference endpoint to looks.ts**

```typescript
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
  try {
    const extractionPrompt =
      prompt ||
      'List all clothing items, accessories, and footwear visible in this image. Return as a simple comma-separated list.';
    const result = await fal.imageToText(image_url, extractionPrompt, workspaceKey);
    const items = result
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    res.json({ items, raw: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Extraction failed';
    res.status(502).json({ error: { code: 'EXTRACTION_FAILED', message } });
  }
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

## Checkpoint: After Phase 3

- [ ] All server tests pass
- [ ] Server builds clean
- [ ] Client builds clean (except pre-existing Sidebar.tsx error)
- [ ] Model selector appears in Actor Designer
- [ ] Reference extraction calls vision model API
- [ ] OpenRouter provider module created and wired

---

## Phase 4: Feature Completion

> **Estimated scope:** L — ~18 files

### Task 13: Dynamic taxonomy-driven library filters

**Current behavior:** `ActorLibrary.tsx`, `LookLibrary.tsx`, `FashionItemLibrary.tsx` all have hardcoded `*_FILTER_GROUPS` constants.

**Files:**

- Create: `client/src/hooks/useTaxonomyFilters.ts`
- Modify: `client/src/pages/actors/ActorLibrary.tsx`
- Modify: `client/src/pages/looks/LookLibrary.tsx`
- Modify: `client/src/pages/fashion-items/FashionItemLibrary.tsx`

- [ ] **Step 1: Create useTaxonomyFilters hook**

```typescript
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { FilterGroup } from '@/components/FilterPanel';

export function useTaxonomyFilters(category: string) {
  return useQuery<FilterGroup[]>({
    queryKey: ['taxonomy', 'filters', category],
    queryFn: async () => {
      const { data } = await apiClient.get(`/admin/taxonomy?category=${category}`);
      return data.map((entry: any) => ({
        key: entry.key,
        label: entry.label,
        type: entry.input_type,
        options: (entry.options || []).map((o: any) => ({
          label: o.label,
          value: o.value,
        })),
      }));
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
```

- [ ] **Step 2: Replace hardcoded filters in all 3 library pages**

In each of `ActorLibrary.tsx`, `LookLibrary.tsx`, `FashionItemLibrary.tsx`:

1. Import `useTaxonomyFilters`
2. Replace the hardcoded `ACTOR_FILTER_GROUPS` / `LOOK_FILTER_GROUPS` / `FASHION_FILTER_GROUPS` with the hook result
3. Pass the dynamic groups to `<FilterPanel groups={filters} />`
4. Add loading state while filters fetch (show skeleton or empty filter panel)

- [ ] **Step 3: Verify TypeScript**

```bash
cd client && npx tsc --noEmit
# Expected: clean (except pre-existing Sidebar.tsx error)
```

- [ ] **Step 4: Commit**

```bash
git add client/src/hooks/useTaxonomyFilters.ts client/src/pages/actors/ActorLibrary.tsx client/src/pages/looks/LookLibrary.tsx client/src/pages/fashion-items/FashionItemLibrary.tsx
git commit -m "feat: replace hardcoded library filters with dynamic taxonomy-driven filters"
```

---

### Task 14: Actor Page — ObsoleteBanner + DELISTED status + Character Sheet Look selector

**Files:**

- Create: `client/src/components/ObsoleteBanner.tsx`
- Modify: `client/src/pages/actors/useActorPageRender.tsx`
- Modify: `client/src/pages/actors/useActorPage.ts`
- Modify: `client/src/pages/actors/ActorPage.tsx`

- [ ] **Step 1: Create ObsoleteBanner component**

```tsx
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

- [ ] **Step 4: Add Character Sheet Look selector to ActorPage**

On the Actor page, add a `<Select>` populated from the workspace Look library. On selection + Generate click, call `POST /api/actors/:id/character-sheet` with the `look_id`.

- [ ] **Step 5: Fix marketplace required outputs check**

In `useActorPage.ts:101`, replace any hardcoded `['headshot', 'fullshot', 'expressions_3x4']` with a fetch of `marketplace_settings.actor_package.required_outputs` and check against those.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/ObsoleteBanner.tsx client/src/pages/actors/useActorPageRender.tsx client/src/pages/actors/useActorPage.ts client/src/pages/actors/ActorPage.tsx
git commit -m "feat: obsolete banner, DELISTED status, Look selector, dynamic marketplace check"
```

---

### Task 15: Actor Designer — Editable Stage 3 + Randomize entry method

**Files:**

- Modify: `client/src/components/actor-designer/Stage3.tsx`
- Modify: `client/src/components/actor-designer/Stage1.tsx`
- Modify: `client/src/components/actor-designer/types.ts`

- [ ] **Step 1: Update EntryMethod type**

In `types.ts`, add `'RANDOMIZE'` to the `EntryMethod` union type.

- [ ] **Step 2: Add Randomize option to Stage1**

Add 4th option card to the entry method grid:

```tsx
{ value: 'RANDOMIZE', label: 'Randomize', icon: Shuffle, description: 'Generate random identities to pick from' }
```

- [ ] **Step 3: Handle RANDOMIZE in useActorDesignerState**

When `entryMethod === 'RANDOMIZE'`, generate random form values (random age, gender, ethnicity, vibe, hair_color, eye_color, body_type) and proceed to Stage 2.

- [ ] **Step 4: Make Stage 3 fields editable**

Replace the read-only display with an editable form using `ActorFormFields` component. The form should work for all entry methods (FORM, TEXT, REFERENCE, RANDOMIZE).

- [ ] **Step 5: Commit**

```bash
git add client/src/components/actor-designer/Stage3.tsx client/src/components/actor-designer/Stage1.tsx client/src/components/actor-designer/types.ts client/src/components/actor-designer/useActorDesignerState.ts
git commit -m "feat: editable Stage 3 taxonomy fields, Randomize entry method"
```

---

### Task 16: Admin features — Commission Forms CRUD + Users management

**Files:**

- Create: `server/src/db/migrations/015_commission_forms.up.sql`
- Create: `server/src/db/migrations/015_commission_forms.down.sql`
- Create: `server/src/services/commission-form-service.ts`
- Create: `server/src/routes/admin/commission-form-routes.ts`
- Modify: `client/src/pages/settings/CommissionFormsPage.tsx`
- Modify: `client/src/pages/settings/UsersPage.tsx`

- [ ] **Step 1: Create commission_forms migration**

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
git add server/src/db/migrations/015_commission_forms.up.sql server/src/db/migrations/015_commission_forms.down.sql server/src/services/commission-form-service.ts server/src/routes/admin/commission-form-routes.ts client/src/pages/settings/CommissionFormsPage.tsx client/src/pages/settings/UsersPage.tsx
git commit -m "feat: commission form templates CRUD, admin user management"
```

---

### Task 17: Frontend code quality — deduplication + design tokens + dead code

**Files:**

- Modify: `client/src/pages/looks/LookDetail.tsx`
- Modify: `client/src/pages/fashion-items/FashionItemDetail.tsx`
- Modify: `client/src/components/actor-designer/Stage3.tsx`
- Modify: `client/src/components/SchemaField.tsx`
- Modify: `client/src/components/layout/LibraryLayout.tsx`
- Modify: `client/src/pages/marketplace/MarketplacePage.tsx`

- [ ] **Step 1: Deduplicate LookDetail + FashionItemDetail**

Both pages use `SingleAssetLayout` and have nearly identical structure. Extract shared `SingleAssetDetail` component. The only differences are the data source hook and the page title.

- [ ] **Step 2: Fix hardcoded colors**

In `Stage3.tsx:47-53`, replace `neutral-200/500/900` with `border-border`, `text-muted-foreground`, `text-foreground`.

In `SchemaField.tsx`, replace `#A8A29E`, `#57534E`, `#D6D3D1` with CSS variables (`var(--text-tertiary)`, `var(--text-secondary)`, `var(--border-medium)`).

- [ ] **Step 3: Fix window.location.href → navigate()**

In `LibraryLayout.tsx:103`, replace `window.location.href = newItemPath` with `useNavigate()`.

- [ ] **Step 4: Fix multi-value filter in all 3 libraries**

Replace `if (vals.length === 1) result[key] = vals[0]` with `result[key] = vals` to support multi-value filters.

- [ ] **Step 5: Verify TypeScript**

```bash
cd client && npx tsc --noEmit
# Expected: clean (except pre-existing Sidebar.tsx error)
```

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/looks/LookDetail.tsx client/src/pages/fashion-items/FashionItemDetail.tsx client/src/components/actor-designer/Stage3.tsx client/src/components/SchemaField.tsx client/src/components/layout/LibraryLayout.tsx client/src/pages/marketplace/MarketplacePage.tsx client/src/pages/actors/ActorLibrary.tsx client/src/pages/looks/LookLibrary.tsx client/src/pages/fashion-items/FashionItemLibrary.tsx
git commit -m "refactor: deduplicate detail pages, fix design tokens, remove dead code"
```

---

## Checkpoint: After Phase 4

- [ ] All server tests pass
- [ ] Server builds clean
- [ ] Client builds clean (except pre-existing Sidebar.tsx error)
- [ ] Library filters are dynamic from taxonomy
- [ ] Actor page has obsolete banner, DELISTED status, Look selector
- [ ] Randomize entry method works
- [ ] Commission forms CRUD works
- [ ] No hardcoded colors in components

---

## Phase 5: Polish

> **Estimated scope:** S — ~6 files

### Task 18: Final cleanup bundle

**Files:**

- `client/src/pages/Dashboard.tsx` — Fix Quick Actions grid (remove `slice(0, 3)`), wire "View All" button
- `client/src/components/NotificationDropdown.tsx:95-99` — Add handlers for MARKETPLACE, COLLECTION notification types
- `client/src/pages/marketplace/MarketplaceManage.tsx:97` — Add FASHION_ITEM case to listing_type badge
- `client/src/pages/admin/AdminSubmissions.tsx:100` — Add FASHION_ITEM case to asset_type badge
- `client/src/pages/settings/TaxonomyPage.tsx:39-44` — Add SLIDER and MULTI_SELECT input types
- `client/src/components/Sidebar.tsx:163` — Fix `asChild` prop type error on DropdownMenuTrigger

- [ ] **Step 1: Fix Dashboard**

- Show all Quick Actions (remove `slice(0, 3)`)
- Wire "View All" button to navigate to full activity page

- [ ] **Step 2: Fix notification navigation**

Add cases for `MARKETPLACE_` and `COLLECTION_` prefixes in the notification click handler.

- [ ] **Step 3: Fix FASHION_ITEM handling**

In `MarketplaceManage.tsx:97`, add FASHION_ITEM case:

```tsx
row.listing_type === 'ACTOR_PACKAGE'
  ? 'Actor'
  : row.listing_type === 'FASHION_ITEM'
    ? 'Fashion Item'
    : 'Look';
```

In `AdminSubmissions.tsx:100`, add FASHION_ITEM case:

```tsx
row.asset_type === 'ACTOR'
  ? 'Actor Package'
  : row.asset_type === 'FASHION_ITEM'
    ? 'Fashion Item'
    : 'Look';
```

- [ ] **Step 4: Add SLIDER + MULTI_SELECT to TaxonomyPage**

Add to `INPUT_TYPES` constant. Add corresponding render cases in `ActorFormFields.tsx`.

- [ ] **Step 5: Fix Sidebar.tsx asChild error**

The `DropdownMenuTrigger` component doesn't accept `asChild`. Replace with a native `<button>` wrapped approach or remove `asChild`:

```tsx
<DropdownMenuTrigger asChild>
  <button className="...">
    <ChevronLeft className="size-4 rotate-[-90deg]" />
  </button>
</DropdownMenuTrigger>
```

- [ ] **Step 6: Run full test suite**

```bash
cd server && npx vitest run && cd ../client && npx vitest run
# Expected: all pass
```

- [ ] **Step 7: Run typecheck**

```bash
cd server && npx tsc --noEmit && cd ../client && npx tsc --noEmit
# Expected: clean
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: final cleanup — dashboard, notifications, FASHION_ITEM handling, taxonomy types, Sidebar fix"
```

---

## Execution Order & Dependencies

```
Phase 1: Tasks 1-5 (critical bugs)
  ├── Task 1: marketplace purchase duplication
  ├── Task 2: commission premium idempotency (needs migration 013)
  ├── Task 3: multi-output partial failure
  ├── Task 4: wallet cache invalidation
  └── Task 5: wallet race condition
  │
  ▼
Phase 2: Tasks 6-7 (security)
  ├── Task 6: remove DEFAULT_MODEL + dynamic endpoints
  └── Task 7: getAssetOutputs workspace filter
  │
  ▼
Phase 3: Tasks 8-12 (generation pipeline — sequential)
  ├── Task 8: provider column + seed data (migration 014)
  ├── Task 9: OpenRouter provider module
  ├── Task 10: wire provider routing (depends on 8, 9)
  ├── Task 11: frontend model selector (depends on 8)
  └── Task 12: vision model for reference extraction
  │
  ▼
Phase 4: Tasks 13-17 (features — can run in parallel)
  ├── Task 13: dynamic taxonomy filters
  ├── Task 14: Actor Page features
  ├── Task 15: Actor Designer Stage 3 + Randomize
  ├── Task 16: Commission Forms + Users (migration 015)
  └── Task 17: frontend code quality
  │
  ▼
Phase 5: Task 18 (polish — depends on everything)
```

## Session Grouping

| Session | Tasks       | Est. Files | Complexity |
| ------- | ----------- | ---------- | ---------- |
| 1       | Task 1      | 2          | S          |
| 2       | Task 2      | 4          | S          |
| 3       | Task 3      | 2          | S          |
| 4       | Tasks 4-5   | 3          | S          |
| 5       | Tasks 6-7   | 5          | M          |
| 6       | Tasks 8-9   | 5          | M          |
| 7       | Task 10     | 3          | S          |
| 8       | Tasks 11-12 | 4          | M          |
| 9       | Tasks 13-14 | 6          | M          |
| 10      | Tasks 15-16 | 8          | L          |
| 11      | Tasks 17-18 | 8          | M          |

## Total Issue Count

| Severity  | Count  | Tasks                                   |
| --------- | ------ | --------------------------------------- |
| Critical  | 5      | T1-T5                                   |
| Important | 4      | T6-T7 (bundle)                          |
| Medium    | 12     | T8-T12 (generation), T13-T17 (features) |
| Minor     | 5      | T18 (bundle)                            |
| **Total** | **26** | **18 tasks**                            |

## Risks and Mitigations

| Risk                                           | Impact | Mitigation                                                                      |
| ---------------------------------------------- | ------ | ------------------------------------------------------------------------------- |
| Migration numbering conflicts                  | High   | Verified current max migration is 012. This plan uses 013-015.                  |
| `duplicateAsset()` signature mismatch          | High   | Verified actual signature from asset-repo.ts:106-111. Plan uses correct params. |
| OpenRouter endpoint URL                        | Medium | Used `https://fal.run/openrouter` (verified from fal.ai docs).                  |
| Admin middleware already exists                | Low    | Plan skips already-implemented checks.                                          |
| Wallet cache already has invalidation function | Low    | Plan uses existing `invalidateWalletCacheEntry` rather than creating new.       |
| Sidebar.tsx `asChild` type error               | Low    | Plan includes fix in Task 18.                                                   |
| Frontend/backend coupling in tasks             | Medium | Each task touches only frontend OR backend, never both.                         |

## Open Questions

1. **OpenRouter model format**: Should OpenRouter models be stored with `provider = 'openrouter'` and the full model ID (e.g., `openrouter/openai/dall-e-3`) in `model_id`? Yes — the `provider` column determines routing, `model_id` is the full model identifier.

2. **Seed for marketplace duplicate**: Should the duplicated asset get a new seed or keep the original? Keep the original seed — the buyer gets an exact copy of the generated asset.

3. **Character Sheet endpoint**: Does `POST /api/actors/:id/character-sheet` exist? Check `server/src/routes/actors.ts`. If not, it needs to be created as part of Task 14.
