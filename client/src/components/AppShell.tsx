/**
 * AppShell — sidebar + main content area layout.
 * Desktop (>=1024px): fixed left sidebar with nav + user controls at bottom.
 * Mobile (<1024px): sidebar hidden, Sheet drawer.
 */
import Sidebar, { SidebarNavContent } from '@/components/Sidebar';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useUIStore } from '@/store/ui-store';
import { Outlet } from 'react-router-dom';
import { cn } from '@/lib/utils';

export default function AppShell() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const closeSidebar = useUIStore((s) => s.closeSidebar);
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);

  return (
    <div className="flex min-h-[100dvh]">
      <Sidebar />

      <Sheet
        open={sidebarOpen}
        onOpenChange={(open) => {
          if (!open) closeSidebar();
        }}
      >
        <SheetContent side="left" showCloseButton={false} className="w-64 p-0">
          <SidebarNavContent onNavigate={closeSidebar} />
        </SheetContent>
      </Sheet>

      <div className={cn('flex flex-1 flex-col', sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64')}>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
