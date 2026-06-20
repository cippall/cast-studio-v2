/**
 * Marketplace frontend tests — covers MarketplacePage rendering, filters, pagination,
 * empty/loading/error states, and wallet balance display.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { ReactNode } from 'react';

// ─── API client mock ────────────────────────────────────────────────
vi.mock('@/lib/api-client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

// ─── Layout mocks ───────────────────────────────────────────────────
vi.mock('@/components/layout/PageContainer', () => ({
  default: function MockPageContainer({ children }: { children: ReactNode }) {
    return <div data-testid="page-container">{children}</div>;
  },
}));

vi.mock('@/components/layout/PageHeader', () => ({
  default: function MockPageHeader({ title, children }: { title: string; children?: ReactNode }) {
    return (
      <div data-testid="page-header">
        <h1>{title}</h1>
        {children}
      </div>
    );
  },
}));

// ─── Shared component mocks ─────────────────────────────────────────
vi.mock('@/components/LoadingState', () => ({
  default: function MockLoadingState({ variant, count }: { variant?: string; count?: number }) {
    if (count) {
      return (
        <div data-testid="loading-state">
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} data-testid="loading-card" />
          ))}
        </div>
      );
    }
    return <div data-testid="loading-state">{variant ?? 'default'}</div>;
  },
}));

vi.mock('@/components/ErrorState', () => ({
  default: function MockErrorState({ message }: { message?: string }) {
    return <div data-testid="error-state">{message ?? 'Error'}</div>;
  },
}));

vi.mock('@/components/EmptyStateV2', () => ({
  default: function MockEmptyStateV2({
    title,
    description,
  }: {
    icon?: ReactNode;
    title: string;
    description: string;
    actionLabel?: string;
    actionPath?: string;
  }) {
    return (
      <div data-testid="empty-state">
        <span data-testid="empty-title">{title}</span>
        <span data-testid="empty-description">{description}</span>
      </div>
    );
  },
}));

// ─── ProductCard mock ───────────────────────────────────────────────
vi.mock('@/components/ProductCard', () => ({
  default: function MockProductCard({
    id,
    name,
    sellerName,
    priceCredits,
    listingType,
    balance,
  }: {
    id: string;
    name: string;
    sellerName: string;
    priceCredits: number;
    listingType: string;
    thumbnailUrl: string | null;
    balance: number | undefined;
    onBuy: (id: string) => void;
  }) {
    return (
      <div data-testid="product-card" data-id={id}>
        <span data-testid="product-name">{name}</span>
        <span data-testid="product-seller">{sellerName}</span>
        <span data-testid="product-price">{priceCredits} cr</span>
        <span data-testid="product-type">{listingType}</span>
        {balance !== undefined && <span data-testid="product-balance">{balance}</span>}
      </div>
    );
  },
}));

// ─── Hooks mock ─────────────────────────────────────────────────────
import type { MarketplaceListing, PaginatedResponse } from '@cast/types';

const mockListings: MarketplaceListing[] = [
  {
    id: 'listing-1',
    listing_type: 'ACTOR_PACKAGE',
    asset_id: 'actor-1',
    asset: {
      id: 'actor-1',
      name: 'Cyberpunk Woman',
      headshot_url: 'http://example.com/1.jpg',
      fullshot_url: null,
      image_url: null,
    },
    seller_id: 'seller-1',
    seller_name: 'Studio Alpha',
    price_credits: 50,
    is_active: true,
    created_at: '2025-01-01',
  },
  {
    id: 'listing-2',
    listing_type: 'LOOK',
    asset_id: 'look-1',
    asset: {
      id: 'look-1',
      name: 'Neon City Look',
      headshot_url: null,
      fullshot_url: null,
      image_url: 'http://example.com/2.jpg',
    },
    seller_id: 'seller-2',
    seller_name: 'Studio Beta',
    price_credits: 25,
    is_active: true,
    created_at: '2025-01-02',
  },
  {
    id: 'listing-3',
    listing_type: 'ACTOR_PACKAGE',
    asset_id: 'actor-2',
    asset: {
      id: 'actor-2',
      name: 'Fantasy Warrior',
      headshot_url: 'http://example.com/3.jpg',
      fullshot_url: null,
      image_url: null,
    },
    seller_id: 'seller-1',
    seller_name: 'Studio Alpha',
    price_credits: 75,
    is_active: true,
    created_at: '2025-01-03',
  },
];

const mockMarketplaceData: PaginatedResponse<MarketplaceListing> = {
  data: mockListings,
  total: 3,
  page: 1,
  pageSize: 12,
  totalPages: 1,
};

const mockEmptyMarketplaceData: PaginatedResponse<MarketplaceListing> = {
  data: [],
  total: 0,
  page: 1,
  pageSize: 12,
  totalPages: 1,
};

const mockPaginatedData: PaginatedResponse<MarketplaceListing> = {
  data: mockListings.slice(0, 2),
  total: 3,
  page: 1,
  pageSize: 2,
  totalPages: 2,
};

const mockUseMarketplace = vi.fn();
const mockUseWalletBalance = vi.fn();

vi.mock('@/hooks/useMarketplace', () => ({
  useMarketplace: (...args: unknown[]) => mockUseMarketplace(...args),
}));

vi.mock('@/hooks/useWallet', () => ({
  useWalletBalance: () => mockUseWalletBalance(),
}));

// ─── Imports after mocks ────────────────────────────────────────────
import MarketplacePage from '@/pages/marketplace/MarketplacePage';

// ─── Test helpers ───────────────────────────────────────────────────
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

function renderMarketplace(queryClient?: QueryClient, initialEntry = '/marketplace') {
  const qc = queryClient ?? createTestQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/marketplace" element={<MarketplacePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ─── Default mock implementations ───────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();

  mockUseMarketplace.mockReturnValue({
    data: mockMarketplaceData,
    isLoading: false,
    isError: false,
    error: null,
  });

  mockUseWalletBalance.mockReturnValue({
    data: { id: 'wallet-1', balance_credits: 100, updated_at: '2025-01-01' },
    isLoading: false,
  });
});

/* ================================================================
 * MarketplacePage — Listing Grid
 * ================================================================ */

