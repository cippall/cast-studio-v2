/**
 * Commission Detail page — full commission view with brief, submitted work,
 * role-specific actions (Approve/Changes for Client, Submit Work for Artist, Assign for Admin).
 * Uses PageContainer.
 * Responsive: stacked mobile, 2-column desktop (main content + sidebar actions).
 */
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/useAuth';
import { useCommission, useUpdateCommissionStatus } from '@/hooks/useCommissions';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ArrowLeft, Send, Clock, Wallet, AlertCircle } from 'lucide-react';
import BriefSection from '@/pages/commissions/BriefSection';
import ClientActions from '@/pages/commissions/ClientActions';
import ArtistActions from '@/pages/commissions/ArtistActions';
import AdminActions from '@/pages/commissions/AdminActions';
import PremiumUnlockDialog from '@/pages/commissions/PremiumUnlockDialog';
import PageContainer from '@/components/layout/PageContainer';

function statusColor(status: string): string {
  switch (status) {
    case 'REQUESTED':
      return 'bg-warning/10 text-warning border border-warning/20';
    case 'ASSIGNED':
      return 'bg-secondary text-secondary-foreground border border-border';
    case 'IN_PROGRESS':
      return 'bg-primary/10 text-primary border border-primary/20';
    case 'SUBMITTED':
      return 'bg-primary/5 text-foreground border border-border';
    case 'CHANGES_REQUESTED':
      return 'bg-warning/10 text-warning border border-warning/20';
    case 'APPROVED':
      return 'bg-success/10 text-success border border-success/20';
    case 'CANCELLED':
      return 'bg-muted text-muted-foreground border border-border';
    default:
      return 'bg-muted text-muted-foreground border border-border';
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface CommissionDetailData {
  id: string;
  title: string;
  status: string;
  client_id: string;
  assignee_id?: string;
  brief: Record<string, unknown>;
  premium_cost?: number;
  submitted_at?: string;
  created_at: string;
  updated_at?: string;
  assets?: Array<{ id: string; asset_id: string; asset_output_id?: string }>;
}

export default function CommissionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: user } = useCurrentUser();
  const role = user?.role ?? 'ARTIST';

  const { data: commission, isLoading, error } = useCommission(id ?? '');
  const updateStatus = useUpdateCommissionStatus();

  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showChangesDialog, setShowChangesDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/commissions')}>
              <ArrowLeft className="size-4" />
            </Button>
            <Skeleton className="h-8 w-48" />
          </div>
          <Card>
            <CardContent className="space-y-4 py-6">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    );
  }

  if (error || !commission) {
    return (
      <PageContainer>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/commissions')}>
              <ArrowLeft className="size-4" />
            </Button>
            <h1 className="font-heading text-2xl font-bold tracking-tight">Commission</h1>
          </div>
          <Card>
            <CardContent className="flex items-center gap-2 py-8 text-destructive">
              <AlertCircle className="size-4" />
              <span className="text-sm">Failed to load commission details.</span>
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    );
  }

  const detail = commission as CommissionDetailData;
  const isClient = role === 'CLIENT';
  const isArtist = role === 'ARTIST';
  const isAdmin = role === 'ADMIN';

  const handleStatusChange = async (status: string) => {
    setActionError(null);
    try {
      await updateStatus.mutateAsync({ id: detail.id, status });
      if (status === 'CHANGES_REQUESTED') {
        setShowChangesDialog(false);
      }
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setActionError(errorObj.message ?? 'Failed to update status.');
    }
  };

  return (
    <PageContainer>
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        {/* Back + Title */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/commissions')}>
            <ArrowLeft className="size-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate font-heading text-2xl font-bold tracking-tight">
                {detail.title}
              </h1>
              <Badge className={statusColor(detail.status)}>
                {detail.status.replace(/_/g, ' ')}
              </Badge>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="size-3" />
                Created {formatDate(detail.created_at)}
              </span>
              {detail.submitted_at && (
                <span className="flex items-center gap-1">
                  <Send className="size-3" />
                  Submitted {formatDate(detail.submitted_at)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Error banner */}
        {actionError && (
          <Card className="border-destructive">
            <CardContent className="flex items-center gap-2 py-3 text-sm text-destructive">
              <AlertCircle className="size-4" />
              {actionError}
            </CardContent>
          </Card>
        )}

        {/* Premium cost banner */}
        {detail.premium_cost != null && detail.premium_cost > 0 && (
          <Card>
            <CardContent className="flex items-center gap-3 py-3">
              <Wallet className="size-4 text-muted-foreground" />
              <span className="text-sm">
                Premium Cost:{' '}
                <span className="font-semibold">{detail.premium_cost.toFixed(2)} credits</span>
              </span>
            </CardContent>
          </Card>
        )}

        {/* Main content + sidebar: stacked mobile, 2-col desktop */}
        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Main column */}
          <div className="min-w-0 flex-1">
            <BriefSection brief={detail.brief} />
          </div>

          {/* Sidebar actions */}
          <div className="flex flex-col gap-4 lg:w-80 lg:shrink-0">
            {isClient && (
              <ClientActions
                commission={detail}
                onApprove={() => setShowApproveDialog(true)}
                onChanges={() => setShowChangesDialog(true)}
              />
            )}
            {isArtist && (
              <ArtistActions
                commission={detail}
                onStartProgress={() => handleStatusChange('IN_PROGRESS')}
                onSubmitWork={() => handleStatusChange('SUBMITTED')}
                pending={updateStatus.isPending}
              />
            )}
            {isAdmin && (
              <AdminActions commission={detail} onAssign={() => setShowAssignDialog(true)} />
            )}
          </div>
        </div>

        {/* Premium Unlock Dialog */}
        <PremiumUnlockDialog
          open={showApproveDialog}
          onOpenChange={setShowApproveDialog}
          commissionId={detail.id}
          premiumCost={detail.premium_cost ?? 0}
          onApproved={() => navigate('/commissions')}
        />

        {/* Request Changes Dialog */}
        <Dialog open={showChangesDialog} onOpenChange={setShowChangesDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Request Changes</DialogTitle>
            </DialogHeader>
            <p className="py-2 text-sm text-muted-foreground">
              This will send the commission back to the artist for revisions. Continue?
            </p>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setShowChangesDialog(false)}>
                Cancel
              </Button>
              <Button
                variant="default"
                onClick={() => handleStatusChange('CHANGES_REQUESTED')}
                disabled={updateStatus.isPending}
              >
                Request Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Assign Dialog */}
        <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Assign Commission</DialogTitle>
            </DialogHeader>
            <p className="py-2 text-sm text-muted-foreground">
              In production, this would show a list of available artists. For now, use the admin API
              directly.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAssignDialog(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageContainer>
  );
}
