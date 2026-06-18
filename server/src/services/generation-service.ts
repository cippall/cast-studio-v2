import {
  findAssetById,
  createAssetOutput,
  getAssetOutputs,
  getAssetOutputById,
  archiveAssetOutput,
  markDownstreamObsolete,
} from '../db/repositories/asset-repo.js';
import type { AssetOutputRow, CreateAssetOutputInput } from '../db/repositories/asset-repo.js';
import type { AccountRow } from '../middleware/requireSession.js';
import type { WorkspaceRow } from '../middleware/requireWorkspace.js';
import { generateSeed } from './actor-service.js';
import * as fal from './fal-service.js';
import { reserveCreditsForGeneration } from './wallet-service.js';
import { InsufficientCreditsError } from '../db/repositories/wallet-repo.js';

// --- Constants ---

const DEFAULT_MODEL = 'flux-pro';
const DEFAULT_COST = 0.05;

// --- Types ---

export interface GenerateOptions {
  layout_type: string;
  model?: string;
  num_outputs?: number;
  prompt?: string;
}

export interface GenerateResponse {
  outputs: Array<{
    id: string;
    layout_type: string;
    status: string;
    model: string;
    cost_credits: number;
  }>;
}

export interface CharacterSheetResponse {
  id: string;
  layout_type: string;
  status: string;
  model: string;
  cost_credits: number;
  source_assets: Array<{
    asset_id: string;
    asset_output_id: string;
    layout_type: string;
  }>;
}

// --- Generation Functions ---

/**
 * Generate outputs for an actor layout.
 * Creates PENDING asset_output row(s) and submits to fal.ai.
 * Returns 202 response shape with output IDs.
 */
export async function generateActorOutput(
  assetId: string,
  account: AccountRow,
  options: GenerateOptions,
  adminBypass = false,
): Promise<GenerateResponse> {
  const asset = await findAssetById(assetId, account.workspace_id, adminBypass);

  if (!asset || asset.asset_type !== 'ACTOR') {
    throw Object.assign(new Error('Actor not found'), { statusCode: 404 });
  }

  if (asset.is_marketplace_frozen) {
    throw Object.assign(new Error('Cannot generate on a marketplace-frozen asset'), {
      statusCode: 409,
    });
  }

  const model = options.model ?? DEFAULT_MODEL;
  const numOutputs = options.num_outputs ?? 1;
  const prompt =
    (options.prompt ?? (asset.prompt_recipe?.identity as Record<string, unknown>))
      ? JSON.stringify(asset.prompt_recipe.identity)
      : '';

  // Reserve credits before generation
  const totalCost = DEFAULT_COST * numOutputs;
  const workspaceRow = {
    id: account.workspace_id,
    name: '',
    slug: '',
    workspace_type: '',
    created_at: '',
  } as WorkspaceRow;
  try {
    await reserveCreditsForGeneration(account, workspaceRow, totalCost);
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      throw Object.assign(
        new Error(
          `Insufficient credits. Balance: ${err.currentBalance}, Required: ${err.required}. Please top up your wallet.`,
        ),
        { statusCode: 422 },
      );
    }
    throw err;
  }

  const outputs: Array<{
    id: string;
    layout_type: string;
    status: string;
    model: string;
    cost_credits: number;
  }> = [];

  const baseSeed = generateSeed();

  for (let i = 0; i < numOutputs; i++) {
    const seed = baseSeed + i;
    const generationParams: Record<string, unknown> = {
      seed,
      prompt,
      model,
      num_outputs: 1,
      layout_type: options.layout_type,
      image_size: '1024x1024',
    };

    // Save to DB first
    const input: CreateAssetOutputInput = {
      asset_id: assetId,
      layout_type: options.layout_type,
      model,
      status: 'PENDING',
      cost_credits: DEFAULT_COST,
      generation_params: generationParams,
    };

    const output = await createAssetOutput(input);

    outputs.push({
      id: output.id,
      layout_type: output.layout_type,
      status: output.status,
      model: output.model,
      cost_credits: output.cost_credits,
    });

    // Submit to fal.ai (non-blocking — worker will poll)
    try {
      await fal.submitTextToImage({
        model,
        prompt,
        seed,
        num_outputs: 1,
        image_size: '1024x1024',
      });
    } catch (err) {
      console.error(`fal.ai submission error for output ${output.id}:`, err);
    }
  }

  return { outputs };
}

