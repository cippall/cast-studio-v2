/**
 * FilterPanel — collapsible filter sidebar for asset libraries.
 * Renders filter groups with checkbox lists and a reset button.
 */
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterGroup {
  key: string;
  label: string;
  options: FilterOption[];
}

interface FilterPanelProps {
  groups: FilterGroup[];
  selected: Record<string, string[]>;
  onChange: (key: string, values: string[]) => void;
  onReset: () => void;
  /** Optional toggle for "Shared with Me" (Client view) */
  sharedWithMe?: boolean;
  onSharedWithMeChange?: (value: boolean) => void;
}

export default function FilterPanel({
  groups,
  selected,
  onChange,
  onReset,
  sharedWithMe,
  onSharedWithMeChange,
}: FilterPanelProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleGroup = (key: string) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const activeFilterCount = Object.values(selected).reduce((sum, vals) => sum + vals.length, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Filters</h3>
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={onReset} className="h-7 text-xs">
            Reset ({activeFilterCount})
          </Button>
        )}
      </div>

      {/* Shared with Me toggle (Client only) */}
      {onSharedWithMeChange && (
        <div className="flex items-center gap-2">
          <Checkbox
            id="shared-with-me"
            checked={sharedWithMe}
            onCheckedChange={(checked) => onSharedWithMeChange(checked === true)}
          />
          <label htmlFor="shared-with-me" className="text-sm cursor-pointer">
            Shared with Me
          </label>
        </div>
      )}

      <Separator />

      {/* Filter groups */}
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-3 pr-3">
          {groups.map((group) => {
            const isCollapsed = collapsed[group.key];
            const groupSelected = selected[group.key] ?? [];

            return (
              <div key={group.key} className="flex flex-col gap-2">
                <button
                  type="button"
                  className="flex items-center justify-between text-sm font-medium"
                  onClick={() => toggleGroup(group.key)}
                >
                  <span>{group.label}</span>
                  <span className="flex items-center gap-1">
                    {groupSelected.length > 0 && (
                      <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                        {groupSelected.length}
                      </Badge>
                    )}
                    {isCollapsed ? (
                      <ChevronDown className="size-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronUp className="size-3.5 text-muted-foreground" />
                    )}
                  </span>
                </button>

                <div className={cn('flex flex-col gap-1.5 pl-1', isCollapsed && 'hidden')}>
                  {group.options.map((option) => {
                    const checked = groupSelected.includes(option.value);
                    return (
                      <div key={option.value} className="flex items-center gap-2">
                        <Checkbox
                          id={`${group.key}-${option.value}`}
                          checked={checked}
                          onCheckedChange={(isChecked) => {
                            const current = selected[group.key] ?? [];
                            if (isChecked) {
                              onChange(group.key, [...current, option.value]);
                            } else {
                              onChange(
                                group.key,
                                current.filter((v) => v !== option.value),
                              );
                            }
                          }}
                        />
                        <label
                          htmlFor={`${group.key}-${option.value}`}
                          className="flex-1 cursor-pointer text-sm text-muted-foreground"
                        >
                          {option.label}
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-1">
          {groups.flatMap((group) =>
            (selected[group.key] ?? []).map((val) => {
              const option = group.options.find((o) => o.value === val);
              return (
                <Badge
                  key={`${group.key}-${val}`}
                  variant="outline"
                  className="flex items-center gap-1 text-xs"
                >
                  {option?.label ?? val}
                  <button
                    type="button"
                    onClick={() => {
                      const current = selected[group.key] ?? [];
                      onChange(
                        group.key,
                        current.filter((v) => v !== val),
                      );
                    }}
                    className="ml-0.5 rounded-full hover:bg-muted"
                    aria-label={`Remove ${option?.label ?? val} filter`}
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              );
            }),
          )}
        </div>
      )}
    </div>
  );
}
