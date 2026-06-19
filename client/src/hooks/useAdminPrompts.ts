/**
 * Admin system prompts hooks — CRUD for prompt templates.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

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
