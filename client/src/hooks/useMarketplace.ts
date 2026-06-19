/**
 * API hooks for marketplace — browse, detail, purchase, manage, submit.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { PaginatedResponse, PaginationParams } from '@cast/types';

/* -- Types -- */

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

export interface MarketplaceSubmission {
  asset_id: string;
  asset_name: string;
  asset_type: string;
  creator_name?: string;
  marketplace_status: string;
  submitted_at: string;
  outputs?: Record<string, { status: string; image_url: string | null }>;
}

export interface MarketplaceSettings {
  actor_package: {
    required_outputs: string[];
    generic_standard_look_id: string | null;
    editorial_count: number;
  };
  look_package: {
    required_outputs: string[];
  };
  fashion_item_package: {
    required_outputs: string[];
  };
}

interface MarketplaceFilters extends PaginationParams {
  listingType?: string;
  maxPrice?: number;
  creatorId?: string;
}

interface ManageFilters extends PaginationParams {
  isActive?: boolean;
  listingType?: string;
}

/* -- Browse (Client) -- */

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

/* -- Artist Management -- */

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

/* -- Artist Submission -- */

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

/* -- Admin Review -- */

export function useAdminSubmissions(filters: PaginationParams & { status?: string } = {}) {
  return useQuery<PaginatedResponse<MarketplaceSubmission>>({
    queryKey: ['admin', 'submissions', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.page) params.set('page', String(filters.page));
      if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
      if (filters.status) params.set('status', filters.status);
      const { data } = await apiClient.get(`/admin/marketplace/submissions?${params}`);
      return data;
    },
  });
}

export function useApproveSubmission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { assetId: string; priceCredits: number }) => {
      const { data } = await apiClient.post(
        `/admin/marketplace/submissions/${input.assetId}/approve`,
        { price_credits: input.priceCredits },
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'submissions'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useRejectSubmission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (assetId: string) => {
      const { data } = await apiClient.post(`/admin/marketplace/submissions/${assetId}/reject`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'submissions'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

/* -- Admin Settings -- */

export function useMarketplaceSettings() {
  return useQuery<MarketplaceSettings>({
    queryKey: ['admin', 'marketplace', 'settings'],
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/marketplace/settings');
      return data;
    },
  });
}

export function useUpdateMarketplaceSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: MarketplaceSettings) => {
      const { data } = await apiClient.put('/admin/marketplace/settings', settings);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'marketplace', 'settings'] });
    },
  });
}
