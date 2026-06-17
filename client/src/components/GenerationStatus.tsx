/**
 * GenerationStatus — displays async generation state.
 * PENDING: spinner, SUCCESS: checkmark, FAILED: error + Retry button.
 */
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type GenerationState = 'PENDING' | 'SUCCESS' | 'FAILED';

interface GenerationStatusProps {
  status: GenerationState;
  errorMessage?: string | null;
  onRetry?: () => void;
  className?: string;
}

export default function GenerationStatus({
  status,
  errorMessage,
  onRetry,
  className,
}: GenerationStatusProps) {
  if (status === 'PENDING') {
    return (
      <div className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}>
        <Loader2 className="size-4 animate-spin" />
        <span>Generating...</span>
      </div>
    );
  }

  if (status === 'FAILED') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <XCircle className="size-4 shrink-0 text-destructive" />
        <span className="text-sm text-destructive">{errorMessage ?? 'Generation failed'}</span>
        {onRetry && (
          <Button variant="outline" size="xs" onClick={onRetry} className="ml-2">
            Retry
          </Button>
        )}
      </div>
    );
  }

  // SUCCESS
  return (
    <div className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}>
      <CheckCircle className="size-4 text-emerald-500" />
      <span>Ready</span>
    </div>
  );
}
