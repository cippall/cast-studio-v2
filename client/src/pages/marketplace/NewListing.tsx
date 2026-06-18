/**
 * NewListing — form for Artists to create a new marketplace listing.
 * Select asset, set price, and submit.
 * Responsive: single column mobile, 2-column desktop.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateListing } from '@/hooks/useMarketplace';
import { useActors } from '@/hooks/useActors';
import { useLooks } from '@/hooks/useLooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function NewListing() {
  const navigate = useNavigate();
  const createListing = useCreateListing();

  const [listingType, setListingType] = useState<string | null>(null);
  const [assetId, setAssetId] = useState<string | null>(null);
  const [price, setPrice] = useState<string>('');

  const { data: actorsData } = useActors({ pageSize: 100 });
  const { data: looksData } = useLooks({ pageSize: 100 });

  const assets =
    listingType === 'ACTOR_PACKAGE' ? (actorsData?.data ?? []) : (looksData?.data ?? []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!listingType || !assetId || !price) {
      toast.error('Please fill in all fields');
      return;
    }
    try {
      await createListing.mutateAsync({
        assetId,
        listingType,
        priceCredits: parseFloat(price),
      });
      toast.success('Listing created successfully');
      navigate('/marketplace/manage');
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message ?? 'Failed to create listing');
    }
  };

  return (
    <PageContainer>
      <div className="mx-auto max-w-2xl space-y-6">
        <PageHeader title="New Listing" />

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 2-column grid on desktop for type + price */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="listingType">Listing Type</Label>
              <Select
                value={listingType}
                onValueChange={(v) => {
                  setListingType(v);
                  setAssetId(null);
                }}
              >
                <SelectTrigger id="listingType">
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTOR_PACKAGE">Actor Package</SelectItem>
                  <SelectItem value="LOOK">Look</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">Price (credits)</Label>
              <Input
                id="price"
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="10.00"
              />
            </div>
          </div>

          {listingType && (
            <div className="space-y-2">
              <Label htmlFor="asset">Asset</Label>
              <Select value={assetId} onValueChange={setAssetId}>
                <SelectTrigger id="asset">
                  <SelectValue placeholder="Select asset..." />
                </SelectTrigger>
                <SelectContent>
                  {assets.map((asset) => (
                    <SelectItem key={asset.id} value={asset.id}>
                      {asset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={createListing.isPending}>
              {createListing.isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Listing'
              )}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate('/marketplace/manage')}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </PageContainer>
  );
}
