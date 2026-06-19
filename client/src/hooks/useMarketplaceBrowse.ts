import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { PaginatedResponse, PaginationParams } from '@cast/types';

export interface MarketplaceListing {
  id: string;
  listing_type: string;
  asset_id: string;
  asset: {
    id: string;
    name: string;
    headshot_url: string | null;
    fullshot_url: string | null;
    image_url: string | null;
  };
  seller_id: string;
  seller_name: string;
  price_credits: number;
  is_active: boolean;
  created_at: string;
}

export interface MarketplaceDetail {
  id: string;
  listing_type: string;
  asset: {
    id: string;
    name: string;
    headshot_url: string | null;
    fullshot_url: string | null;
    expression_sheet_url: string | null;
    character_sheet_url: string | null;
    editorial_urls: string[];
    image_url: string | null;
  };
  seller: { id: string; name: string };
  price_credits: number;
  is_active: boolean;
  created_at: string;
}

export interface MarketplaceSettings {
  actor_package: {
    required_outputs: string[];
    generic_standard_look_id: string | null;
    editorial_count: number;
  };
  look_package: { required_outputs: string[] };
  fashion_item_package: { required_outputs: string[] };
}

interface MarketplaceFilters extends PaginationParams {
  listingType?: string;
  maxPrice?: number;
  creatorId?: string;
}

function buildMarketplaceQuery(filters: MarketplaceFilters): string {
  const params = new URLSearchParams();
  if (filters.page) params.set('page', String(filters.page));
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
  if (filters.sortBy) params.set('sortBy', filters.sortBy);
  if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);
  if (filters.listingType) params.set('listing_type', filters.listingType);
  if (filters.maxPrice) params.set('max_price', String(filters.maxPrice));
  if (filters.creatorId) params.set('creator_id', filters.creatorId);
  return params.toString();
}

export function useMarketplace(filters: MarketplaceFilters = {}, options?: { enabled?: boolean }) {
  return useQuery<PaginatedResponse<MarketplaceListing>>({
    queryKey: ['marketplace', filters],
    queryFn: async () => {
      const qs = buildMarketplaceQuery(filters);
      const { data } = await apiClient.get(`/marketplace?${qs}`);
      return data;
    },
    enabled: options?.enabled ?? true,
  });
}

export function useMarketplaceDetail(id: string) {
  return useQuery<MarketplaceDetail>({
    queryKey: ['marketplace', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/marketplace/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function usePurchaseListing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (listingId: string) => {
      const { data } = await apiClient.post(`/marketplace/${listingId}/purchase`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['actors'] });
      queryClient.invalidateQueries({ queryKey: ['looks'] });
    },
  });
}
