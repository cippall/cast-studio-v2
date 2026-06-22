/**
 * API hooks for fashion items — list + detail queries.
 */
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { FashionItemListItem, PaginatedResponse, PaginationParams } from '@cast/types';

interface FashionItemFilters extends PaginationParams {
  gender?: string | string[];
  itemType?: string | string[];
  subType?: string | string[];
  style?: string | string[];
  color?: string | string[];
  season?: string | string[];
  sharedWithMe?: boolean;
  creatorId?: string;
  [key: string]: string | string[] | boolean | number | undefined;
}

function appendParam(params: URLSearchParams, key: string, value: string) {
  params.append(key, value);
}

function buildQueryString(filters: FashionItemFilters): string {
  const params = new URLSearchParams();
  if (filters.page) params.set('page', String(filters.page));
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
  if (filters.sortBy) params.set('sortBy', filters.sortBy);
  if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);
  if (filters.sharedWithMe) params.set('shared_with_me', 'true');
  if (filters.creatorId) params.set('creator_id', filters.creatorId);

  // Handle all filter keys: known taxonomy fields + dynamic ones
  const handledKeys = new Set([
    'page',
    'pageSize',
    'sortBy',
    'sortOrder',
    'shared_with_me',
    'creator_id',
  ]);
  for (const [key, value] of Object.entries(filters)) {
    if (handledKeys.has(key) || value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const v of value) {
        if (v) appendParam(params, key, v);
      }
    } else if (value !== '') {
      params.set(key, String(value));
    }
  }
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
