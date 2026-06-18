/**
 * PageContainer — responsive max-width wrapper for page content.
 *
 * Breakpoints:
 *   - Mobile (< 768px): full width, 16px padding
 *   - Tablet (768px-1023px): full width, 24px padding
 *   - Desktop (1024px+): max-w-7xl centered, 48px padding
 */
import { cn } from '@/lib/utils';

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export default function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div
      className={cn(
        'mx-auto w-full px-4 py-4 md:px-6 md:py-6 lg:max-w-7xl lg:px-12 lg:py-12',
        className,
      )}
    >
      {children}
    </div>
  );
}
