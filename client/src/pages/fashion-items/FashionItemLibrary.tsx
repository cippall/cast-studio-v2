/**
 * Fashion Item Library — grid of fashion item cards with filter panel and pagination.
 * Migrated to use LibraryLayout composite component.
 */
import { useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/useAuth';
import { useFashionItems } from '@/hooks/useFashionItems';
import LibraryLayout, { type SortOption, type ViewMode } from '@/components/layout/LibraryLayout';
import AssetCardV2 from '@/components/AssetCardV2';
import type { FilterGroup } from '@/components/FilterPanel';
import { Checkbox } from '@/components/ui/checkbox';

const FASHION_FILTER_GROUPS: FilterGroup[] = [
  {
    key: 'gender',
    label: 'Gender',
    options: [
      { label: 'Women', value: 'women' },
      { label: 'Men', value: 'men' },
      { label: 'Girls', value: 'girls' },
      { label: 'Boys', value: 'boys' },
      { label: 'Unisex', value: 'unisex' },
    ],
  },
  {
    key: 'itemType',
    label: 'Item Type',
    options: [
      { label: 'Clothing', value: 'clothing' },
      { label: 'Shoes', value: 'shoes' },
      { label: 'Accessories', value: 'accessories' },
    ],
  },
  {
    key: 'subType',
    label: 'Sub-type',
    options: [
      { label: 'Jackets', value: 'jackets' },
      { label: 'Shirts', value: 'shirts' },
      { label: 'Pants', value: 'pants' },
      { label: 'Dresses', value: 'dresses' },
      { label: 'Sneakers', value: 'sneakers' },
      { label: 'Boots', value: 'boots' },
      { label: 'Bags', value: 'bags' },
      { label: 'Jewelry', value: 'jewelry' },
    ],
  },
  {
    key: 'style',
    label: 'Style',
    options: [
      { label: 'Casual', value: 'casual' },
      { label: 'Formal', value: 'formal' },
      { label: 'Streetwear', value: 'streetwear' },
      { label: 'Vintage', value: 'vintage' },
      { label: 'Minimalist', value: 'minimalist' },
    ],
  },
  {
    key: 'color',
    label: 'Color',
    options: [
      { label: 'Black', value: 'black' },
      { label: 'White', value: 'white' },
      { label: 'Red', value: 'red' },
      { label: 'Blue', value: 'blue' },
      { label: 'Green', value: 'green' },
      { label: 'Neutral', value: 'neutral' },
    ],
  },
  {
    key: 'season',
    label: 'Season',
    options: [
      { label: 'Spring', value: 'spring' },
      { label: 'Summer', value: 'summer' },
      { label: 'Fall', value: 'fall' },
      { label: 'Winter', value: 'winter' },
    ],
  },
];

const PAGE_SIZE = 20;

interface FashionItemEntry {
  id: string;
  name: string;
  image_url: string | null;
  taxonomy_values?: Record<string, string>;
  created_at: string;
}

function extractTags(item: FashionItemEntry): string[] {
  const tv = item.taxonomy_values;
  if (!tv) return [];
  return Object.values(tv).filter(Boolean).slice(0, 4);
}

export default function FashionItemLibrary() {
  const { data: user } = useCurrentUser();
  const isClient = user?.role === 'CLIENT';

  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page') ?? 1);
  const [sort, setSort] = useState<SortOption>((searchParams.get('sort') as SortOption) || 'date');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showFilters, setShowFilters] = useState(true);

  const [filters, setFilters] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {};
    FASHION_FILTER_GROUPS.forEach((group) => {
      const vals = searchParams.getAll(group.key);
      if (vals.length > 0) initial[group.key] = vals;
    });
    return initial;
  });
  const [sharedWithMe, setSharedWithMe] = useState(searchParams.get('shared') === 'true');

  const queryFilters = useMemo(() => {
    const result: Record<string, string | boolean | number> = {
      page,
      pageSize: PAGE_SIZE,
    };
    Object.entries(filters).forEach(([key, vals]) => {
      if (vals.length === 1) result[key] = vals[0];
    });
    if (sharedWithMe) result.sharedWithMe = true;
    return result;
  }, [filters, page, sharedWithMe]);

  const { data, isLoading, isError, error } = useFashionItems(
    queryFilters as Parameters<typeof useFashionItems>[0],
  );

  const totalPages = data?.totalPages ?? 1;

  const handleFilterChange = useCallback(
    (key: string, values: string[]) => {
      setFilters((prev) => {
        const next = { ...prev };
        if (values.length === 0) {
          delete next[key];
        } else {
          next[key] = values;
        }
        return next;
      });
      setSearchParams((prev) => {
        prev.delete('page');
        return prev;
      });
    },
    [setSearchParams],
  );

  const handleResetFilters = useCallback(() => {
    setFilters({});
    setSharedWithMe(false);
    setSearchParams(new URLSearchParams());
  }, [setSearchParams]);

  const handlePageChange = useCallback(
    (p: number) => {
      setSearchParams((prev) => {
        prev.set('page', String(p));
        return prev;
      });
    },
    [setSearchParams],
  );

  const handleSortChange = useCallback(
    (value: SortOption) => {
      setSort(value);
      setSearchParams((prev) => {
        prev.set('sort', value);
        prev.delete('page');
        return prev;
      });
    },
    [setSearchParams],
  );

  const handleSharedWithMe = useCallback(
    (value: boolean) => {
      setSharedWithMe(value);
      setSearchParams((prev) => {
        if (value) {
          prev.set('shared', 'true');
        } else {
          prev.delete('shared');
        }
        prev.delete('page');
        return prev;
      });
    },
    [setSearchParams],
  );

  return (
    <LibraryLayout
      title="Fashion Items"
      description="items"
      filterGroups={FASHION_FILTER_GROUPS}
      selectedFilters={filters}
      onFilterChange={handleFilterChange}
      onResetFilters={handleResetFilters}
      items={data?.data ?? []}
      total={data?.total}
      page={page}
      totalPages={totalPages}
      onPageChange={handlePageChange}
      isLoading={isLoading}
      isError={isError}
      error={error}
      newItemPath="/fashion-items/new"
      newItemLabel="+ New Item"
      sort={sort}
      onSortChange={handleSortChange}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      showFilters={showFilters}
      onToggleFilters={() => setShowFilters((v) => !v)}
      extraActions={
        isClient ? (
          <div className="flex items-center gap-2">
            <Checkbox
              id="shared-with-me"
              checked={sharedWithMe}
              onCheckedChange={(checked) => handleSharedWithMe(checked === true)}
            />
            <label htmlFor="shared-with-me" className="cursor-pointer text-sm">
              Shared with Me
            </label>
          </div>
        ) : undefined
      }
      renderCard={(item) => (
        <AssetCardV2
          key={item.id}
          id={item.id}
          name={item.name}
          type="fashion-item"
          imageUrl={item.image_url}
          tags={extractTags(item)}
          createdAt={item.created_at}
        />
      )}
      emptyTitle="No fashion items yet"
      emptyDescription="Create your first fashion item to get started."
      emptyActionLabel="New Item"
      emptyActionPath="/fashion-items/new"
    />
  );
}
