/**
 * Client smoke tests — App rendering, ProtectedRoute, and router configuration.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// ─── Mock AppShell to avoid sidebar/routing complexity ────────────────
vi.mock('@/components/AppShell', () => ({
  default: function MockAppShell({ children }: { children?: ReactNode }) {
    return <div data-testid="app-shell">{children}</div>;
  },
}));

// ─── Mock all lazy-loaded page components ─────────────────────────────
vi.mock('@/pages/actors/ActorLibrary', () => ({ default: () => <div>ActorLibrary</div> }));
vi.mock('@/pages/actors/ActorDesigner', () => ({ default: () => <div>ActorDesigner</div> }));
vi.mock('@/pages/actors/ActorPage', () => ({ default: () => <div>ActorPage</div> }));
vi.mock('@/pages/looks/LookLibrary', () => ({ default: () => <div>LookLibrary</div> }));
vi.mock('@/pages/looks/LookDesigner', () => ({ default: () => <div>LookDesigner</div> }));
vi.mock('@/pages/looks/LookDetail', () => ({ default: () => <div>LookDetail</div> }));
vi.mock('@/pages/fashion-items/FashionItemLibrary', () => ({
  default: () => <div>FashionItemLibrary</div>,
}));
vi.mock('@/pages/fashion-items/FashionItemCreator', () => ({
  default: () => <div>FashionItemCreator</div>,
}));
vi.mock('@/pages/fashion-items/FashionItemDetail', () => ({
  default: () => <div>FashionItemDetail</div>,
}));
vi.mock('@/pages/marketplace/MarketplacePage', () => ({
  default: () => <div>MarketplacePage</div>,
}));
vi.mock('@/pages/marketplace/MarketplaceDetail', () => ({
  default: () => <div>MarketplaceDetail</div>,
}));
vi.mock('@/pages/marketplace/MarketplaceManage', () => ({
  default: () => <div>MarketplaceManage</div>,
}));
vi.mock('@/pages/marketplace/NewListing', () => ({ default: () => <div>NewListing</div> }));
vi.mock('@/pages/commissions/CommissionsList', () => ({
  default: () => <div>CommissionsList</div>,
}));
vi.mock('@/pages/commissions/NewCommission', () => ({ default: () => <div>NewCommission</div> }));
vi.mock('@/pages/commissions/CommissionDetail', () => ({
  default: () => <div>CommissionDetail</div>,
}));
vi.mock('@/pages/admin/AdminSubmissions', () => ({ default: () => <div>AdminSubmissions</div> }));
vi.mock('@/pages/admin/AdminListingsSettings', () => ({
  default: () => <div>AdminListingsSettings</div>,
}));
vi.mock('@/pages/settings/SettingsPage', () => ({ default: () => <div>SettingsPage</div> }));
vi.mock('@/pages/settings/ApiKeysPage', () => ({ default: () => <div>ApiKeysPage</div> }));
vi.mock('@/pages/settings/WalletPage', () => ({ default: () => <div>WalletPage</div> }));
vi.mock('@/pages/settings/UsersPage', () => ({ default: () => <div>UsersPage</div> }));
vi.mock('@/pages/settings/ModelsPage', () => ({ default: () => <div>ModelsPage</div> }));
vi.mock('@/pages/settings/PromptsPage', () => ({ default: () => <div>PromptsPage</div> }));
vi.mock('@/pages/settings/TaxonomyPage', () => ({ default: () => <div>TaxonomyPage</div> }));
vi.mock('@/pages/settings/CommissionFormsPage', () => ({
  default: () => <div>CommissionFormsPage</div>,
}));
vi.mock('@/pages/collections/CollectionsPage', () => ({
  default: () => <div>CollectionsPage</div>,
}));
vi.mock('@/pages/collections/CollectionDetail', () => ({
  default: () => <div>CollectionDetail</div>,
}));
vi.mock('@/pages/LoginPage', () => ({ default: () => <div>LoginPage</div> }));
vi.mock('@/pages/Dashboard', () => ({ default: () => <div>Dashboard</div> }));

// ─── Mock PageSkeleton (used by lazy route Suspense fallback) ─────────
vi.mock('@/components/PageSkeleton', () => ({
  PageSkeleton: () => <div data-testid="page-skeleton">Loading...</div>,
}));

// ─── Mock TooltipProvider (used by App) ──────────────────────────────
vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: function MockTooltipProvider({ children }: { children: ReactNode }) {
    return <>{children}</>;
  },
}));

// ─── Mock query-client (used by App) ─────────────────────────────────
vi.mock('@/lib/query-client', () => ({
  queryClient: new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  }),
}));

// ─── Mock useAuth (used by ProtectedRoute) ───────────────────────────
const mockUseCurrentUser = vi.fn();
vi.mock('@/hooks/useAuth', () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}));

// ─── Imports after mocks ─────────────────────────────────────────────
import App from '@/App';
import ProtectedRoute from '@/components/ProtectedRoute';
import { router } from '@/router';

// ─── Test helpers ────────────────────────────────────────────────────
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
}

// ─── Test 1: App renders ─────────────────────────────────────────────

describe('App component', () => {
  it('should render without crashing', () => {
    const qc = createTestQueryClient();
    const { container } = render(
      <QueryClientProvider client={qc}>
        <App />
      </QueryClientProvider>,
    );
    expect(container).toBeTruthy();
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});

// ─── Test 2: ProtectedRoute redirects unauthenticated ────────────────

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should redirect to /login when user is not authenticated', () => {
    // Simulate unauthenticated: isLoading=false, isError=true, data=undefined
    mockUseCurrentUser.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });

    const qc = createTestQueryClient();

    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/login" element={<div data-testid="login-page">Login</div>} />
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<div data-testid="protected">Protected</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // Should see the login page, not the protected content
    expect(screen.getByTestId('login-page')).toBeTruthy();
    expect(screen.queryByTestId('protected')).toBeNull();
  });
});

// ─── Test 3: Router has routes ───────────────────────────────────────

describe('Router configuration', () => {
  it('should have a defined router with state', () => {
    expect(router).toBeDefined();
    expect(router.state).toBeDefined();
    expect(router.state.location.pathname).toBe('/');
  });

  it('should have navigate and subscribe functions', () => {
    expect(typeof router.navigate).toBe('function');
    expect(typeof router.subscribe).toBe('function');
  });
});
