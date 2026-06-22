/**
 * MarketplaceManage — Artist/Admin marketplace listing management.
 * Uses DataTable (sortable, paginated, card list on mobile) instead of raw Table.
 * PageContainer + PageHeader for consistent layout.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMarketplaceManage, useUpdateListing, useDeleteListing } from '@/hooks/useMarketplace';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable } from '@/components/DataTable';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface ListingRow {
  id: string;
  asset_name: string;
  listing_type: string;
  price_credits: number;
  is_active: boolean;
}

export default function MarketplaceManage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filters = {
    page: 1,
    pageSize: 20,
    ...(statusFilter ? { isActive: statusFilter === 'active' } : {}),
  };

  const { data, isLoading, isError, error } = useMarketplaceManage(filters);
  const updateListing = useUpdateListing();
  const deleteListing = useDeleteListing();

  const listings: ListingRow[] = (data?.data ?? []).map((l) => ({
    id: l.id,
    asset_name: l.asset.name,
    listing_type: l.listing_type,
    price_credits: l.price_credits,
    is_active: l.is_active,
  }));

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      await updateListing.mutateAsync({ id, isActive: !currentActive });
      toast.success(currentActive ? 'Listing deactivated' : 'Listing activated');
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message ?? 'Failed to update listing');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteListing.mutateAsync(deleteId);
      toast.success('Listing deleted');
      setDeleteId(null);
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message ?? 'Failed to delete listing');
    }
  };

  const columns = [
    {
      key: 'asset_name',
      header: 'Asset',
      sortable: false,
      render: (row: ListingRow) => <span className="font-medium">{row.asset_name}</span>,
    },
    {
      key: 'listing_type',
      header: 'Type',
      sortable: false,
      render: (row: ListingRow) => (
        <Badge variant="secondary">
          {row.listing_type === 'ACTOR_PACKAGE'
            ? 'Actor'
            : row.listing_type === 'FASHION_ITEM'
              ? 'Fashion Item'
              : 'Look'}
        </Badge>
      ),
    },
    {
      key: 'price_credits',
      header: 'Price',
      sortable: false,
      render: (row: ListingRow) => `${row.price_credits.toFixed(2)} cr`,
    },
    {
      key: 'is_active',
      header: 'Status',
      sortable: false,
      render: (row: ListingRow) => (
        <Badge variant={row.is_active ? 'default' : 'outline'}>
          {row.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
  ];

  const rowActions = (row: ListingRow) => [
    <Button
      key="toggle"
      variant="ghost"
      size="sm"
      onClick={() => handleToggleActive(row.id, row.is_active)}
    >
      {row.is_active ? 'Deactivate' : 'Activate'}
    </Button>,
    <Button key="delete" variant="ghost" size="sm" onClick={() => setDeleteId(row.id)}>
      <Trash2 className="size-4 text-destructive" />
    </Button>,
  ];

  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
        <PageHeader title="Marketplace Management">
          <Button onClick={() => navigate('/marketplace/manage/new')}>
            <Plus className="mr-2 size-4" />
            New Listing
          </Button>
        </PageHeader>

        {/* Filter */}
        <div className="flex flex-wrap gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DataTable<ListingRow>
          columns={columns}
          data={listings}
          isLoading={isLoading}
          isError={isError}
          error={error instanceof Error ? error : null}
          emptyTitle="No listings yet"
          emptyDescription="Create your first marketplace listing to start selling assets."
          rowActions={rowActions}
          cardTitleKey="asset_name"
        />

        {/* Delete confirmation */}
        <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Listing</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this listing? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteId(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteListing.isPending}
              >
                {deleteListing.isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  'Delete'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageContainer>
  );
}
