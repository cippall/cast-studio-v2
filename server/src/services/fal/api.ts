import type { FalGenerateParams, FalJobResult } from './types.js';

const FAL_API_BASE = 'https://queue.fal.run/fal-ai';

function getApiKey(): string | undefined {
  return process.env.FAL_KEY;
}

function getModelEndpoint(model: string): string {
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
      return `${FAL_API_BASE}/flux-pro`;
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

export async function submitTextToImage(params: FalGenerateParams): Promise<{
  jobId: string;
  status: string;
}> {
  const apiKey = getApiKey();
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

  if (apiKey) {
    const data = (await postJson(endpoint, apiKey, body)) as { request_id: string };
    return { jobId: data.request_id, status: 'PENDING' };
  }
  return { jobId: simJobId(), status: 'PENDING' };
}

export async function submitImageToImage(params: FalGenerateParams): Promise<{
  jobId: string;
  status: string;
}> {
  const apiKey = getApiKey();
  const endpoint = getModelEndpoint(params.model);

  const body: Record<string, unknown> = {
    image_url: params.image_url,
    prompt: params.prompt,
    seed: params.seed,
    num_images: params.num_outputs ?? 1,
  };
  if (params.strength !== undefined) body['strength'] = params.strength;

  if (apiKey) {
    const data = (await postJson(endpoint, apiKey, body)) as { request_id: string };
    return { jobId: data.request_id, status: 'PENDING' };
  }
  return { jobId: simJobId(), status: 'PENDING' };
}

export async function pollJob(jobId: string, model: string): Promise<FalJobResult> {
  const apiKey = getApiKey();
  const endpoint = getModelEndpoint(model);

  if (apiKey) {
    const response = await fetch(`${endpoint}/requests/${jobId}`, {
      headers: {
        Authorization: `Key ${apiKey}`,
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
    return { id: jobId, status: 'PENDING', image_url: null, error_message: null, cost_credits: 0 };
  }

  return {
    id: jobId,
    status: 'SUCCESS',
    image_url: `https://fal.ai/sim/${jobId}.png`,
    error_message: null,
    cost_credits: 0.05,
  };
}

export async function cancelJob(jobId: string, model: string): Promise<void> {
  const apiKey = getApiKey();
  if (apiKey) {
    const endpoint = getModelEndpoint(model);
    await fetch(`${endpoint}/requests/${jobId}/cancel`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }
}

export async function imageToText(imageUrl: string, prompt: string): Promise<string> {
  const apiKey = getApiKey();
  if (apiKey) {
    const data = (await postJson(`${FAL_API_BASE}/flux-pro/v1/image-to-text`, apiKey, {
      image_url: imageUrl,
      prompt,
    })) as { output: string };
    return data.output;
  }
  return '';
}
