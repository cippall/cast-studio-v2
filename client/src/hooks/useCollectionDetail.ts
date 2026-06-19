/**
 * API hooks for collection detail — get collection, items, update, remove items.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { Collection, CollectionItemWithAsset } from '@cast/types';

export function useCollectionDetail(collectionId: string) {
  return useQuery<Collection>({
    queryKey: ['collections', collectionId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/collections/${collectionId}`);
      return data;
    },
    enabled: !!collectionId,
  });
}

export function useCollectionItems(collectionId: string) {
  return useQuery<CollectionItemWithAsset[]>({
    queryKey: ['collections', collectionId, 'items'],
    queryFn: async () => {
      const { data } = await apiClient.get(`/collections/${collectionId}/items`);
      return data;
    },
    enabled: !!collectionId,
  });
}

export function useUpdateCollection(collectionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data } = await apiClient.put<Collection>(`/collections/${collectionId}`, { name });
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['collections', collectionId], data);
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });
}

export function useRemoveCollectionItem(collectionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      await apiClient.delete(`/collections/${collectionId}/items/${itemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections', collectionId, 'items'] });
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });
}

export function useAddCollectionItem(collectionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ assetType, assetId }: { assetType: string; assetId: string }) => {
      const { data } = await apiClient.post(`/collections/${collectionId}/items`, {
        asset_type: assetType,
        asset_id: assetId,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections', collectionId, 'items'] });
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
