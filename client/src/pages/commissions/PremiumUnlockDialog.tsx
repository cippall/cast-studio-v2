/**
 * PremiumUnlockDialog — confirmation dialog for commission premium unlock.
 * Shows cost, current balance, and balance after unlock.
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Approve & Unlock Commission</DialogTitle>
          <DialogDescription>
            Approving this commission will deduct the premium cost from your wallet and transfer
            asset ownership to you.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
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
                  className={hasSufficientBalance ? 'font-medium' : 'font-medium text-destructive'}
                >
                  {balanceAfter.toFixed(2)} credits
                </span>
              </div>
            </div>
          </div>

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

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleApprove}
            disabled={!hasSufficientBalance || updateStatus.isPending}
          >
            <CheckCircle className="mr-1 size-4" />
            {updateStatus.isPending ? 'Processing...' : 'Approve & Unlock'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
