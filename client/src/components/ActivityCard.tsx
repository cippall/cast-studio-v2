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

const actionLabelVariant: Record<string, string> = {
  Generated: 'bg-surface-container text-foreground',
  Updated: 'bg-surface-container-low text-foreground',
  Approved: 'bg-surface-container text-foreground',
  Created: 'bg-surface-container text-foreground',
};

export default function ActivityCard({ item }: { item: ActivityFeedItem }) {
  return (
    <div className="flex-none w-64 snap-start group">
      <div className="w-full h-40 bg-surface-container-highest mb-4 relative overflow-hidden border border-border">
        {item.thumbnail_url ? (
          <img
            src={item.thumbnail_url}
            alt={item.asset_name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Image className="size-12 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[17px] leading-[30.6px] text-foreground truncate pr-2">
            {item.asset_name}
          </p>
          <p className="text-[13px] leading-[19.5px] text-muted-foreground mt-1">
            {formatRelativeTime(item.created_at)}
          </p>
        </div>
        <span
          className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-1 border border-border ${actionLabelVariant[item.action] ?? 'bg-surface-container text-foreground'}`}
        >
          {item.action}
        </span>
      </div>
    </div>
  );
}
