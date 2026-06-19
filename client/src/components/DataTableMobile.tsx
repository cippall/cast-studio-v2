import { cn } from '@/lib/utils';
import RowDropdown from '@/components/RowDropdown';
import type { Column } from '@/components/DataTable';

interface DataTableMobileProps<T extends { id: string }> {
  columns: Column<T>[];
  sortedData: T[];
  cardTitleKey?: string;
  onRowClick?: (row: T) => void;
  rowActions?: (row: T) => React.ReactNode[];
}

function getCardTitle<T extends { id: string }>(
  row: T,
  columns: Column<T>[],
  cardTitleKey?: string,
): React.ReactNode {
  if (cardTitleKey) {
    const col = columns.find((c) => c.key === cardTitleKey);
    if (col) return col.render(row);
  }
  return columns[0]?.render(row) ?? row.id;
}

export function DataTableMobile<T extends { id: string }>({
  columns,
  sortedData,
  cardTitleKey,
  onRowClick,
  rowActions,
}: DataTableMobileProps<T>) {
  return (
    <div className="flex flex-col gap-3 md:hidden">
      {sortedData.map((row) => (
        <div
          key={row.id}
          className="border border-border p-4"
          onClick={() => onRowClick?.(row)}
          role={onRowClick ? 'button' : undefined}
          tabIndex={onRowClick ? 0 : undefined}
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="font-medium">{getCardTitle(row, columns, cardTitleKey)}</div>
            {rowActions && (
              <div onClick={(e) => e.stopPropagation()}>
                <RowDropdown actions={rowActions(row)} />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {columns
              .filter((col) => col.key !== cardTitleKey)
              .map((col) => (
                <div key={col.key} className="flex items-baseline justify-between gap-2">
                  <span className="shrink-0 text-sm text-muted-foreground">{col.header}</span>
                  <span className="text-right text-sm">{col.render(row)}</span>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
