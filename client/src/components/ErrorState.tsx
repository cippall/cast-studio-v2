/**
 * ErrorState — icon, message, retry button.
 * Wraps shadcn Alert for consistent error presentation.
 */
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ErrorStateProps {
  /** Error message to display. Defaults to a generic message. */
  message?: string;
  /** Callback for retry button. Defaults to page reload. */
  onRetry?: () => void;
  /** Additional className for the container */
  className?: string;
}

export default function ErrorState({
  message = 'Something went wrong. Please try again.',
  onRetry,
  className,
}: ErrorStateProps) {
  const handleRetry = onRetry ?? (() => window.location.reload());

  return (
    <div className={cn('flex flex-col items-center justify-center py-16', className)}>
      <Alert variant="destructive" className="w-full max-w-md border-error/20 bg-error/5">
        <AlertCircle className="size-4 text-error" />
        <AlertTitle className="text-error">Error</AlertTitle>
        <AlertDescription className="text-error/90">{message}</AlertDescription>
      </Alert>
      <Button
        variant="outline"
        size="sm"
        className="mt-4 border-border hover:bg-surface"
        onClick={handleRetry}
      >
        <RefreshCw className="mr-2 size-4" />
        Retry
      </Button>
    </div>
  );
}
