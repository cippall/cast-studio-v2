/**
 * API hook for the activity feed — recent user activity (created, generated, shared).
 */
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { ActivityFeedItem } from '@cast/types';

export function useActivityFeed(limit = 10) {
  return useQuery<ActivityFeedItem[]>({
    queryKey: ['activity', limit],
    queryFn: async () => {
      const { data } = await apiClient.get('/activity', { params: { limit } });
      return data;
    },
  });
}
