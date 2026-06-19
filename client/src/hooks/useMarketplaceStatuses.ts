/**
 * Hook to fetch marketplace status for all assets visible in library views.
 * Returns a Map-like record: { [assetId]: marketplace_status }
 * Queries the artist submissions endpoint which returns all assets with marketplace status.
 */
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export type MarketplaceStatusValue =
  | 'MARKETPLACE_PENDING'
  | 'MARKETPLACE_APPROVED'
  | 'MARKETPLACE_REJECTED'
  | 'MARKETPLACE_DELISTED';

interface MarketplaceSubmissionRow {
  asset_id: string;
  marketplace_status: string;
}

export function useMarketplaceStatuses() {
  return useQuery<Record<string, MarketplaceStatusValue>>({
    queryKey: ['marketplace', 'statuses'],
    queryFn: async () => {
      const { data } = await apiClient.get<{
        data: MarketplaceSubmissionRow[];
      }>('/marketplace/submissions');
      const map: Record<string, MarketplaceStatusValue> = {};
      for (const row of data.data) {
        map[row.asset_id] = row.marketplace_status as MarketplaceStatusValue;
      }
      return map;
    },
    staleTime: 30_000, // 30 seconds - marketplace status can change
  });
}