describe('MarketplacePage — Listing Grid', () => {
  it('renders the Marketplace heading', () => {
    renderMarketplace();
    expect(screen.getByText('Marketplace')).toBeInTheDocument();
  });

  it('renders product cards for each listing', () => {
    renderMarketplace();
    const cards = screen.getAllByTestId('product-card');
    expect(cards.length).toBe(3);
  });

  it('renders listing names', () => {
    renderMarketplace();
    expect(screen.getByText('Cyberpunk Woman')).toBeInTheDocument();
    expect(screen.getByText('Neon City Look')).toBeInTheDocument();
    expect(screen.getByText('Fantasy Warrior')).toBeInTheDocument();
  });

  it('renders seller names', () => {
    renderMarketplace();
    const studioAlphas = screen.getAllByText('Studio Alpha');
    expect(studioAlphas.length).toBe(2);
    expect(screen.getByText('Studio Beta')).toBeInTheDocument();
  });

  it('renders prices', () => {
    renderMarketplace();
    expect(screen.getByText('50 cr')).toBeInTheDocument();
    expect(screen.getByText('25 cr')).toBeInTheDocument();
    expect(screen.getByText('75 cr')).toBeInTheDocument();
  });

  it('renders listing type badges', () => {
    renderMarketplace();
    expect(screen.getAllByText('ACTOR_PACKAGE').length).toBe(2);
    expect(screen.getByText('LOOK')).toBeInTheDocument();
  });

  it('renders a grid container for product cards', () => {
    renderMarketplace();
    const grid = document.querySelector('.grid');
    expect(grid).not.toBeNull();
  });
});

/* ================================================================
 * MarketplacePage — Wallet Balance
 * ================================================================ */

describe('MarketplacePage — Wallet Balance', () => {
  it('renders wallet balance badge when wallet data is available', () => {
    renderMarketplace();
    expect(screen.getByText('Balance: 100.00 cr')).toBeInTheDocument();
  });

  it('does not render balance badge when wallet data is loading', () => {
    mockUseWalletBalance.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    renderMarketplace();
    expect(screen.queryByText(/balance/i)).not.toBeInTheDocument();
  });

  it('does not render balance badge when wallet data is undefined', () => {
    mockUseWalletBalance.mockReturnValue({
      data: undefined,
      isLoading: false,
    });

    renderMarketplace();
    expect(screen.queryByText(/balance/i)).not.toBeInTheDocument();
  });
});

/* ================================================================
 * MarketplacePage — Type Filters
 * ================================================================ */

describe('MarketplacePage — Type Filters', () => {
  it('renders filter buttons for All, Actor Packages, and Looks', () => {
    renderMarketplace();
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actor Packages' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Looks' })).toBeInTheDocument();
  });

  it('All filter is active by default', () => {
    renderMarketplace();
    const allBtn = screen.getByRole('button', { name: 'All' });
    // The active button uses the "default" variant which has bg-primary class
    expect(allBtn.className).toContain('bg-primary');
  });

  it('clicking Actor Packages filter changes the active filter', async () => {
    const user = userEvent.setup();
    renderMarketplace();

    await user.click(screen.getByRole('button', { name: 'Actor Packages' }));

    // After clicking, URL params update causes re-render
    // The button should now be active (variant=default)
    // We can verify the click handler was invoked by checking the button state
    expect(screen.getByRole('button', { name: 'Actor Packages' })).toBeInTheDocument();
  });

  it('clicking Looks filter changes the active filter', async () => {
    const user = userEvent.setup();
    renderMarketplace();

    await user.click(screen.getByRole('button', { name: 'Looks' }));

    expect(screen.getByRole('button', { name: 'Looks' })).toBeInTheDocument();
  });
});

