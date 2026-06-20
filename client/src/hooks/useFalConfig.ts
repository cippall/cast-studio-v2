/**
 * fal.ai config hooks — API key management, model browser, model import.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

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
      description?: string;
      category: string;
      input_schema?: Record<string, unknown>;
      default_parameters?: Record<string, unknown>;
    }) => {
      const { data } = await apiClient.post('/admin/models/import', input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'models'] });
    },
  });
}
