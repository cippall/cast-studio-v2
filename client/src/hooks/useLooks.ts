/**
 * API hooks for looks — list + detail queries.
 */
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { LookListItem, PaginatedResponse, PaginationParams } from '@cast/types';

interface LookFilters extends PaginationParams {
  gender?: string;
  style?: string;
  season?: string;
  color?: string;
  occasion?: string;
  sharedWithMe?: boolean;
  creatorId?: string;
}

function buildQueryString(filters: LookFilters): string {
  const params = new URLSearchParams();
  if (filters.page) params.set('page', String(filters.page));
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
  if (filters.sortBy) params.set('sortBy', filters.sortBy);
  if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);
  if (filters.gender) params.set('gender', filters.gender);
  if (filters.style) params.set('style', filters.style);
  if (filters.season) params.set('season', filters.season);
  if (filters.color) params.set('color', filters.color);
  if (filters.occasion) params.set('occasion', filters.occasion);
  if (filters.sharedWithMe) params.set('shared_with_me', 'true');
  if (filters.creatorId) params.set('creator_id', filters.creatorId);
  return params.toString();
}

export function useLooks(filters: LookFilters = {}) {
  return useQuery<PaginatedResponse<LookListItem>>({
    queryKey: ['looks', filters],
    queryFn: async () => {
      const qs = buildQueryString(filters);
      const { data } = await apiClient.get(`/looks?${qs}`);
      return data;
    },
  });
}

export function useLook(id: string) {
  return useQuery({
    queryKey: ['looks', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/looks/${id}`);
      return data;
    },
    enabled: !!id,
  });
}
