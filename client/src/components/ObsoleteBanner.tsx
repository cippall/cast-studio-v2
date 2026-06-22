import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ObsoleteBanner({
  reason,
  onRegenerate,
}: {
  reason: string | null;
  onRegenerate?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 border border-warning/20 bg-warning/10 px-4 py-3 text-sm text-warning mb-4">
      <AlertTriangle className="size-5 shrink-0" />
      <p className="flex-1">
        {reason ?? 'This output is based on a previous version. Regenerate to update.'}
      </p>
      {onRegenerate && (
        <Button variant="outline" size="xs" onClick={onRegenerate}>
          Regenerate
        </Button>
      )}
    </div>
  );
}
