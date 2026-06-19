import {
  findAssetById,
  createAssetOutput,
  getAssetOutputs,
  archiveAssetOutput,
  markDownstreamObsolete,
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
import type { GenerateOptions, GenerateResponse } from './generation-types.js';

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

  // Resolve model: validate against active models or use default
  const model = await resolveModel(options.model);
  const prompt =
    (options.prompt ?? (asset.prompt_recipe?.identity as Record<string, unknown>))
      ? JSON.stringify(asset.prompt_recipe.identity)
      : '';

  // Determine seed: randomize generates a fresh random seed
  const seed = options.randomize ? generateSeed() : (asset.seed ?? generateSeed());

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
  const generationParams: Record<string, unknown> = {
    seed,
    prompt,
    model,
    num_outputs: 1,
    layout_type: layoutType,
    image_size: '1024x1024',
    version: newVersion,
  };

  // Include form_data for FORM mode
  if (options.form_data) {
    generationParams.form_data = options.form_data;
  }

  // Include reference_images for REFERENCE mode
  if (options.reference_images) {
    generationParams.reference_images = options.reference_images;
  }

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
