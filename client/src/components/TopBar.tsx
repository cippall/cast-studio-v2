/**
 * TopBar — workspace badge, notifications, user avatar menu.
 * Mobile: hamburger button + Cast Studio branding.
 * Desktop: workspace name, theme toggle, notifications, user menu.
 */
import { useNavigate } from 'react-router-dom';
import { useCurrentUser, useLogout } from '@/hooks/useAuth';
import { useUIStore } from '@/store/ui-store';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, Settings, Sun, Moon, User, Menu } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import NotificationDropdown from '@/components/NotificationDropdown';

function workspaceDisplayName(workspaceId: string): string {
  if (!workspaceId) return 'Studio';
  // Use first segment before any dash/underscore, or first 8 chars
  const segment = workspaceId.split(/[-_]/)[0];
  return segment.slice(0, 12);
}

export default function TopBar() {
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  const navigate = useNavigate();
  const openSidebar = useUIStore((s) => s.openSidebar);
  const { theme, toggleTheme } = useTheme();

  const initials = user?.name
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
    <header className="flex h-14 items-center justify-between border-b bg-background px-4">
      {/* Left: hamburger (mobile) + workspace info */}
      <div className="flex items-center gap-3">
        {/* Hamburger — mobile only */}
        <Button
          variant="ghost"
          size="sm"
          className="lg:hidden"
          onClick={openSidebar}
          aria-label="Open navigation menu"
        >
          <Menu className="size-5" />
        </Button>

        {/* Workspace name */}
        <span className="text-sm font-medium text-foreground">
          {user?.workspace_id ? workspaceDisplayName(user.workspace_id) : 'Cast Studio'}
        </span>
      </div>

      {/* Right: theme toggle + notifications + user menu */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleTheme}
          aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          {theme === 'light' ? <Moon className="size-4" /> : <Sun className="size-4" />}
        </Button>

        <NotificationDropdown />

        {/* User avatar dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Avatar className="size-8 cursor-pointer">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span>{user?.name}</span>
                <span className="text-xs font-normal text-muted-foreground">{user?.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => navigate('/settings')}>
                <User className="mr-2 size-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/settings/users')}>
                <Settings className="mr-2 size-4" />
                <span>Settings</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} disabled={logout.isPending}>
              <LogOut className="mr-2 size-4" />
              <span>{logout.isPending ? 'Signing out...' : 'Sign out'}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
