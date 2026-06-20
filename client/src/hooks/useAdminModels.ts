/**
 * Admin models hooks — CRUD for configured models + model schema.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export interface ModelConfig {
  id: string;
  model_id: string;
  name: string;
  model_type: string;
  task: string;
  parameters: Record<string, unknown>;
  input_schema: Record<string, unknown> | null;
  is_active: boolean;
}

export function useAdminModels() {
  return useQuery<ModelConfig[]>({
    queryKey: ['admin', 'models'],
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/models');
      return data;
    },
  });
}

export function useCreateModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Omit<ModelConfig, 'id'>) => {
      const { data } = await apiClient.post('/admin/models', input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'models'] });
    },
  });
}

export function useUpdateModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Partial<ModelConfig> & { id: string }) => {
      const { data } = await apiClient.patch(`/admin/models/${input.id}`, input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'models'] });
    },
  });
}

export function useDeleteModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/admin/models/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'models'] });
    },
  });
}

export interface ModelParameterSchema {
  input: Record<string, FalModelSchemaField>;
  output: Record<string, FalModelSchemaField>;
}

export interface FalModelSchemaField {
  title: string;
  type: string;
  description?: string;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  enum?: string[];
}

export function useModelSchema(modelId: string | null) {
  return useQuery<ModelParameterSchema>({
    queryKey: ['admin', 'model-schema', modelId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/admin/models/${modelId}/schema`);
      return data;
    },
    enabled: !!modelId,
  });
}

export function useSaveModelParameters() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; parameters: Record<string, unknown> }) => {
      const { data } = await apiClient.patch(`/admin/models/${input.id}`, {
        parameters: input.parameters,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'models'] });
    },
  });
}

export function useAssignModelTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; task: string }) => {
      const { data } = await apiClient.patch(`/admin/models/${input.id}`, {
        task: input.task,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'models'] });
    },
  });
}

/**
 * Read model schema from local DB first (models.input_schema),
 * falling back to fal.ai API if no local schema is stored.
 *
 * The local schema is stored when a model is imported from fal.ai
 * or when an admin saves it via the model configuration UI.
 * If input_schema is null/empty, we fall back to the fal.ai REST API
 * endpoint (/admin/models/:id/schema) which requires an API key.
 */
export function useLocalModelSchema(model: ModelConfig | null) {
  const localSchema = model?.input_schema;
  const hasLocalSchema =
    localSchema != null && typeof localSchema === 'object' && Object.keys(localSchema).length > 0;

  // If we have a local schema, use it directly (no API call needed).
  // Otherwise fall back to the fal.ai API endpoint.
  const fallback = useModelSchema(hasLocalSchema ? null : (model?.id ?? null));

  if (hasLocalSchema) {
    return {
      data: { input: localSchema as Record<string, unknown>, output: {} } as ModelParameterSchema,
      isLoading: false,
      isError: false,
    };
  }

  return fallback;
}
