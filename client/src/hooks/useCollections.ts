/**
 * API hooks for collections — list, create, delete.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { Collection, CollectionListResult } from '@cast/types';

interface CollectionListParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

export function useCollections(params: CollectionListParams = {}) {
  return useQuery<CollectionListResult>({
    queryKey: ['collections', params],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (params.page) qs.set('page', String(params.page));
      if (params.pageSize) qs.set('pageSize', String(params.pageSize));
      if (params.search) qs.set('search', params.search);
      const { data } = await apiClient.get(`/collections?${qs.toString()}`);
      return data;
    },
  });
}

export function useCreateCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data } = await apiClient.post<Collection>('/collections', { name });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });
}

export function useDeleteCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/collections/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });
}
