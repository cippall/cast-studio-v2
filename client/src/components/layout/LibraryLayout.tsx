/**
 * LibraryLayout — composite layout for all library pages.
 * Grid/list toggle, filter sidebar (desktop) / Sheet drawer (mobile),
 * sort dropdown, pagination, and empty state.
 *
 * The page component owns data fetching and filter state;
 * this component owns layout, view mode, and presentation.
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
import { SlidersHorizontal, LayoutGrid, List, ChevronLeft, ChevronRight } from 'lucide-react';
import FilterPanel, { type FilterGroup } from '@/components/FilterPanel';
import EmptyStateV2 from '@/components/EmptyStateV2';
import ErrorState from '@/components/ErrorState';
import LoadingState from '@/components/LoadingState';

export type ViewMode = 'grid' | 'list';
export type SortOption = 'date' | 'name' | 'status';

export interface LibraryLayoutProps {
  title: string;
  description?: string;
  filterGroups: FilterGroup[];
  /** Currently selected filters (key → selected values) */
  selectedFilters: Record<string, string[]>;
  onFilterChange: (key: string, values: string[]) => void;
  onResetFilters: () => void;
  /** Flattened data items to render */
  items: readonly any[];
  /** Total count for display */
  total?: number;
  /** Current page (1-indexed) */
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  /** Path for the "New" button */
  newItemPath?: string;
  newItemLabel?: string;
  /** Sort value + handler */
  sort: SortOption;
  onSortChange: (sort: SortOption) => void;
  /** View mode */
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  /** Optional element in the header (e.g. shared-with-me toggle) */
  extraActions?: ReactNode;
  /** Render a card for grid view */
  renderCard: (item: any, index: number) => ReactNode;
  /** Render a row for list view (falls back to renderCard if omitted) */
  renderListRow?: (item: any, index: number) => ReactNode;
  /** Empty state */
  emptyTitle: string;
  emptyDescription: string;
  emptyActionLabel?: string;
  emptyActionPath?: string;
  /** Whether to show the filter sidebar (can be toggled off) */
  showFilters?: boolean;
  onToggleFilters?: () => void;
}

export default function LibraryLayout({
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
}: LibraryLayoutProps) {
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const activeFilterCount = Object.values(selectedFilters).reduce(
    (sum, vals) => sum + vals.length,
    0,
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
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

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Mobile filter button */}
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

        {/* Sort */}
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

        {/* View toggle */}
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

      {/* Main content area */}
      <div className="flex gap-6">
        {/* Desktop filter sidebar */}
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

        {/* Content */}
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

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-center gap-1 sm:gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => onPageChange(page - 1)}
                  >
                    <ChevronLeft className="size-4" />
                    <span className="hidden sm:inline ml-1">Prev</span>
                  </Button>
                  <span className="hidden sm:inline-flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <Button
                        key={p}
                        variant={p === page ? 'default' : 'outline'}
                        size="sm"
                        className="hidden lg:inline-flex w-8"
                        onClick={() => onPageChange(p)}
                      >
                        {p}
                      </Button>
                    ))}
                  </span>
                  <span className="text-sm text-muted-foreground px-2">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => onPageChange(page + 1)}
                  >
                    <span className="hidden sm:inline mr-1">Next</span>
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
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

      {/* Mobile filter Sheet */}
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
