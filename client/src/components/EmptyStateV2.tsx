/**
 * EmptyStateV2 — icon, title, description, optional action button.
 * Replaces the old EmptyState with DESIGN.md-compliant styling.
 *
 * Variants provide pre-configured icons and default messages for common
 * scenarios. All variant defaults can be overridden by passing explicit
 * title/description/icon props.
 */
import { type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ImageIcon, FolderOpen, AlertTriangle, SearchX } from 'lucide-react';
import { cn } from '@/lib/utils';

type EmptyStateVariant = 'no-image' | 'no-assets' | 'generation-failed' | 'no-results';

export type { EmptyStateVariant };

interface VariantConfig {
  icon: ReactNode;
  title: string;
  description: string;
}

const VARIANT_CONFIGS: Record<EmptyStateVariant, VariantConfig> = {
  'no-image': {
    icon: <ImageIcon className="size-8 text-muted-foreground" />,
    title: 'No image yet',
    description: 'Generate an image to see it here.',
  },
  'no-assets': {
    icon: <FolderOpen className="size-8 text-muted-foreground" />,
    title: 'No assets yet',
    description: 'Get started by creating your first asset.',
  },
  'generation-failed': {
    icon: <AlertTriangle className="size-8 text-destructive" />,
    title: 'Generation failed',
    description: 'Something went wrong. Try again or adjust your settings.',
  },
  'no-results': {
    icon: <SearchX className="size-8 text-muted-foreground" />,
    title: 'No results found',
    description: 'Try adjusting your filters or search terms.',
  },
};

interface EmptyStateV2Props {
  icon?: ReactNode;
  title?: string;
  description?: string;
  actionLabel?: string;
  actionPath?: string;
  /** Optional className for the container */
  className?: string;
  /**
   * Pre-configured variant providing a default icon, title, and description.
   * All variant defaults can be overridden by passing explicit props.
   */
  variant?: EmptyStateVariant;
}

export default function EmptyStateV2({
  icon,
  title,
  description,
  actionLabel,
  actionPath,
  className,
  variant,
}: EmptyStateV2Props) {
  const navigate = useNavigate();
  const config = variant ? VARIANT_CONFIGS[variant] : null;

  const resolvedIcon = icon ?? config?.icon;
  const resolvedTitle = title ?? config?.title ?? '';
  const resolvedDescription = description ?? config?.description ?? '';

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 text-center',
        'px-4 sm:px-6 md:px-8',
        className,
      )}
    >
      {resolvedIcon && (
        <div className="mb-4 flex size-16 items-center justify-center bg-surface">
          {resolvedIcon}
        </div>
      )}
      <h2 className="mb-1 text-xl font-semibold text-foreground">{resolvedTitle}</h2>
      <p className="mb-6 max-w-sm text-sm text-muted-foreground">{resolvedDescription}</p>
      {actionLabel && actionPath && (
        <Button onClick={() => navigate(actionPath)}>{actionLabel}</Button>
      )}
    </div>
  );
}
