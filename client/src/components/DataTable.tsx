/**
 * DataTable — reusable sortable, paginated table for admin/settings pages.
 */
import { useState, useMemo } from 'react';
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
import LoadingStateTable from '@/components/LoadingStateTable';
import { DataTableDesktop } from '@/components/DataTableDesktop';
import { DataTableMobile } from '@/components/DataTableMobile';
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
    return [...data].sort((a, b) => {
      const aVal = getSortValue(a, col);
      const bVal = getSortValue(b, col);
      if (aVal < bVal) return activeSortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return activeSortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, activeSortKey, activeSortDir, columns]);

  const handleSort = (key: string) => {
    const col = columns.find((c) => c.key === key);
    if (!col?.sortable) return;
    if (onSort) onSort(key);
    else if (clientSortKey === key) setClientSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setClientSortKey(key);
      setClientSortDir('asc');
    }
  };

  if (isLoading) return <LoadingStateTable columns={columns} rowCount={loadingRowCount} />;
  if (isError) return <ErrorState message={error?.message} />;
  if (data.length === 0) return <EmptyStateV2 title={emptyTitle} description={emptyDescription} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="hidden md:block">
        <DataTableDesktop
          columns={columns}
          sortedData={sortedData}
          activeSortKey={activeSortKey ?? undefined}
          activeSortDir={activeSortDir}
          onSort={handleSort}
          onRowClick={onRowClick}
          rowActions={rowActions}
        />
      </div>
      <DataTableMobile
        columns={columns}
        sortedData={sortedData}
        cardTitleKey={cardTitleKey}
        onRowClick={onRowClick}
        rowActions={rowActions}
      />
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
