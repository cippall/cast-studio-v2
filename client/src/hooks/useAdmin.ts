/**
 * API hooks for admin — users, models, prompts, taxonomy, commission forms.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { PaginatedResponse, PaginationParams } from '@cast/types';

/* -- Users -- */

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  workspace_id: string;
  is_api_able: boolean;
  is_active: boolean;
  created_at: string;
}

export function useAdminUsers(
  filters: PaginationParams & { role?: string; workspaceId?: string } = {},
) {
  return useQuery<PaginatedResponse<AdminUser>>({
    queryKey: ['admin', 'users', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.page) params.set('page', String(filters.page));
      if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
      if (filters.role) params.set('role', filters.role);
      if (filters.workspaceId) params.set('workspace_id', filters.workspaceId);
      const { data } = await apiClient.get(`/accounts?${params}`);
      return data;
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      name?: string;
      isApiAble?: boolean;
      role?: string | null;
    }) => {
      const { data } = await apiClient.patch(`/accounts/${input.id}`, {
        name: input.name,
        is_api_able: input.isApiAble,
        role: input.role,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

/* -- Models -- */

export interface ModelConfig {
  id: string;
  model_id: string;
  name: string;
  model_type: string;
  task: string;
  parameters: Record<string, unknown>;
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

/* -- System Prompts -- */

export interface SystemPrompt {
  id: string;
  task: string;
  template: string;
  updated_at?: string;
}

export function useAdminPrompts() {
  return useQuery<SystemPrompt[]>({
    queryKey: ['admin', 'prompts'],
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/prompts');
      return data;
    },
  });
}

export function useCreatePrompt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Omit<SystemPrompt, 'id'>) => {
      const { data } = await apiClient.post('/admin/prompts', input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'prompts'] });
    },
  });
}

export function useUpdatePrompt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Partial<SystemPrompt> & { id: string }) => {
      const { data } = await apiClient.patch(`/admin/prompts/${input.id}`, input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'prompts'] });
    },
  });
}

export function useDeletePrompt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/admin/prompts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'prompts'] });
    },
  });
}

/* -- Taxonomy -- */

export interface TaxonomyEntry {
  id: string;
  category: string;
  key: string;
  label: string;
  input_type: string;
  options?: Array<{ value: string; label: string }>;
  is_required: boolean;
  sort_order: number;
  is_active: boolean;
}

export function useAdminTaxonomy(category?: string) {
  return useQuery<TaxonomyEntry[]>({
    queryKey: ['admin', 'taxonomy', category],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      const { data } = await apiClient.get(`/admin/taxonomy?${params}`);
      return data;
    },
  });
}

export function useCreateTaxonomyEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Omit<TaxonomyEntry, 'id'>) => {
      const { data } = await apiClient.post('/admin/taxonomy', input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'taxonomy'] });
      queryClient.invalidateQueries({ queryKey: ['taxonomy'] });
    },
  });
}

export function useUpdateTaxonomyEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Partial<TaxonomyEntry> & { id: string }) => {
      const { data } = await apiClient.patch(`/admin/taxonomy/${input.id}`, input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'taxonomy'] });
      queryClient.invalidateQueries({ queryKey: ['taxonomy'] });
    },
  });
}

export function useDeleteTaxonomyEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/admin/taxonomy/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'taxonomy'] });
      queryClient.invalidateQueries({ queryKey: ['taxonomy'] });
    },
  });
}

/* -- Commission Forms -- */

export interface CommissionFormTemplate {
  id: string;
  name: string;
  fields: Array<{
    key: string;
    label: string;
    input_type: string;
    is_required: boolean;
    options?: Array<{ value: string; label: string }>;
  }>;
  is_active: boolean;
}

export function useAdminCommissionForms() {
  return useQuery<CommissionFormTemplate[]>({
    queryKey: ['admin', 'commission-forms'],
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/commission-forms');
      return data;
    },
  });
}

export function useCreateCommissionForm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Omit<CommissionFormTemplate, 'id'>) => {
      const { data } = await apiClient.post('/admin/commission-forms', input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'commission-forms'] });
    },
  });
}

export function useUpdateCommissionForm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Partial<CommissionFormTemplate> & { id: string }) => {
      const { data } = await apiClient.patch(`/admin/commission-forms/${input.id}`, input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'commission-forms'] });
    },
  });
}

export function useDeleteCommissionForm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/admin/commission-forms/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'commission-forms'] });
    },
  });
}

/* -- fal.ai API Key -- */

export interface FalKeyStatus {
  connected: boolean;
  created_at?: string;
  updated_at?: string;
}

export function useFalKeyStatus() {
  return useQuery<FalKeyStatus>({
    queryKey: ['admin', 'fal-key', 'status'],
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/fal-key/status');
      return data.data;
    },
  });
}

export function useSaveFalKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (apiKey: string) => {
      const { data } = await apiClient.post('/admin/fal-key', { api_key: apiKey });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'fal-key'] });
    },
  });
}

export function useTestFalKey() {
  return useMutation({
    mutationFn: async (apiKey: string) => {
      const { data } = await apiClient.post('/admin/fal-key/test', { api_key: apiKey });
      return data.data;
    },
  });
}

export function useDisconnectFalKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.delete('/admin/fal-key');
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'fal-key'] });
    },
  });
}

/* -- fal.ai Model Browser -- */

export interface FalModel {
  id: string;
  name: string;
  description: string;
  category: 'text_to_image' | 'image_to_image' | 'image_to_text';
  endpoint: string;
  inputSchema?: Record<string, { title: string; type: string; description?: string }>;
}

export function useFalModels() {
  return useQuery<FalModel[]>({
    queryKey: ['admin', 'fal-models'],
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/fal-models');
      return data;
    },
  });
}

export function useImportFalModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      fal_model_id: string;
      name: string;
      description: string;
      category: string;
      parameters?: Record<string, unknown>;
    }) => {
      const { data } = await apiClient.post('/admin/models/import', input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'models'] });
    },
  });
}

/* -- Model Parameter Schema -- */

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
