/**
 * LibraryLayout — composite layout for all library pages.
 */
import { useState, type ReactNode } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SlidersHorizontal, LayoutGrid, List } from 'lucide-react';
import FilterPanel, { type FilterGroup } from '@/components/FilterPanel';
import EmptyStateV2 from '@/components/EmptyStateV2';
import ErrorState from '@/components/ErrorState';
import LoadingState from '@/components/LoadingState';
import LibraryPagination from './LibraryPagination';

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
  showFilters = true,
  onToggleFilters,
}: LibraryLayoutProps<T>) {
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
            <Button size="sm" onClick={() => (window.location.href = newItemPath)}>
              {newItemLabel ?? '+ New'}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="lg:hidden"
          onClick={() => setShowMobileFilters(true)}
        >
          <SlidersHorizontal className="mr-2 size-4" />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-1.5 flex size-5 items-center justify-center bg-primary text-[10px] text-primary-foreground">
              {activeFilterCount}
            </span>
          )}
        </Button>
        <div className="flex-1" />
        <Select value={sort} onValueChange={(v) => onSortChange(v as SortOption)}>
          <SelectTrigger className="w-36" size="sm">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Date</SelectItem>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="status">Status</SelectItem>
          </SelectContent>
        </Select>
        <div className="inline-flex border">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="sm"
            className="rounded-none border-0"
            onClick={() => onViewModeChange('grid')}
            aria-label="Grid view"
          >
            <LayoutGrid className="size-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            className="rounded-none border-0"
            onClick={() => onViewModeChange('list')}
            aria-label="List view"
          >
            <List className="size-4" />
          </Button>
        </div>
      </div>

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
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
            />
          )}
        </div>
      </div>

      <Sheet open={showMobileFilters} onOpenChange={setShowMobileFilters}>
        <SheetContent side="left" className="w-72 pt-12">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
            <SheetDescription>
              {activeFilterCount > 0
                ? `${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''} active`
                : 'Refine your results'}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            <FilterPanel
              groups={filterGroups}
              selected={selectedFilters}
              onChange={onFilterChange}
              onReset={onResetFilters}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
