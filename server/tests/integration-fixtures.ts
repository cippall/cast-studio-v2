/**
 * Shared fixtures for integration tests.
 *
 * Provides mock setup (vi.mock + vi.spyOn), UUID constants, and factory functions.
 * Each test file imports from this module to ensure consistent test data.
 *
 * NOTE: Heavy use of `as any` (~30 occurrences) is a known trade-off of the
 * mock-based approach — mock shapes are not type-checked against real DB row
 * types. This keeps tests focused on workflow contracts rather than type
 * enforcement, which is already handled by unit tests.
 */

import { vi } from 'vitest';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Mock pool at the lowest level — vi.mock is hoisted, so mock client must be created inside the factory
// We also store a reference at module level so tests can access it.
// NOTE: must use `var` because vi.mock is hoisted above const/let declarations
// and the factory needs to assign to this variable.
// eslint-disable-next-line no-var
export var mockPoolClient: {
  query: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
};

vi.mock('../src/db/pool.js', () => {
  const client = {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    release: vi.fn(),
    on: vi.fn(),
  };
  mockPoolClient = client;
  return {
    query: vi.fn(),
    getClient: vi.fn().mockResolvedValue(client),
    default: { connect: vi.fn().mockResolvedValue(client) },
  };
});

// Mock external services
vi.mock('../src/services/fal-service.js', () => ({
  submitTextToImage: vi.fn().mockResolvedValue({ request_id: 'fal-test-123' }),
  getWorkspaceApiKey: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/services/stripe-service.js', () => ({
  createCheckoutSession: vi
    .fn()
    .mockResolvedValue({ id: 'cs_test_123', url: 'https://checkout.stripe.com/pay/cs_test_123' }),
  verifyWebhookEvent: vi.fn().mockReturnValue({
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_test_123', amount_total: 5000, metadata: { wallet_id: 'w1' } } },
  }),
}));

vi.mock('../src/services/email-service.js', () => ({
  sendNotificationEmail: vi.fn().mockResolvedValue(undefined),
}));

// Mock model-repo to avoid real DB queries for model resolution
vi.mock('../src/db/repositories/model-repo.js', () => ({
  listActiveModels: vi
    .fn()
    .mockResolvedValue([
      {
        model_id: 'fal-ai/flux-pro',
        name: 'Flux Pro',
        model_type: 'image',
        task: 'text-to-image',
        parameters: {},
        is_active: true,
        created_at: '2026-06-17T10:00:00.000Z',
      },
    ]),
  findActiveModel: vi.fn().mockResolvedValue(null),
}));

// Mock notification-service to prevent fire-and-forget side effects from consuming DB mocks.
// The vi.mock replaces module-level imports; vi.spyOn below intercepts direct imports.
// Both layers are needed because services import notificationRepo directly from its path.
vi.mock('../src/services/notification-service.js', () => ({
  dispatchNotification: vi.fn().mockResolvedValue(undefined),
  notifyCommissionAssigned: vi.fn().mockResolvedValue(undefined),
  notifyCommissionSubmitted: vi.fn().mockResolvedValue(undefined),
  notifyCommissionApproved: vi.fn().mockResolvedValue(undefined),
  notifyCommissionChangesRequested: vi.fn().mockResolvedValue(undefined),
  notifyAssetShared: vi.fn().mockResolvedValue(undefined),
  notifyWorkflowCompleted: vi.fn().mockResolvedValue(undefined),
  notifyWorkflowFailed: vi.fn().mockResolvedValue(undefined),
  notificationRepo: {
    createNotification: vi.fn().mockResolvedValue({ id: 'n1' }),
    listNotifications: vi.fn().mockResolvedValue({ data: [], pagination: { totalItems: 0 } }),
    markNotificationRead: vi.fn().mockResolvedValue({ id: 'n1', is_read: true }),
    markAllNotificationsRead: vi.fn().mockResolvedValue(undefined),
    getUnreadCount: vi.fn().mockResolvedValue({ count: 0 }),
  },
}));

import * as poolModule from '../src/db/pool.js';
import * as notificationService from '../src/services/notification-service.js';
import * as notificationRepo from '../src/db/repositories/notification-repo.js';

// Spy on the real notification repo to intercept direct imports from services
vi.spyOn(notificationRepo, 'createNotification').mockResolvedValue({ id: 'n1' } as any);
vi.spyOn(notificationRepo, 'listNotifications').mockResolvedValue({
  data: [],
  pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
} as any);
vi.spyOn(notificationRepo, 'markNotificationRead').mockResolvedValue({
  id: 'n1',
  is_read: true,
} as any);
vi.spyOn(notificationRepo, 'markAllNotificationsRead').mockResolvedValue(undefined as any);

