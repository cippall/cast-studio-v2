/**
 * AppShell — sidebar + topbar + main content area layout.
 * Used by all authenticated pages.
 */
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import { Outlet } from 'react-router-dom';

export default function AppShell() {
  return (
    <div className="flex min-h-[100dvh]">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <TopBar />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
