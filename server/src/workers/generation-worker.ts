import * as fal from '../services/fal-service.js';
import {
  findPendingOutputs,
  updateOutputsStatus,
  getAssetOutputById,
} from '../db/repositories/asset-repo.js';

// --- Debounce Flag ---

let isRunning = false;
let intervalHandle: ReturnType<typeof setInterval> | null = null;

// --- Configuration ---

const POLL_INTERVAL_MS = 5000; // Check every 5 seconds
const MAX_BATCH_SIZE = 10;

// --- Worker Logic ---

/**
 * Process all PENDING outputs in the queue.
 * Debounced: if a previous run is still in progress, this one is skipped.
 */
async function processPendingOutputs(): Promise<void> {
  if (isRunning) {
    return;
  }

  isRunning = true;

  try {
    const pendingOutputs = await findPendingOutputs(MAX_BATCH_SIZE);

    for (const output of pendingOutputs) {
      try {
        await processSingleOutput(output);
      } catch (err) {
        console.error(`Error processing output ${output.id}:`, err);

        // Mark as FAILED on unexpected error
        try {
          await updateOutputsStatus(output.asset_id, [output.id], 'FAILED', {
            image_url: null,
            error_message: err instanceof Error ? err.message : 'Unexpected error',
          } as Record<string, unknown>);
        } catch (innerErr) {
          console.error(`Failed to mark output ${output.id} as FAILED:`, innerErr);
        }
      }
    }
  } catch (err) {
    console.error('Error finding pending outputs:', err);
  } finally {
    isRunning = false;
  }
}

/**
 * Process a single pending output by polling fal.ai.
 */
async function processSingleOutput(output: {
  id: string;
  asset_id: string;
  model: string;
  generation_params: Record<string, unknown> | null;
}): Promise<void> {
  // If generation_params has a fal_job_id, poll that job
  const generationParams = output.generation_params ?? {};
  const falJobId = generationParams['fal_job_id'] as string | undefined;

  if (falJobId) {
    // Poll fal.ai for the job status
    const result = await fal.pollJob(falJobId, output.model);

    if (result.status === 'SUCCESS') {
      await updateOutputsStatus(output.asset_id, [output.id], 'SUCCESS', {
        image_url: result.image_url,
        cost_credits: result.cost_credits,
      } as Record<string, unknown>);
    } else if (result.status === 'FAILED') {
      await updateOutputsStatus(output.asset_id, [output.id], 'FAILED', {
        error_message: result.error_message,
        image_url: null,
      } as Record<string, unknown>);
    }
    // If still PENDING, do nothing — will pick it up on next poll
  } else {
    // No fal.ai job ID — this is a simulated/dev scenario.
    // Mark as SUCCESS immediately with a placeholder URL.
    await updateOutputsStatus(output.asset_id, [output.id], 'SUCCESS', {
      image_url: `https://fal.ai/sim/${output.id}.png`,
      cost_credits: 0.05,
    } as Record<string, unknown>);
  }
}

// --- Lifecycle ---

/**
 * Start the generation worker polling loop.
 */
export function startWorker(): void {
  if (intervalHandle) {
    return; // Already started
  }

  console.log('Starting generation worker (poll interval: %dms)', POLL_INTERVAL_MS);
  intervalHandle = setInterval(processPendingOutputs, POLL_INTERVAL_MS);

  // Run the first batch immediately
  processPendingOutputs().catch((err) => {
    console.error('Initial worker run failed:', err);
  });
}

/**
 * Stop the generation worker polling loop.
 */
export function stopWorker(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log('Generation worker stopped');
  }
}

/**
 * Process pending outputs on-demand (for use in tests).
 */
export async function processNow(): Promise<void> {
  await processPendingOutputs();
}