export const mockQuery = vi.mocked(poolModule.query);

// --- UUIDs ---
export const WS = 'a0000000-0000-4000-8000-000000000001';
export const ARTIST = 'b0000000-0000-4000-8000-000000000001';
export const CLIENT_WS = 'a0000000-0000-4000-8000-000000000002';
export const CLIENT = 'b0000000-0000-4000-8000-000000000002';
export const ADMIN = 'd0000000-0000-4000-8000-000000000003';
export const ACTOR = 'c0000000-0000-4000-8000-000000000001';
export const COMMISSION = 'e0000000-0000-4000-8000-000000000010';
export const ASSET = 'f0000000-0000-4000-8000-000000000020';
export const LISTING = '10000000-0000-4000-8000-000000000001';
export const WALLET = 'w0000000-0000-4000-8000-000000000001';
export const OUTPUT_V1 = 'o0000000-0000-4000-8000-000000000001';
export const OUTPUT_V2 = 'o0000000-0000-4000-8000-000000000002';

// --- Factories ---
export function artistAccount() {
  return {
    id: ARTIST,
    workspace_id: WS,
    name: 'Artist',
    role: 'ARTIST',
    email: 'a@b.com',
    is_api_able: false,
    password_hash: 'x',
    created_at: '2026-06-17T10:00:00Z',
  };
}
export function clientAccount() {
  return {
    id: CLIENT,
    workspace_id: CLIENT_WS,
    name: 'Client',
    role: 'CLIENT',
    email: 'c@b.com',
    is_api_able: false,
    password_hash: 'x',
    created_at: '2026-06-17T10:00:00Z',
  };
}
export function adminAccount() {
  return {
    id: ADMIN,
    workspace_id: WS,
    name: 'Admin',
    role: 'ADMIN',
    email: 'a@s.com',
    is_api_able: false,
    password_hash: 'x',
    created_at: '2026-06-17T10:00:00Z',
  };
}
export function actorRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ACTOR,
    workspace_id: WS,
    creator_id: ARTIST,
    client_id: null,
    asset_type: 'ACTOR',
    name: 'Test Actor',
    seed: 12345,
    prompt_recipe: { identity: { age: 25 } },
    marketplace_status: null,
    is_marketplace_frozen: false,
    source_asset_id: null,
    source_type: 'ORIGINAL',
    deleted_at: null,
    sold_at: null,
    created_at: '2026-06-17T10:00:00Z',
    ...overrides,
  };
}
export function walletRow(overrides: Record<string, unknown> = {}) {
  return {
    id: WALLET,
    workspace_id: WS,
    account_id: ARTIST,
    balance_credits: 50,
    updated_at: '2026-06-17T10:00:00Z',
    ...overrides,
  };
}
export function outputRow(overrides: Record<string, unknown> = {}) {
  return {
    id: OUTPUT_V1,
    asset_id: ACTOR,
    layout_type: 'headshot',
    model: 'flux-pro',
    image_url: null,
    local_backup_url: null,
    cost_credits: 0.05,
    status: 'PENDING',
    version: 1,
    is_obsolete: false,
    obsolete_reason: null,
    error_message: null,
    generation_params: { seed: 1 },
    reference_images: null,
    source_asset_outputs: null,
    created_at: '2026-06-17T10:00:00Z',
    ...overrides,
  };
}
export function commissionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: COMMISSION,
    client_workspace_id: CLIENT_WS,
    studio_workspace_id: CLIENT_WS,
    client_id: CLIENT,
    assignee_id: null,
    title: 'Test Commission',
    brief: { description: 'test' },
    status: 'REQUESTED',
    premium_cost: 0,
    change_notes: null,
    submitted_at: null,
    approved_at: null,
    created_at: '2026-06-17T10:00:00Z',
    updated_at: '2026-06-17T10:00:00Z',
    ...overrides,
  };
}
export function listingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: LISTING,
    asset_id: ACTOR,
    listing_type: 'ACTOR_PACKAGE',
    price_credits: 25,
    is_active: true,
    purchased_by: null,
    purchased_at: null,
    seller_id: ARTIST,
    created_at: '2026-06-17T10:00:00Z',
    updated_at: '2026-06-17T10:00:00Z',
    ...overrides,
  };
}

export function resetMock() {
  mockQuery.mockReset();
}

// Re-export vi helpers for convenience
export { vi, describe, it, expect, beforeEach } from 'vitest';
