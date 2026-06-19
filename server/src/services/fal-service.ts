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

/**
 * Get the fal.ai API key for a specific workspace.
 * Reads from the encrypted fal_ai_keys table.
 * Returns undefined if no key configured for this workspace.
 */
export async function getWorkspaceApiKey(workspaceId: string): Promise<string | undefined> {
  const { query } = await import('../db/pool.js');
  const result = await query(
    `SELECT encrypted_key, iv, auth_tag FROM fal_ai_keys
     WHERE workspace_id = $1 AND is_active = TRUE
     LIMIT 1`,
    [workspaceId],
  );

  if (result.rows.length === 0) {
    return undefined;
  }

  const { decrypt } = await import('../utils/encryption.js');
  try {
    return decrypt({
      encrypted: result.rows[0].encrypted_key,
      iv: result.rows[0].iv,
      authTag: result.rows[0].auth_tag,
    });
  } catch {
    return undefined;
  }
}

const FAL_API_BASE = 'https://queue.fal.run/fal-ai';

// --- Model Endpoint Mapping ---

function getModelEndpoint(model: string, _params: FalGenerateParams): string {
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

// --- Model Discovery ---

export interface FalModelSchema {
  title: string;
  type: string;
  description?: string;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  enum?: string[];
}

export interface FalModel {
  id: string;
  name: string;
  description: string;
  category: 'text_to_image' | 'image_to_image' | 'image_to_text';
  endpoint: string;
  inputSchema?: Record<string, FalModelSchema>;
  outputSchema?: Record<string, FalModelSchema>;
}

const FAL_REST_BASE = 'https://rest.fal.ai';

/**
 * Fetch available models from fal.ai REST API.
 * Returns models grouped by category.
 * The fal.ai REST endpoint /models returns all public models.
 * We categorize them by inspecting the endpoint path and input/output schema.
 */
export async function fetchFalModels(apiKey: string): Promise<FalModel[]> {
  // Fetch models from fal.ai REST API - filter by common generation categories
  const categories = ['text-to-image', 'image-to-image', 'image-to-text'];

  const allModels: FalModel[] = [];

  for (const category of categories) {
    try {
      const response = await fetch(`${FAL_REST_BASE}/models?category=${category}&limit=50`, {
        headers: {
          Authorization: `Key ${apiKey}`,
        },
      });

      if (!response.ok) {
        continue;
      }

      const data = (await response.json()) as {
        models?: Array<{
          id: string;
          name?: string;
          description?: string;
        }>;
      };

      if (data.models) {
        for (const m of data.models) {
          const modelId = m.id;
          const categoryMap: Record<string, FalModel['category']> = {
            'text-to-image': 'text_to_image',
            'image-to-image': 'image_to_image',
            'image-to-text': 'image_to_text',
          };

          // Fetch model schema for richer metadata
          let inputSchema: Record<string, FalModelSchema> | undefined;
          try {
            const schemaRes = await fetch(`${FAL_REST_BASE}/${modelId}/schema`, {
              headers: { Authorization: `Key ${apiKey}` },
            });
            if (schemaRes.ok) {
              const schemaData = (await schemaRes.json()) as {
                input?: { properties?: Record<string, FalModelSchema> };
              };
              inputSchema = schemaData.input?.properties;
            }
          } catch {
            // Schema fetch is best-effort
          }

          allModels.push({
            id: modelId,
            name: m.name ?? modelId.split('/').pop() ?? modelId,
            description: m.description ?? '',
            category: categoryMap[category] ?? 'text_to_image',
            endpoint: modelId,
            inputSchema,
          });
        }
      }
    } catch {
      // Category fetch is best-effort; continue with other categories
    }
  }

  // Deduplicate by id
  const seen = new Set<string>();
  return allModels.filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}
