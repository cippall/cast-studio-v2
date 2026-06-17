/**
 * Fashion Item Library — grid of fashion item cards with filter panel and pagination.
 */
import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/useAuth';
import { useFashionItems } from '@/hooks/useFashionItems';
import AssetCard from '@/components/AssetCard';
import AssetCardSkeleton from '@/components/AssetCardSkeleton';
import FilterPanel from '@/components/FilterPanel';
import type { FilterGroup } from '@/components/FilterPanel';
import EmptyState from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';

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

function extractTags(item: { taxonomy_values?: Record<string, string> }): string[] {
  const tv = item.taxonomy_values;
  if (!tv) return [];
  return Object.values(tv).filter(Boolean).slice(0, 4);
}

export default function FashionItemLibrary() {
  const { data: user } = useCurrentUser();
  const isClient = user?.role === 'CLIENT';

  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page') ?? 1);

  const [filters, setFilters] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {};
    FASHION_FILTER_GROUPS.forEach((group) => {
      const vals = searchParams.getAll(group.key);
      if (vals.length > 0) initial[group.key] = vals;
    });
    return initial;
  });
  const [sharedWithMe, setSharedWithMe] = useState(searchParams.get('shared') === 'true');
  const [showFilters, setShowFilters] = useState(true);

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

  const handleFilterChange = (key: string, values: string[]) => {
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
  };

  const handleResetFilters = () => {
    setFilters({});
    setSharedWithMe(false);
    setSearchParams(new URLSearchParams());
  };

  const handleSharedWithMe = (value: boolean) => {
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
  };

  const goToPage = (p: number) => {
    setSearchParams((prev) => {
      prev.set('page', String(p));
      return prev;
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fashion Items</h1>
          <p className="text-sm text-muted-foreground">
            {data ? `${data.total} items` : 'Browse your fashion item library'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowFilters((v) => !v)}>
            <SlidersHorizontal className="mr-2 size-4" />
            Filters
          </Button>
          <Button size="sm" onClick={() => (window.location.href = '/fashion-items/new')}>
            + New Item
          </Button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Filter panel */}
        {showFilters && (
          <aside className="hidden w-56 shrink-0 lg:block">
            <FilterPanel
              groups={FASHION_FILTER_GROUPS}
              selected={filters}
              onChange={handleFilterChange}
              onReset={handleResetFilters}
              sharedWithMe={sharedWithMe}
              onSharedWithMeChange={isClient ? handleSharedWithMe : undefined}
            />
          </aside>
        )}

        {/* Main content */}
        <div className="flex-1">
          {isLoading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <AssetCardSkeleton key={i} />
              ))}
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm text-muted-foreground">
                {error instanceof Error ? error.message : 'Failed to load fashion items'}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => window.location.reload()}
              >
                Retry
              </Button>
            </div>
          ) : data && data.data.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                {data.data.map((item) => (
                  <AssetCard
                    key={item.id}
                    id={item.id}
                    name={item.name}
                    type="fashion-item"
                    imageUrl={item.image_url}
                    tags={extractTags(item)}
                    createdAt={item.created_at}
                  />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => goToPage(page - 1)}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => goToPage(page + 1)}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              )}
            </>
          ) : (
            <EmptyState
              title="No fashion items yet"
              description="Create your first fashion item to get started."
              actionLabel="New Item"
              actionPath="/fashion-items/new"
            />
          )}
        </div>
      </div>
    </div>
  );
}
