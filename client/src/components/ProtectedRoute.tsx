/**
 * ProtectedRoute — redirects to /login if the user is not authenticated.
 * Shows a loading skeleton while the session is being checked.
 */
import { Navigate, Outlet } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/useAuth';

export default function ProtectedRoute() {
  const { data: user, isLoading, isError } = useCurrentUser();

  if (isLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="size-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (isError || !user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