/**
 * Regenerate an existing actor layout.
 * Archives the current output to asset_output_versions,
 * marks downstream outputs as obsolete,
 * then creates a new PENDING output with version+1.
 */
export async function regenerateActorOutput(
  assetId: string,
  layoutType: string,
  account: AccountRow,
  options: GenerateOptions,
  adminBypass = false,
): Promise<GenerateResponse> {
  const asset = await findAssetById(assetId, account.workspace_id, adminBypass);

  if (!asset || asset.asset_type !== 'ACTOR') {
    throw Object.assign(new Error('Actor not found'), { statusCode: 404 });
  }

  if (asset.is_marketplace_frozen) {
    throw Object.assign(new Error('Cannot regenerate on a marketplace-frozen asset'), {
      statusCode: 409,
    });
  }

  const model = options.model ?? DEFAULT_MODEL;
  const prompt =
    (options.prompt ?? (asset.prompt_recipe?.identity as Record<string, unknown>))
      ? JSON.stringify(asset.prompt_recipe.identity)
      : '';

  // Reserve credits before regeneration
  const workspaceRow = {
    id: account.workspace_id,
    name: '',
    slug: '',
    workspace_type: '',
    created_at: '',
  } as WorkspaceRow;
  try {
    await reserveCreditsForGeneration(account, workspaceRow, DEFAULT_COST);
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      throw Object.assign(
        new Error(
          `Insufficient credits. Balance: ${err.currentBalance}, Required: ${err.required}. Please top up your wallet.`,
        ),
        { statusCode: 422 },
      );
    }
    throw err;
  }

  // Find current outputs for this layout type
  const allOutputs = await getAssetOutputs(assetId);
  const currentOutputs = allOutputs.filter(
    (o) => o.layout_type === layoutType && o.status !== 'FAILED',
  );

  // Get the current max version for this layout
  const maxVersion = currentOutputs.reduce((max, o) => Math.max(max, o.version), 0);
  const newVersion = maxVersion + 1;

  // Archive each current output
  for (const output of currentOutputs) {
    await archiveAssetOutput(output.id);
  }

  // Mark downstream outputs as obsolete
  const downstreamReason = `${layoutType} was regenerated. Regenerate to update.`;
  await markDownstreamObsolete(assetId, asset.asset_type, layoutType, downstreamReason);

  // Create new output with version+1
  const seed = generateSeed();
  const generationParams: Record<string, unknown> = {
    seed,
    prompt,
    model,
    num_outputs: 1,
    layout_type: layoutType,
    image_size: '1024x1024',
    version: newVersion,
  };

  const input: CreateAssetOutputInput = {
    asset_id: assetId,
    layout_type: layoutType,
    model,
    status: 'PENDING',
    cost_credits: DEFAULT_COST,
    version: newVersion,
    generation_params: generationParams,
  };

  const output = await createAssetOutput(input);

  // Submit to fal.ai (non-blocking)
  try {
    await fal.submitTextToImage({
      model,
      prompt,
      seed,
      num_outputs: 1,
      image_size: '1024x1024',
    });
  } catch (err) {
    console.error(`fal.ai submission error for regenerated output ${output.id}:`, err);
  }

  return {
    outputs: [
      {
        id: output.id,
        layout_type: output.layout_type,
        status: output.status,
        model: output.model,
        cost_credits: output.cost_credits,
      },
    ],
  };
}

/**
 * Generate a character sheet by composing an actor headshot with a look.
 * Creates a single PENDING character_sheet output.
 */
