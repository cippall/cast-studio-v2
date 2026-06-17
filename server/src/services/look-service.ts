import {
  createAsset,
  createAssetOutput,
  findAssetById,
  listAssets,
  updateAsset,
  softDeleteAsset,
  getAssetOutputs,
  updateOutputsStatus,
  isClientOwnedBlocked,
} from '../db/repositories/asset-repo.js';
import type { AssetRow, AssetOutputRow } from '../db/repositories/asset-repo.js';
import type { AccountRow } from '../middleware/requireSession.js';
import { generateSeed } from './actor-service.js';

// --- Constants ---

const DEFAULT_MODEL = 'flux-pro';
const DEFAULT_COST = 0.05;
const NUM_OUTPUTS = 4;

// --- Types ---

export type LookEntryMethod = 'PROMPT' | 'REFERENCE' | 'COMPOSITE';

export interface CreateLookParams {
  entry_method: LookEntryMethod;
  prompt?: string;
  reference_image?: string;
  fashion_item_ids?: string[];
}

export interface UpdateLookData {
  selected_output_id?: string;
  name?: string;
}

export interface LookListItem {
  id: string;
  name: string | null;
  creator_id: string;
  asset_type: string;
  image_url: string | null;
  taxonomy_values: Record<string, unknown>;
  created_at: string;
}

export interface LookDetail {
  id: string;
  name: string | null;
  asset_type: string;
  seed: number;
  prompt_recipe: Record<string, unknown>;
  outputs: AssetOutputRow[];
  taxonomy_values: Record<string, unknown>;
  created_at: string;
}

export interface CreateLookResponse {
  id: string;
  asset_type: string;
  outputs: Array<{
    id: string;
    image_url: null;
    status: string;
    model: string;
    cost_credits: number;
  }>;
  auto_name: string;
  created_at: string;
}

// --- Helpers ---

/**
 * Generate an auto-name from the first few words of a prompt.
 */
function generateAutoName(prompt?: string): string {
  if (prompt) {
    // Take first 4 meaningful words, strip punctuation, title case
    const words = prompt
      .replace(/[,.]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 0)
      .slice(0, 4);
    return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }
  return 'New Look';
}

/**
 * Build the prompt_recipe JSON from entry method data.
 */
function buildPromptRecipe(
  entryMethod: string,
  data: Record<string, unknown>,
): Record<string, unknown> {
  switch (entryMethod) {
    case 'PROMPT':
      return { prompt: data.prompt ?? null, identity: null, reference_image: null };
    case 'REFERENCE':
      return { prompt: null, identity: null, reference_image: data.reference_image ?? null };
    case 'COMPOSITE':
      return { prompt: null, identity: null, fashion_item_ids: data.fashion_item_ids ?? [] };
    default:
      return { prompt: null, identity: null };
  }
}

/**
 * Extract taxonomy values (identity field) from prompt_recipe.
 */
function extractTaxonomyValues(promptRecipe: Record<string, unknown>): Record<string, unknown> {
  if (promptRecipe.identity && typeof promptRecipe.identity === 'object') {
    return promptRecipe.identity as Record<string, unknown>;
  }
  return {};
}

/**
 * Map asset row + outputs to detail shape.
 */
function toLookDetail(asset: AssetRow, outputs: AssetOutputRow[]): LookDetail {
  return {
    id: asset.id,
    name: asset.name,
    asset_type: asset.asset_type,
    seed: asset.seed,
    prompt_recipe: asset.prompt_recipe,
    outputs,
    taxonomy_values: extractTaxonomyValues(asset.prompt_recipe),
    created_at: asset.created_at,
  };
}

/**
 * Map asset row to list item shape, resolving image_url from the first SUCCESS output.
 */
function toLookListItem(asset: AssetRow): LookListItem {
  return {
    id: asset.id,
    name: asset.name,
    creator_id: asset.creator_id,
    asset_type: asset.asset_type,
    image_url: asset.headshot_url ?? null,
    taxonomy_values: extractTaxonomyValues(asset.prompt_recipe),
    created_at: asset.created_at,
  };
}

// --- Service Functions ---

/**
 * Create a new look with 4 PENDING outputs and an auto-name.
 */
