/**
 * Sidebar navigation — renders nav items based on user role.
 * Desktop: persistent sidebar (collapsible).
 * Mobile: Sheet drawer triggered by hamburger in TopBar.
 */
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUIStore } from '@/store/ui-store';
import { useCurrentUser } from '@/hooks/useAuth';
import { getNavItems } from '@/lib/navigation';
import type { NavItem } from '@/lib/navigation';
import { ChevronLeft } from 'lucide-react';

function NavLinkItem({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  if (item.children) {
    return (
      <div className="flex flex-col gap-1">
        {!collapsed && (
          <span className="px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {item.label}
          </span>
        )}
        <div className="flex flex-col gap-0.5">
          {item.children.map((child) => (
            <NavLink
              key={child.path}
              to={child.path}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  collapsed && 'justify-center px-2',
                )
              }
            >
              <child.icon className="size-4 shrink-0" />
              {!collapsed && <span>{child.label}</span>}
            </NavLink>
          ))}
        </div>
      </div>
    );
  }

  return (
    <NavLink
      to={item.path}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
          collapsed && 'justify-center px-2',
        )
      }
    >
      <item.icon className="size-4 shrink-0" />
      {!collapsed && <span>{item.label}</span>}
    </NavLink>
  );
}

export function SidebarNavContent({ onNavigate }: { onNavigate?: () => void }) {
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const { data: user } = useCurrentUser();

  if (!user) return null;

  const navItems = getNavItems(user.role);

  return (
    <div className="flex h-full flex-col">
      {/* Logo area */}
      <div
        className={cn(
          'flex h-14 items-center border-b px-4',
          sidebarCollapsed && 'justify-center px-2',
        )}
      >
        {sidebarCollapsed ? (
          <span className="text-lg font-bold text-primary">CS</span>
        ) : (
          <span className="text-lg font-bold">Cast Studio</span>
        )}
      </div>

      {/* Nav items */}
      <ScrollArea className="flex-1 px-2 py-4">
        <nav className="flex flex-col gap-4">
          {navItems.map((item) => (
            <NavLinkItem key={item.path} item={item} collapsed={sidebarCollapsed} />
          ))}
        </nav>
      </ScrollArea>

      {/* Collapse toggle — desktop only */}
      <div className="hidden border-t p-2 lg:block">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-center"
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronLeft
            className={cn('size-4 transition-transform', sidebarCollapsed && 'rotate-180')}
          />
        </Button>
      </div>

      {/* Close button for mobile drawer */}
      {onNavigate && (
        <div className="border-t p-2 lg:hidden">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center"
            onClick={onNavigate}
            aria-label="Close menu"
          >
            <ChevronLeft className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  return (
    <aside
      className={cn(
        'hidden lg:flex flex-col border-r bg-background transition-all duration-200',
        useUIStore((s) => s.sidebarCollapsed) ? 'lg:w-16' : 'lg:w-60',
      )}
    >
      <SidebarNavContent />
    </aside>
  );
}
