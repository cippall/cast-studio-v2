import { findAssetById, createAssetOutput } from '../../db/repositories/asset-repo.js';
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

  // Resolve model: validate against active models or use default
  const model = await resolveModel(options.model);
  const numOutputs = options.num_outputs ?? 1;
  const prompt =
    (options.prompt ?? (asset.prompt_recipe?.identity as Record<string, unknown>))
      ? JSON.stringify(asset.prompt_recipe.identity)
      : '';

  // Determine seed: randomize generates a fresh random seed
  const seed = options.randomize ? generateSeed() : (asset.seed ?? generateSeed());

  // Build generation_params with all context
  const generationParams: Record<string, unknown> = {
    prompt,
    seed,
    model,
    num_outputs: 1,
    layout_type: options.layout_type,
    image_size: '1024x1024',
  };

  // Include form_data for FORM mode
  if (options.form_data) {
    generationParams.form_data = options.form_data;
  }

  // Include reference_images for REFERENCE mode
  if (options.reference_images) {
    generationParams.reference_images = options.reference_images;
  }

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

  for (let i = 0; i < numOutputs; i++) {
    const outputSeed = seed + i;

    // Clone per-output generation_params with unique seed
    const outputGenerationParams: Record<string, unknown> = {
      ...generationParams,
      seed: outputSeed,
    };

    // Save to DB first
    const input: CreateAssetOutputInput = {
      asset_id: assetId,
      layout_type: options.layout_type,
      model,
      status: 'PENDING',
      cost_credits: DEFAULT_COST,
      generation_params: outputGenerationParams,
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
        seed: outputSeed,
        num_outputs: 1,
        image_size: '1024x1024',
      });
    } catch (err) {
      console.error(`fal.ai submission error for output ${output.id}:`, err);
    }
  }

  return { outputs };
}
