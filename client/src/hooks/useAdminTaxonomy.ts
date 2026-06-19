/**
 * Admin taxonomy hooks — CRUD for taxonomy entries.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

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
