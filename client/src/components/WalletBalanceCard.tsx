import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet } from 'lucide-react';
import LoadingState from '@/components/LoadingState';

interface WalletBalanceCardProps {
  balance: number | undefined;
  isLoading: boolean;
  isError: boolean;
  onTopUp: () => void;
}

export default function WalletBalanceCard({
  balance,
  isLoading,
  isError,
  onTopUp,
}: WalletBalanceCardProps) {
  return (
    <Card className="w-full sm:w-80">
      <CardHeader className="flex flex-row items-center gap-3 pb-2">
        <div className="flex size-10 items-center justify-center bg-primary/10">
          <Wallet className="size-5 text-primary" />
        </div>
        <div>
          <CardTitle className="text-base">Balance</CardTitle>
          <CardDescription>Available credits</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingState variant="list" count={1} />
        ) : isError ? (
          <div className="text-sm text-error">Failed to load balance</div>
        ) : (
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold">{balance?.toFixed(2) ?? '0.00'}</span>
            <span className="text-sm text-muted-foreground">credits</span>
          </div>
        )}
        <Button variant="outline" size="sm" className="mt-3" onClick={onTopUp}>
          Top Up
        </Button>
      </CardContent>
    </Card>
  );
}
