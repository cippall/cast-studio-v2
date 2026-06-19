/**
 * ProductCard — reusable card for marketplace listings.
 * AspectRatio image, name, seller, price, type badge, Buy button with
 * disabled state + Tooltip. Hover border change, clickable to detail page.
 */
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { cn } from '@/lib/utils';

interface ProductCardProps {
  id: string;
  name: string;
  sellerName: string;
  priceCredits: number;
  listingType: string;
  thumbnailUrl: string | null;
  balance: number | undefined;
  onBuy: (id: string) => void;
}

const TYPE_LABELS: Record<string, string> = {
  ACTOR_PACKAGE: 'Actor Package',
  LOOK: 'Look',
  FASHION_ITEM: 'Fashion Item',
};

export default function ProductCard({
  id,
  name,
  sellerName,
  priceCredits,
  listingType,
  thumbnailUrl,
  balance,
  onBuy,
}: ProductCardProps) {
  const navigate = useNavigate();
  const canAfford = balance !== undefined && balance >= priceCredits;
  const typeLabel = TYPE_LABELS[listingType] ?? listingType;

  return (
    <Card
      className={cn('group cursor-pointer overflow-hidden transition-colors hover:border-border')}
      onClick={() => navigate(`/marketplace/${id}`)}
    >
      <AspectRatio ratio={1} className="bg-muted">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={name}
            className="size-full object-cover transition-transform duration-200 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <span className="text-sm text-muted-foreground">No image</span>
          </div>
        )}
      </AspectRatio>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate text-sm font-semibold">{name}</h3>
          <Badge variant="secondary" className="shrink-0 text-[10px]">
            {typeLabel}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">by {sellerName}</p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold">{priceCredits.toFixed(2)} cr</span>
          {canAfford ? (
            <Button
              size="sm"
              variant="default"
              onClick={(e) => {
                e.stopPropagation();
                onBuy(id);
              }}
            >
              Buy
            </Button>
          ) : (
            <Tooltip>
              <TooltipTrigger
                render={(props) => (
                  <span {...props}>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled
                      onClick={(e) => e.stopPropagation()}
                    >
                      {balance !== undefined
                        ? `Need ${(priceCredits - balance).toFixed(2)} more`
                        : 'Buy'}
                    </Button>
                  </span>
                )}
              />
              <TooltipContent>
                {balance !== undefined
                  ? `Insufficient balance. You have ${balance.toFixed(2)} cr but need ${priceCredits.toFixed(2)} cr.`
                  : 'Wallet balance not loaded.'}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
