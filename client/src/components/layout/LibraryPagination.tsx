import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LibraryPaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function LibraryPagination({
  page,
  totalPages,
  onPageChange,
}: LibraryPaginationProps) {
  return (
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
  );
}
