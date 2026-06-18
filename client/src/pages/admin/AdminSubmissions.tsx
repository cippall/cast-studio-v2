/**
 * AdminSubmissions — review queue for marketplace submissions.
 * Artists submit assets → Admin previews, approves (with price), or rejects.
 * Uses DataTable for desktop table + mobile card list with status filter tabs.
 */
import { useState } from 'react';
import {
  useAdminSubmissions,
  useApproveSubmission,
  useRejectSubmission,
  type MarketplaceSubmission,
} from '@/hooks/useMarketplace';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable, type Column } from '@/components/DataTable';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import { Check, Eye, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_TABS = [
  { value: 'MARKETPLACE_PENDING', label: 'Pending' },
  { value: 'MARKETPLACE_APPROVED', label: 'Approved' },
  { value: 'MARKETPLACE_REJECTED', label: 'Rejected' },
];

export default function AdminSubmissions() {
  const [status, setStatus] = useState('MARKETPLACE_PENDING');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [approveId, setApproveId] = useState<string | null>(null);
  const [approvePrice, setApprovePrice] = useState('');

  const { data, isLoading } = useAdminSubmissions({ status, page: 1, pageSize: 20 });
  const approve = useApproveSubmission();
  const reject = useRejectSubmission();

  const submissions = data?.data ?? [];

  // DataTable requires { id: string }; map asset_id → id
  const tableData = submissions.map((s) => ({ ...s, id: s.asset_id }));

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

  const columns: Column<MarketplaceSubmission & { id: string }>[] = [
    {
      key: 'asset_name',
      header: 'Asset',
      sortable: false,
      render: (row) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">{row.asset_name}</span>
          {row.creator_name && (
            <span className="text-xs text-muted-foreground">by {row.creator_name}</span>
          )}
        </div>
      ),
    },
    {
      key: 'asset_type',
      header: 'Type',
      sortable: false,
      render: (row) => (
        <Badge variant="outline">{row.asset_type === 'ACTOR' ? 'Actor Package' : 'Look'}</Badge>
      ),
    },
    {
      key: 'submitted_at',
      header: 'Submitted',
      sortable: false,
      render: (row) =>
        row.submitted_at
          ? new Date(row.submitted_at).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })
          : '—',
    },
  ];

  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
        <PageHeader title="Submissions" description="Review and manage marketplace submissions" />

        <Tabs value={status} onValueChange={setStatus}>
          <TabsList>
            {STATUS_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
                {tab.value === 'MARKETPLACE_PENDING' && submissions.length > 0 && (
                  <span className="ml-1">({submissions.length})</span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {STATUS_TABS.map((tab) => (
            <TabsContent key={tab.value} value={tab.value} className="mt-4">
              <DataTable<MarketplaceSubmission & { id: string }>
                columns={columns}
                data={status === tab.value ? tableData : []}
                isLoading={isLoading && status === tab.value}
                emptyTitle="No submissions"
                emptyDescription={`No ${tab.label.toLowerCase()} submissions.`}
                cardTitleKey="asset_name"
                rowActions={
                  status === 'MARKETPLACE_PENDING'
                    ? (row) => [
                        <button
                          key="preview"
                          className="flex w-full cursor-pointer items-center gap-2 px-2 py-1.5 text-sm"
                          onClick={() => setPreviewId(row.asset_id)}
                        >
                          <Eye className="size-4" />
                          Preview
                        </button>,
                        <button
                          key="approve"
                          className="flex w-full cursor-pointer items-center gap-2 px-2 py-1.5 text-sm"
                          onClick={() => {
                            setApproveId(row.asset_id);
                            setApprovePrice('');
                          }}
                        >
                          <Check className="size-4" />
                          Approve
                        </button>,
                        <button
                          key="reject"
                          className="flex w-full cursor-pointer items-center gap-2 px-2 py-1.5 text-sm text-destructive"
                          onClick={() => handleReject(row.asset_id)}
                        >
                          <X className="size-4" />
                          Reject
                        </button>,
                      ]
                    : undefined
                }
              />
            </TabsContent>
          ))}
        </Tabs>

        {/* Preview dialog */}
        <Dialog open={!!previewId} onOpenChange={() => setPreviewId(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{preview?.asset_name}</DialogTitle>
            </DialogHeader>
            {preview?.outputs && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {Object.entries(preview.outputs).map(([key, output]) => (
                  <div key={key} className="space-y-1">
                    <p className="text-sm font-medium capitalize">{key.replace('_', ' ')}</p>
                    {output.image_url ? (
                      <img
                        src={output.image_url}
                        alt={key}
                        className="w-full object-cover"
                        width={200}
                        height={200}
                      />
                    ) : (
                      <div className="flex aspect-square items-center justify-center border border-border bg-surface">
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
    </PageContainer>
  );
}
