/**
 * CollectionDetail frontend tests — dedicated test file.
 * Covers asset grid rendering, empty/loading/error states, rename, add/remove items, delete.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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

// ─── Shared component mocks ─────────────────────────────────────────
vi.mock('@/components/LoadingState', () => ({
  default: function MockLoadingState({ variant }: { variant?: string }) {
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
    actionLabel,
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
        {actionLabel && <span data-testid="empty-action">{actionLabel}</span>}
      </div>
    );
  },
}));

// ─── Collection sub-component mocks ─────────────────────────────────
vi.mock('@/components/collections/CollectionNameEditor', () => ({
  default: function MockCollectionNameEditor({
    name,
    itemCount,
    editing,
    editValue,
    onStartEdit,
    onSave,
    onCancel,
    onEditChange,
  }: {
    name: string;
    itemCount: number;
    editing: boolean;
    editValue: string;
    onStartEdit: () => void;
    onSave: () => void;
    onCancel: () => void;
    onEditChange: (v: string) => void;
  }) {
    return (
      <div data-testid="collection-name-editor">
        {editing ? (
          <div data-testid="name-editing">
            <input
              data-testid="name-input"
              value={editValue}
              onChange={(e) => onEditChange(e.target.value)}
            />
            <button data-testid="name-save" onClick={onSave}>
              Save
            </button>
            <button data-testid="name-cancel" onClick={onCancel}>
              Cancel
            </button>
          </div>
        ) : (
          <div data-testid="name-display">
            <span data-testid="collection-name">{name}</span>
            <span data-testid="item-count">
              {itemCount} item{itemCount !== 1 ? 's' : ''}
            </span>
            <button data-testid="name-edit-btn" onClick={onStartEdit}>
              Edit
            </button>
          </div>
        )}
      </div>
    );
  },
}));

vi.mock('@/components/collections/CollectionAssetCard', () => ({
  default: function MockCollectionAssetCard({
    item,
    onRemove,
    onNavigate,
  }: {
    item: { id: string; asset_type: string; asset: { name: string } | null };
    onRemove: () => void;
    onNavigate: () => void;
  }) {
    return (
      <div data-testid="collection-asset-card" data-item-id={item.id}>
        <span data-testid="asset-name">{item.asset?.name ?? 'Unavailable'}</span>
        <button data-testid={`navigate-${item.id}`} onClick={onNavigate}>
          View
        </button>
        <button data-testid={`remove-${item.id}`} onClick={onRemove}>
          Remove
        </button>
      </div>
    );
  },
}));

vi.mock('@/components/collections/AddAssetsDialog', () => ({
  default: function MockAddAssetsDialog({
    open,
    onClose,
  }: {
    open: boolean;
    onClose: () => void;
    collectionId: string;
    existingAssetIds: Set<string>;
  }) {
    if (!open) return null;
    return (
      <div data-testid="add-assets-dialog">
        <button data-testid="close-add-dialog" onClick={onClose}>
          Close
        </button>
      </div>
    );
  },
}));

vi.mock('@/components/collections/DeleteCollectionDialog', () => ({
  default: function MockDeleteCollectionDialog({
    open,
    onOpenChange,
    collectionName,
    onConfirm,
    isDeleting,
  }: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    collectionName: string;
    itemCount: number;
    onConfirm: () => void;
    isDeleting: boolean;
  }) {
    if (!open) return null;
    return (
      <div data-testid="delete-collection-dialog">
        <span data-testid="delete-collection-name">{collectionName}</span>
        <button data-testid="cancel-delete" onClick={() => onOpenChange(false)}>
          Cancel
        </button>
        <button data-testid="confirm-delete" onClick={onConfirm} disabled={isDeleting}>
          {isDeleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    );
  },
}));

// ─── Hooks mock ─────────────────────────────────────────────────────
import type { Collection, CollectionItemWithAsset } from '@cast/types';

const mockCollectionDetail: Collection = {
  id: 'col-1',
  user_id: 'u1',
  workspace_id: 'w1',
  name: 'Cyberpunk Actors',
  created_at: '2025-01-01',
  updated_at: '2025-01-01',
};

const mockCollectionItems: CollectionItemWithAsset[] = [
  {
    id: 'item-1',
    collection_id: 'col-1',
    asset_type: 'ACTOR',
    asset_id: 'actor-1',
    created_at: '2025-01-01',
    asset: { name: 'Cyberpunk Woman', image_url: 'http://example.com/1.jpg', headshot_url: null },
  },
  {
    id: 'item-2',
    collection_id: 'col-1',
    asset_type: 'LOOK',
    asset_id: 'look-1',
    created_at: '2025-01-02',
    asset: { name: 'Neon City Look', image_url: 'http://example.com/2.jpg', headshot_url: null },
  },
];

const mockEmptyItems: CollectionItemWithAsset[] = [];

const mockUseCollectionDetail = vi.fn();
const mockUseCollectionItems = vi.fn();
const mockUseUpdateCollection = vi.fn();
const mockUseRemoveCollectionItem = vi.fn();
const mockUseDeleteCollection = vi.fn();

vi.mock('@/hooks/useCollectionDetail', () => ({
  useCollectionDetail: (...args: unknown[]) => mockUseCollectionDetail(...args),
  useCollectionItems: (...args: unknown[]) => mockUseCollectionItems(...args),
  useUpdateCollection: (...args: unknown[]) => mockUseUpdateCollection(...args),
  useRemoveCollectionItem: (...args: unknown[]) => mockUseRemoveCollectionItem(...args),
  useDeleteCollection: () => mockUseDeleteCollection(),
}));

vi.mock('@/hooks/useUserLibrary', () => ({
  useUserLibrary: () => ({ data: [], isLoading: false }),
}));

// ─── Imports after mocks ────────────────────────────────────────────
import CollectionDetail from '@/pages/collections/CollectionDetail';

// ─── Test helpers ───────────────────────────────────────────────────
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

function renderCollectionDetail(queryClient?: QueryClient) {
  const qc = queryClient ?? createTestQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/collections/col-1']}>
        <Routes>
          <Route path="/collections/:id" element={<CollectionDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ─── Default mock implementations ───────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();

  mockUseCollectionDetail.mockReturnValue({
    data: mockCollectionDetail,
    isLoading: false,
    isError: false,
    error: null,
  });

  mockUseCollectionItems.mockReturnValue({
    data: mockCollectionItems,
    isLoading: false,
  });

  mockUseUpdateCollection.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  });

  mockUseRemoveCollectionItem.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  });

  mockUseDeleteCollection.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  });
});

/* ================================================================
 * CollectionDetail — Asset Grid
 * ================================================================ */

