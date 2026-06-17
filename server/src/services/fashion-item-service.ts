import {
  createAsset,
  createAssetOutput,
  findAssetById,
  listAssets,
  updateAsset,
  softDeleteAsset,
  getAssetOutputs,
  updateOutputsStatus,
} from '../db/repositories/asset-repo.js';
import type { AssetRow, AssetOutputRow } from '../db/repositories/asset-repo.js';
import type { AccountRow } from '../middleware/requireSession.js';
import { generateSeed } from './actor-service.js';

// --- Constants ---

const DEFAULT_MODEL = 'flux-pro';
const DEFAULT_COST = 0.02;
const NUM_OUTPUTS = 4;

// --- Types ---

export type FashionItemEntryMethod = 'PROMPT' | 'REFERENCE';

export interface CreateFashionItemParams {
  entry_method: FashionItemEntryMethod;
  prompt?: string;
  reference_image?: string;
}

export interface UpdateFashionItemData {
  selected_output_id?: string;
  name?: string;
}

export interface FashionItemListItem {
  id: string;
  name: string | null;
  creator_id: string;
  asset_type: string;
  image_url: string | null;
  taxonomy_values: Record<string, unknown>;
  created_at: string;
}

export interface FashionItemDetail {
  id: string;
  name: string | null;
  asset_type: string;
  seed: number;
  prompt_recipe: Record<string, unknown>;
  outputs: AssetOutputRow[];
  taxonomy_values: Record<string, unknown>;
  created_at: string;
}

export interface CreateFashionItemResponse {
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
    const words = prompt
      .replace(/[,.]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 0)
      .slice(0, 4);
    return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }
  return 'New Fashion Item';
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
function toFashionItemDetail(asset: AssetRow, outputs: AssetOutputRow[]): FashionItemDetail {
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
 * Map asset row to list item shape, resolving image_url from headshot_url (populated by LEFT JOIN).
 */
function toFashionItemListItem(asset: AssetRow): FashionItemListItem {
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
 * Create a new fashion item with 4 PENDING outputs and an auto-name.
 */
export async function createFashionItem(
  params: CreateFashionItemParams,
  account: AccountRow,
): Promise<CreateFashionItemResponse> {
  const promptRecipe = buildPromptRecipe(
    params.entry_method,
    params as unknown as Record<string, unknown>,
  );
  const seed = generateSeed();
  const autoName = generateAutoName(params.prompt);

  const asset = await createAsset({
    workspace_id: account.workspace_id,
    creator_id: account.id,
    asset_type: 'FASHION_ITEM',
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
      layout_type: 'fashion_item',
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
    asset_type: 'FASHION_ITEM',
    outputs,
    auto_name: autoName,
    created_at: asset.created_at,
  };
}

/**
 * List fashion items with pagination and taxonomy filters.
 */
export async function listFashionItems(
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
  data: FashionItemListItem[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}> {
  const result = await listAssets({
    workspaceId: account.workspace_id,
    assetType: 'FASHION_ITEM',
    creatorId: options.creatorId,
    taxonomyFilters: { ...options.taxonomyFilters },
    page: options.page,
    pageSize: options.pageSize,
    sortBy: options.sortBy,
    sortOrder: options.sortOrder,
    adminBypass,
  });

  return {
    data: result.data.map(toFashionItemListItem),
    pagination: result.pagination,
  };
}

/**
 * Get a single fashion item with all outputs.
 */
export async function getFashionItem(
  id: string,
  account: AccountRow,
  adminBypass = false,
): Promise<FashionItemDetail | null> {
  const asset = await findAssetById(id, account.workspace_id, adminBypass);

  if (!asset || asset.asset_type !== 'FASHION_ITEM') {
    return null;
  }

  const outputs = await getAssetOutputs(id);
  return toFashionItemDetail(asset, outputs);
}

/**
 * Update a fashion item: select an output and optionally rename.
 * Selecting an output marks it SUCCESS and marks all other outputs FAILED.
 */
export async function updateFashionItem(
  id: string,
  data: UpdateFashionItemData,
  account: AccountRow,
  adminBypass = false,
): Promise<FashionItemDetail | null> {
  const asset = await findAssetById(id, account.workspace_id, adminBypass);

  if (!asset || asset.asset_type !== 'FASHION_ITEM') {
    return null;
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
      image_url: `https://fal.ai/fashion-items/${id}/${data.selected_output_id}.png`,
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
    return toFashionItemDetail(updated, outputs);
  }

  // Fetch fresh state after output selection
  const freshAsset = await findAssetById(id, account.workspace_id, adminBypass);
  if (!freshAsset) {
    return null;
  }
  const outputs = await getAssetOutputs(id);
  return toFashionItemDetail(freshAsset, outputs);
}

/**
 * Soft-delete a fashion item.
 */
export async function deleteFashionItem(
  id: string,
  account: AccountRow,
  adminBypass = false,
): Promise<boolean> {
  return softDeleteAsset(id, account.workspace_id, adminBypass);
}
