import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SlidersHorizontal, LayoutGrid, List } from 'lucide-react';
import type { ViewMode, SortOption } from '@/components/layout/LibraryLayout';

interface LibraryToolbarProps {
  sort: SortOption;
  onSortChange: (sort: SortOption) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  activeFilterCount: number;
  onMobileFilterOpen: () => void;
}

export default function LibraryToolbar({
  sort,
  onSortChange,
  viewMode,
  onViewModeChange,
  activeFilterCount,
  onMobileFilterOpen,
}: LibraryToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" className="lg:hidden" onClick={onMobileFilterOpen}>
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
  );
}
