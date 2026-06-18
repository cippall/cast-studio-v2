/**
 * Dashboard — quick actions + recent activity + role-specific sections.
 * Client: wallet balance card.
 * Admin: stats row.
 */
import { useNavigate } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/useAuth';
import { useWalletBalance, useDashboardStats } from '@/hooks/useDashboard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import {
  User,
  Shirt,
  Image,
  MessageSquare,
  Wallet,
  Users,
  Layers,
  ShirtIcon,
  ClipboardList,
} from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: user } = useCurrentUser();
  const isClient = user?.role === 'CLIENT';
  const isAdmin = user?.role === 'ADMIN';

  const { data: wallet, isLoading: walletLoading } = useWalletBalance();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();

  const quickActions = [
    { label: 'New Actor', icon: User, path: '/actors/new' },
    { label: 'New Look', icon: Shirt, path: '/looks/new' },
    { label: 'New Item', icon: Image, path: '/fashion-items/new' },
  ];

  if (isClient) {
    quickActions.push({ label: 'New Commission', icon: MessageSquare, path: '/commissions/new' });
  }

  return (
    <PageContainer>
      <PageHeader title="Dashboard" description={`Welcome back, ${user?.name ?? 'User'}`} />

      <div className="mt-6 flex flex-col gap-6">
        {/* Quick Actions */}
        <div>
          <h2 className="mb-3 text-lg font-semibold">Quick Actions</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {quickActions.map((action) => (
              <Card
                key={action.path}
                className="cursor-pointer transition-colors hover:border-border-medium"
                onClick={() => navigate(action.path)}
              >
                <CardHeader className="flex flex-row items-center gap-3 pb-2">
                  <div className="flex size-10 items-center justify-center bg-primary/10">
                    <action.icon className="size-5 text-primary" />
                  </div>
                  <CardTitle className="text-base">{action.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>Create a new {action.label.toLowerCase()}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Client: Wallet Balance */}
        {isClient && (
          <div>
            <h2 className="mb-3 text-lg font-semibold">Wallet</h2>
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
                {walletLoading ? (
                  <Skeleton className="h-8 w-32" />
                ) : (
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">
                      {wallet?.balance?.toFixed(2) ?? '0.00'}
                    </span>
                    <span className="text-sm text-muted-foreground">credits</span>
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => navigate('/settings/wallet')}
                >
                  Top Up
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Admin: Stats */}
        {isAdmin && (
          <div>
            <h2 className="mb-3 text-lg font-semibold">Overview</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {[
                { label: 'Actors', icon: User, value: stats?.totalActors, loading: statsLoading },
                {
                  label: 'Looks',
                  icon: ShirtIcon,
                  value: stats?.totalLooks,
                  loading: statsLoading,
                },
                { label: 'Items', icon: Layers, value: stats?.totalItems, loading: statsLoading },
                {
                  label: 'Members',
                  icon: Users,
                  value: stats?.activeMembers,
                  loading: statsLoading,
                },
                {
                  label: 'Commissions',
                  icon: ClipboardList,
                  value: stats?.pendingCommissions,
                  loading: statsLoading,
                },
              ].map((stat) => (
                <Card key={stat.label}>
                  <CardHeader className="flex flex-row items-center gap-2 pb-2">
                    <stat.icon className="size-4 text-muted-foreground" />
                    <CardDescription className="text-xs">{stat.label}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {stat.loading ? (
                      <Skeleton className="h-6 w-12" />
                    ) : (
                      <span className="text-2xl font-bold">{stat.value ?? 0}</span>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Recent Activity */}
        <div>
          <h2 className="mb-3 text-lg font-semibold">Recent Activity</h2>
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <p className="text-sm text-muted-foreground">No recent activity yet.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
