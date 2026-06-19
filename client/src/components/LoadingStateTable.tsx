import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import type { Column } from '@/components/DataTable';

interface LoadingStateProps<T extends { id: string }> {
  columns: Column<T>[];
  rowCount: number;
}

export default function LoadingStateTable<T extends { id: string }>({
  columns,
  rowCount,
}: LoadingStateProps<T>) {
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
