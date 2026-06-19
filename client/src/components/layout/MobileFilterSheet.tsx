import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import FilterPanel, { type FilterGroup } from '@/components/FilterPanel';

interface MobileFilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filterGroups: FilterGroup[];
  selected: Record<string, string[]>;
  onChange: (key: string, values: string[]) => void;
  onReset: () => void;
  activeFilterCount: number;
}

export default function MobileFilterSheet({
  open,
  onOpenChange,
  filterGroups,
  selected,
  onChange,
  onReset,
  activeFilterCount,
}: MobileFilterSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
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
            selected={selected}
            onChange={onChange}
            onReset={onReset}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
