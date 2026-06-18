/**
 * PageToolbar — horizontal bar for filters, sort, and view toggles.
 *
 * Layout:
 *   - Mobile: wraps (flex-wrap), full-width children
 *   - Desktop (md+): single row, left-aligned with gap
 *
 * Used below PageHeader for filter/sort controls on library and admin pages.
 */
import { cn } from '@/lib/utils';

interface PageToolbarProps {
  children: React.ReactNode;
  className?: string;
}

export default function PageToolbar({ children, className }: PageToolbarProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3 border-b border-border pb-4', className)}>
      {children}
    </div>
  );
}
