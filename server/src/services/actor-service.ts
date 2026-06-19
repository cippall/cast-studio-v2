import {
  createAsset,
  findAssetById,
  listAssets,
  updateAsset,
  softDeleteAsset,
  getAssetOutputs,
  isClientOwnedBlocked,
  duplicateAsset,
  duplicateAssetOutputs,
} from '../db/repositories/asset-repo.js';
import type { AssetRow, AssetOutputRow } from '../db/repositories/asset-repo.js';
import type { AccountRow } from '../middleware/requireSession.js';

// --- Constants ---

const LAYOUT_TYPES = ['headshot', 'fullshot', 'expressions_3x4', 'character_sheet', 'editorial'];

// --- Internal types ---

export interface CreateActorParams {
  entry_method: 'FORM' | 'REFERENCE' | 'TEXT' | 'RANDOMIZE';
  form_data?: Record<string, unknown>;
  reference_image?: string;
  prompt?: string;
}

export interface UpdateActorData {
  name?: string;
  taxonomy_values?: Record<string, unknown>;
}

export interface ActorListItem extends AssetRow {
  headshot_url: string | null;
}

export interface ActorDetail {
  id: string;
  name: string | null;
  asset_type: string;
  seed: number;
  prompt_recipe: Record<string, unknown>;
  outputs: Record<string, AssetOutputRow | null>;
  taxonomy_values: Record<string, unknown>;
  created_at: string;
}

// --- Helpers ---

/**
 * Generate a random seed for deterministic image generation.
 */
export function generateSeed(): number {
  return Math.floor(Math.random() * 2_147_483_647);
}

/**
 * Build the prompt_recipe JSON from entry method data.
 */
export function buildPromptRecipe(
  entryMethod: string,
  data: Record<string, unknown>,
): Record<string, unknown> {
  switch (entryMethod) {
    case 'FORM':
      return { identity: data.form_data ?? {}, style: data.style ?? null };
    case 'REFERENCE':
      return { identity: null, reference_image: data.reference_image ?? null, style: null };
    case 'TEXT':
      return { identity: null, prompt: data.prompt ?? null, style: null };
    case 'RANDOMIZE':
      return { identity: {}, style: null };
    default:
      return { identity: {}, style: null };
  }
}

/**
 * Extract taxonomy values from prompt_recipe.identity.
 */
function extractTaxonomyValues(promptRecipe: Record<string, unknown>): Record<string, unknown> {
  if (promptRecipe.identity && typeof promptRecipe.identity === 'object') {
    return promptRecipe.identity as Record<string, unknown>;
  }
  return {};
}

/**
 * Group outputs by layout_type with all layout types represented (null if missing).
 */
function groupOutputsByLayout(outputs: AssetOutputRow[]): Record<string, AssetOutputRow | null> {
  const grouped: Record<string, AssetOutputRow | null> = {};
  for (const lt of LAYOUT_TYPES) {
    grouped[lt] = outputs.find((o) => o.layout_type === lt) ?? null;
  }
  return grouped;
}

/**
 * Map asset row + outputs to the actor detail response shape.
 */
function toActorDetail(asset: AssetRow, outputs: AssetOutputRow[]): ActorDetail {
  return {
    id: asset.id,
    name: asset.name,
    asset_type: asset.asset_type,
    seed: asset.seed,
    prompt_recipe: asset.prompt_recipe,
    outputs: groupOutputsByLayout(outputs),
    taxonomy_values: extractTaxonomyValues(asset.prompt_recipe),
    created_at: asset.created_at,
  };
}

/**
 * Map asset row to the list item shape.
 */
function toActorListItem(asset: AssetRow): ActorListItem {
  return { ...asset, headshot_url: asset.headshot_url ?? null };
}

// --- Service Functions ---

/**
 * Create a new actor (identity only, no generation).
 */
export async function createActor(
  params: CreateActorParams,
  account: AccountRow,
): Promise<ActorDetail> {
  const promptRecipe = buildPromptRecipe(
    params.entry_method,
    params as unknown as Record<string, unknown>,
  );

  const asset = await createAsset({
    workspace_id: account.workspace_id,
    creator_id: account.id,
    asset_type: 'ACTOR',
    seed: generateSeed(),
    prompt_recipe: promptRecipe,
  });

  return toActorDetail(asset, []);
}

/**
 * List actors with pagination and filters.
 */
