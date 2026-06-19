import {
  findAssetById,
  createAssetOutput,
  getAssetOutputs,
} from '../../db/repositories/asset-repo.js';
import type { CreateAssetOutputInput } from '../../db/repositories/asset-repo.js';
import type { AccountRow } from '../../middleware/requireSession.js';
import type { WorkspaceRow } from '../../middleware/requireWorkspace.js';
import { generateSeed } from '../actor-service.js';
import * as fal from '../fal-service.js';
import { reserveCreditsForGeneration } from '../wallet-service.js';
import { InsufficientCreditsError } from '../../db/repositories/wallet-repo.js';
import { DEFAULT_COST } from './generation-constants.js';
import { resolveModel, InvalidModelError } from './resolve-model.js';
import type { CharacterSheetResponse } from './generation-types.js';

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

  // Resolve model: validate against active models or use default
  const resolvedModel = await resolveModel(model);
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
