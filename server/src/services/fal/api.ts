import type { FalGenerateParams, FalJobResult } from './types.js';

const FAL_API_BASE = 'https://queue.fal.run/fal-ai';

function getEnvKey(): string | undefined {
  return process.env.FAL_KEY;
}

function getModelEndpoint(model: string): string {
  // Dynamic model IDs (e.g. "fal-ai/flux/dev") use the queue endpoint directly
  if (model.includes('/')) {
    return `https://queue.fal.run/${model}`;
  }
  // Hardcoded short names keep backward compatibility
  switch (model) {
    case 'flux-pro':
      return `${FAL_API_BASE}/flux-pro`;
    case 'flux-realism':
      return `${FAL_API_BASE}/flux-realism`;
    case 'flux-canny':
      return `${FAL_API_BASE}/flux-canny`;
    case 'sdxl-turbo':
      return `${FAL_API_BASE}/sdxl-turbo`;
    default:
      return `${FAL_API_BASE}/${model}`;
  }
}

function simJobId(): string {
  return `sim_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function postJson(url: string, apiKey: string, body: unknown): Promise<unknown> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`fal.ai API error (${response.status}): ${text}`);
  }
  return response.json();
}

// --- Public API ---

export async function submitTextToImage(
  params: FalGenerateParams,
  apiKey?: string,
): Promise<{
  jobId: string;
  status: string;
}> {
  const key = apiKey ?? getEnvKey();
  const endpoint = getModelEndpoint(params.model);

  const body: Record<string, unknown> = {
    prompt: params.prompt,
    seed: params.seed,
    num_images: params.num_outputs ?? 1,
  };
  if (params.image_size) body['image_size'] = params.image_size;
  if (params.guidance_scale !== undefined) body['guidance_scale'] = params.guidance_scale;
  if (params.num_inference_steps !== undefined)
    body['num_inference_steps'] = params.num_inference_steps;
  if (key) {
    const data = (await postJson(endpoint, key, body)) as { request_id: string };
    return { jobId: data.request_id, status: 'PENDING' };
  }
  return { jobId: simJobId(), status: 'PENDING' };
}

export async function submitImageToImage(
  params: FalGenerateParams,
  apiKey?: string,
): Promise<{
  jobId: string;
  status: string;
}> {
  const key = apiKey ?? getEnvKey();
  const endpoint = getModelEndpoint(params.model);

  const body: Record<string, unknown> = {
    image_url: params.image_url,
    prompt: params.prompt,
    seed: params.seed,
    num_images: params.num_outputs ?? 1,
  };
  if (params.strength !== undefined) body['strength'] = params.strength;

  if (key) {
    const data = (await postJson(endpoint, key, body)) as { request_id: string };
    return { jobId: data.request_id, status: 'PENDING' };
  }
  return { jobId: simJobId(), status: 'PENDING' };
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return hash;
}

export async function pollJob(
  jobId: string,
  model: string,
  apiKey?: string,
  seed?: number,
): Promise<FalJobResult> {
  const key = apiKey ?? getEnvKey();
  const endpoint = getModelEndpoint(model);

  if (!key) {
    console.warn(`[fal] No API key available for polling job ${jobId}`);
    return {
      id: jobId,
      status: 'FAILED',
      image_url: null,
      error_message: 'No API key configured',
      cost_credits: 0,
    };
  }

  if (key) {
    // Use the status endpoint for queue-based polling
    const response = await fetch(`${endpoint}/requests/${jobId}/status`, {
      headers: {
        Authorization: `Key ${key}`,
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`fal.ai poll error (${response.status}): ${text}`);
    }
    const data = (await response.json()) as {
      status: string;
      output?: { images?: Array<{ url: string }> };
      error?: string;
    };
    if (data.status === 'COMPLETED') {
      return {
        id: jobId,
        status: 'SUCCESS',
        image_url: data.output?.images?.[0]?.url ?? null,
        error_message: null,
        cost_credits: 0.05,
      };
    }
    if (data.status === 'FAILED' || data.status === 'ERROR') {
      return {
        id: jobId,
        status: 'FAILED',
        image_url: null,
        error_message: data.error ?? 'Unknown fal.ai error',
        cost_credits: 0.05,
      };
    }
    // IN_PROGRESS, QUEUED, etc. — still pending
    return { id: jobId, status: 'PENDING', image_url: null, error_message: null, cost_credits: 0 };
  }

  const picsumSeed = seed ?? Math.abs(hashString(jobId)) % 100000;
  return {
    id: jobId,
    status: 'SUCCESS',
    image_url: `https://picsum.photos/seed/${picsumSeed}/400/500`,
    error_message: null,
    cost_credits: 0,
  };
}

export async function cancelJob(jobId: string, model: string, apiKey?: string): Promise<void> {
  const key = apiKey ?? getEnvKey();
  if (key) {
    const endpoint = getModelEndpoint(model);
    await fetch(`${endpoint}/requests/${jobId}/cancel`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${key}`,
        'Content-Type': 'application/json',
      },
    });
  }
}

export async function imageToText(
  imageUrl: string,
  prompt: string,
  apiKey?: string,
): Promise<string> {
  const key = apiKey ?? getEnvKey();
  if (key) {
    const data = (await postJson(`${FAL_API_BASE}/flux-pro/v1/image-to-text`, key, {
      image_url: imageUrl,
      prompt,
    })) as { output: string };
    return data.output;
  }
  return '';
}
