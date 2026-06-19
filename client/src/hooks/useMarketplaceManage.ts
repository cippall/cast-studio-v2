import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { PaginatedResponse, PaginationParams } from '@cast/types';
import type { MarketplaceListing } from './useMarketplaceBrowse';

interface ManageFilters extends PaginationParams {
  isActive?: boolean;
  listingType?: string;
}

function buildManageQuery(filters: ManageFilters): string {
  const params = new URLSearchParams();
  if (filters.page) params.set('page', String(filters.page));
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
  if (filters.isActive !== undefined) params.set('is_active', String(filters.isActive));
  if (filters.listingType) params.set('listing_type', filters.listingType);
  return params.toString();
}

export function useMarketplaceManage(filters: ManageFilters = {}) {
  return useQuery<PaginatedResponse<MarketplaceListing>>({
    queryKey: ['marketplace', 'manage', filters],
    queryFn: async () => {
      const qs = buildManageQuery(filters);
      const { data } = await apiClient.get(`/marketplace/manage?${qs}`);
      return data;
    },
  });
}

export function useCreateListing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { assetId: string; listingType: string; priceCredits: number }) => {
      const { data } = await apiClient.post('/marketplace/manage', {
        asset_id: input.assetId,
        listing_type: input.listingType,
        price_credits: input.priceCredits,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace', 'manage'] });
    },
  });
}

export function useUpdateListing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; priceCredits?: number; isActive?: boolean }) => {
      const { data } = await apiClient.patch(`/marketplace/manage/${input.id}`, {
        price_credits: input.priceCredits,
        is_active: input.isActive,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace', 'manage'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace'] });
    },
  });
}

export function useDeleteListing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/marketplace/manage/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace', 'manage'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace'] });
    },
  });
}

export function useSubmitToMarketplace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (assetId: string) => {
      const { data } = await apiClient.post('/marketplace/submit', { asset_id: assetId });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actors'] });
      queryClient.invalidateQueries({ queryKey: ['looks'] });
      queryClient.invalidateQueries({ queryKey: ['fashion-items'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
