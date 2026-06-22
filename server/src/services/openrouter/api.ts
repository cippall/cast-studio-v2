import type { OpenRouterRequest, OpenRouterResult } from './types.js';

const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1';

function getEnvKey(): string | undefined {
  return process.env.OPENROUTER_API_KEY;
}

async function postJson(url: string, apiKey: string, body: unknown): Promise<unknown> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenRouter API error (${response.status}): ${text}`);
  }
  return response.json();
}

export async function submitOpenRouterRequest(
  request: OpenRouterRequest,
  apiKey?: string,
): Promise<OpenRouterResult> {
  const key = apiKey ?? getEnvKey();
  const url = `${OPENROUTER_API_BASE}/chat/completions`;

  const body: Record<string, unknown> = {
    model: request.model,
    messages: request.messages,
  };
  if (request.max_tokens !== undefined) body['max_tokens'] = request.max_tokens;
  if (request.temperature !== undefined) body['temperature'] = request.temperature;
  if (request.top_p !== undefined) body['top_p'] = request.top_p;
  if (request.frequency_penalty !== undefined)
    body['frequency_penalty'] = request.frequency_penalty;
  if (request.presence_penalty !== undefined) body['presence_penalty'] = request.presence_penalty;
  if (request.stop !== undefined) body['stop'] = request.stop;
  if (request.stream !== undefined) body['stream'] = request.stream;

  if (!key) {
    return {
      id: `sim_${Date.now()}`,
      model: request.model,
      content: '',
      finish_reason: 'error',
      usage: null,
    };
  }

  const data = (await postJson(url, key, body)) as {
    id: string;
    model: string;
    choices: Array<{
      message: { content: string };
      finish_reason: string | null;
    }>;
    usage: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    } | null;
  };

  const choice = data.choices[0];
  return {
    id: data.id,
    model: data.model,
    content: choice?.message?.content ?? '',
    finish_reason: choice?.finish_reason ?? null,
    usage: data.usage,
  };
}
