// --- Types ---

export interface FalGenerateParams {
  model: string;
  prompt: string;
  seed: number;
  num_outputs?: number;
  image_size?: string;
  guidance_scale?: number;
  num_inference_steps?: number;
  /** For image-to-image: input image URL */
  image_url?: string;
  /** For image-to-image: strength of the original image */
  strength?: number;
}

export interface FalJobResult {
  id: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  image_url: string | null;
  error_message: string | null;
  cost_credits: number;
}

// --- Configuration ---

function getApiKey(): string | undefined {
  return process.env.FAL_KEY;
}

const FAL_API_BASE = 'https://queue.fal.run/fal-ai';

// --- Model Endpoint Mapping ---

function getModelEndpoint(model: string, params: FalGenerateParams): string {
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
      // Default to flux-pro
      return `${FAL_API_BASE}/flux-pro`;
  }
}

// --- API Functions ---

/**
 * Submit a text-to-image generation job to fal.ai.
 * Returns the job ID and initial status.
 */
export async function submitTextToImage(params: FalGenerateParams): Promise<{
  jobId: string;
  status: string;
}> {
  const apiKey = getApiKey();
  const endpoint = getModelEndpoint(params.model, params);

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
    const response = await fetch(endpoint, {
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

    const data = (await response.json()) as { request_id: string };
    return { jobId: data.request_id, status: 'PENDING' };
  }

  // No API key configured — return a simulated job ID for development/testing
  return {
    jobId: `sim_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    status: 'PENDING',
  };
}

/**
 * Submit an image-to-image generation job to fal.ai.
 */
export async function submitImageToImage(params: FalGenerateParams): Promise<{
  jobId: string;
  status: string;
}> {
  const apiKey = getApiKey();
  const endpoint = getModelEndpoint(params.model, params);

  const body: Record<string, unknown> = {
    image_url: params.image_url,
    prompt: params.prompt,
    seed: params.seed,
    num_images: params.num_outputs ?? 1,
  };

  if (params.strength !== undefined) body['strength'] = params.strength;

  if (apiKey) {
    const response = await fetch(endpoint, {
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

    const data = (await response.json()) as { request_id: string };
    return { jobId: data.request_id, status: 'PENDING' };
  }

  return {
    jobId: `sim_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    status: 'PENDING',
  };
}

/**
 * Poll a fal.ai job for its status and result.
 */
export async function pollJob(jobId: string, model: string): Promise<FalJobResult> {
  const apiKey = getApiKey();
  const endpoint = getModelEndpoint(model, { model, prompt: '', seed: 0 });

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
      const images = data.output?.images;
      return {
        id: jobId,
        status: 'SUCCESS',
        image_url: images?.[0]?.url ?? null,
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

    // Still pending
    return {
      id: jobId,
      status: 'PENDING',
      image_url: null,
      error_message: null,
      cost_credits: 0,
    };
  }

  // No API key — simulate completion for development/testing
  return {
    id: jobId,
    status: 'SUCCESS',
    image_url: `https://fal.ai/sim/${jobId}.png`,
    error_message: null,
    cost_credits: 0.05,
  };
}

/**
 * Cancel a fal.ai job.
 */
export async function cancelJob(jobId: string, model: string): Promise<void> {
  const apiKey = getApiKey();
  const endpoint = getModelEndpoint(model, { model, prompt: '', seed: 0 });

  if (apiKey) {
    await fetch(`${endpoint}/requests/${jobId}/cancel`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }
}

/**
 * Extract structured data from an image using fal.ai vision model.
 */
export async function imageToText(imageUrl: string, prompt: string): Promise<string> {
  const apiKey = getApiKey();
  const endpoint = `${FAL_API_BASE}/flux-pro/v1/image-to-text`;

  if (apiKey) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_url: imageUrl,
        prompt,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`fal.ai image-to-text error (${response.status}): ${text}`);
    }

    const data = (await response.json()) as { output: string };
    return data.output;
  }

  return '';
}
