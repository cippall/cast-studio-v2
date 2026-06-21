/**
 * MarketplacePage — Client-facing storefront.
 * Grid of listings with type/price filters, search, pagination, and Buy button.
 * Uses PageContainer + PageHeader + ProductCard.
 * Responsive: 1 col mobile, 2 col tablet, 3 col desktop, 4 col large.
 */
import { useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useMarketplace, usePurchaseListing } from '@/hooks/useMarketplace';
import { useWalletBalance } from '@/hooks/useWallet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ProductCard from '@/components/ProductCard';
import EmptyStateV2 from '@/components/EmptyStateV2';
import ErrorState from '@/components/ErrorState';
import LoadingState from '@/components/LoadingState';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useUIStore } from '@/store/ui-store';
import { ShoppingBag, Loader2 } from 'lucide-react';

const PAGE_SIZE = 12;

const LISTING_TYPE_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'ACTOR_PACKAGE', label: 'Actor Packages' },
  { value: 'LOOK', label: 'Looks' },
];

export default function MarketplacePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const page = Number(searchParams.get('page') ?? 1);
  const listingType = searchParams.get('type') ?? '';
  const [purchasingListing, setPurchasingListing] = useState<{
    id: string;
    name: string;
    price: number;
  } | null>(null);
  const addToast = useUIStore((s) => s.addToast);

  const filters = useMemo(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      listingType: listingType || undefined,
      sortBy: 'created_at',
      sortOrder: 'desc' as const,
    }),
    [page, listingType],
  );

  const { data, isLoading, isError, error } = useMarketplace(filters);
  const { data: wallet } = useWalletBalance();
  const balance = wallet?.balance_credits;
  const purchase = usePurchaseListing();

  const setType = (type: string) => {
    const next = new URLSearchParams(searchParams);
    if (type) {
      next.set('type', type);
    } else {
      next.delete('type');
    }
    next.delete('page');
    setSearchParams(next);
  };

  const setPage = (p: number) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(p));
    setSearchParams(next);
  };

  const listings = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;

  const handleBuy = (id: string) => {
    const listing = listings.find((l) => l.id === id);
    if (!listing) return;
    setPurchasingListing({ id, name: listing.asset.name, price: listing.price_credits });
  };

  const handleConfirmPurchase = () => {
    if (!purchasingListing) return;
    purchase.mutate(purchasingListing.id, {
      onSuccess: () => {
        addToast({
          title: 'Purchase complete',
          description: `"${purchasingListing.name}" has been added to your library.`,
        });
        setPurchasingListing(null);
        navigate(`/marketplace/${purchasingListing.id}`);
      },
      onError: (err) => {
        addToast({
          title: 'Purchase failed',
          description:
            err instanceof Error ? err.message : 'Something went wrong. Please try again.',
          variant: 'destructive',
        });
        setPurchasingListing(null);
      },
    });
  };

  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
        <PageHeader title="Marketplace">
          {balance !== undefined && (
            <Badge variant="secondary" className="text-sm">
              Balance: {balance.toFixed(2)} cr
            </Badge>
          )}
        </PageHeader>

        {/* Type filter tabs */}
        <div className="flex flex-wrap gap-2">
          {LISTING_TYPE_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant={listingType === opt.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setType(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <LoadingState variant="grid" count={8} />
        ) : isError ? (
          <ErrorState
            message={error instanceof Error ? error.message : undefined}
            onRetry={() => window.location.reload()}
          />
        ) : listings.length === 0 ? (
          <EmptyStateV2
            icon={<ShoppingBag className="size-8 text-muted-foreground" />}
            title="No listings available"
            description="Check back soon for new assets."
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {listings.map((listing) => (
                <ProductCard
                  key={listing.id}
                  id={listing.id}
                  name={listing.asset.name}
                  sellerName={listing.seller_name}
                  priceCredits={listing.price_credits}
                  listingType={listing.listing_type}
                  thumbnailUrl={
                    listing.listing_type === 'ACTOR_PACKAGE'
                      ? listing.asset.headshot_url
                      : listing.asset.image_url
                  }
                  balance={balance}
                  onBuy={handleBuy}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Quick-purchase confirmation dialog */}
      <Dialog
        open={purchasingListing !== null}
        onOpenChange={(open) => {
          if (!open && !purchase.isPending) {
            setPurchasingListing(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Purchase</DialogTitle>
            <DialogDescription>
              {purchasingListing && (
                <span>
                  Purchase <strong>{purchasingListing.name}</strong> for{' '}
                  <strong>{purchasingListing.price.toFixed(2)} cr</strong>?
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          {balance !== undefined && purchasingListing && (
            <div className="flex items-center justify-between border-t border-border pt-4 text-sm">
              <span className="text-muted-foreground">Your balance</span>
              <span className="font-medium">{balance.toFixed(2)} cr</span>
            </div>
          )}
          {balance !== undefined && purchasingListing && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">After purchase</span>
              <span className="font-medium">
                {(balance - purchasingListing.price).toFixed(2)} cr
              </span>
            </div>
          )}
          <DialogFooter showCloseButton={false}>
            <Button
              variant="outline"
              onClick={() => setPurchasingListing(null)}
              disabled={purchase.isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirmPurchase} disabled={purchase.isPending}>
              {purchase.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              {purchase.isPending ? 'Processing...' : 'Confirm Purchase'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
