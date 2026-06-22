/**
 * Hook to fetch taxonomy entries and transform into FilterGroup[] for library filters.
 * Fetches from /admin/taxonomy?category=X — one call per category.
 */
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { FilterGroup } from '@/components/FilterPanel';

interface TaxonomyEntry {
  id: string;
  category: string;
  key: string;
  label: string;
  input_type: string;
  options?: Array<{ value: string; label: string }>;
  is_required: boolean;
  sort_order: number;
  is_active: boolean;
}

/**
 * Maps taxonomy category codes to the API category parameter.
 * These match the database seed values used in server/src/db/seed.ts.
 */
export const TAXONOMY_CATEGORIES = {
  ACTOR: 'ACTOR_PROPERTY',
  LOOK: 'LOOK_TAXONOMY',
  FASHION_ITEM: 'FASHION_ITEM_TAXONOMY',
} as const;

export type TaxonomyCategory = (typeof TAXONOMY_CATEGORIES)[keyof typeof TAXONOMY_CATEGORIES];

/**
 * Fetch taxonomy entries for a category and transform into FilterGroup[].
 * Each taxonomy entry's `key` becomes a filter group label, and its `options`
 * become the filter options.
 */
export function useTaxonomyFilters(category: TaxonomyCategory) {
  return useQuery<FilterGroup[]>({
    queryKey: ['taxonomy', category],
    queryFn: async () => {
      const { data } = await apiClient.get<TaxonomyEntry[]>(
        `/admin/taxonomy?category=${encodeURIComponent(category)}`,
      );
      return data
        .filter((entry) => entry.is_active && entry.options && entry.options.length > 0)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((entry) => ({
          key: entry.key,
          label: entry.label,
          options: entry.options!,
        }));
    },
    staleTime: 5 * 60 * 1000, // 5 minutes — taxonomy doesn't change often
  });
}
