/**
 * LibraryLayout — composite layout for all library pages.
 */
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import FilterPanel, { type FilterGroup } from '@/components/FilterPanel';
import EmptyStateV2 from '@/components/EmptyStateV2';
import type { EmptyStateVariant } from '@/components/EmptyStateV2';
import ErrorState from '@/components/ErrorState';
import LoadingState from '@/components/LoadingState';
import LibraryPagination from './LibraryPagination';
import LibraryToolbar from './LibraryToolbar';
import MobileFilterSheet from './MobileFilterSheet';

export type ViewMode = 'grid' | 'list';
export type SortOption = 'date' | 'name' | 'status';

export interface LibraryLayoutProps<T> {
  title: string;
  description?: string;
  filterGroups: FilterGroup[];
  selectedFilters: Record<string, string[]>;
  onFilterChange: (key: string, values: string[]) => void;
  onResetFilters: () => void;
  items: readonly T[];
  total?: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  newItemPath?: string;
  newItemLabel?: string;
  sort: SortOption;
  onSortChange: (sort: SortOption) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  extraActions?: ReactNode;
  renderCard: (item: T, index: number) => ReactNode;
  renderListRow?: (item: T, index: number) => ReactNode;
  emptyTitle: string;
  emptyDescription: string;
  emptyActionLabel?: string;
  emptyActionPath?: string;
  emptyVariant?: EmptyStateVariant;
  showFilters?: boolean;
  onToggleFilters?: () => void;
}

export default function LibraryLayout<T>({
  title,
  description,
  filterGroups,
  selectedFilters,
  onFilterChange,
  onResetFilters,
  items,
  total,
  page,
  totalPages,
  onPageChange,
  isLoading,
  isError,
  error,
  newItemPath,
  newItemLabel,
  sort,
  onSortChange,
  viewMode,
  onViewModeChange,
  extraActions,
  renderCard,
  renderListRow,
  emptyTitle,
  emptyDescription,
  emptyActionLabel,
  emptyActionPath,
  emptyVariant,
  showFilters = true,
  onToggleFilters,
}: LibraryLayoutProps<T>) {
  const navigate = useNavigate();
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const activeFilterCount = Object.values(selectedFilters).reduce(
    (sum, vals) => sum + vals.length,
    0,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground">
              {total !== undefined ? `${total} ${description}` : description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {extraActions}
          {newItemPath && (
            <Button size="sm" onClick={() => navigate(newItemPath)}>
              {newItemLabel ?? '+ New'}
            </Button>
          )}
        </div>
      </div>

      <LibraryToolbar
        sort={sort}
        onSortChange={onSortChange}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        activeFilterCount={activeFilterCount}
        onMobileFilterOpen={() => setShowMobileFilters(true)}
      />

      <div className="flex gap-6">
        {showFilters && (
          <aside className="hidden w-56 shrink-0 lg:block">
            <FilterPanel
              groups={filterGroups}
              selected={selectedFilters}
              onChange={onFilterChange}
              onReset={onResetFilters}
            />
          </aside>
        )}
        <div className="flex-1">
          {isLoading ? (
            <LoadingState variant={viewMode === 'grid' ? 'grid' : 'list'} />
          ) : isError ? (
            <ErrorState message={error instanceof Error ? error.message : undefined} />
          ) : items.length > 0 ? (
            <>
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
                  {items.map((item, i) => renderCard(item, i))}
                </div>
              ) : (
                <div className="flex flex-col divide-y border">
                  {items.map((item, i) =>
                    renderListRow ? renderListRow(item, i) : renderCard(item, i),
                  )}
                </div>
              )}
              {totalPages > 1 && (
                <LibraryPagination
                  page={page}
                  totalPages={totalPages}
                  onPageChange={onPageChange}
                />
              )}
            </>
          ) : (
            <EmptyStateV2
              title={emptyTitle}
              description={emptyDescription}
              actionLabel={emptyActionLabel}
              actionPath={emptyActionPath}
              variant={emptyVariant}
            />
          )}
        </div>
      </div>

      <MobileFilterSheet
        open={showMobileFilters}
        onOpenChange={setShowMobileFilters}
        filterGroups={filterGroups}
        selected={selectedFilters}
        onChange={onFilterChange}
        onReset={onResetFilters}
        activeFilterCount={activeFilterCount}
      />
    </div>
  );
}
