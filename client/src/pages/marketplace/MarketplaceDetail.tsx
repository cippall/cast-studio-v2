/**
 * MarketplaceDetail — single listing view with all output images,
 * seller info, price, purchase confirmation dialog.
 */
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMarketplaceDetail, usePurchaseListing } from '@/hooks/useMarketplace';
import { useWalletBalance } from '@/hooks/useWallet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ImageIcon, Loader2, ShoppingBag, Wallet } from 'lucide-react';
import { toast } from 'sonner';

export default function MarketplaceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showPurchase, setShowPurchase] = useState(false);

  const { data: listing, isLoading } = useMarketplaceDetail(id ?? '');
  const { data: wallet } = useWalletBalance();
  const purchase = usePurchaseListing();

  const balance = wallet?.balance_credits ?? 0;
  const price = listing?.price_credits ?? 0;
  const canAfford = balance >= price;

  const handlePurchase = async () => {
    if (!id) return;
    try {
      await purchase.mutateAsync(id);
      setShowPurchase(false);
      toast.success('Purchase complete! Assets added to your library.');
      navigate('/actors');
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message ?? 'Purchase failed. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="flex flex-col items-center py-24 text-center">
        <p className="text-muted-foreground">Listing not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/marketplace')}>
          Back to Marketplace
        </Button>
      </div>
    );
  }

  const isActorPackage = listing.listing_type === 'ACTOR_PACKAGE';
  const asset = listing.asset;

  const outputImages: Array<{ label: string; url: string | null }> = isActorPackage
    ? [
        { label: 'Headshot', url: asset.headshot_url },
        { label: 'Fullshot', url: asset.fullshot_url },
        { label: 'Expression Sheet', url: asset.expression_sheet_url },
        { label: 'Character Sheet', url: asset.character_sheet_url },
        ...(asset.editorial_urls?.map((url, i) => ({
          label: `Editorial ${i + 1}`,
          url,
        })) ?? []),
      ]
    : [{ label: 'Image', url: asset.image_url }];

  const validImages = outputImages.filter((img) => img.url);

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('/marketplace')} className="pl-0">
        ← Back to Marketplace
      </Button>

      <div className="flex flex-col gap-8 md:flex-row">
        {/* Image gallery */}
        <div className="flex-1 space-y-4">
          {validImages.length > 0 ? (
            <>
              {/* Main image */}
              {validImages[0]?.url && (
                <img
                  src={validImages[0].url}
                  alt={validImages[0].label}
                  className="w-full rounded-lg object-cover"
                />
              )}
              {/* Thumbnails */}
              {validImages.length > 1 && (
                <div className="grid grid-cols-4 gap-2">
                  {validImages
                    .slice(1)
                    .map((img, i) =>
                      img.url ? (
                        <img
                          key={i}
                          src={img.url}
                          alt={img.label}
                          className="aspect-square w-full rounded object-cover"
                        />
                      ) : null,
                    )}
                </div>
              )}
            </>
          ) : (
            <div className="flex aspect-square items-center justify-center rounded-lg bg-muted">
              <ImageIcon className="size-16 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Purchase panel */}
        <div className="space-y-6 md:w-80">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{asset.name}</h1>
            <p className="text-sm text-muted-foreground">by {listing.seller.name}</p>
            {isActorPackage && (
              <div className="mt-2">
                <Badge variant="secondary">Actor Package</Badge>
              </div>
            )}
          </div>

          <div className="rounded-lg border p-4 space-y-4">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-bold">{price.toFixed(2)}</span>
              <span className="text-muted-foreground">credits</span>
            </div>

            <div className="text-sm text-muted-foreground">
              Your balance: {balance.toFixed(2)} cr
            </div>

            {canAfford ? (
              <Button className="w-full" size="lg" onClick={() => setShowPurchase(true)}>
                <ShoppingBag className="mr-2 size-4" />
                Buy for {price.toFixed(2)} cr
              </Button>
            ) : (
              <div className="space-y-2">
                <Button className="w-full" size="lg" disabled variant="outline">
                  <Wallet className="mr-2 size-4" />
                  Insufficient credits (need {(price - balance).toFixed(2)} more)
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => navigate('/settings/wallet')}
                >
                  Top Up Wallet
                </Button>
              </div>
            )}
          </div>

          {/* Package contents */}
          {isActorPackage && (
            <div className="rounded-lg border p-4">
              <h3 className="mb-2 text-sm font-semibold">Package includes:</h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {validImages.map((img) => (
                  <li key={img.label} className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-primary" />
                    {img.label}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Purchase confirmation dialog */}
      <Dialog open={showPurchase} onOpenChange={setShowPurchase}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Purchase</DialogTitle>
            <DialogDescription>
              Purchase "{asset.name}" for {price.toFixed(2)} credits?
              <br />
              Your balance after: {(balance - price).toFixed(2)} cr
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPurchase(false)}
              disabled={purchase.isPending}
            >
              Cancel
            </Button>
            <Button onClick={handlePurchase} disabled={purchase.isPending}>
              {purchase.isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Confirm Purchase'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
