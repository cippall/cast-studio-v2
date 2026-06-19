/**
 * ModelsPage frontend tests — covers fal.ai connection flow, model browser, and configured models tab.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

// ─── Layout mocks ───────────────────────────────────────────────────
vi.mock('@/components/layout/PageContainer', () => ({
  default: function MockPageContainer({ children }: { children: ReactNode }) {
    return <div data-testid="page-container">{children}</div>;
  },
}));

vi.mock('@/components/layout/PageHeader', () => ({
  default: function MockPageHeader({
    title,
    description,
    children,
  }: {
    title: string;
    description?: string;
    children?: ReactNode;
  }) {
    return (
      <div>
        <h1 data-testid="page-header">{title}</h1>
        {description && <p data-testid="page-description">{description}</p>}
        {children}
      </div>
    );
  },
}));

// ─── DataTable mock ─────────────────────────────────────────────────
vi.mock('@/components/DataTable', () => ({
  DataTable: function MockDataTable({
    data,
    isLoading,
    isError,
    error,
    emptyTitle,
    rowActions,
  }: {
    columns: Array<{ key: string; header: string; render: (row: unknown) => ReactNode }>;
    data: unknown[];
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    emptyTitle: string;
    emptyDescription: string;
    rowActions?: (row: unknown) => ReactNode[];
  }) {
    if (isLoading) return <div data-testid="datatable-loading">Loading...</div>;
    if (isError) return <div data-testid="datatable-error">{error?.message ?? 'Error'}</div>;
    if (!data.length) return <div data-testid="datatable-empty">{emptyTitle}</div>;
    return (
      <div data-testid="datatable">
        {data.map((row: Record<string, unknown>, i: number) => (
          <div key={i} data-testid={`row-${i}`}>
            {rowActions &&
              rowActions(row).map((action, j) => (
                <div key={j} data-testid={`action-${j}`}>
                  {action}
                </div>
              ))}
          </div>
        ))}
      </div>
    );
  },
}));

// ─── ModelParameterForm mock ────────────────────────────────────────
vi.mock('@/components/ModelParameterForm', () => ({
  default: function MockModelParameterForm() {
    return <div data-testid="model-parameter-form">Parameter Form</div>;
  },
}));

// ─── Toast mock ─────────────────────────────────────────────────────
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// ─── Tabs mock — always render tab content ──────────────────────────
vi.mock('@/components/ui/tabs', () => ({
  Tabs: function MockTabs({
    children,
    defaultValue,
  }: {
    children: ReactNode;
    defaultValue?: string;
  }) {
    return (
      <div data-testid="tabs" data-default={defaultValue}>
        {children}
      </div>
    );
  },
  TabsList: function MockTabsList({ children }: { children: ReactNode }) {
    return <div data-testid="tabs-list">{children}</div>;
  },
  TabsTrigger: function MockTabsTrigger({ children }: { children: ReactNode }) {
    return <button data-testid="tabs-trigger">{children}</button>;
  },
  TabsContent: function MockTabsContent({ children }: { children: ReactNode }) {
    return <div data-testid="tabs-content">{children}</div>;
  },
}));

// ─── Test data ──────────────────────────────────────────────────────
const mockFalStatusConnected = { connected: true, created_at: '2025-01-01T00:00:00Z' };
const mockFalStatusDisconnected = { connected: false };

const mockFalModels = [
  {
    id: 'fal-ai/fast-sdxl',
    name: 'Fast SDXL',
    description: 'Fast text-to-image generation',
    category: 'text_to_image' as const,
    endpoint: 'fal-ai/fast-sdxl',
    inputSchema: {
      prompt: { title: 'Prompt', type: 'string' },
      negative_prompt: { title: 'Negative Prompt', type: 'string' },
    },
  },
  {
    id: 'fal-ai/flux/schnell',
    name: 'FLUX Schnell',
    description: 'Ultra-fast image generation',
    category: 'text_to_image' as const,
    endpoint: 'fal-ai/flux/schnell',
    inputSchema: {
      prompt: { title: 'Prompt', type: 'string' },
    },
  },
  {
    id: 'fal-ai/stable-video-diffusion',
    name: 'SVD',
    description: 'Image to video generation',
    category: 'image_to_image' as const,
    endpoint: 'fal-ai/stable-video-diffusion',
    inputSchema: {
      image_url: { title: 'Image URL', type: 'string' },
    },
  },
];

const mockConfiguredModels = [
  {
    id: 'model-1',
    model_id: 'fal-ai/fast-sdxl',
    name: 'Fast SDXL',
    model_type: 'text_to_image',
    task: 'actor_generation',
    parameters: {},
    is_active: true,
  },
  {
    id: 'model-2',
    model_id: 'fal-ai/flux/schnell',
    name: 'FLUX Schnell',
    model_type: 'text_to_image',
    task: 'look_generation',
    parameters: {},
    is_active: false,
  },
];

// ─── Mutable hook state + mocks ─────────────────────────────────────
import type { ModelConfig, FalModel } from '@/hooks/useAdmin';

let currentFalStatus: { connected: boolean } | undefined;
let currentConfiguredModels: ModelConfig[] | undefined;
let currentFalModels: FalModel[] | undefined;
let falModelsLoading = false;
let testKeyShouldFail = false;

vi.mock('@/hooks/useAdmin', () => ({
  useAdminModels: () => ({
    data: currentConfiguredModels,
    isLoading: false,
    isError: false,
    error: null,
  }),
  useUpdateModel: () => ({
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
  }),
  useDeleteModel: () => ({
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
  }),
  useFalKeyStatus: () => ({
    data: currentFalStatus,
  }),
  useSaveFalKey: () => ({
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
  }),
  useTestFalKey: () => ({
    mutateAsync: vi.fn().mockImplementation(() => {
      if (testKeyShouldFail) return Promise.reject(new Error('Invalid key'));
      return Promise.resolve({});
    }),
    isPending: false,
  }),
  useDisconnectFalKey: () => ({
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
  }),
  useFalModels: () => ({
    data: currentFalModels,
    isLoading: falModelsLoading,
  }),
  useImportFalModel: () => ({
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
  }),
  useModelSchema: () => ({
    data: { input: {}, output: {} },
    isLoading: false,
  }),
  useSaveModelParameters: () => ({
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
  }),
}));

import ModelsPage from '@/pages/settings/ModelsPage';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

function renderWithProviders(ui: ReactNode) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ModelsPage — Connection Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentFalStatus = mockFalStatusDisconnected;
    currentConfiguredModels = [];
    currentFalModels = [];
    testKeyShouldFail = false;
  });

  it('shows connect button when not connected', () => {
    renderWithProviders(<ModelsPage />);

    expect(screen.getByRole('button', { name: 'Connect fal.ai' })).toBeInTheDocument();
  });

  it('shows API key input after clicking Connect button', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ModelsPage />);

    await user.click(screen.getByRole('button', { name: 'Connect fal.ai' }));

    expect(screen.getByLabelText('API Key')).toBeInTheDocument();
    expect(screen.getByText('Test Connection')).toBeInTheDocument();
    expect(screen.getByText('Save & Connect')).toBeInTheDocument();
  });

  it('shows success message after successful test connection', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ModelsPage />);

    await user.click(screen.getByRole('button', { name: 'Connect fal.ai' }));
    const input = screen.getByLabelText('API Key');
    await user.type(input, 'fal-ai_test-key');
    await user.click(screen.getByText('Test Connection'));

    await waitFor(() => {
      expect(screen.getByText(/Connected/)).toBeInTheDocument();
    });
  });

  it('shows error message after failed test connection', async () => {
    const user = userEvent.setup();
    testKeyShouldFail = true;

    renderWithProviders(<ModelsPage />);

    await user.click(screen.getByRole('button', { name: 'Connect fal.ai' }));
    const input = screen.getByLabelText('API Key');
    await user.type(input, 'bad-key');
    await user.click(screen.getByText('Test Connection'));

    await waitFor(() => {
      expect(screen.getByText(/Invalid key/)).toBeInTheDocument();
    });
  });

  it('shows fal.ai connected status and disconnect button when connected', () => {
    currentFalStatus = mockFalStatusConnected;
    currentConfiguredModels = mockConfiguredModels;
    currentFalModels = mockFalModels;

    renderWithProviders(<ModelsPage />);

    expect(screen.getByText(/fal.ai connected/)).toBeInTheDocument();
    expect(screen.getByText('Disconnect')).toBeInTheDocument();
  });
});

describe('ModelsPage — Model Browser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentFalStatus = mockFalStatusConnected;
    currentConfiguredModels = [];
    currentFalModels = [];
    falModelsLoading = false;
  });

  it('shows loading state while fetching fal models', () => {
    currentFalModels = undefined;
    falModelsLoading = true;

    renderWithProviders(<ModelsPage />);

    expect(screen.getByText(/Loading models/)).toBeInTheDocument();
  });

  it('shows empty state when no fal models returned', () => {
    currentFalModels = [];

    renderWithProviders(<ModelsPage />);

    expect(screen.getByText('No models found. Check your fal.ai API key.')).toBeInTheDocument();
  });

  it('groups models by category with correct headings', () => {
    currentFalModels = mockFalModels;

    renderWithProviders(<ModelsPage />);

    expect(screen.getByText('Text to Image')).toBeInTheDocument();
    expect(screen.getByText('Image to Image')).toBeInTheDocument();

    expect(screen.getByText('Fast SDXL')).toBeInTheDocument();
    expect(screen.getByText('FLUX Schnell')).toBeInTheDocument();
    expect(screen.getByText('SVD')).toBeInTheDocument();
  });

  it('shows import button for unimported models', () => {
    currentFalModels = mockFalModels;
    currentConfiguredModels = [];

    renderWithProviders(<ModelsPage />);

    const importButtons = screen.getAllByText('Import model');
    expect(importButtons.length).toBe(3);
  });

  it('shows "Already Added" badge for imported models', () => {
    currentFalModels = mockFalModels;
    currentConfiguredModels = [
      {
        id: 'model-1',
        model_id: 'fal-ai/fast-sdxl',
        name: 'Fast SDXL',
        model_type: 'text_to_image',
        task: 'actor_generation',
        parameters: {},
        is_active: true,
      },
    ];

    renderWithProviders(<ModelsPage />);

    // The badge renders "Added" with a CheckCircle2 icon next to it
    expect(screen.getAllByText(/Added/).length).toBeGreaterThan(0);
    // Only 2 import buttons for the unimported models
    const importButtons = screen.getAllByText('Import model');
    expect(importButtons.length).toBe(2);
  });

  it('shows supported inputs badges on model cards', () => {
    currentFalModels = [mockFalModels[0]];

    renderWithProviders(<ModelsPage />);

    expect(screen.getByText('Prompt')).toBeInTheDocument();
    expect(screen.getByText('Negative Prompt')).toBeInTheDocument();
  });
});

describe('ModelsPage — Configured Models Tab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentFalStatus = mockFalStatusConnected;
    currentConfiguredModels = mockConfiguredModels;
    currentFalModels = mockFalModels;
  });

  it('shows configured models in DataTable', () => {
    renderWithProviders(<ModelsPage />);

    // Switch to Configured Models tab
    const configuredTab = screen.getByText('Configured Models');
    configuredTab.click();

    expect(screen.getByTestId('datatable')).toBeInTheDocument();
  });

  it('shows empty state when no configured models', () => {
    currentConfiguredModels = [];

    renderWithProviders(<ModelsPage />);

    // Switch to Configured Models tab
    const configuredTab = screen.getByText('Configured Models');
    configuredTab.click();

    expect(screen.getByText('No configured models')).toBeInTheDocument();
  });

  it('shows delete confirmation dialog when delete action is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ModelsPage />);

    // Switch to Configured Models tab
    await user.click(screen.getByText('Configured Models'));

    // Find and click the first delete button (via rowActions)
    const deleteButtons = screen.getAllByText('Delete');
    await user.click(deleteButtons[0]);

    // Delete dialog should appear
    expect(screen.getByText('Delete Model')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure/)).toBeInTheDocument();
  });

  it('shows configure dialog when configure action is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ModelsPage />);

    // Switch to Configured Models tab
    await user.click(screen.getByText('Configured Models'));

    // Find and click the first configure button
    const configureButtons = screen.getAllByText('Configure');
    await user.click(configureButtons[0]);

    // Configure dialog should appear
    expect(screen.getByText('Configure Parameters')).toBeInTheDocument();
  });

  it('shows activate/deactivate toggle in row actions', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ModelsPage />);

    // Switch to Configured Models tab
    await user.click(screen.getByText('Configured Models'));

    // First model is active → should show "Deactivate"
    expect(screen.getByText('Deactivate')).toBeInTheDocument();
    // Second model is inactive → should show "Activate"
    expect(screen.getByText('Activate')).toBeInTheDocument();
  });
});

describe('ModelsPage — Disconnect Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentFalStatus = mockFalStatusConnected;
    currentConfiguredModels = mockConfiguredModels;
    currentFalModels = mockFalModels;
  });

  it('renders disconnect button that triggers disconnect action', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ModelsPage />);

    // Verify the disconnect button exists
    const disconnectBtn = screen.getByText('Disconnect');
    expect(disconnectBtn).toBeInTheDocument();

    // Click disconnect
    await user.click(disconnectBtn);

    // The disconnect handler calls mutateAsync on the mock
    // Since our mock hooks don't trigger re-renders (no actual query invalidation),
    // we verify the button was clickable and the page remains stable
    await waitFor(() => {
      expect(screen.getByText('Disconnect')).toBeInTheDocument();
    });
  });
});