describe('CollectionDetail — Asset Grid', () => {
  it('renders the collection name', () => {
    renderCollectionDetail();
    expect(screen.getByTestId('collection-name')).toHaveTextContent('Cyberpunk Actors');
  });

  it('renders the item count', () => {
    renderCollectionDetail();
    expect(screen.getByTestId('item-count')).toHaveTextContent('2 items');
  });

  it('renders asset cards for each item', () => {
    renderCollectionDetail();
    const cards = screen.getAllByTestId('collection-asset-card');
    expect(cards.length).toBe(2);
  });

  it('renders asset names in cards', () => {
    renderCollectionDetail();
    expect(screen.getByText('Cyberpunk Woman')).toBeInTheDocument();
    expect(screen.getByText('Neon City Look')).toBeInTheDocument();
  });

  it('renders the Add Assets button', () => {
    renderCollectionDetail();
    expect(screen.getByRole('button', { name: /add assets/i })).toBeInTheDocument();
  });

  it('renders the Delete button', () => {
    renderCollectionDetail();
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });

  it('renders a grid container for asset cards', () => {
    renderCollectionDetail();
    const grid = document.querySelector('.grid');
    expect(grid).not.toBeNull();
  });
});

/* ================================================================
 * CollectionDetail — Empty State
 * ================================================================ */

