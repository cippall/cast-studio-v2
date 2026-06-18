/**
 * DataTable — reusable sortable, paginated table for admin/settings pages.
 * Desktop: table with sortable headers.
 * Mobile: card list (each row = card with label:value pairs).
 * Row actions via DropdownMenu.
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Button } from '@/components/ui/button';
import { MoreHorizontal } from 'lucide-react';
import EmptyState from '@/components/EmptyState';
import { cn } from '@/lib/utils';

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  render: (row: T) => React.ReactNode;
}

export interface DataTableProps<T extends { id: string }> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
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
  }, [data, activeSortKey, activeSortDir, columns, activeSortDir]); // eslint-disable-line

  const handleSort = (key: string) => {
    const col = columns.find((c) => c.key === key);
    if (!col?.sortable) return;

    if (onSort) {
      onSort(key);
    } else {
      if (clientSortKey === key) {
        setClientSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setClientSortKey(key);
        setClientSortDir('asc');
      }
    }
  };

  const getCardTitle = (row: T): React.ReactNode => {
    if (cardTitleKey) {
      const col = columns.find((c) => c.key === cardTitleKey);
      if (col) return col.render(row);
    }
    return columns[0]?.render(row) ?? row.id;
  };

  // Loading state
  if (isLoading) {
    return <LoadingState<T> columns={columns} rowCount={loadingRowCount} />;
  }

  // Empty state
  if (data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Desktop table */}
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

      {/* Mobile card list */}
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

      {/* Pagination */}
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

/* -- Row dropdown menu -- */

interface RowDropdownProps {
  actions: React.ReactNode[];
}

function RowDropdown({ actions }: RowDropdownProps) {
  if (actions.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button variant="ghost" size="sm" className="size-8 p-0">
          <MoreHorizontal className="size-4" />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {actions.map((action, i) => (
          <DropdownMenuItem key={i}>{action}</DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* -- Loading skeleton -- */

interface LoadingStateProps<T extends { id: string }> {
  columns: Column<T>[];
  rowCount: number;
}

function LoadingState<T extends { id: string }>({ columns, rowCount }: LoadingStateProps<T>) {
  return (
    <div>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key}>{col.header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rowCount }).map((_, i) => (
              <TableRow key={i}>
                {columns.map((col) => (
                  <TableCell key={col.key}>
                    <Skeleton className="h-6 w-24" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-col gap-3 md:hidden">
        {Array.from({ length: rowCount }).map((_, i) => (
          <div key={i} className="border border-border p-4">
            <Skeleton className="mb-3 h-5 w-32" />
            {columns.slice(1).map((col, j) => (
              <div key={j} className="flex items-center justify-between py-1">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* -- Helpers -- */

function getSortValue<T extends { id: string }>(row: T, col: Column<T>): string {
  const rendered = col.render(row);
  if (typeof rendered === 'string' || typeof rendered === 'number') {
    return String(rendered);
  }
  const rowRec = row as unknown as Record<string, unknown>;
  if (col.key in rowRec) {
    return String(rowRec[col.key] ?? '');
  }
  return '';
}

function getPaginationRange(current: number, total: number): number[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const range: number[] = [];
  if (current <= 4) {
    for (let i = 1; i <= 5; i++) range.push(i);
    range.push(-1);
    range.push(total);
  } else if (current >= total - 3) {
    range.push(1);
    range.push(-1);
    for (let i = total - 4; i <= total; i++) range.push(i);
  } else {
    range.push(1);
    range.push(-1);
    for (let i = current - 1; i <= current + 1; i++) range.push(i);
    range.push(-1);
    range.push(total);
  }
  return range;
}
