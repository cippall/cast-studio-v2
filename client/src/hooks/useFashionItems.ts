/**
 * API hooks for fashion items — list + detail queries.
 */
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { FashionItemListItem, PaginatedResponse, PaginationParams } from '@cast/types';

interface FashionItemFilters extends PaginationParams {
  gender?: string;
  itemType?: string;
  subType?: string;
  style?: string;
  color?: string;
  season?: string;
  sharedWithMe?: boolean;
  creatorId?: string;
}

function buildQueryString(filters: FashionItemFilters): string {
  const params = new URLSearchParams();
  if (filters.page) params.set('page', String(filters.page));
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
  if (filters.sortBy) params.set('sortBy', filters.sortBy);
  if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);
  if (filters.gender) params.set('gender', filters.gender);
  if (filters.itemType) params.set('item_type', filters.itemType);
  if (filters.subType) params.set('sub_type', filters.subType);
  if (filters.style) params.set('style', filters.style);
  if (filters.color) params.set('color', filters.color);
  if (filters.season) params.set('season', filters.season);
  if (filters.sharedWithMe) params.set('shared_with_me', 'true');
  if (filters.creatorId) params.set('creator_id', filters.creatorId);
  return params.toString();
}

export function useFashionItems(filters: FashionItemFilters = {}) {
  return useQuery<PaginatedResponse<FashionItemListItem>>({
    queryKey: ['fashion-items', filters],
    queryFn: async () => {
      const qs = buildQueryString(filters);
      const { data } = await apiClient.get(`/fashion-items?${qs}`);
      return data;
    },
  });
}

export function useFashionItem(id: string) {
  return useQuery({
    queryKey: ['fashion-items', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/fashion-items/${id}`);
      return data;
    },
    enabled: !!id,
  });
}