describe('CollectionDetail — Empty State', () => {
  it('renders empty state when collection has no items', () => {
    mockUseCollectionItems.mockReturnValue({
      data: mockEmptyItems,
      isLoading: false,
    });

    renderCollectionDetail();
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });

  it('shows "This collection is empty" title', () => {
    mockUseCollectionItems.mockReturnValue({
      data: mockEmptyItems,
      isLoading: false,
    });

    renderCollectionDetail();
    expect(screen.getByTestId('empty-title')).toHaveTextContent('This collection is empty');
  });

  it('shows "Add assets from your library" description', () => {
    mockUseCollectionItems.mockReturnValue({
      data: mockEmptyItems,
      isLoading: false,
    });

    renderCollectionDetail();
    expect(screen.getByTestId('empty-description')).toHaveTextContent(
      'Add assets from your library to get started.',
    );
  });
});

/* ================================================================
 * CollectionDetail — Loading State
 * ================================================================ */

describe('CollectionDetail — Loading State', () => {
  it('renders loading state when collection is loading', () => {
    mockUseCollectionDetail.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    });
    mockUseCollectionItems.mockReturnValue({
      data: [],
      isLoading: true,
    });

    renderCollectionDetail();
    expect(screen.getByTestId('loading-state')).toBeInTheDocument();
  });

  it('renders loading state when items are loading', () => {
    mockUseCollectionItems.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    renderCollectionDetail();
    expect(screen.getByTestId('loading-state')).toBeInTheDocument();
  });
});

/* ================================================================
 * CollectionDetail — Error State
 * ================================================================ */

describe('CollectionDetail — Error State', () => {
  it('renders error state when collection fetch fails', () => {
    mockUseCollectionDetail.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Collection not found'),
    });

    renderCollectionDetail();
    expect(screen.getByTestId('error-state')).toBeInTheDocument();
  });

  it('shows error message from API', () => {
    mockUseCollectionDetail.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Not found'),
    });

    renderCollectionDetail();
    expect(screen.getByTestId('error-state')).toHaveTextContent('Not found');
  });
});

/* ================================================================
 * CollectionDetail — Rename
 * ================================================================ */

describe('CollectionDetail — Rename', () => {
  it('shows edit button for collection name', () => {
    renderCollectionDetail();
    expect(screen.getByTestId('name-edit-btn')).toBeInTheDocument();
  });

  it('enters edit mode when edit button is clicked', async () => {
    const user = userEvent.setup();
    renderCollectionDetail();

    await user.click(screen.getByTestId('name-edit-btn'));

    expect(screen.getByTestId('name-editing')).toBeInTheDocument();
    expect(screen.getByTestId('name-input')).toBeInTheDocument();
  });

  it('shows save and cancel buttons in edit mode', async () => {
    const user = userEvent.setup();
    renderCollectionDetail();

    await user.click(screen.getByTestId('name-edit-btn'));

    expect(screen.getByTestId('name-save')).toBeInTheDocument();
    expect(screen.getByTestId('name-cancel')).toBeInTheDocument();
  });

  it('pre-fills input with current collection name', async () => {
    const user = userEvent.setup();
    renderCollectionDetail();

    await user.click(screen.getByTestId('name-edit-btn'));

    expect(screen.getByTestId('name-input')).toHaveValue('Cyberpunk Actors');
  });

  it('exits edit mode when cancel is clicked', async () => {
    const user = userEvent.setup();
    renderCollectionDetail();

    await user.click(screen.getByTestId('name-edit-btn'));
    expect(screen.getByTestId('name-editing')).toBeInTheDocument();

    await user.click(screen.getByTestId('name-cancel'));
    expect(screen.getByTestId('name-display')).toBeInTheDocument();
  });

  it('calls updateCollection when save is clicked with new name', async () => {
    const user = userEvent.setup();
    const mockMutate = vi.fn();
    mockUseUpdateCollection.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    });

    renderCollectionDetail();

    await user.click(screen.getByTestId('name-edit-btn'));
    const input = screen.getByTestId('name-input');
    await user.clear(input);
    await user.type(input, 'Renamed Collection');
    await user.click(screen.getByTestId('name-save'));

    expect(mockMutate).toHaveBeenCalledWith('Renamed Collection');
  });

  it('exits edit mode after saving', async () => {
    const user = userEvent.setup();
    const mockMutate = vi.fn();
    mockUseUpdateCollection.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    });

    renderCollectionDetail();

    await user.click(screen.getByTestId('name-edit-btn'));
    await user.click(screen.getByTestId('name-save'));

    expect(screen.getByTestId('name-display')).toBeInTheDocument();
  });

  it('does not call updateCollection when name is unchanged', async () => {
    const user = userEvent.setup();
    const mockMutate = vi.fn();
    mockUseUpdateCollection.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    });

    renderCollectionDetail();

    await user.click(screen.getByTestId('name-edit-btn'));
    await user.click(screen.getByTestId('name-save'));

    expect(mockMutate).not.toHaveBeenCalled();
  });
});

