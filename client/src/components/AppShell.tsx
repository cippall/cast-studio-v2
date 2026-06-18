/**
 * AppShell — sidebar + topbar + main content area layout.
 * Desktop (>=1024px): persistent sidebar, always visible.
 * Tablet (768-1023px): collapsible sidebar via toggle.
 * Mobile (<768px): sidebar hidden, Sheet drawer triggered by TopBar hamburger.
 */
import Sidebar, { SidebarNavContent } from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useUIStore } from '@/store/ui-store';
import { Outlet } from 'react-router-dom';

export default function AppShell() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const closeSidebar = useUIStore((s) => s.closeSidebar);

  return (
    <div className="flex min-h-[100dvh]">
      {/* Desktop sidebar — visible >= 1024px */}
      <Sidebar />

      {/* Mobile drawer — visible < 1024px */}
      <Sheet
        open={sidebarOpen}
        onOpenChange={(open) => {
          if (!open) closeSidebar();
        }}
      >
        <SheetContent side="left" showCloseButton={false} className="w-60 p-0">
          <SidebarNavContent onNavigate={closeSidebar} />
        </SheetContent>
      </Sheet>

      <div className="flex flex-1 flex-col">
        <TopBar />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
