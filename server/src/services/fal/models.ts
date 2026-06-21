import type { FalModel, FalModelSchema } from './types.js';

const FAL_API_BASE = 'https://api.fal.ai/v1';

export async function fetchFalModels(apiKey: string): Promise<FalModel[]> {
  const categories = ['text-to-image', 'image-to-image', 'image-to-text'];
  const allModels: FalModel[] = [];

  for (const category of categories) {
    try {
      const response = await fetch(`${FAL_API_BASE}/models?category=${category}&limit=50`, {
        headers: {
          Authorization: `Key ${apiKey}`,
        },
      });

      if (!response.ok) {
        continue;
      }

      const data = (await response.json()) as {
        models?: Array<{
          endpoint_id: string;
          metadata?: {
            display_name?: string;
            category?: string;
            description?: string;
          };
        }>;
      };

      if (data.models) {
        for (const m of data.models) {
          const modelId = m.endpoint_id;
          const meta = m.metadata ?? {};
          const categoryMap: Record<string, FalModel['category']> = {
            'text-to-image': 'text_to_image',
            'image-to-image': 'image_to_image',
            'image-to-text': 'image_to_text',
          };

          allModels.push({
            id: modelId,
            name: meta.display_name ?? modelId.split('/').pop() ?? modelId,
            description: meta.description ?? '',
            category: categoryMap[meta.category ?? category] ?? 'text_to_image',
            endpoint: modelId,
            // Schema endpoint no longer available on api.fal.ai
          });
        }
      }
    } catch {
      // Category fetch is best-effort; continue with other categories
    }
  }

  const seen = new Set<string>();
  return allModels.filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}
