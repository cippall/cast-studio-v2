import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import RowDropdown from '@/components/RowDropdown';
import type { Column } from '@/components/DataTable';

interface DataTableDesktopProps<T extends { id: string }> {
  columns: Column<T>[];
  sortedData: T[];
  activeSortKey?: string;
  activeSortDir?: 'asc' | 'desc';
  onSort: (key: string) => void;
  onRowClick?: (row: T) => void;
  rowActions?: (row: T) => React.ReactNode[];
}

export function DataTableDesktop<T extends { id: string }>({
  columns,
  sortedData,
  activeSortKey,
  activeSortDir,
  onSort,
  onRowClick,
  rowActions,
}: DataTableDesktopProps<T>) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((col) => (
            <TableHead
              key={col.key}
              className={cn(col.sortable && 'cursor-pointer select-none hover:text-foreground')}
              onClick={() => onSort(col.key)}
            >
              <span className="flex items-center gap-1">
                {col.header}
                {col.sortable && activeSortKey === col.key && (
                  <span className="text-xs">{activeSortDir === 'asc' ? '\u2191' : '\u2193'}</span>
                )}
              </span>
            </TableHead>
          ))}
          {rowActions && <TableHead className="w-12" />}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedData.map((row) => (
          <TableRow
            key={row.id}
            className={cn(onRowClick && 'cursor-pointer')}
            onClick={() => onRowClick?.(row)}
          >
            {columns.map((col) => (
              <TableCell key={col.key}>{col.render(row)}</TableCell>
            ))}
            {rowActions && (
              <TableCell onClick={(e) => e.stopPropagation()}>
                <RowDropdown actions={rowActions(row)} />
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
