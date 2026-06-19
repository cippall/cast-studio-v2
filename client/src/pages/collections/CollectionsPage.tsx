/**
 * Collections browse page — grid of collection cards with search and pagination.
 * Each card shows name, item count, and a folder icon.
 */
import { useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Folder, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import EmptyStateV2 from '@/components/EmptyStateV2';
import CreateCollectionDialog from '@/components/collections/CreateCollectionDialog';
import { useCollections, useCreateCollection } from '@/hooks/useCollections';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { CollectionWithItemCount } from '@cast/types';

const PAGE_SIZE = 12;

export default function CollectionsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page') ?? 1);
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, isLoading, isError, error } = useCollections({
    page,
    pageSize: PAGE_SIZE,
    search: search || undefined,
  });

  const createCollection = useCreateCollection();

  const totalPages = data?.pagination.totalPages ?? 1;
  const collections = data?.data ?? [];

  const handleSearch = useCallback(
    (value: string) => {
      setSearch(value);
      setSearchParams((prev) => {
        if (value) {
          prev.set('search', value);
        } else {
          prev.delete('search');
        }
        prev.delete('page');
        return prev;
      });
    },
    [setSearchParams],
  );

  const handlePageChange = useCallback(
    (p: number) => {
      setSearchParams((prev) => {
        prev.set('page', String(p));
        return prev;
      });
    },
    [setSearchParams],
  );

  const handleCreate = useCallback(() => {
    setDialogOpen(true);
  }, []);

  const handleDialogSubmit = useCallback(
    (name: string) => {
      createCollection.mutate(name, {
        onSuccess: (collection) => {
          setDialogOpen(false);
          navigate(`/collections/${collection.id}`);
        },
        onError: () => {
          setDialogOpen(false);
        },
      });
    },
    [createCollection, navigate],
  );

  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Collections</h1>
            <p className="text-sm text-muted-foreground">
              {data?.pagination.totalItems ?? 0} collection
              {(data?.pagination.totalItems ?? 0) !== 1 ? 's' : ''}
            </p>
          </div>
          <Button size="sm" onClick={handleCreate}>
            <Folder className="mr-2 size-4" />
            New Collection
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search collections by name..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Content */}
        {isLoading ? (
          <LoadingState variant="grid" />
        ) : isError ? (
          <ErrorState message={error instanceof Error ? error.message : undefined} />
        ) : collections.length === 0 ? (
          <EmptyStateV2
            icon={<Folder className="size-8 text-muted-foreground" />}
            title={search ? 'No collections found' : 'No collections yet'}
            description={
              search
                ? 'Try a different search term.'
                : 'Create your first collection to organize your assets.'
            }
            actionLabel={search ? undefined : 'New Collection'}
            actionPath={search ? undefined : '/collections/new'}
          />
        ) : (
          <>
            {/* Collection grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {collections.map((collection) => (
                <CollectionCard
                  key={collection.id}
                  collection={collection}
                  onClick={() => navigate(`/collections/${collection.id}`)}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1 sm:gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => handlePageChange(page - 1)}
                >
                  <ChevronLeft className="size-4" />
                  <span className="hidden sm:inline ml-1">Prev</span>
                </Button>
                <span className="text-sm text-muted-foreground px-2">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => handlePageChange(page + 1)}
                >
                  <span className="hidden sm:inline mr-1">Next</span>
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <CreateCollectionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleDialogSubmit}
        isCreating={createCollection.isPending}
      />
    </PageContainer>
  );
}

interface CollectionCardProps {
  collection: CollectionWithItemCount;
  onClick: () => void;
}

function CollectionCard({ collection, onClick }: CollectionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col gap-3 border border-border bg-background p-4 text-left transition-colors hover:border-[var(--color-border-medium)] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
    >
      <div className="flex size-10 items-center justify-center bg-surface">
        <Folder className="size-5 text-primary" />
      </div>
      <div className="flex flex-col gap-1">
        <span className="truncate text-sm font-medium text-foreground">{collection.name}</span>
        <span className="text-xs text-muted-foreground">
          {collection.item_count} item{collection.item_count !== 1 ? 's' : ''}
        </span>
      </div>
    </button>
  );
}
