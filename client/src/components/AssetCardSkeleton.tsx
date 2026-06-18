/**
 * AssetCardSkeleton — loading placeholder matching AssetCard shape.
 */
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function AssetCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="aspect-square">
        <Skeleton className="size-full rounded-none" />
      </div>
      <CardContent className="p-3">
        <Skeleton className="h-4 w-3/4" />
        <div className="mt-1.5 flex gap-1">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="mt-1.5 h-3 w-16" />
      </CardContent>
    </Card>
  );
}
