/**
 * Dashboard — quick actions + recent activity + role-specific sections.
 * Client: wallet balance card.
 * Admin: stats row.
 */
import { useNavigate } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/useAuth';
import { useWalletBalance, useDashboardStats } from '@/hooks/useDashboard';
import { useActivityFeed } from '@/hooks/useActivityFeed';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import StatCard from '@/components/StatCard';
import EmptyStateV2 from '@/components/EmptyStateV2';
import LoadingState from '@/components/LoadingState';
import { Skeleton } from '@/components/ui/skeleton';
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
  Inbox,
} from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: user } = useCurrentUser();
  const isClient = user?.role === 'CLIENT';
  const isAdmin = user?.role === 'ADMIN';

  const { data: wallet, isLoading: walletLoading, isError: walletError } = useWalletBalance();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: activities, isLoading: activitiesLoading } = useActivityFeed(10);

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
          <h2 className="mb-3 font-heading text-lg font-semibold">Quick Actions</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

        {/* Client: Wallet Balance */}
        {isClient && (
          <div>
            <h2 className="mb-3 font-heading text-lg font-semibold">Wallet</h2>
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
                  <LoadingState variant="list" count={1} />
                ) : walletError ? (
                  <div className="text-sm text-error">Failed to load balance</div>
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
            <h2 className="mb-3 font-heading text-lg font-semibold">Overview</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <StatCard
                icon={User}
                label="Actors"
                value={stats?.totalActors ?? 0}
                isLoading={statsLoading}
              />
              <StatCard
                icon={ShirtIcon}
                label="Looks"
                value={stats?.totalLooks ?? 0}
                isLoading={statsLoading}
              />
              <StatCard
                icon={Layers}
                label="Items"
                value={stats?.totalItems ?? 0}
                isLoading={statsLoading}
              />
              <StatCard
                icon={Users}
                label="Members"
                value={stats?.activeMembers ?? 0}
                isLoading={statsLoading}
              />
              <StatCard
                icon={ClipboardList}
                label="Commissions"
                value={stats?.pendingCommissions ?? 0}
                isLoading={statsLoading}
              />
            </div>
          </div>
        )}

        {/* Recent Activity */}
        <div>
          <h2 className="mb-3 font-heading text-lg font-semibold">Recent Activity</h2>
          {activitiesLoading ? (
            <div className="flex gap-4 overflow-x-auto pb-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="w-40 shrink-0 space-y-2">
                  <Skeleton className="aspect-square w-full" />
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : activities && activities.length > 0 ? (
            <div className="flex gap-4 overflow-x-auto pb-2">
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

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

const actionBadgeVariant: Record<string, 'default' | 'secondary' | 'outline'> = {
  Created: 'default',
  Generated: 'secondary',
  Shared: 'outline',
};

function ActivityCard({ item }: { item: import('@cast/types').ActivityFeedItem }) {
  return (
    <div className="w-40 shrink-0 overflow-hidden border border-border bg-card">
      <div className="aspect-square w-full bg-surface">
        {item.thumbnail_url ? (
          <img
            src={item.thumbnail_url}
            alt={item.asset_name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Image className="size-8 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="p-2">
        <p className="truncate text-sm font-medium text-foreground">{item.asset_name}</p>
        <div className="mt-1 flex items-center gap-2">
          <Badge variant={actionBadgeVariant[item.action] ?? 'default'} className="text-[10px]">
            {item.action}
          </Badge>
          <span className="text-[11px] text-muted-foreground">
            {formatRelativeTime(item.created_at)}
          </span>
        </div>
      </div>
    </div>
  );
}
