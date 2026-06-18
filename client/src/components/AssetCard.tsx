/**
 * AssetCard — reusable card for actor/look/fashion-item grids.
 * Shows thumbnail, name, tags, and hover action overlay.
 */
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type AssetCardType = 'actor' | 'look' | 'fashion-item';

interface AssetCardProps {
  id: string;
  name: string;
  type: AssetCardType;
  imageUrl: string | null;
  tags: string[];
  createdAt: string;
}

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

function detailPath(type: AssetCardType, id: string): string {
  if (type === 'actor') return `/actors/${id}`;
  if (type === 'look') return `/looks/${id}`;
  return `/fashion-items/${id}`;
}

export default function AssetCard({ id, name, type, imageUrl, tags, createdAt }: AssetCardProps) {
  const navigate = useNavigate();

  return (
    <Card
      className={cn(
        'group cursor-pointer overflow-hidden transition-colors hover:border-border-medium',
      )}
      onClick={() => navigate(detailPath(type, id))}
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            className="size-full object-cover transition-transform duration-200 group-hover:scale-105"
            loading="lazy"
            width={300}
            height={300}
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-muted">
            <span className="text-sm text-muted-foreground">No image</span>
          </div>
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
          <span className="text-sm font-medium text-white">View</span>
        </div>
      </div>
      <CardContent className="p-3">
        <h3 className="truncate text-sm font-semibold">{name}</h3>
        {tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[10px]">
                {tag}
              </Badge>
            ))}
            {tags.length > 3 && (
              <Badge variant="secondary" className="text-[10px]">
                +{tags.length - 3}
              </Badge>
            )}
          </div>
        )}
        <p className="mt-1.5 text-[11px] text-muted-foreground">{formatRelativeTime(createdAt)}</p>
      </CardContent>
    </Card>
  );
}