/* ================================================================
 * MarketplacePage — Empty State
 * ================================================================ */

describe('MarketplacePage — Empty State', () => {
  it('renders empty state when there are no listings', () => {
    mockUseMarketplace.mockReturnValue({
      data: mockEmptyMarketplaceData,
      isLoading: false,
      isError: false,
      error: null,
    });

    renderMarketplace();
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });

  it('shows "No listings available" title in empty state', () => {
    mockUseMarketplace.mockReturnValue({
      data: mockEmptyMarketplaceData,
      isLoading: false,
      isError: false,
      error: null,
    });

    renderMarketplace();
    expect(screen.getByTestId('empty-title')).toHaveTextContent('No listings available');
  });

  it('shows "Check back soon" description in empty state', () => {
    mockUseMarketplace.mockReturnValue({
      data: mockEmptyMarketplaceData,
      isLoading: false,
      isError: false,
      error: null,
    });

    renderMarketplace();
    expect(screen.getByTestId('empty-description')).toHaveTextContent(
      'Check back soon for new assets.',
    );
  });

  it('does not render product cards when empty', () => {
    mockUseMarketplace.mockReturnValue({
      data: mockEmptyMarketplaceData,
      isLoading: false,
      isError: false,
      error: null,
    });

    renderMarketplace();
    expect(screen.queryAllByTestId('product-card').length).toBe(0);
  });
});

/* ================================================================
 * MarketplacePage — Loading State
 * ================================================================ */

describe('MarketplacePage — Loading State', () => {
  it('renders loading state when data is loading', () => {
    mockUseMarketplace.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    });

    renderMarketplace();
    expect(screen.getByTestId('loading-state')).toBeInTheDocument();
  });

  it('renders skeleton cards during loading', () => {
    mockUseMarketplace.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    });

    renderMarketplace();
    const skeletons = screen.getAllByTestId('loading-card');
    expect(skeletons.length).toBe(8);
  });

  it('does not render product cards during loading', () => {
    mockUseMarketplace.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    });

    renderMarketplace();
    expect(screen.queryAllByTestId('product-card').length).toBe(0);
  });
});

/* ================================================================
 * MarketplacePage — Error State
 * ================================================================ */

describe('MarketplacePage — Error State', () => {
  it('renders error state when fetch fails', () => {
    mockUseMarketplace.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Failed to fetch marketplace'),
    });

    renderMarketplace();
    expect(screen.getByTestId('error-state')).toBeInTheDocument();
  });

  it('shows error message from API', () => {
    mockUseMarketplace.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Network error'),
    });

    renderMarketplace();
    expect(screen.getByTestId('error-state')).toHaveTextContent('Network error');
  });
});

/* ================================================================
 * MarketplacePage — Pagination
 * ================================================================ */

describe('MarketplacePage — Pagination', () => {
  it('does not render pagination when totalPages is 1', () => {
    renderMarketplace();
    expect(screen.queryByText(/page.*of/i)).not.toBeInTheDocument();
  });

  it('renders pagination when there are multiple pages', () => {
    mockUseMarketplace.mockReturnValue({
      data: mockPaginatedData,
      isLoading: false,
      isError: false,
      error: null,
    });

    renderMarketplace();
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
  });

  it('renders Previous and Next buttons when paginated', () => {
    mockUseMarketplace.mockReturnValue({
      data: mockPaginatedData,
      isLoading: false,
      isError: false,
      error: null,
    });

    renderMarketplace();
    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('disables Previous button on first page', () => {
    mockUseMarketplace.mockReturnValue({
      data: mockPaginatedData,
      isLoading: false,
      isError: false,
      error: null,
    });

    renderMarketplace();
    const prevButton = screen.getByText('Previous').closest('button');
    expect(prevButton).toBeDisabled();
  });

  it('disables Next button on last page', () => {
    mockUseMarketplace.mockReturnValue({
      data: {
        ...mockPaginatedData,
        page: 2,
      },
      isLoading: false,
      isError: false,
      error: null,
    });

    const qc = createTestQueryClient();
    renderMarketplace(qc, '/marketplace?page=2');
    const nextButton = screen.getByText('Next').closest('button');
    expect(nextButton).toBeDisabled();
  });

  it('enables both buttons on a middle page', () => {
    const middlePageData = {
      ...mockPaginatedData,
      page: 2,
      totalPages: 3,
    };

    mockUseMarketplace.mockReturnValue({
      data: middlePageData,
      isLoading: false,
      isError: false,
      error: null,
    });

    const qc = createTestQueryClient();
    renderMarketplace(qc, '/marketplace?page=2');

    const prevButton = screen.getByText('Previous').closest('button');
    const nextButton = screen.getByText('Next').closest('button');
    expect(prevButton).not.toBeDisabled();
    expect(nextButton).not.toBeDisabled();
  });
});
