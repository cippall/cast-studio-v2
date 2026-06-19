/**
 * CommissionsList — role-based commission list with status tabs.
 * Client: "My Commissions" with status tabs (All/Requested/In Review/Approved).
 * Artist: "Assigned Commissions" with status tabs (All/Assigned/In Progress/Submitted).
 * Admin: "All Commissions" with full status tabs + Assign action.
 * Uses PageContainer + PageHeader.
 * Responsive: 1 col mobile, 2 col tablet, 3 col desktop card grid.
 */
import { useState, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/useAuth';
import { useCommissions } from '@/hooks/useCommissions';
import type { CommissionStatus } from '@cast/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import EmptyStateV2 from '@/components/EmptyStateV2';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import { MessageSquare, Plus, Eye, Send, ChevronRight } from 'lucide-react';

const STATUS_TABS_CLIENT: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'SUBMITTED', label: 'In Review' },
  { value: 'CHANGES_REQUESTED', label: 'Changes Requested' },
  { value: 'APPROVED', label: 'Approved' },
];

const STATUS_TABS_ARTIST: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'SUBMITTED', label: 'Submitted' },
];

const STATUS_TABS_ADMIN: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'REQUESTED', label: 'Requested' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

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

interface CommissionCardProps {
  commission: CommissionListItem;
  role: 'CLIENT' | 'ARTIST' | 'ADMIN';
  onAssign?: (id: string) => void;
}

interface CommissionListItem {
  id: string;
  title: string;
  status: string;
  assignee_id?: string;
  premium_cost?: number;
  submitted_at?: string;
  created_at: string;
  brief?: Record<string, unknown>;
}

const CommissionCard = memo(function CommissionCard({
  commission,
  role,
  onAssign,
}: CommissionCardProps) {
  const navigate = useNavigate();

  return (
    <Card className="transition-colors hover:bg-accent/50">
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold">{commission.title}</h3>
            <Badge className={statusColor(commission.status)}>
              {commission.status.replace(/_/g, ' ')}
            </Badge>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{formatRelativeTime(commission.created_at)}</span>
            {commission.assignee_id && <span className="flex items-center gap-1">Assigned</span>}
            {commission.premium_cost != null && Number(commission.premium_cost) > 0 && (
              <span>{Number(commission.premium_cost).toFixed(2)} cr</span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {role === 'ADMIN' && commission.status === 'REQUESTED' && onAssign && (
            <Button variant="outline" size="sm" onClick={() => onAssign(commission.id)}>
              Assign
            </Button>
          )}
          {role === 'ARTIST' &&
            (commission.status === 'ASSIGNED' ||
              commission.status === 'IN_PROGRESS' ||
              commission.status === 'CHANGES_REQUESTED') && (
              <Button
                variant="default"
                size="sm"
                onClick={() => navigate(`/commissions/${commission.id}`)}
              >
                <Send className="mr-1 size-3" />
                Submit Work
              </Button>
            )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/commissions/${commission.id}`)}
          >
            <Eye className="mr-1 size-3" />
            View
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});

export default function CommissionsList() {
  const navigate = useNavigate();
  const { data: user } = useCurrentUser();
  const role = user?.role ?? 'ARTIST';

  const [statusFilter, setStatusFilter] = useState('');

  const tabs =
    role === 'CLIENT'
      ? STATUS_TABS_CLIENT
      : role === 'ADMIN'
        ? STATUS_TABS_ADMIN
        : STATUS_TABS_ARTIST;

  const { data, isLoading, error } = useCommissions(statusFilter ? { status: statusFilter } : {});

  const commissions = data?.data ?? [];

  if (error) {
    return (
      <PageContainer>
        <PageHeader
          title={
            role === 'CLIENT'
              ? 'My Commissions'
              : role === 'ADMIN'
                ? 'All Commissions'
                : 'My Commissions'
          }
        />
        <Card>
          <CardContent className="py-8 text-center text-sm text-destructive">
            Failed to load commissions. Please try again.
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
        <PageHeader
          title={
            role === 'CLIENT'
              ? 'My Commissions'
              : role === 'ADMIN'
                ? 'All Commissions'
                : 'My Commissions'
          }
          description={
            role === 'CLIENT'
              ? 'Track your commission requests'
              : role === 'ADMIN'
                ? 'Manage all commission requests'
                : 'Commissions assigned to you'
          }
        >
          {role === 'CLIENT' && (
            <Button onClick={() => navigate('/commissions/new')}>
              <Plus className="mr-1 size-4" />
              New Commission
            </Button>
          )}
        </PageHeader>

        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList>
            {tabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {tabs.map((tab) => (
            <TabsContent key={tab.value} value={tab.value}>
              {isLoading ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {[1, 2, 3].map((i) => (
                    <Card key={i}>
                      <CardContent className="p-4">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="mt-2 h-3 w-32" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : commissions.length === 0 ? (
                <EmptyStateV2
                  icon={<MessageSquare className="size-8 text-muted-foreground" />}
                  title="No commissions"
                  description={
                    role === 'CLIENT'
                      ? "You haven't submitted any commissions yet."
                      : role === 'ADMIN'
                        ? 'No commissions found matching the selected filter.'
                        : 'No commissions assigned to you yet.'
                  }
                  actionLabel={role === 'CLIENT' ? 'New Commission' : undefined}
                  actionPath={role === 'CLIENT' ? '/commissions/new' : undefined}
                />
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {commissions.map((commission) => (
                    <CommissionCard
                      key={commission.id}
                      commission={commission}
                      role={role as 'CLIENT' | 'ARTIST' | 'ADMIN'}
                      onAssign={(id) => navigate(`/commissions/${id}`)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </PageContainer>
  );
}
