import {
  findAssetById,
  createAssetOutput,
  updateAssetOutputError,
} from '../../db/repositories/asset-repo.js';
import type { CreateAssetOutputInput } from '../../db/repositories/asset-repo.js';
import type { AccountRow } from '../../middleware/requireSession.js';
import type { WorkspaceRow } from '../../middleware/requireWorkspace.js';
import { query } from '../../db/pool.js';
import { generateSeed } from '../actor-service.js';
import * as fal from '../fal-service.js';
import { getWorkspaceApiKey } from '../fal-service.js';
import { reserveCreditsForGeneration } from '../wallet-service.js';
import { refundCredits } from '../../db/repositories/wallet-repo.js';
import { InsufficientCreditsError } from '../../db/repositories/wallet-repo.js';
import { DEFAULT_COST } from './generation-constants.js';
import { resolveModel, InvalidModelError } from './resolve-model.js';
import { resolvePrompt } from '../prompt-service.js';
import type { GenerateOptions, GenerateResponse } from './generation-types.js';

/**
 * Infer the Cast Studio task from the layout_type when no explicit task is provided.
 */
function inferTaskFromLayout(layoutType: string): string {
  switch (layoutType) {
    case 'headshot':
      return 'actor_headshot';
    case 'fullshot':
      return 'actor_fullshot';
    case 'expressions_3x4':
      return 'actor_expressions';
    case 'editorial':
      return 'actor_editorial';
    case 'character_sheet':
      return 'actor_character_sheet';
    default:
      return 'actor_headshot';
  }
}

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

  // Resolve model
  const model = await resolveModel(options.model, account.workspace_id);
  const numOutputs = options.num_outputs ?? 1;

  // Determine seed: randomize generates a fresh random seed
  const seed = options.randomize ? generateSeed() : (asset.seed ?? generateSeed());

  // Resolve workspace-specific fal.ai key (falls back to FAL_KEY env)
  const workspaceKey = await getWorkspaceApiKey(account.workspace_id);

  // Resolve prompt: use system prompt template if no explicit prompt provided
  let resolvedPrompt: string;
  if (options.prompt) {
    resolvedPrompt = options.prompt;
  } else {
    const promptTask = options.task ?? inferTaskFromLayout(options.layout_type);
    const identityData = (asset.prompt_recipe?.identity as Record<string, unknown>) ?? {};
    resolvedPrompt = await resolvePrompt(promptTask, identityData);
  }

  // Build generation_params with all context
  const generationParams: Record<string, unknown> = {
    prompt: resolvedPrompt,
    seed,
    model,
    num_outputs: 1,
    layout_type: options.layout_type,
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

    // Submit to fal.ai and store the job ID in generation_params for worker polling
    try {
      let jobId: string;
      if (options.reference_images && options.reference_images.length > 0) {
        const result = await fal.submitImageToImage(
          {
            model,
            prompt: resolvedPrompt,
            seed: outputSeed,
            num_outputs: 1,
            image_url: options.reference_images[0],
            strength: 0.7,
            reference_images: options.reference_images,
          },
          workspaceKey,
        );
        jobId = result.jobId;
      } else {
        const result = await fal.submitTextToImage(
          {
            model,
            prompt: resolvedPrompt,
            seed: outputSeed,
            num_outputs: 1,
            form_data: options.form_data,
          },
          workspaceKey,
        );
        jobId = result.jobId;
      }

      // Store fal job ID in generation_params so the worker can poll it
      outputGenerationParams['fal_job_id'] = jobId;
      await query('UPDATE asset_outputs SET generation_params = $1 WHERE id = $2', [
        JSON.stringify(outputGenerationParams),
        output.id,
      ]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'fal.ai submission failed';
      console.error(`fal.ai submission error for output ${output.id}:`, err);

      // Update output row to FAILED
      await updateAssetOutputError(output.id, errorMessage);

      // Refund credits
      await refundCredits(account.workspace_id, account.id, DEFAULT_COST);

      // Propagate error to route handler
      throw Object.assign(new Error(errorMessage), { statusCode: 502 });
    }

    outputs.push({
      id: output.id,
      layout_type: output.layout_type,
      status: output.status,
      model: output.model,
      cost_credits: output.cost_credits,
    });
  }

  return { outputs };
}
