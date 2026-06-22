/**
 * API hooks for actors — list + detail queries.
 */
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { ActorListItem, PaginatedResponse, PaginationParams } from '@cast/types';

interface ActorFilters extends PaginationParams {
  gender?: string | string[];
  age?: string | string[];
  vibe?: string | string[];
  style?: string | string[];
  sharedWithMe?: boolean;
  creatorId?: string;
  [key: string]: string | string[] | boolean | number | undefined;
}

function appendParam(params: URLSearchParams, key: string, value: string) {
  params.append(key, value);
}

function buildQueryString(filters: ActorFilters): string {
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

export function useActors(filters: ActorFilters = {}) {
  return useQuery<PaginatedResponse<ActorListItem>>({
    queryKey: ['actors', filters],
    queryFn: async () => {
      const qs = buildQueryString(filters);
      const { data } = await apiClient.get(`/actors?${qs}`);
      return data;
    },
  });
}

export function useActor(id: string) {
  return useQuery({
    queryKey: ['actors', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/actors/${id}`);
      return data;
    },
    enabled: !!id,
  });
}
