/**
 * AssetCardV2 — richer library card with consistent metadata.
 * Uses AspectRatio for image, shows name/type/creator/date/status,
 * hover border change (no shadow), optional DropdownMenu actions.
 */
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { cn } from '@/lib/utils';
import { MoreHorizontal, Copy, Trash2, Share2 } from 'lucide-react';
import type { AssetCardType } from '@/components/AssetCard';

interface AssetCardV2Props {
  id: string;
  name: string;
  type: AssetCardType;
  imageUrl: string | null;
  creatorName?: string;
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

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function detailPath(type: AssetCardType, id: string): string {
  if (type === 'actor') return `/actors/${id}`;
  if (type === 'look') return `/looks/${id}`;
  return `/fashion-items/${id}`;
}

function typeLabel(type: AssetCardType): string {
  if (type === 'actor') return 'Actor';
  if (type === 'look') return 'Look';
  return 'Fashion Item';
}

function statusVariant(status: string): string {
  switch (status) {
    case 'active':
      return 'bg-success/10 text-success border border-success/20';
    case 'archived':
      return 'bg-muted text-muted-foreground border border-border';
    case 'pending':
      return 'bg-warning/10 text-warning border border-warning/20';
    case 'draft':
      return 'bg-muted text-muted-foreground border border-border';
    default:
      return '';
  }
}

function marketplaceStatusBadge(status: string): { label: string; classes: string } {
  switch (status) {
    case 'MARKETPLACE_PENDING':
      return { label: 'Pending', classes: 'bg-info/10 text-info border border-info/20' };
    case 'MARKETPLACE_APPROVED':
      return { label: 'Listed', classes: 'bg-success/10 text-success border border-success/20' };
    case 'MARKETPLACE_REJECTED':
      return {
        label: 'Rejected',
        classes: 'bg-destructive/10 text-destructive border border-destructive/20',
      };
    case 'MARKETPLACE_DELISTED':
      return { label: 'Delisted', classes: 'bg-muted text-muted-foreground border border-border' };
    default:
      return { label: status, classes: 'bg-muted text-muted-foreground border border-border' };
  }
}

export default function AssetCardV2({
  id,
  name,
  type,
  imageUrl,
  creatorName,
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
  const mpBadge = marketplaceStatus ? marketplaceStatusBadge(marketplaceStatus) : null;

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
        {/* Name + actions row */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate text-sm font-medium text-foreground">{name}</h3>
          {hasActions && (
            <DropdownMenu>
              <DropdownMenuTrigger
                onClick={(e) => e.stopPropagation()}
                className="shrink-0 opacity-0 transition-opacity group-hover/card:opacity-100"
              >
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
          )}
        </div>

        {/* Type + status badges */}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="text-[10px] font-medium">
            {typeLabel(type)}
          </Badge>
          {status && (
            <span
              className={cn(
                'inline-flex h-5 items-center px-2 text-[10px] font-semibold uppercase',
                statusVariant(status),
              )}
            >
              {status}
            </span>
          )}
          {mpBadge && (
            <span
              className={cn(
                'inline-flex h-5 items-center px-2 text-[10px] font-semibold uppercase',
                mpBadge.classes,
              )}
            >
              {mpBadge.label}
            </span>
          )}
        </div>

        {/* Tags */}
        {tags && tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {tags.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="outline" className="text-[10px]">
                {tag}
              </Badge>
            ))}
            {tags.length > 2 && (
              <Badge variant="outline" className="text-[10px]">
                +{tags.length - 2}
              </Badge>
            )}
          </div>
        )}

        {/* Creator + date */}
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {creatorName && (
            <>
              <span className="truncate">{creatorName}</span>
              <span className="shrink-0">·</span>
            </>
          )}
          <span className="shrink-0">{formatDate(createdAt)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
