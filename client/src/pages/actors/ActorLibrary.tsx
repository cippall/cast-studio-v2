/**
 * Actor Library — grid of actor cards with filter panel and pagination.
 * Migrated to use LibraryLayout composite component.
 * Clients see two sections: "My Assets" and "Similar in Marketplace".
 */
import { useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/useAuth';
import { useActors } from '@/hooks/useActors';
import { useMarketplaceStatuses } from '@/hooks/useMarketplaceStatuses';
import { useMarketplace } from '@/hooks/useMarketplace';
import type { MarketplaceListing } from '@/hooks/useMarketplace';
import LibraryLayout, { type SortOption, type ViewMode } from '@/components/layout/LibraryLayout';
import PageContainer from '@/components/layout/PageContainer';
import AssetCardV2 from '@/components/AssetCardV2';
import type { ActorListItem } from '@cast/types';
import type { FilterGroup } from '@/components/FilterPanel';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import EmptyStateV2 from '@/components/EmptyStateV2';

const ACTOR_FILTER_GROUPS: FilterGroup[] = [
  {
    key: 'gender',
    label: 'Gender',
    options: [
      { label: 'Female', value: 'female' },
      { label: 'Male', value: 'male' },
      { label: 'Non-binary', value: 'non_binary' },
    ],
  },
  {
    key: 'age',
    label: 'Age',
    options: [
      { label: 'Young', value: 'young' },
      { label: 'Middle', value: 'middle' },
      { label: 'Mature', value: 'mature' },
    ],
  },
  {
    key: 'vibe',
    label: 'Vibe',
    options: [
      { label: 'Cyberpunk', value: 'cyberpunk' },
      { label: 'Fantasy', value: 'fantasy' },
      { label: 'Realistic', value: 'realistic' },
      { label: 'Stylized', value: 'stylized' },
    ],
  },
  {
    key: 'style',
    label: 'Style',
    options: [
      { label: 'Casual', value: 'casual' },
      { label: 'Formal', value: 'formal' },
      { label: 'Editorial', value: 'editorial' },
      { label: 'Streetwear', value: 'streetwear' },
    ],
  },
];

const PAGE_SIZE = 20;

interface ActorItem {
  id: string;
  name: string;
  headshot_url: string | null;
  taxonomy_values?: Record<string, string>;
  created_at: string;
}

function extractTags(actor: ActorItem): string[] {
  const tv = actor.taxonomy_values;
  if (!tv) return [];
  return Object.values(tv).filter(Boolean).slice(0, 4);
}

function marketplaceActorTags(listing: MarketplaceListing): string[] {
  const asset = listing.asset;
  const tags: string[] = [];
  if (asset.headshot_url) tags.push('Headshot');
  if (asset.fullshot_url) tags.push('Fullshot');
  return tags.slice(0, 4);
}

export default function ActorLibrary() {
  const { data: user } = useCurrentUser();
  const isClient = user?.role === 'CLIENT';

  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page') ?? 1);
  const [sort, setSort] = useState<SortOption>((searchParams.get('sort') as SortOption) || 'date');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showFilters, setShowFilters] = useState(true);

  const [filters, setFilters] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {};
    ACTOR_FILTER_GROUPS.forEach((group) => {
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

  const { data, isLoading, isError, error } = useActors(
    queryFilters as Parameters<typeof useActors>[0],
  );
  const { data: marketplaceStatuses } = useMarketplaceStatuses();

  const { data: marketplaceData } = useMarketplace(
    { listingType: 'ACTOR_PACKAGE', pageSize: 20 },
    { enabled: isClient },
  );

  const totalPages = data?.totalPages ?? 1;

  const ownedActorIds = useMemo(() => {
    if (!data?.data) return new Set<string>();
    return new Set(data.data.map((a) => a.id));
  }, [data?.data]);

  const marketplaceListings = useMemo(() => {
    if (!marketplaceData?.data || !isClient) return [];
    return marketplaceData.data.filter(
      (listing) => listing.is_active && !ownedActorIds.has(listing.asset_id),
    );
  }, [marketplaceData?.data, isClient, ownedActorIds]);

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
      <LibraryLayout<ActorListItem>
        title="Actors"
        description="actors"
        filterGroups={ACTOR_FILTER_GROUPS}
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
        newItemPath="/actors/new"
        newItemLabel="+ New Actor"
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
        renderCard={(actor) => (
          <AssetCardV2
            key={actor.id}
            id={actor.id}
            name={actor.name}
            type="actor"
            imageUrl={actor.headshot_url}
            tags={extractTags(actor)}
            createdAt={actor.created_at}
            marketplaceStatus={marketplaceStatuses?.[actor.id] ?? null}
          />
        )}
        emptyTitle="No actors yet"
        emptyDescription="Create your first actor to get started."
        emptyActionLabel="New Actor"
        emptyActionPath="/actors/new"
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
                  type="actor"
                  imageUrl={listing.asset.headshot_url}
                  tags={marketplaceActorTags(listing)}
                  createdAt={listing.created_at}
                  marketplaceStatus={null}
                />
              ))}
            </div>
          ) : (
            <EmptyStateV2
              title="No marketplace listings"
              description="No actors are currently available in the marketplace."
            />
          )}
        </div>
      )}
    </PageContainer>
  );
}
