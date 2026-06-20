/**
 * Sidebar navigation — renders nav items based on user role.
 * Desktop: persistent sidebar (collapsible).
 * Mobile: Sheet drawer triggered by hamburger in TopBar.
 */
import { NavLink, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUIStore } from '@/store/ui-store';
import { useCurrentUser, useLogout } from '@/hooks/useAuth';
import { getNavItems } from '@/lib/navigation';
import type { NavItem } from '@/lib/navigation';
import { ChevronLeft, Sun, Moon, LogOut, Settings, User } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import NotificationDropdown from '@/components/NotificationDropdown';

function NavLinkItem({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const iconSize = collapsed ? 'size-5' : 'size-4';

  if (item.children) {
    return (
      <div className="flex flex-col gap-1 border-b border-border pb-2">
        {!collapsed && (
          <span className="px-3 py-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {item.label}
          </span>
        )}
        <div className="flex flex-col">
          {item.children.map((child) => (
            <NavLink
              key={child.path}
              to={child.path}
              title={collapsed ? child.label : undefined}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 pl-[52px] pr-3 py-2 text-[11px] font-semibold uppercase tracking-widest transition-colors',
                  isActive
                    ? 'bg-surface-container-highest text-foreground'
                    : 'text-muted-foreground hover:bg-surface-container-highest',
                  collapsed && 'justify-center px-0 pl-0',
                )
              }
            >
              <child.icon className={cn('shrink-0', iconSize)} />
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
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 px-3 py-3 text-[11px] font-semibold uppercase tracking-widest transition-colors',
          isActive
            ? 'bg-surface-container-highest text-foreground'
            : 'text-muted-foreground hover:bg-surface-container-highest',
          collapsed && 'justify-center px-0',
        )
      }
    >
      <item.icon className={cn('shrink-0', iconSize)} />
      {!collapsed && <span>{item.label}</span>}
    </NavLink>
  );
}

export function SidebarNavContent({ onNavigate }: { onNavigate?: () => void }) {
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  if (!user) return null;

  const navItems = getNavItems(user.role);

  const initials = user.name
    ? user.name
        .split(' ')
        .map((n) => n.charAt(0))
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '??';

  const handleLogout = async () => {
    await logout.mutateAsync();
    navigate('/login');
  };

  return (
    <div className="flex h-full flex-col bg-surface-container-low">
      {/* Logo area — bigger title, more gap below */}
      <div
        className={cn(
          'flex h-20 items-center border-b border-border px-4',
          sidebarCollapsed && 'justify-center px-2',
        )}
      >
        {sidebarCollapsed ? (
          <span className="text-xl font-bold text-primary">CS</span>
        ) : (
          <h1 className="font-heading text-[28px] font-bold leading-[36px] tracking-[-0.02em] text-foreground">
            Cast Studio
          </h1>
        )}
      </div>

      {/* Nav items — more gap from logo */}
      <ScrollArea className="flex-1 px-2 pt-6 pb-4">
        <nav className="flex flex-col gap-3">
          {navItems.map((item) => (
            <NavLinkItem key={item.path} item={item} collapsed={sidebarCollapsed} />
          ))}
        </nav>
      </ScrollArea>

      {/* Bottom section: user controls — single row when collapsed */}
      <div className="border-t border-border p-2">
        <div
          className={cn(
            'flex items-center gap-1',
            sidebarCollapsed ? 'justify-center' : 'justify-between',
          )}
        >
          {/* Left: theme + notifications */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={toggleTheme}
              aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            >
              {theme === 'light' ? <Moon className="size-4" /> : <Sun className="size-4" />}
            </Button>
            <NotificationDropdown />
          </div>

          {/* Right: user avatar + menu (only when expanded) */}
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2">
              <Avatar className="size-7 shrink-0">
                <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
              </Avatar>
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <Button variant="ghost" size="icon-sm" aria-label="User menu">
                    <ChevronLeft className="size-4 rotate-[-90deg]" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="right" className="w-48">
                  <DropdownMenuItem onClick={() => navigate('/settings')}>
                    <User className="mr-2 size-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/settings/users')}>
                    <Settings className="mr-2 size-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} disabled={logout.isPending}>
                    <LogOut className="mr-2 size-4" />
                    <span>{logout.isPending ? 'Signing out...' : 'Sign out'}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        {/* User name/email row — only when expanded */}
        {!sidebarCollapsed && (
          <div className="mt-2 px-1">
            <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
        )}
      </div>

      {/* Collapse toggle — desktop only */}
      <div className="hidden border-t border-border p-2 lg:block">
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
        <div className="border-t border-border p-2 lg:hidden">
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
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);

  return (
    <aside
      className={cn(
        'hidden lg:flex flex-col fixed left-0 top-0 h-full border-r border-border bg-surface-container-low z-40 transition-all duration-200',
        sidebarCollapsed ? 'lg:w-16' : 'lg:w-64',
      )}
    >
      <SidebarNavContent />
    </aside>
  );
}
