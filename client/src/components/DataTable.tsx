/**
 * DataTable — reusable sortable, paginated table for admin/settings pages.
 */
import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { cn } from '@/lib/utils';
import EmptyStateV2 from '@/components/EmptyStateV2';
import ErrorState from '@/components/ErrorState';
import RowDropdown from '@/components/RowDropdown';
import LoadingStateTable from '@/components/LoadingStateTable';
import { getSortValue, getPaginationRange } from '@/components/data-table-helpers';

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  render: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number;
}

export interface DataTableProps<T extends { id: string }> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  isError?: boolean;
  error?: Error | null;
  emptyTitle?: string;
  emptyDescription?: string;
  loadingRowCount?: number;
  rowActions?: (row: T) => React.ReactNode[];
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  sortKey?: string;
  sortDir?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  onRowClick?: (row: T) => void;
  cardTitleKey?: string;
}

export function DataTable<T extends { id: string }>({
  columns,
  data,
  isLoading = false,
  isError = false,
  error = null,
  emptyTitle = 'No data',
  emptyDescription = 'No items to display.',
  loadingRowCount = 5,
  rowActions,
  page = 1,
  totalPages = 1,
  onPageChange,
  sortKey,
  sortDir,
  onSort,
  onRowClick,
  cardTitleKey,
}: DataTableProps<T>) {
  const [clientSortKey, setClientSortKey] = useState<string | null>(null);
  const [clientSortDir, setClientSortDir] = useState<'asc' | 'desc'>('asc');

  const activeSortKey = onSort ? sortKey : clientSortKey;
  const activeSortDir = onSort ? sortDir : clientSortDir;

  const sortedData = useMemo(() => {
    if (!activeSortKey) return data;
    const col = columns.find((c) => c.key === activeSortKey);
    if (!col) return data;
    const sorted = [...data].sort((a, b) => {
      const aVal = getSortValue(a, col);
      const bVal = getSortValue(b, col);
      if (aVal < bVal) return activeSortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return activeSortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [data, activeSortKey, activeSortDir, columns]);

  const handleSort = (key: string) => {
    const col = columns.find((c) => c.key === key);
    if (!col?.sortable) return;
    if (onSort) {
      onSort(key);
    } else if (clientSortKey === key) {
      setClientSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setClientSortKey(key);
      setClientSortDir('asc');
    }
  };

  const getCardTitle = (row: T): React.ReactNode => {
    if (cardTitleKey) {
      const col = columns.find((c) => c.key === cardTitleKey);
      if (col) return col.render(row);
    }
    return columns[0]?.render(row) ?? row.id;
  };

  if (isLoading) return <LoadingStateTable columns={columns} rowCount={loadingRowCount} />;
  if (isError) return <ErrorState message={error?.message} />;
  if (data.length === 0) return <EmptyStateV2 title={emptyTitle} description={emptyDescription} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={cn(col.sortable && 'cursor-pointer select-none hover:text-foreground')}
                  onClick={() => handleSort(col.key)}
                >
                  <span className="flex items-center gap-1">
                    {col.header}
                    {col.sortable && activeSortKey === col.key && (
                      <span className="text-xs">
                        {activeSortDir === 'asc' ? '\u2191' : '\u2193'}
                      </span>
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
      </div>

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
              <div className="font-medium">{getCardTitle(row)}</div>
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

      {totalPages > 1 && onPageChange && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => onPageChange(Math.max(1, page - 1))}
                className={cn(page <= 1 && 'pointer-events-none opacity-50')}
              />
            </PaginationItem>
            {getPaginationRange(page, totalPages).map((p, i) =>
              p === -1 ? (
                <PaginationItem key={`ellipsis-${i}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={p}>
                  <PaginationLink isActive={p === page} onClick={() => onPageChange(p)}>
                    {p}
                  </PaginationLink>
                </PaginationItem>
              ),
            )}
            <PaginationItem>
              <PaginationNext
                onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                className={cn(page >= totalPages && 'pointer-events-none opacity-50')}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