export async function listActors(
  options: {
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    creatorId?: string;
    taxonomyFilters?: Record<string, string>;
    sharedWithMeAccountId?: string;
  },
  account: AccountRow,
  adminBypass = false,
): Promise<{
  data: ActorListItem[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}> {
  // Clients see their own workspace assets + purchased assets (via client_id)
  const clientId = account.role === 'CLIENT' ? account.id : undefined;

  const result = await listAssets({
    workspaceId: account.workspace_id,
    assetType: 'ACTOR',
    creatorId: options.creatorId,
    taxonomyFilters: options.taxonomyFilters,
    page: options.page,
    pageSize: options.pageSize,
    sortBy: options.sortBy,
    sortOrder: options.sortOrder,
    adminBypass,
    sharedWithMeAccountId: options.sharedWithMeAccountId,
    clientId,
  });

  return {
    data: result.data.map(toActorListItem),
    pagination: result.pagination,
  };
}

/**
 * Get a single actor with all outputs grouped by layout_type.
 */
export async function getActor(
  id: string,
  account: AccountRow,
  adminBypass = false,
): Promise<ActorDetail | null> {
  const asset = await findAssetById(id, account.workspace_id, adminBypass);

  if (!asset || asset.asset_type !== 'ACTOR') {
    return null;
  }

  const outputs = await getAssetOutputs(id);
  return toActorDetail(asset, outputs);
}

/**
 * Update an actor's name and/or taxonomy values.
 * Only fields present in the data are updated.
 */
export async function updateActor(
  id: string,
  data: UpdateActorData,
  account: AccountRow,
  adminBypass = false,
): Promise<ActorDetail | null> {
  // Get current asset to merge taxonomy
  const current = await findAssetById(id, account.workspace_id, adminBypass);

  if (!current || current.asset_type !== 'ACTOR') {
    return null;
  }

  // Client-owned assets cannot be edited by artists
  if (isClientOwnedBlocked(current, account.role, adminBypass)) {
    throw Object.assign(new Error('Cannot edit a client-owned asset'), { statusCode: 403 });
  }

  const updatePayload: {
    name?: string | null;
    prompt_recipe?: Record<string, unknown>;
  } = {};

  if (data.name !== undefined) {
    updatePayload.name = data.name;
  }

  if (data.taxonomy_values !== undefined) {
    const promptRecipe = { ...current.prompt_recipe };
    promptRecipe.identity = {
      ...((promptRecipe.identity as Record<string, unknown>) ?? {}),
      ...data.taxonomy_values,
    };
    updatePayload.prompt_recipe = promptRecipe;
  }

  const updated = await updateAsset(id, account.workspace_id, updatePayload, adminBypass);

  if (!updated) {
    return null;
  }

  const outputs = await getAssetOutputs(id);
  return toActorDetail(updated, outputs);
}

/**
 * Soft-delete an actor.
 */
export async function deleteActor(
  id: string,
  account: AccountRow,
  adminBypass = false,
): Promise<boolean> {
  const asset = await findAssetById(id, account.workspace_id, adminBypass);

  if (!asset || asset.asset_type !== 'ACTOR') {
    return false;
  }

  if (isClientOwnedBlocked(asset, account.role, adminBypass)) {
    throw Object.assign(new Error('Cannot delete a client-owned asset'), { statusCode: 403 });
  }

  return softDeleteAsset(id, account.workspace_id, adminBypass);
}

/**
 * Duplicate an actor: creates a new actor with source_asset_id pointing to original,
 * copies all asset_outputs with new IDs but same image_urls.
 * The duplicate is fully editable (not frozen).
 */
export async function duplicateActor(
  sourceActorId: string,
  account: AccountRow,
  newName: string | null,
  adminBypass = false,
): Promise<ActorDetail> {
  const sourceAsset = await findAssetById(sourceActorId, account.workspace_id, adminBypass);

  if (!sourceAsset || sourceAsset.asset_type !== 'ACTOR') {
    throw Object.assign(new Error('Actor not found'), { statusCode: 404 });
  }

  const duplicatedAsset = await duplicateAsset(
    sourceAsset,
    newName,
    account.workspace_id,
    account.id,
  );

  const duplicatedOutputs = await duplicateAssetOutputs(sourceAsset.id, duplicatedAsset.id);

  return toActorDetail(duplicatedAsset, duplicatedOutputs);
}
