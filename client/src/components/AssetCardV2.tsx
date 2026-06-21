/**
 * AssetCardV2 — simplified library card with reduced visual noise.
 */
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { cn } from '@/lib/utils';
import { MoreHorizontal, Copy, Trash2, Share2 } from 'lucide-react';
import type { AssetCardType } from '@/components/AssetCard';
import { detailPath } from './asset-card-helpers';

interface AssetCardV2Props {
  id: string;
  name: string;
  type: AssetCardType;
  imageUrl: string | null;
  createdAt: string;
  status?: 'active' | 'archived' | 'pending' | 'draft';
  marketplaceStatus?:
    | 'MARKETPLACE_PENDING'
    | 'MARKETPLACE_APPROVED'
    | 'MARKETPLACE_REJECTED'
    | 'MARKETPLACE_DELISTED'
    | null;
  tags?: string[];
  onDuplicate?: () => void;
  onDelete?: () => void;
  onShare?: () => void;
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  if (diffWeek < 4) return `${diffWeek}w ago`;
  if (diffMonth < 12) return `${diffMonth}mo ago`;
  return `${diffYear}y ago`;
}

function statusDotColor(status?: string, marketplaceStatus?: string | null): string {
  if (marketplaceStatus === 'MARKETPLACE_APPROVED') return 'bg-success';
  if (marketplaceStatus === 'MARKETPLACE_PENDING') return 'bg-info';
  if (marketplaceStatus === 'MARKETPLACE_REJECTED') return 'bg-destructive';
  if (marketplaceStatus === 'MARKETPLACE_DELISTED') return 'bg-muted-foreground';
  if (status === 'active') return 'bg-success';
  if (status === 'pending') return 'bg-warning';
  if (status === 'archived') return 'bg-muted-foreground';
  return 'bg-muted-foreground';
}

function statusLabel(status?: string, marketplaceStatus?: string | null): string {
  const parts: string[] = [];
  if (status) parts.push(status.charAt(0).toUpperCase() + status.slice(1));
  if (marketplaceStatus) {
    const mpLabel = marketplaceStatus.replace('MARKETPLACE_', '');
    parts.push(mpLabel.charAt(0).toUpperCase() + mpLabel.slice(1).toLowerCase());
  }
  return parts.join(' · ');
}

export default function AssetCardV2({
  id,
  name,
  type,
  imageUrl,
  createdAt,
  status,
  marketplaceStatus,
  tags,
  onDuplicate,
  onDelete,
  onShare,
}: AssetCardV2Props) {
  const navigate = useNavigate();
  const hasActions = onDuplicate || onDelete || onShare;
  const hasStatusIndicator = status || marketplaceStatus;

  return (
    <Card
      className={cn(
        'group/card cursor-pointer overflow-hidden transition-colors',
        'hover:border-border',
      )}
      onClick={() => navigate(detailPath(type, id))}
    >
      <AspectRatio ratio={1}>
        {imageUrl ? (
          <img src={imageUrl} alt={name} className="size-full object-cover" loading="lazy" />
        ) : (
          <div className="flex size-full items-center justify-center bg-muted">
            <span className="text-xs text-muted-foreground">No image</span>
          </div>
        )}
      </AspectRatio>

      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate text-sm font-medium text-foreground">{name}</h3>
          {hasActions && (
            <div className="flex items-center gap-1 shrink-0 opacity-0 transition-opacity group-hover/card:opacity-100">
              <DropdownMenu>
                <DropdownMenuTrigger onClick={(e) => e.stopPropagation()}>
                  <MoreHorizontal className="size-4 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  {onDuplicate && (
                    <DropdownMenuItem onClick={onDuplicate}>
                      <Copy className="mr-2 size-4" />
                      Duplicate
                    </DropdownMenuItem>
                  )}
                  {onShare && (
                    <DropdownMenuItem onClick={onShare}>
                      <Share2 className="mr-2 size-4" />
                      Share
                    </DropdownMenuItem>
                  )}
                  {onDelete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={onDelete} variant="destructive">
                        <Trash2 className="mr-2 size-4" />
                        Delete
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        {hasStatusIndicator && (
          <div className="mt-1.5 flex items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger>
                <span
                  className={cn(
                    'inline-block size-2 shrink-0 rounded-full',
                    statusDotColor(status, marketplaceStatus),
                  )}
                />
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">{statusLabel(status, marketplaceStatus)}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {tags && tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-x-1.5 gap-y-0.5 text-[11px] text-muted-foreground">
            {tags.slice(0, 3).map((tag, i) => (
              <span key={tag} className="inline-flex items-center gap-1">
                {i > 0 && <span className="text-border">·</span>}
                {tag}
              </span>
            ))}
            {tags.length > 3 && (
              <span className="text-[11px] text-muted-foreground">+{tags.length - 3}</span>
            )}
          </div>
        )}

        <div className="mt-2 text-[11px] text-muted-foreground">{relativeTime(createdAt)}</div>
      </CardContent>
    </Card>
  );
}
