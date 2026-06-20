/**
 * Dashboard — quick actions + recent activity + role-specific sections.
 */
import { useNavigate } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/useAuth';
import { useWalletBalance, useDashboardStats } from '@/hooks/useDashboard';
import { useActivityFeed } from '@/hooks/useActivityFeed';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import StatCard from '@/components/StatCard';
import EmptyStateV2 from '@/components/EmptyStateV2';
import LoadingState from '@/components/LoadingState';
import { Skeleton } from '@/components/ui/skeleton';
import type { DashboardStats, ArtistDashboard, ClientDashboard } from '@cast/types';
import {
  User,
  Shirt,
  Image,
  MessageSquare,
  Users,
  Layers,
  ClipboardList,
  Inbox,
  Folder,
  Store,
} from 'lucide-react';
import ActivityCard from '@/components/ActivityCard';
import WalletBalanceCard from '@/components/WalletBalanceCard';

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: user } = useCurrentUser();
  const isClient = user?.role === 'CLIENT';
  const isAdmin = user?.role === 'ADMIN';
  const isArtist = user?.role === 'ARTIST';

  const { data: wallet, isLoading: walletLoading, isError: walletError } = useWalletBalance();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: activities, isLoading: activitiesLoading } = useActivityFeed(8);

  const adminStats = isAdmin && stats && 'totalActors' in stats ? (stats as DashboardStats) : null;
  const artistStats = isArtist && stats && 'myActors' in stats ? (stats as ArtistDashboard) : null;
  const clientStats =
    isClient && stats && 'walletBalance' in stats ? (stats as ClientDashboard) : null;

  const quickActions = [
    { label: 'New Actor', icon: User, path: '/actors/new' },
    { label: 'New Look', icon: Shirt, path: '/looks/new' },
    { label: 'New Item', icon: Image, path: '/fashion-items/new' },
  ];

  if (isClient) {
    quickActions.push({ label: 'New Commission', icon: MessageSquare, path: '/commissions/new' });
  }

  if (isArtist) {
    quickActions.push({ label: 'New Collection', icon: Folder, path: '/collections' });
    quickActions.push({ label: 'Marketplace', icon: Store, path: '/marketplace/manage' });
  }

  return (
    <PageContainer>
      <PageHeader title="Dashboard" description={`Welcome back, ${user?.name ?? 'User'}`} />

      <div className="mt-6 flex flex-col gap-6">
        <div>
          <h2 className="mb-3 font-heading text-lg font-semibold">Quick Actions</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
            {quickActions.map((action) => (
              <Card
                key={action.path}
                className="cursor-pointer transition-colors hover:border-border"
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

        {isClient && (
          <div>
            <h2 className="mb-3 font-heading text-lg font-semibold">Wallet</h2>
            <WalletBalanceCard
              balance={wallet?.balance}
              isLoading={walletLoading}
              isError={walletError}
              onTopUp={() => navigate('/settings/wallet')}
            />
          </div>
        )}

        {adminStats && (
          <div>
            <h2 className="mb-3 font-heading text-lg font-semibold">Overview</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <StatCard
                icon={User}
                label="Actors"
                value={adminStats.totalActors}
                isLoading={statsLoading}
              />
              <StatCard
                icon={Shirt}
                label="Looks"
                value={adminStats.totalLooks}
                isLoading={statsLoading}
              />
              <StatCard
                icon={Layers}
                label="Items"
                value={adminStats.totalItems}
                isLoading={statsLoading}
              />
              <StatCard
                icon={Users}
                label="Members"
                value={adminStats.activeMembers}
                isLoading={statsLoading}
              />
              <StatCard
                icon={ClipboardList}
                label="Commissions"
                value={adminStats.pendingCommissions}
                isLoading={statsLoading}
              />
            </div>
          </div>
        )}

        {artistStats && (
          <div>
            <h2 className="mb-3 font-heading text-lg font-semibold">My Work</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard
                icon={User}
                label="My Actors"
                value={artistStats.myActors}
                isLoading={statsLoading}
              />
              <StatCard
                icon={Shirt}
                label="My Looks"
                value={artistStats.myLooks}
                isLoading={statsLoading}
              />
              <StatCard
                icon={Layers}
                label="My Items"
                value={artistStats.myItems}
                isLoading={statsLoading}
              />
              <StatCard
                icon={ClipboardList}
                label="Submissions"
                value={artistStats.recentSubmissions?.length ?? 0}
                isLoading={statsLoading}
              />
            </div>
          </div>
        )}

        {clientStats && (
          <div>
            <h2 className="mb-3 font-heading text-lg font-semibold">My Account</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <StatCard
                icon={Layers}
                label="Wallet Balance"
                value={clientStats.walletBalance}
                isLoading={statsLoading}
              />
              <StatCard
                icon={ClipboardList}
                label="Active Commissions"
                value={clientStats.activeCommissions}
                isLoading={statsLoading}
              />
              <StatCard
                icon={Inbox}
                label="Recent Purchases"
                value={clientStats.recentPurchases?.length ?? 0}
                isLoading={statsLoading}
              />
            </div>
          </div>
        )}

        <div>
          <h2 className="mb-3 font-heading text-lg font-semibold">Recent Activity</h2>
          {activitiesLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="aspect-square w-full" />
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : activities && activities.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {activities.map((item) => (
                <ActivityCard key={item.id + item.action} item={item} />
              ))}
            </div>
          ) : (
            <EmptyStateV2
              icon={<Inbox className="size-8 text-muted-foreground" />}
              title="No recent activity"
              description="Your recent activity will appear here as you create and manage assets."
            />
          )}
        </div>
      </div>
    </PageContainer>
  );
}