export async function generateCharacterSheet(
  assetId: string,
  lookId: string,
  account: AccountRow,
  model?: string,
  adminBypass = false,
): Promise<CharacterSheetResponse> {
  const asset = await findAssetById(assetId, account.workspace_id, adminBypass);

  if (!asset || asset.asset_type !== 'ACTOR') {
    throw Object.assign(new Error('Actor not found'), { statusCode: 404 });
  }

  // Verify the look exists (must be in same workspace)
  const lookAsset = await findAssetById(lookId, account.workspace_id, adminBypass);

  if (!lookAsset || lookAsset.asset_type !== 'LOOK') {
    throw Object.assign(new Error('Look not found'), { statusCode: 404 });
  }

  if (asset.is_marketplace_frozen) {
    throw Object.assign(
      new Error('Cannot generate character sheet on a marketplace-frozen asset'),
      {
        statusCode: 409,
      },
    );
  }

  const resolvedModel = model ?? DEFAULT_MODEL;
  const prompt = (asset.prompt_recipe?.identity as Record<string, unknown>)
    ? JSON.stringify(asset.prompt_recipe.identity)
    : '';

  // Reserve credits before generation
  const workspaceRow = {
    id: account.workspace_id,
    name: '',
    slug: '',
    workspace_type: '',
    created_at: '',
  } as WorkspaceRow;
  try {
    await reserveCreditsForGeneration(account, workspaceRow, DEFAULT_COST);
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      throw Object.assign(
        new Error(
          `Insufficient credits. Balance: ${err.currentBalance}, Required: ${err.required}. Please top up your wallet.`,
        ),
        { statusCode: 422 },
      );
    }
    throw err;
  }

  // Find the actor's headshot output and the look's selected output
  const actorOutputs = await getAssetOutputs(assetId);
  const headshotOutput = actorOutputs.find(
    (o) => o.layout_type === 'headshot' && o.status === 'SUCCESS',
  );

  const lookOutputs = await getAssetOutputs(lookId);
  const lookSelectedOutput = lookOutputs.find((o) => o.status === 'SUCCESS');

  // Build source_asset_outputs reference
  const sourceAssetOutputs: Array<{
    asset_id: string;
    asset_output_id: string;
    layout_type: string;
  }> = [];

  if (headshotOutput) {
    sourceAssetOutputs.push({
      asset_id: assetId,
      asset_output_id: headshotOutput.id,
      layout_type: 'headshot',
    });
  }

  if (lookSelectedOutput) {
    sourceAssetOutputs.push({
      asset_id: lookId,
      asset_output_id: lookSelectedOutput.id,
      layout_type: 'look',
    });
  }

  // Create the character_sheet output
  const seed = generateSeed();
  const generationParams: Record<string, unknown> = {
    seed,
    prompt,
    model: resolvedModel,
    num_outputs: 1,
    layout_type: 'character_sheet',
    image_size: '1024x1024',
    source_assets: sourceAssetOutputs,
  };

  const input: CreateAssetOutputInput = {
    asset_id: assetId,
    layout_type: 'character_sheet',
    model: resolvedModel,
    status: 'PENDING',
    cost_credits: DEFAULT_COST,
    generation_params: generationParams,
    source_asset_outputs: (sourceAssetOutputs.length > 0
      ? sourceAssetOutputs
      : null) as unknown as Record<string, unknown> | null,
  };

  const output = await createAssetOutput(input);

  // Submit to fal.ai (non-blocking)
  try {
    await fal.submitTextToImage({
      model: resolvedModel,
      prompt,
      seed,
      num_outputs: 1,
      image_size: '1024x1024',
    });
  } catch (err) {
    console.error(`fal.ai submission error for character sheet ${output.id}:`, err);
  }

  return {
    id: output.id,
    layout_type: 'character_sheet',
    status: output.status,
    model: output.model,
    cost_credits: output.cost_credits,
    source_assets: sourceAssetOutputs,
  };
}

/**
 * Get the current status of a generation job (asset output).
 */
export async function getGenerationStatus(outputId: string): Promise<AssetOutputRow | null> {
  return getAssetOutputById(outputId);
}
