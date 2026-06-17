/**
 * MarketplaceManage — Artist/Admin marketplace listing management.
 * Table of listings with price editing, active toggle, and delete.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMarketplaceManage, useUpdateListing, useDeleteListing } from '@/hooks/useMarketplace';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import EmptyState from '@/components/EmptyState';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function MarketplaceManage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filters = {
    page: 1,
    pageSize: 20,
    ...(statusFilter ? { isActive: statusFilter === 'active' } : {}),
  };

  const { data, isLoading } = useMarketplaceManage(filters);
  const updateListing = useUpdateListing();
  const deleteListing = useDeleteListing();

  const listings = data?.data ?? [];

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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Marketplace Management</h1>
        <Button onClick={() => navigate('/marketplace/manage/new')}>
          <Plus className="mr-2 size-4" />
          New Listing
        </Button>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
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

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : listings.length === 0 ? (
        <EmptyState
          title="No listings yet"
          description="Create your first marketplace listing to start selling assets."
          actionLabel="New Listing"
          actionPath="/marketplace/manage/new"
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asset</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-32">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listings.map((listing) => (
              <TableRow key={listing.id}>
                <TableCell className="font-medium">{listing.asset.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {listing.listing_type === 'ACTOR_PACKAGE' ? 'Actor' : 'Look'}
                  </Badge>
                </TableCell>
                <TableCell>{listing.price_credits.toFixed(2)} cr</TableCell>
                <TableCell>
                  <Badge variant={listing.is_active ? 'default' : 'outline'}>
                    {listing.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(listing.id, listing.is_active)}
                    >
                      {listing.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteId(listing.id)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

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
            <Button variant="destructive" onClick={handleDelete} disabled={deleteListing.isPending}>
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
  );
}
