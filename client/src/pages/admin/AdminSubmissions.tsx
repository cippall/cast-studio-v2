/**
 * AdminSubmissions — review queue for marketplace submissions.
 * Artists submit assets → Admin previews, approves (with price), or rejects.
 */
import { useState } from 'react';
import {
  useAdminSubmissions,
  useApproveSubmission,
  useRejectSubmission,
} from '@/hooks/useMarketplace';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import EmptyState from '@/components/EmptyState';
import { Check, Eye, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminSubmissions() {
  const [status, setStatus] = useState('MARKETPLACE_PENDING');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [approveId, setApproveId] = useState<string | null>(null);
  const [approvePrice, setApprovePrice] = useState('');

  const { data, isLoading } = useAdminSubmissions({ status, page: 1, pageSize: 20 });
  const approve = useApproveSubmission();
  const reject = useRejectSubmission();

  const submissions = data?.data ?? [];
  const pendingCount = status === 'MARKETPLACE_PENDING' ? submissions.length : 0;

  const preview = submissions.find((s) => s.asset_id === previewId);

  const handleApprove = async () => {
    if (!approveId || !approvePrice) return;
    try {
      await approve.mutateAsync({ assetId: approveId, priceCredits: parseFloat(approvePrice) });
      toast.success('Submission approved and listing created');
      setApproveId(null);
      setApprovePrice('');
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message ?? 'Failed to approve submission');
    }
  };

  const handleReject = async (assetId: string) => {
    try {
      await reject.mutateAsync(assetId);
      toast.success('Submission rejected');
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message ?? 'Failed to reject submission');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">Submissions</h1>

      <Tabs value={status} onValueChange={setStatus}>
        <TabsList>
          <TabsTrigger value="MARKETPLACE_PENDING">
            Pending {pendingCount > 0 && `(${pendingCount})`}
          </TabsTrigger>
          <TabsTrigger value="MARKETPLACE_APPROVED">Approved</TabsTrigger>
          <TabsTrigger value="MARKETPLACE_REJECTED">Rejected</TabsTrigger>
        </TabsList>

        <TabsContent value={status} className="mt-4">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : submissions.length === 0 ? (
            <EmptyState
              title="No submissions"
              description={`No ${status.replace('MARKETPLACE_', '').toLowerCase()} submissions.`}
            />
          ) : (
            <div className="space-y-3">
              {submissions.map((sub) => (
                <Card key={sub.asset_id}>
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{sub.asset_name}</span>
                        <Badge variant="outline">
                          {sub.asset_type === 'ACTOR' ? 'Actor Package' : 'Look'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        by {sub.creator_name ?? 'Unknown'}
                        {sub.submitted_at && ` • ${new Date(sub.submitted_at).toLocaleString()}`}
                      </p>
                    </div>

                    {status === 'MARKETPLACE_PENDING' && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPreviewId(sub.asset_id)}
                        >
                          <Eye className="mr-2 size-4" />
                          Preview
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            setApproveId(sub.asset_id);
                            setApprovePrice('');
                          }}
                        >
                          <Check className="mr-2 size-4" />
                          Approve
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleReject(sub.asset_id)}
                          disabled={reject.isPending}
                        >
                          <X className="mr-2 size-4" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Preview dialog */}
      <Dialog open={!!previewId} onOpenChange={() => setPreviewId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{preview?.asset_name}</DialogTitle>
          </DialogHeader>
          {preview?.outputs && (
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(preview.outputs).map(([key, output]) => (
                <div key={key} className="space-y-1">
                  <p className="text-sm font-medium capitalize">{key.replace('_', ' ')}</p>
                  {output.image_url ? (
                    <img src={output.image_url} alt={key} className="w-full rounded object-cover" />
                  ) : (
                    <div className="flex aspect-square items-center justify-center rounded bg-muted">
                      <span className="text-xs text-muted-foreground">No image</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approve dialog */}
      <Dialog open={!!approveId} onOpenChange={() => setApproveId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Listing</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Set the price for this listing. The asset will be frozen and listed on the
              marketplace.
            </p>
            <div className="space-y-2">
              <Label htmlFor="approvePrice">Price (credits)</Label>
              <Input
                id="approvePrice"
                type="number"
                min="0"
                step="0.01"
                value={approvePrice}
                onChange={(e) => setApprovePrice(e.target.value)}
                placeholder="10.00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveId(null)}>
              Cancel
            </Button>
            <Button onClick={handleApprove} disabled={approve.isPending || !approvePrice}>
              {approve.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                'Approve & List'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
