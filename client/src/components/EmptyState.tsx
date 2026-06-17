/**
 * EmptyState — illustration + message + action button for empty views.
 */
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  actionPath?: string;
}

export default function EmptyState({
  title,
  description,
  actionLabel,
  actionPath,
}: EmptyStateProps) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-muted">
        <Inbox className="size-8 text-muted-foreground" />
      </div>
      <h2 className="mb-1 text-xl font-semibold">{title}</h2>
      <p className="mb-6 max-w-sm text-sm text-muted-foreground">{description}</p>
      {actionLabel && actionPath && (
        <Button onClick={() => navigate(actionPath)}>{actionLabel}</Button>
      )}
    </div>
  );
}
