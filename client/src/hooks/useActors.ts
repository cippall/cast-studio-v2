/**
 * API hooks for actors — list + detail queries.
 */
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { ActorListItem, PaginatedResponse, PaginationParams } from '@cast/types';

interface ActorFilters extends PaginationParams {
  gender?: string;
  age?: string;
  vibe?: string;
  style?: string;
  sharedWithMe?: boolean;
  creatorId?: string;
}

function buildQueryString(filters: ActorFilters): string {
  const params = new URLSearchParams();
  if (filters.page) params.set('page', String(filters.page));
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
  if (filters.sortBy) params.set('sortBy', filters.sortBy);
  if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);
  if (filters.gender) params.set('gender', filters.gender);
  if (filters.age) params.set('age', filters.age);
  if (filters.vibe) params.set('vibe', filters.vibe);
  if (filters.style) params.set('style', filters.style);
  if (filters.sharedWithMe) params.set('shared_with_me', 'true');
  if (filters.creatorId) params.set('creator_id', filters.creatorId);
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
