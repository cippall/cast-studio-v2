/**
 * WalletPage — Client wallet balance, top-up, and transaction history.
 */
import { useState } from 'react';
import { useWalletBalance, useWalletTransactions, useTopUpWallet } from '@/hooks/useWallet';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';

function formatCredits(amount: number): string {
  const sign = amount >= 0 ? '+' : '';
  return `${sign}${amount.toFixed(2)}`;
}

export default function WalletPage() {
  const { data: wallet, isLoading: loadingBalance } = useWalletBalance();
  const { data: txData, isLoading: loadingTx } = useWalletTransactions({ pageSize: 20 });
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

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">Wallet</h1>

      {/* Balance card */}
      <Card>
        <CardHeader>
          <CardTitle>Balance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingBalance ? (
            <Skeleton className="h-10 w-32" />
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold">
                {wallet?.balance_credits.toFixed(2) ?? '0.00'}
              </span>
              <span className="text-muted-foreground">credits</span>
            </div>
          )}
          <Button onClick={() => setShowTopUp(true)}>
            <Plus className="mr-2 size-4" />
            Top Up
          </Button>
        </CardContent>
      </Card>

      {/* Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingTx ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No transactions yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Amount</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className={tx.amount >= 0 ? 'text-emerald-600' : 'text-destructive'}>
                      {formatCredits(tx.amount)}
                    </TableCell>
                    <TableCell>{tx.type}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(tx.created_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
    </div>
  );
}
