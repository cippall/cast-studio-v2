/**
 * PageContainer — responsive max-width wrapper for page content.
 * Includes mobile hamburger for sidebar toggle.
 */
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store/ui-store';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export default function PageContainer({ children, className }: PageContainerProps) {
  const openSidebar = useUIStore((s) => s.openSidebar);

  return (
    <div className="mx-auto w-full px-4 py-4 md:px-6 md:py-6 lg:max-w-7xl lg:px-12 lg:py-12">
      {/* Mobile hamburger — visible < 1024px */}
      <div className="mb-4 lg:hidden">
        <Button variant="ghost" size="icon" onClick={openSidebar} aria-label="Open navigation menu">
          <Menu className="size-5" />
        </Button>
      </div>
      <div className={cn(className)}>{children}</div>
    </div>
  );
}
