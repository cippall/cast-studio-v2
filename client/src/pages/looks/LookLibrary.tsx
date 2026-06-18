/**
 * Look Library — grid of look cards with filter panel and pagination.
 * Migrated to use LibraryLayout composite component.
 */
import { useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/useAuth';
import { useLooks } from '@/hooks/useLooks';
import LibraryLayout, { type SortOption, type ViewMode } from '@/components/layout/LibraryLayout';
import PageContainer from '@/components/layout/PageContainer';
import AssetCardV2 from '@/components/AssetCardV2';
import type { FilterGroup } from '@/components/FilterPanel';
import { Checkbox } from '@/components/ui/checkbox';

const LOOK_FILTER_GROUPS: FilterGroup[] = [
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
    key: 'style',
    label: 'Style',
    options: [
      { label: 'Casual', value: 'casual' },
      { label: 'Formal', value: 'formal' },
      { label: 'Streetwear', value: 'streetwear' },
      { label: 'Bohemian', value: 'bohemian' },
      { label: 'Minimalist', value: 'minimalist' },
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
    key: 'occasion',
    label: 'Occasion',
    options: [
      { label: 'Everyday', value: 'everyday' },
      { label: 'Work', value: 'work' },
      { label: 'Evening', value: 'evening' },
      { label: 'Outdoor', value: 'outdoor' },
      { label: 'Athletic', value: 'athletic' },
    ],
  },
];

const PAGE_SIZE = 20;

interface LookItem {
  id: string;
  name: string;
  image_url: string | null;
  taxonomy_values?: Record<string, string>;
  created_at: string;
}

function extractTags(look: LookItem): string[] {
  const tv = look.taxonomy_values;
  if (!tv) return [];
  return Object.values(tv).filter(Boolean).slice(0, 4);
}

export default function LookLibrary() {
  const { data: user } = useCurrentUser();
  const isClient = user?.role === 'CLIENT';

  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page') ?? 1);
  const [sort, setSort] = useState<SortOption>((searchParams.get('sort') as SortOption) || 'date');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showFilters, setShowFilters] = useState(true);

  const [filters, setFilters] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {};
    LOOK_FILTER_GROUPS.forEach((group) => {
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

  const { data, isLoading, isError, error } = useLooks(
    queryFilters as Parameters<typeof useLooks>[0],
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
    <PageContainer>
      <LibraryLayout
        title="Looks"
        description="looks"
        filterGroups={LOOK_FILTER_GROUPS}
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
        newItemPath="/looks/new"
        newItemLabel="+ New Look"
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
        renderCard={(look) => (
          <AssetCardV2
            key={look.id}
            id={look.id}
            name={look.name}
            type="look"
            imageUrl={look.image_url}
            tags={extractTags(look)}
            createdAt={look.created_at}
          />
        )}
        emptyTitle="No looks yet"
        emptyDescription="Create your first look to get started."
        emptyActionLabel="New Look"
        emptyActionPath="/looks/new"
      />
    </PageContainer>
  );
}