/* ================================================================
 * CollectionDetail — Add Assets
 * ================================================================ */

describe('CollectionDetail — Add Assets', () => {
  it('opens Add Assets dialog when button is clicked', async () => {
    const user = userEvent.setup();
    renderCollectionDetail();

    await user.click(screen.getByRole('button', { name: /add assets/i }));

    expect(screen.getByTestId('add-assets-dialog')).toBeInTheDocument();
  });

  it('closes Add Assets dialog when close button is clicked', async () => {
    const user = userEvent.setup();
    renderCollectionDetail();

    await user.click(screen.getByRole('button', { name: /add assets/i }));
    expect(screen.getByTestId('add-assets-dialog')).toBeInTheDocument();

    await user.click(screen.getByTestId('close-add-dialog'));
    expect(screen.queryByTestId('add-assets-dialog')).not.toBeInTheDocument();
  });
});

/* ================================================================
 * CollectionDetail — Remove Items
 * ================================================================ */

describe('CollectionDetail — Remove Items', () => {
  it('calls removeItem when remove button is clicked on an asset card', async () => {
    const user = userEvent.setup();
    const mockMutate = vi.fn();
    mockUseRemoveCollectionItem.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    });

    renderCollectionDetail();

    const removeButtons = screen.getAllByText('Remove');
    await user.click(removeButtons[0]);

    expect(mockMutate).toHaveBeenCalledWith('item-1');
  });

  it('renders a remove button for each asset card', () => {
    renderCollectionDetail();
    const removeButtons = screen.getAllByText('Remove');
    expect(removeButtons.length).toBe(2);
  });
});

/* ================================================================
 * CollectionDetail — Delete Collection
 * ================================================================ */

describe('CollectionDetail — Delete Collection', () => {
  it('opens delete dialog when Delete button is clicked', async () => {
    const user = userEvent.setup();
    renderCollectionDetail();

    await user.click(screen.getByRole('button', { name: /delete/i }));

    expect(screen.getByTestId('delete-collection-dialog')).toBeInTheDocument();
  });

  it('shows collection name in delete dialog', async () => {
    const user = userEvent.setup();
    renderCollectionDetail();

    await user.click(screen.getByRole('button', { name: /delete/i }));

    expect(screen.getByTestId('delete-collection-name')).toHaveTextContent('Cyberpunk Actors');
  });

  it('calls deleteCollection when confirm is clicked', async () => {
    const user = userEvent.setup();
    const mockMutate = vi.fn();
    mockUseDeleteCollection.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    });

    renderCollectionDetail();

    await user.click(screen.getByRole('button', { name: /delete/i }));
    await user.click(screen.getByTestId('confirm-delete'));

    expect(mockMutate).toHaveBeenCalledWith(
      'col-1',
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('closes delete dialog when cancel is clicked', async () => {
    const user = userEvent.setup();
    renderCollectionDetail();

    await user.click(screen.getByRole('button', { name: /delete/i }));
    expect(screen.getByTestId('delete-collection-dialog')).toBeInTheDocument();

    await user.click(screen.getByTestId('cancel-delete'));
    expect(screen.queryByTestId('delete-collection-dialog')).not.toBeInTheDocument();
  });

  it('disables confirm button while deleting', async () => {
    const user = userEvent.setup();
    const mockMutate = vi.fn();
    mockUseDeleteCollection.mockReturnValue({
      mutate: mockMutate,
      isPending: true,
    });

    renderCollectionDetail();

    await user.click(screen.getByRole('button', { name: /delete/i }));
    const confirmBtn = screen.getByTestId('confirm-delete');

    expect(confirmBtn).toBeDisabled();
    expect(confirmBtn).toHaveTextContent('Deleting...');
  });
});