export async function createLook(
  params: CreateLookParams,
  account: AccountRow,
): Promise<CreateLookResponse> {
  const promptRecipe = buildPromptRecipe(
    params.entry_method,
    params as unknown as Record<string, unknown>,
  );
  const seed = generateSeed();
  const autoName = generateAutoName(params.prompt);

  const asset = await createAsset({
    workspace_id: account.workspace_id,
    creator_id: account.id,
    asset_type: 'LOOK',
    seed,
    prompt_recipe: promptRecipe,
    name: autoName,
  });

  // Create 4 PENDING output rows
  const outputs: Array<{
    id: string;
    image_url: null;
    status: string;
    model: string;
    cost_credits: number;
  }> = [];

  for (let i = 0; i < NUM_OUTPUTS; i++) {
    const output = await createAssetOutput({
      asset_id: asset.id,
      layout_type: 'look',
      model: DEFAULT_MODEL,
      status: 'PENDING',
      cost_credits: DEFAULT_COST,
      generation_params: {
        seed: seed + i,
        prompt: params.prompt ?? null,
        model: DEFAULT_MODEL,
        num_outputs: 1,
      },
    });
    outputs.push({
      id: output.id,
      image_url: null,
      status: output.status,
      model: output.model,
      cost_credits: output.cost_credits,
    });
  }

  return {
    id: asset.id,
    asset_type: 'LOOK',
    outputs,
    auto_name: autoName,
    created_at: asset.created_at,
  };
}

/**
 * List looks with pagination and taxonomy filters.
 */
export async function listLooks(
  options: {
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    creatorId?: string;
    taxonomyFilters?: Record<string, string>;
  },
  account: AccountRow,
  adminBypass = false,
): Promise<{
  data: LookListItem[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}> {
  const result = await listAssets({
    workspaceId: account.workspace_id,
    assetType: 'LOOK',
    creatorId: options.creatorId,
    taxonomyFilters: { ...options.taxonomyFilters },
    page: options.page,
    pageSize: options.pageSize,
    sortBy: options.sortBy,
    sortOrder: options.sortOrder,
    adminBypass,
  });

  return {
    data: result.data.map(toLookListItem),
    pagination: result.pagination,
  };
}

/**
 * Get a single look with all outputs.
 */
export async function getLook(
  id: string,
  account: AccountRow,
  adminBypass = false,
): Promise<LookDetail | null> {
  const asset = await findAssetById(id, account.workspace_id, adminBypass);

  if (!asset || asset.asset_type !== 'LOOK') {
    return null;
  }

  const outputs = await getAssetOutputs(id);
  return toLookDetail(asset, outputs);
}

/**
 * Update a look: select an output and optionally rename.
 * Selecting an output marks it SUCCESS and marks all other outputs FAILED.
 */
export async function updateLook(
  id: string,
  data: UpdateLookData,
  account: AccountRow,
  adminBypass = false,
): Promise<LookDetail | null> {
  const asset = await findAssetById(id, account.workspace_id, adminBypass);

  if (!asset || asset.asset_type !== 'LOOK') {
    return null;
  }

  // Client-owned assets cannot be edited by artists
  if (isClientOwnedBlocked(asset, account.role, adminBypass)) {
    throw Object.assign(new Error('Cannot edit a client-owned asset'), { statusCode: 403 });
  }

  // Handle output selection
  if (data.selected_output_id) {
    const allOutputs = await getAssetOutputs(id);
    const selectedOutput = allOutputs.find((o) => o.id === data.selected_output_id);

    if (!selectedOutput) {
      return null;
    }

    // Mark selected as SUCCESS
    await updateOutputsStatus(id, [data.selected_output_id], 'SUCCESS', {
      image_url: `https://fal.ai/looks/${id}/${data.selected_output_id}.png`,
    });

    // Mark rest as FAILED
    const otherIds = allOutputs.filter((o) => o.id !== data.selected_output_id).map((o) => o.id);
    if (otherIds.length > 0) {
      await updateOutputsStatus(id, otherIds, 'FAILED');
    }
  }

  // Handle rename
  const updatePayload: { name?: string | null } = {};
  if (data.name !== undefined) {
    updatePayload.name = data.name;
  }

  if (Object.keys(updatePayload).length > 0) {
    const updated = await updateAsset(id, account.workspace_id, updatePayload, adminBypass);
    if (!updated) {
      return null;
    }
    const outputs = await getAssetOutputs(id);
    return toLookDetail(updated, outputs);
  }

  // Fetch fresh state after output selection
  const freshAsset = await findAssetById(id, account.workspace_id, adminBypass);
  if (!freshAsset) {
    return null;
  }
  const outputs = await getAssetOutputs(id);
  return toLookDetail(freshAsset, outputs);
}

/**
 * Soft-delete a look.
 */
export async function deleteLook(
  id: string,
  account: AccountRow,
  adminBypass = false,
): Promise<boolean> {
  const asset = await findAssetById(id, account.workspace_id, adminBypass);

  if (!asset || asset.asset_type !== 'LOOK') {
    return false;
  }

  if (isClientOwnedBlocked(asset, account.role, adminBypass)) {
    throw Object.assign(new Error('Cannot delete a client-owned asset'), { statusCode: 403 });
  }

  return softDeleteAsset(id, account.workspace_id, adminBypass);
}
