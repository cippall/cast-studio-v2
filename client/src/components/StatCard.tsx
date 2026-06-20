import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  isLoading?: boolean;
  variant?: 'default' | 'highlight';
}

export default function StatCard({
  label,
  value,
  isLoading = false,
  variant = 'default',
}: StatCardProps) {
  return (
    <div className="flex flex-col justify-center items-start p-6">
      <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
        {label}
      </span>
      {isLoading ? (
        <Skeleton className="h-8 w-16" />
      ) : (
        <span
          className={cn(
            'font-heading text-[30px] font-bold leading-[39px] tracking-[-0.015em]',
            variant === 'highlight' ? 'text-primary' : 'text-foreground',
          )}
        >
          {value}
        </span>
      )}
    </div>
  );
}
