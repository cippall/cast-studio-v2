import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { PaginatedResponse, PaginationParams } from '@cast/types';
import type { MarketplaceSettings } from './useMarketplaceBrowse';

export interface MarketplaceSubmission {
  asset_id: string;
  asset_name: string;
  asset_type: string;
  creator_name?: string;
  marketplace_status: string;
  submitted_at: string;
  outputs?: Record<string, { status: string; image_url: string | null }>;
}

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
