/**
 * PageHeader — page title + optional description + optional action slot.
 *
 * Layout:
 *   - Mobile: stacked (title, description, actions full-width below)
 *   - Desktop (md+): row (title+description left, actions right)
 *
 * Typography:
 *   - Title: Libre Baskerville (serif via --font-heading), bold
 *   - Description: Inter (body font), muted-foreground color
 */
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

export default function PageHeader({ title, description, children, className }: PageHeaderProps) {
  return (
    <div
      className={cn('flex flex-col gap-4 md:flex-row md:items-start md:justify-between', className)}
    >
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  );
}
