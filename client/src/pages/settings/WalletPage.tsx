/**
 * WalletPage — Client wallet balance, top-up, and transaction history.
 * Uses PageContainer for responsive padding.
 * Transactions use DataTable (table on desktop, card list on mobile).
 */
import { useState } from 'react';
import {
  useWalletBalance,
  useWalletTransactions,
  useTopUpWallet,
  type LedgerEntry,
} from '@/hooks/useWallet';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { DataTable, type Column } from '@/components/DataTable';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';

function formatCredits(amount: number): string {
  const sign = amount >= 0 ? '+' : '';
  return `${sign}${amount.toFixed(2)}`;
}

export default function WalletPage() {
  const { data: wallet, isLoading: loadingBalance, isError: balanceError } = useWalletBalance();
  const {
    data: txData,
    isLoading: loadingTx,
    isError: txError,
    error: txErrorObj,
  } = useWalletTransactions({ pageSize: 20 });
  const topUp = useTopUpWallet();

  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('');

  const transactions = txData?.data ?? [];

  const handleTopUp = async () => {
    const amount = parseFloat(topUpAmount);
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    try {
      const result = await topUp.mutateAsync(amount);
      if (result.checkout_url) {
        window.location.href = result.checkout_url;
      }
      setShowTopUp(false);
      setTopUpAmount('');
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message ?? 'Failed to initiate top-up');
    }
  };

  const columns: Column<LedgerEntry>[] = [
    {
      key: 'amount',
      header: 'Amount',
      sortable: true,
      render: (row) => (
        <span className={row.amount >= 0 ? 'text-success' : 'text-destructive'}>
          {formatCredits(row.amount)}
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      sortable: true,
      render: (row) => row.type,
    },
    {
      key: 'created_at',
      header: 'Date',
      sortable: true,
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {new Date(row.created_at).toLocaleString()}
        </span>
      ),
    },
  ];

  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
        <PageHeader title="Wallet" description="Balance, top-up, and transaction history">
          <Button onClick={() => setShowTopUp(true)}>
            <Plus className="mr-2 size-4" />
            Top Up
          </Button>
        </PageHeader>

        {/* Balance card */}
        <Card>
          <CardHeader>
            <CardTitle>Balance</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingBalance ? (
              <Skeleton className="h-10 w-32" />
            ) : balanceError ? (
              <div className="text-sm text-error">Failed to load balance</div>
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold">
                  {wallet?.balance_credits.toFixed(2) ?? '0.00'}
                </span>
                <span className="text-muted-foreground">credits</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Transactions */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable<LedgerEntry>
              columns={columns}
              data={transactions}
              isLoading={loadingTx}
              isError={txError}
              error={txErrorObj instanceof Error ? txErrorObj : null}
              emptyTitle="No transactions"
              emptyDescription="No transactions yet."
              cardTitleKey="type"
            />
          </CardContent>
        </Card>
      </div>

      {/* Top-up dialog */}
      <Dialog open={showTopUp} onOpenChange={setShowTopUp}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Top Up Wallet</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="topupAmount">Amount (credits)</Label>
              <Input
                id="topupAmount"
                type="number"
                min="1"
                step="0.01"
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(e.target.value)}
                placeholder="100.00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTopUp(false)}>
              Cancel
            </Button>
            <Button onClick={handleTopUp} disabled={topUp.isPending}>
              {topUp.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                'Continue to Payment'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
