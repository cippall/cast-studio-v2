/**
 * MarketplacePage — Client-facing storefront.
 * Grid of listings with type/price filters, search, pagination, and Buy button.
 */
import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMarketplace } from '@/hooks/useMarketplace';
import { useWalletBalance } from '@/hooks/useWallet';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import EmptyStateV2 from '@/components/EmptyStateV2';
import ErrorState from '@/components/ErrorState';
import LoadingState from '@/components/LoadingState';
import { ShoppingBag } from 'lucide-react';

const PAGE_SIZE = 12;

const LISTING_TYPE_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'ACTOR_PACKAGE', label: 'Actor Packages' },
  { value: 'LOOK', label: 'Looks' },
];

function ListingCard({
  listing,
  balance,
  onBuy,
}: {
  listing: {
    id: string;
    listing_type: string;
    asset: { name: string; headshot_url: string | null; image_url: string | null };
    seller_name: string;
    price_credits: number;
  };
  balance: number | undefined;
  onBuy: (id: string) => void;
}) {
  const thumbnail =
    listing.listing_type === 'ACTOR_PACKAGE' ? listing.asset.headshot_url : listing.asset.image_url;
  const canAfford = balance !== undefined && balance >= listing.price_credits;

  return (
    <Card className="group overflow-hidden transition-colors hover:border-border-medium">
      <div className="relative aspect-square overflow-hidden bg-muted">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={listing.asset.name}
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
      </div>
      <CardContent className="p-3">
        <h3 className="truncate text-sm font-semibold">{listing.asset.name}</h3>
        <p className="text-xs text-muted-foreground">by {listing.seller_name}</p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-sm font-semibold">{listing.price_credits.toFixed(2)} cr</span>
          <Button
            size="sm"
            variant={canAfford ? 'default' : 'outline'}
            onClick={() => onBuy(listing.id)}
          >
            {canAfford ? 'Buy' : `Need ${(listing.price_credits - (balance ?? 0)).toFixed(2)} more`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MarketplacePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page') ?? 1);
  const listingType = searchParams.get('type') ?? '';

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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Marketplace</h1>
        {balance !== undefined && (
          <Badge variant="secondary" className="text-sm">
            Balance: {balance.toFixed(2)} cr
          </Badge>
        )}
      </div>

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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {listings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                balance={balance}
                onBuy={(id) => {
                  window.location.href = `/marketplace/${id}`;
                }}
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
  );
}
