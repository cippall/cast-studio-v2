/**
 * Dashboard — quick actions + recent activity.
 */
import { useNavigate } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, Shirt, Image, MessageSquare } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: user } = useCurrentUser();

  const quickActions = [
    { label: 'New Actor', icon: User, path: '/actors/new' },
    { label: 'New Look', icon: Shirt, path: '/looks/new' },
    { label: 'New Item', icon: Image, path: '/fashion-items/new' },
  ];

  if (user?.role !== 'ADMIN' && user?.role !== 'ARTIST') {
    quickActions.push({ label: 'New Commission', icon: MessageSquare, path: '/commissions/new' });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {user?.name ?? 'User'}</p>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => (
            <Card
              key={action.path}
              className="cursor-pointer transition-colors hover:bg-accent"
              onClick={() => navigate(action.path)}
            >
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
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

      {/* Recent Activity (placeholder) */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Recent Activity</h2>
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">No recent activity yet.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
