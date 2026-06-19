import { Badge } from '@/components/ui/badge';
import { Image } from 'lucide-react';
import type { ActivityFeedItem } from '@cast/types';

export function formatRelativeTime(dateStr: string): string {
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

const actionBadgeVariant: Record<string, 'default' | 'secondary' | 'outline'> = {
  Created: 'default',
  Generated: 'secondary',
  Shared: 'outline',
};

export default function ActivityCard({ item }: { item: ActivityFeedItem }) {
  return (
    <div className="overflow-hidden border border-border bg-card">
      <div className="aspect-square w-full bg-surface">
        {item.thumbnail_url ? (
          <img
            src={item.thumbnail_url}
            alt={item.asset_name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Image className="size-8 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="p-2">
        <p className="truncate text-sm font-medium text-foreground">{item.asset_name}</p>
        <div className="mt-1 flex items-center gap-2">
          <Badge variant={actionBadgeVariant[item.action] ?? 'default'} className="text-[10px]">
            {item.action}
          </Badge>
          <span className="text-[11px] text-muted-foreground">
            {formatRelativeTime(item.created_at)}
          </span>
        </div>
      </div>
    </div>
  );
}
