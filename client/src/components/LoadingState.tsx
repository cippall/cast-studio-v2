/**
 * LoadingState — configurable skeleton layout for loading states.
 * Supports grid, list, detail, and table variants.
 */
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export type LoadingVariant = 'grid' | 'list' | 'detail' | 'table';

interface LoadingStateProps {
  /** Layout variant. Default: 'grid'. */
  variant?: LoadingVariant;
  /** Number of skeleton items to show. Default depends on variant. */
  count?: number;
  /** Additional className for the container */
  className?: string;
}

const DEFAULT_COUNTS: Record<LoadingVariant, number> = {
  grid: 8,
  list: 5,
  detail: 1,
  table: 5,
};

export default function LoadingState({ variant = 'grid', count, className }: LoadingStateProps) {
  const n = count ?? DEFAULT_COUNTS[variant];

  if (variant === 'grid') {
    return (
      <div className={cn('grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4', className)}>
        {Array.from({ length: n }).map((_, i) => (
          <Skeleton key={i} className="aspect-square w-full" />
        ))}
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className={cn('flex flex-col gap-3', className)}>
        {Array.from({ length: n }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3">
            <Skeleton className="size-10 shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'detail') {
    return (
      <div className={cn('flex flex-col gap-6 md:flex-row', className)}>
        {/* Image skeleton */}
        <Skeleton className="aspect-square w-full md:w-80 md:shrink-0" />
        {/* Content skeleton */}
        <div className="flex-1 space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <div className="space-y-2 pt-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <div className="flex gap-2 pt-4">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div className={cn('space-y-3', className)}>
        {/* Header row */}
        <div className="flex gap-4 border-b border-border pb-2">
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
        </div>
        {/* Data rows */}
        {Array.from({ length: n }).map((_, i) => (
          <div key={i} className="flex gap-4 py-2">
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    );
  }

  return null;
}
