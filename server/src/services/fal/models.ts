import type { FalModel, FalModelSchema } from './types.js';

const FAL_REST_BASE = 'https://rest.fal.ai';

export async function fetchFalModels(apiKey: string): Promise<FalModel[]> {
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

  const seen = new Set<string>();
  return allModels.filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}
