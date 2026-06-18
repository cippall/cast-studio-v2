/**
 * PremiumUnlockDialog — confirmation dialog for commission premium unlock.
 * Shows cost, current balance, and balance after unlock.
 * Responsive: full-screen mobile, centered modal desktop.
 */
import { useState } from 'react';
import { useWalletBalance } from '@/hooks/useDashboard';
import { useUpdateCommissionStatus } from '@/hooks/useCommissions';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Wallet, AlertTriangle, CheckCircle } from 'lucide-react';

interface PremiumUnlockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commissionId: string;
  premiumCost: number;
  onApproved?: () => void;
}

export default function PremiumUnlockDialog({
  open,
  onOpenChange,
  commissionId,
  premiumCost,
  onApproved,
}: PremiumUnlockDialogProps) {
  const { data: wallet, isLoading: walletLoading } = useWalletBalance();
  const updateStatus = useUpdateCommissionStatus();
  const [error, setError] = useState<string | null>(null);

  const balance = wallet?.balance ?? 0;
  const balanceAfter = balance - premiumCost;
  const hasSufficientBalance = balanceAfter >= 0;

  const handleApprove = async () => {
    setError(null);
    try {
      await updateStatus.mutateAsync({
        id: commissionId,
        status: 'APPROVED',
      });
      onOpenChange(false);
      onApproved?.();
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setError(errorObj.message ?? 'Failed to approve commission. Please try again.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Full-screen on mobile, centered modal on desktop */}
      <DialogContent className="max-h-full max-w-full gap-0 rounded-none border-0 p-0 sm:max-h-[90vh] sm:max-w-lg sm:rounded-md sm:border sm:p-6">
        {/* Header */}
        <div className="flex-shrink-0 px-4 pt-4 sm:px-0 sm:pt-0">
          <DialogHeader>
            <DialogTitle>Approve & Unlock Commission</DialogTitle>
            <DialogDescription>
              Approving this commission will deduct the premium cost from your wallet and transfer
              asset ownership to you.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-0 sm:py-0">
          <div className="flex flex-col gap-4">
            {/* Cost breakdown */}
            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Premium Cost</span>
                <span className="text-lg font-semibold">{premiumCost.toFixed(2)} credits</span>
              </div>
              <div className="mt-3 border-t pt-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Current Balance</span>
                  {walletLoading ? (
                    <Skeleton className="h-4 w-16" />
                  ) : (
                    <span>{balance.toFixed(2)} credits</span>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Balance After</span>
                  <span
                    className={
                      hasSufficientBalance ? 'font-medium' : 'font-medium text-destructive'
                    }
                  >
                    {balanceAfter.toFixed(2)} credits
                  </span>
                </div>
              </div>
            </div>

            {/* Insufficient balance warning */}
            {!hasSufficientBalance && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <div className="text-sm text-destructive">
                  <p className="font-medium">Insufficient balance</p>
                  <p className="mt-0.5">
                    You need {(premiumCost - balance).toFixed(2)} more credits. Please top up your
                    wallet first.
                  </p>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t px-4 py-3 sm:border-t-0 sm:px-0 sm:py-0 sm:pt-4">
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={!hasSufficientBalance || updateStatus.isPending}
              className="w-full sm:w-auto"
            >
              <CheckCircle className="mr-1 size-4" />
              {updateStatus.isPending ? 'Processing...' : 'Approve & Unlock'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
