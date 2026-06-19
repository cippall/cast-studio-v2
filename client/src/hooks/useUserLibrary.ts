/**
 * Hook to fetch all user's library assets (actors, looks, fashion items)
 * for the Add Assets dialog in collections.
 */
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type {
  ActorListItem,
  LookListItem,
  FashionItemListItem,
  PaginatedResponse,
} from '@cast/types';

export interface LibraryAsset {
  id: string;
  name: string;
  asset_type: 'ACTOR' | 'LOOK' | 'FASHION_ITEM';
  image_url: string | null;
  headshot_url: string | null;
}

export function useUserLibrary() {
  return useQuery<LibraryAsset[]>({
    queryKey: ['user-library'],
    queryFn: async () => {
      const [actorsRes, looksRes, itemsRes] = await Promise.all([
        apiClient.get<PaginatedResponse<ActorListItem>>('/actors?pageSize=100'),
        apiClient.get<PaginatedResponse<LookListItem>>('/looks?pageSize=100'),
        apiClient.get<PaginatedResponse<FashionItemListItem>>('/fashion-items?pageSize=100'),
      ]);

      const actors: LibraryAsset[] = (actorsRes.data.data ?? []).map((a) => ({
        id: a.id,
        name: a.name,
        asset_type: 'ACTOR' as const,
        image_url: null,
        headshot_url: a.headshot_url,
      }));

      const looks: LibraryAsset[] = (looksRes.data.data ?? []).map((l) => ({
        id: l.id,
        name: l.name,
        asset_type: 'LOOK' as const,
        image_url: l.image_url,
        headshot_url: null,
      }));

      const items: LibraryAsset[] = (itemsRes.data.data ?? []).map((f) => ({
        id: f.id,
        name: f.name,
        asset_type: 'FASHION_ITEM' as const,
        image_url: f.image_url,
        headshot_url: null,
      }));

      return [...actors, ...looks, ...items];
    },
  });
}
