/**
 * Look Library — grid of look cards with filter panel and pagination.
 * Migrated to use LibraryLayout composite component.
 * Clients see two sections: "My Assets" and "Similar in Marketplace".
 */
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/useAuth';
import { useLooks } from '@/hooks/useLooks';
import { useMarketplaceStatuses } from '@/hooks/useMarketplaceStatuses';
import { useMarketplace } from '@/hooks/useMarketplace';
import type { MarketplaceListing } from '@/hooks/useMarketplace';
import LibraryLayout, { type SortOption, type ViewMode } from '@/components/layout/LibraryLayout';
import PageContainer from '@/components/layout/PageContainer';
import AssetCardV2 from '@/components/AssetCardV2';
import type { LookListItem } from '@cast/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import EmptyStateV2 from '@/components/EmptyStateV2';
import { useTaxonomyFilters, TAXONOMY_CATEGORIES } from '@/hooks/useTaxonomyFilters';
import type { FilterGroup } from '@/components/FilterPanel';

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

  const { data: dynamicFilterGroups = [] } = useTaxonomyFilters(TAXONOMY_CATEGORIES.LOOK);

  const filtersInitialized = useRef(false);
  const [filters, setFilters] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (filtersInitialized.current || dynamicFilterGroups.length === 0) return;
    const initial: Record<string, string[]> = {};
    dynamicFilterGroups.forEach((group) => {
      const vals = searchParams.getAll(group.key);
      if (vals.length > 0) initial[group.key] = vals;
    });
    filtersInitialized.current = true;
    setFilters(initial);
  }, [dynamicFilterGroups, searchParams]);
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
  const { data: marketplaceStatuses } = useMarketplaceStatuses();

  const { data: marketplaceData } = useMarketplace(
    { listingType: 'LOOK', pageSize: 20 },
    { enabled: isClient },
  );

  const totalPages = data?.totalPages ?? 1;

  const ownedLookIds = useMemo(() => {
    if (!data?.data) return new Set<string>();
    return new Set(data.data.map((l) => l.id));
  }, [data?.data]);

  const marketplaceListings = useMemo(() => {
    if (!marketplaceData?.data || !isClient) return [];
    return marketplaceData.data.filter(
      (listing) => listing.is_active && !ownedLookIds.has(listing.asset_id),
    );
  }, [marketplaceData?.data, isClient, ownedLookIds]);

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
      <LibraryLayout<LookListItem>
        title="Looks"
        description="looks"
        filterGroups={dynamicFilterGroups}
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
            marketplaceStatus={marketplaceStatuses?.[look.id] ?? null}
          />
        )}
        emptyTitle="No looks yet"
        emptyDescription="Create your first look to get started."
        emptyActionLabel="New Look"
        emptyActionPath="/looks/new"
        emptyVariant="no-assets"
      />

      {isClient && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold text-foreground">Similar in Marketplace</h2>
          <Separator className="my-3" />
          {marketplaceListings.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {marketplaceListings.map((listing) => (
                <AssetCardV2
                  key={`mp-${listing.id}`}
                  id={listing.asset_id}
                  name={listing.asset.name}
                  type="look"
                  imageUrl={listing.asset.image_url}
                  tags={[]}
                  createdAt={listing.created_at}
                  marketplaceStatus={null}
                />
              ))}
            </div>
          ) : (
            <EmptyStateV2
              title="No marketplace listings"
              description="No looks are currently available in the marketplace."
            />
          )}
        </div>
      )}
    </PageContainer>
  );
}
