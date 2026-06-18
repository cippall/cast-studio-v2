/**
 * Actor Library — grid of actor cards with filter panel and pagination.
 */
import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/useAuth';
import { useActors } from '@/hooks/useActors';
import AssetCardV2 from '@/components/AssetCardV2';
import AssetCardSkeleton from '@/components/AssetCardSkeleton';
import FilterPanel from '@/components/FilterPanel';
import type { FilterGroup } from '@/components/FilterPanel';
import EmptyState from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';

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

function extractTags(actor: { taxonomy_values?: Record<string, string> }): string[] {
  const tv = actor.taxonomy_values;
  if (!tv) return [];
  return Object.values(tv).filter(Boolean).slice(0, 4);
}

export default function ActorLibrary() {
  const { data: user } = useCurrentUser();
  const isClient = user?.role === 'CLIENT';

  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page') ?? 1);

  const [filters, setFilters] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {};
    ACTOR_FILTER_GROUPS.forEach((group) => {
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

  const { data, isLoading, isError, error } = useActors(
    queryFilters as Parameters<typeof useActors>[0],
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
          <h1 className="text-2xl font-bold tracking-tight">Actors</h1>
          <p className="text-sm text-muted-foreground">
            {data ? `${data.total} actors` : 'Browse your actor library'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowFilters((v) => !v)}>
            <SlidersHorizontal className="mr-2 size-4" />
            Filters
          </Button>
          <Button size="sm" onClick={() => (window.location.href = '/actors/new')}>
            + New Actor
          </Button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Filter panel */}
        {showFilters && (
          <aside className="hidden w-56 shrink-0 lg:block">
            <FilterPanel
              groups={ACTOR_FILTER_GROUPS}
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
                {error instanceof Error ? error.message : 'Failed to load actors'}
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
                {data.data.map((actor) => (
                  <AssetCardV2
                    key={actor.id}
                    id={actor.id}
                    name={actor.name}
                    type="actor"
                    imageUrl={actor.headshot_url}
                    tags={extractTags(actor)}
                    createdAt={actor.created_at}
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
              title="No actors yet"
              description="Create your first actor to get started."
              actionLabel="New Actor"
              actionPath="/actors/new"
            />
          )}
        </div>
      </div>
    </div>
  );
}
