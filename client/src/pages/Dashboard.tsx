/**
 /**
  * Dashboard — stats row + quick actions + recent activity.
  * Matches Stitch reference: Admin Dashboard - Classic Sidebar Variant.
  */
import { useNavigate } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/useAuth';
import { useWalletBalance, useDashboardStats } from '@/hooks/useDashboard';
import { useActivityFeed } from '@/hooks/useActivityFeed';
import { Button } from '@/components/ui/button';
import PageContainer from '@/components/layout/PageContainer';
import StatCard from '@/components/StatCard';
import EmptyStateV2 from '@/components/EmptyStateV2';
import { Skeleton } from '@/components/ui/skeleton';
import type { DashboardStats, ArtistDashboard, ClientDashboard } from '@cast/types';
import { User, Shirt, Image, MessageSquare, Inbox, Folder, Store, Plus } from 'lucide-react';
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
      {/* Page header */}
      <header className="mb-12">
        <h2 className="font-heading text-[40px] font-bold leading-[48px] tracking-[-0.02em] text-foreground mb-2">
          Dashboard Overview
        </h2>
        <p className="font-body text-[20px] leading-[35px] text-muted-foreground max-w-[680px]">
          Welcome back, {user?.name ?? 'User'}
        </p>
      </header>

      {/* Admin Stats Row */}
      {adminStats && (
        <section className="mb-12">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-0 border-y border-border">
            <StatCard
              label="Total Actors"
              value={adminStats.totalActors}
              isLoading={statsLoading}
            />
            <div className="border-r border-border">
              <StatCard
                label="Total Looks"
                value={adminStats.totalLooks}
                isLoading={statsLoading}
              />
            </div>
            <div className="border-r border-border">
              <StatCard
                label="Total Items"
                value={adminStats.totalItems}
                isLoading={statsLoading}
              />
            </div>
            <div className="border-r border-border">
              <StatCard
                label="Active Members"
                value={adminStats.activeMembers}
                isLoading={statsLoading}
              />
            </div>
            <div className="bg-surface-container-low">
              <StatCard
                label="Pending Commissions"
                value={adminStats.pendingCommissions}
                isLoading={statsLoading}
                variant="highlight"
              />
            </div>
          </div>
        </section>
      )}

      {/* Artist Stats */}
      {artistStats && (
        <section className="mb-12">
          <div className="flex items-center justify-between mb-8 border-b border-border pb-4">
            <h3 className="font-heading text-[22px] font-normal leading-[30px] tracking-[-0.01em] text-foreground">
              My Work
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="My Actors" value={artistStats.myActors} isLoading={statsLoading} />
            <StatCard label="My Looks" value={artistStats.myLooks} isLoading={statsLoading} />
            <StatCard label="My Items" value={artistStats.myItems} isLoading={statsLoading} />
            <StatCard
              label="Submissions"
              value={artistStats.recentSubmissions?.length ?? 0}
              isLoading={statsLoading}
            />
          </div>
        </section>
      )}

      {/* Client Stats */}
      {clientStats && (
        <section className="mb-12">
          <div className="flex items-center justify-between mb-8 border-b border-border pb-4">
            <h3 className="font-heading text-[22px] font-normal leading-[30px] tracking-[-0.01em] text-foreground">
              My Account
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <StatCard
              label="Wallet Balance"
              value={clientStats.walletBalance}
              isLoading={statsLoading}
            />
            <StatCard
              label="Active Commissions"
              value={clientStats.activeCommissions}
              isLoading={statsLoading}
            />
            <StatCard
              label="Recent Purchases"
              value={clientStats.recentPurchases?.length ?? 0}
              isLoading={statsLoading}
            />
          </div>
        </section>
      )}

      {/* Client Wallet */}
      {isClient && (
        <section className="mb-12">
          <WalletBalanceCard
            balance={wallet?.balance}
            isLoading={walletLoading}
            isError={walletError}
            onTopUp={() => navigate('/settings/wallet')}
          />
        </section>
      )}

      {/* Quick Actions */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-8 border-b border-border pb-4">
          <h3 className="font-heading text-[22px] font-normal leading-[30px] tracking-[-0.01em] text-foreground">
            Quick Actions
          </h3>
          <button
            className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => navigate('/actors')}
          >
            View All
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {quickActions.map((action) => (
            <div
              key={action.path}
              className="border border-border p-6 flex flex-col justify-between h-48 bg-surface-bright hover:bg-surface-container-low transition-colors duration-200 cursor-pointer"
              onClick={() => navigate(action.path)}
            >
              <div>
                <action.icon className="size-8 text-primary mb-4" />
                <h4 className="font-body text-[20px] leading-[35px] text-foreground">
                  {action.label}
                </h4>
              </div>
              <Button
                variant="default"
                size="icon"
                className="self-start"
                aria-label={`Create ${action.label}`}
              >
                <Plus className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* Recent Activity */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-8 border-b border-border pb-4">
          <h3 className="font-heading text-[22px] font-normal leading-[30px] tracking-[-0.01em] text-foreground">
            Recent Activity
          </h3>
          <button className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">
            View All
          </button>
        </div>
        {activitiesLoading ? (
          <div className="flex overflow-x-auto gap-6 pb-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex-none w-64 space-y-2">
                <Skeleton className="w-full h-40" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : activities && activities.length > 0 ? (
          <div className="flex overflow-x-auto gap-6 pb-6 cursor-grab active:cursor-grabbing snap-x">
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
      </section>
    </PageContainer>
  );
}
