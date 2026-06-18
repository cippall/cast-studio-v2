/**
 * EmptyStateV2 — icon, title, description, optional action button.
 * Replaces the old EmptyState with DESIGN.md-compliant styling.
 */
import { type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateV2Props {
  icon?: ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  actionPath?: string;
  /** Optional className for the container */
  className?: string;
}

export default function EmptyStateV2({
  icon,
  title,
  description,
  actionLabel,
  actionPath,
  className,
}: EmptyStateV2Props) {
  const navigate = useNavigate();

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 text-center',
        'px-4 sm:px-6 md:px-8',
        className,
      )}
    >
      {icon && (
        <div className="mb-4 flex size-16 items-center justify-center bg-surface">{icon}</div>
      )}
      <h2 className="mb-1 text-xl font-semibold text-foreground">{title}</h2>
      <p className="mb-6 max-w-sm text-sm text-muted-foreground">{description}</p>
      {actionLabel && actionPath && (
        <Button onClick={() => navigate(actionPath)}>{actionLabel}</Button>
      )}
    </div>
  );
}
