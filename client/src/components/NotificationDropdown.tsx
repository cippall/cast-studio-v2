/**
 * NotificationDropdown — notification center dropdown with unread count.
 * Shows recent notifications, mark as read, and "View All" link.
 */
import { useNavigate } from 'react-router-dom';
import {
  useNotifications,
  useUnreadNotificationCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '@/hooks/useNotifications';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Bell, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function NotificationDropdown() {
  const navigate = useNavigate();
  const { data: unreadCount } = useUnreadNotificationCount();
  const { data: notifData, isLoading } = useNotifications({ pageSize: 10 });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const notifications = notifData?.data ?? [];
  const unread = unreadCount ?? 0;

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
            <Bell className="size-5" />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center bg-warning text-[10px] font-bold text-warning-foreground">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Notifications</h3>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-1 text-xs"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              <Check className="mr-1 size-3" />
              Mark all read
            </Button>
          )}
        </div>

        <ScrollArea className="h-80">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No notifications</div>
          ) : (
            <div className="divide-y">
              {notifications.map((notif) => (
                <button
                  key={notif.id}
                  className={cn(
                    'flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-muted/50',
                    !notif.is_read && 'bg-primary/5 dark:bg-primary/10',
                  )}
                  onClick={() => {
                    if (!notif.is_read) {
                      markRead.mutate(notif.id);
                    }
                    // Navigate based on notification type
                    if (notif.type.startsWith('COMMISSION')) {
                      navigate('/commissions');
                    } else if (notif.type.startsWith('ASSET')) {
                      navigate('/actors');
                    } else if (notif.type.startsWith('MARKETPLACE')) {
                      navigate('/marketplace/manage');
                    } else if (notif.type.startsWith('COLLECTION')) {
                      navigate('/collections');
                    }
                  }}
                >
                  <div className="flex items-start gap-2">
                    {!notif.is_read && <span className="mt-1.5 size-2 shrink-0 bg-warning" />}
                    <div className={cn('flex-1', notif.is_read && 'pl-4')}>
                      <p className="text-sm font-medium">{notif.title}</p>
                      <p className="line-clamp-2 text-xs text-muted-foreground">{notif.message}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {formatRelativeTime(notif.created_at)}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        {notifications.length > 0 && (
          <div className="border-t px-4 py-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => navigate('/notifications')}
            >
              View All Notifications
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
