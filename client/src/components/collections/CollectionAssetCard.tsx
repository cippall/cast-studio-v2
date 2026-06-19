/**
 * CollectionAssetCard — displays a single asset within a collection.
 * Shows image, name, type badge, marketplace badge, and remove button.
 */
import { X, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { CollectionItemWithAsset } from '@cast/types';

function assetTypeLabel(type: string): string {
  if (type === 'ACTOR') return 'Actor';
  if (type === 'LOOK') return 'Look';
  if (type === 'FASHION_ITEM') return 'Fashion Item';
  return type;
}

interface CollectionAssetCardProps {
  item: CollectionItemWithAsset;
  onRemove: () => void;
  onNavigate: () => void;
}

export default function CollectionAssetCard({
  item,
  onRemove,
  onNavigate,
}: CollectionAssetCardProps) {
  const asset = item.asset;

  if (!asset) {
    return (
      <div className="border border-border bg-background p-4">
        <p className="text-sm text-muted-foreground">Asset unavailable</p>
        <Button size="sm" variant="ghost" onClick={onRemove} className="mt-2">
          <X className="mr-1 size-3" />
          Remove
        </Button>
      </div>
    );
  }

  const imageUrl = asset.headshot_url ?? asset.image_url;
  const isMarketplace = item.asset_type.startsWith('MARKETPLACE');

  return (
    <div className="group relative border border-border bg-background">
      <button
        type="button"
        onClick={onNavigate}
        className="w-full text-left focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
      >
        <div className="aspect-square w-full overflow-hidden bg-muted">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={asset.name}
              className="size-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex size-full items-center justify-center">
              <span className="text-xs text-muted-foreground">No image</span>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1.5 p-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-sm font-medium text-foreground">{asset.name}</h3>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="text-[10px] font-medium">
              {assetTypeLabel(item.asset_type)}
            </Badge>
            {isMarketplace && (
              <Badge variant="outline" className="flex items-center gap-1 text-[10px]">
                <ShoppingBag className="size-2.5" />
                Marketplace
              </Badge>
            )}
          </div>
        </div>
      </button>
      <Button
        size="sm"
        variant="ghost"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="absolute right-2 top-2 size-7 p-0 opacity-0 transition-opacity group-hover:opacity-100 bg-background/80 hover:bg-background"
        aria-label="Remove from collection"
      >
        <X className="size-3.5" />
      </Button>
    </div>
  );
}
