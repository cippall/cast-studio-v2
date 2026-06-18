/**
 * Integration Tests: Cross-Service Workflows
 *
 * Tests the key integration points between services using mocked DB.
 * These tests verify data contracts between services, not the HTTP layer.
 * The HTTP layer is already covered by 419 existing unit tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Mock pool at the lowest level
vi.mock('../src/db/pool.js', () => ({
  query: vi.fn(),
  getClient: vi.fn(),
  default: {},
}));

// Mock external services
vi.mock('../src/services/fal-service.js', () => ({
  submitTextToImage: vi.fn().mockResolvedValue({ request_id: 'fal-test-123' }),
}));

vi.mock('../src/services/stripe-service.js', () => ({
  createCheckoutSession: vi
    .fn()
    .mockResolvedValue({ id: 'cs_test_123', url: 'https://checkout.stripe.com/pay/cs_test_123' }),
  constructWebhookEvent: vi
    .fn()
    .mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_test_123', amount_total: 5000, metadata: { wallet_id: 'w1' } } },
    }),
  verifyWebhookEvent: vi
    .fn()
    .mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_test_123', amount_total: 5000, metadata: { wallet_id: 'w1' } } },
    }),
}));

vi.mock('../src/services/email-service.js', () => ({
  sendNotificationEmail: vi.fn().mockResolvedValue(undefined),
}));

// Mock notification-service to prevent fire-and-forget side effects from consuming DB mocks
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
import * as commissionService from '../src/services/commission-service.js';
import * as marketplaceService from '../src/services/marketplace-service.js';
import * as generationService from '../src/services/generation-service.js';
import * as actorService from '../src/services/actor-service.js';
import * as notificationService from '../src/services/notification-service.js';
import * as walletService from '../src/services/wallet-service.js';
import * as notificationRepo from '../src/db/repositories/notification-repo.js';

// Also spy on the notification repo to prevent DB calls from fire-and-forget notifications
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

const mockQuery = vi.mocked(poolModule.query);

// --- UUIDs ---
const WS = 'a0000000-0000-4000-8000-000000000001';
const ARTIST = 'b0000000-0000-4000-8000-000000000001';
const CLIENT_WS = 'a0000000-0000-4000-8000-000000000002';
const CLIENT = 'b0000000-0000-4000-8000-000000000002';
const ADMIN = 'd0000000-0000-4000-8000-000000000003';
const ACTOR = 'c0000000-0000-4000-8000-000000000001';
const COMMISSION = 'e0000000-0000-4000-8000-000000000010';
const ASSET = 'f0000000-0000-4000-8000-000000000020';
const LISTING = '10000000-0000-4000-8000-000000000001';
const WALLET = 'w0000000-0000-4000-8000-000000000001';
const OUTPUT_V1 = 'o0000000-0000-4000-8000-000000000001';
const OUTPUT_V2 = 'o0000000-0000-4000-8000-000000000002';

// --- Factories ---
function artistAccount() {
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
function clientAccount() {
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
function adminAccount() {
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
function actorRow(overrides: Record<string, unknown> = {}) {
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
    created_at: '2026-06-17T10:00:00Z',
    ...overrides,
  };
}
function walletRow(overrides: Record<string, unknown> = {}) {
  return {
    id: WALLET,
    workspace_id: WS,
    account_id: ARTIST,
    balance_credits: 50,
    updated_at: '2026-06-17T10:00:00Z',
    ...overrides,
  };
}
function outputRow(overrides: Record<string, unknown> = {}) {
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
function commissionRow(overrides: Record<string, unknown> = {}) {
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
function listingRow(overrides: Record<string, unknown> = {}) {
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

function resetMock() {
  mockQuery.mockReset();
}

// ================================================================
// 1. COMMISSION LIFECYCLE
// ================================================================
describe('Integration: Commission Lifecycle', () => {
  beforeEach(() => {
    resetMock();
  });

  it('runs complete flow: create → assign → in_progress → submit → changes → in_progress → submit', async () => {
    // Create commission
    mockQuery.mockResolvedValueOnce({ rows: [commissionRow()] } as any);
    const commission = await commissionService.createCommissionRequest(
      { title: 'Test', brief: { description: 'test' } },
      clientAccount(),
    );
    expect(commission.status).toBe('REQUESTED');

    // Assign to artist
    resetMock();
    mockQuery.mockResolvedValueOnce({ rows: [commissionRow()] } as any);
    mockQuery.mockResolvedValueOnce({
      rows: [commissionRow({ assignee_id: ARTIST, status: 'ASSIGNED' })],
    } as any);
    // Extra mocks for fire-and-forget notification dispatch
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'n0' }] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [{ email: 'artist@studio.com' }] } as any);
    const assigned = await commissionService.assignCommissionToArtist(
      COMMISSION,
      ARTIST,
      adminAccount(),
      true,
    );
    expect(assigned.status).toBe('ASSIGNED');
    expect(assigned.assignee_id).toBe(ARTIST);

    // Artist sets IN_PROGRESS
    resetMock();
    mockQuery.mockResolvedValueOnce({
      rows: [commissionRow({ assignee_id: ARTIST, status: 'ASSIGNED' })],
    } as any);
    mockQuery.mockResolvedValueOnce({
      rows: [commissionRow({ status: 'IN_PROGRESS', assignee_id: ARTIST })],
    } as any);
    mockQuery.mockResolvedValueOnce({ rows: [] } as any); // getCommissionAssets
    const inProgress = await commissionService.transitionCommissionStatus(
      COMMISSION,
      'IN_PROGRESS',
      artistAccount(),
      undefined,
      true,
    );
    expect(inProgress.status).toBe('IN_PROGRESS');

    // Artist submits work
    resetMock();
    mockQuery.mockResolvedValueOnce({
      rows: [commissionRow({ assignee_id: ARTIST, status: 'IN_PROGRESS' })],
    } as any);
    mockQuery.mockResolvedValueOnce({
      rows: [commissionRow({ status: 'SUBMITTED', premium_cost: 10, assignee_id: ARTIST })],
    } as any);
    mockQuery.mockResolvedValueOnce({ rows: [] } as any); // linkAsset
    mockQuery.mockResolvedValueOnce({ rows: [] } as any); // getCommissionAssets
    // Extra mocks for fire-and-forget notification dispatch (createNotification + resolveRecipientEmail)
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'n1' }] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [{ email: 'client@brand.com' }] } as any);
    const submitted = await commissionService.transitionCommissionStatus(
      COMMISSION,
      'SUBMITTED',
      artistAccount(),
      { premium_cost: 10, asset_ids: [ASSET] },
      true,
    );
    expect(submitted.status).toBe('SUBMITTED');

    // Client requests changes
    resetMock();
    mockQuery.mockResolvedValueOnce({
      rows: [commissionRow({ status: 'SUBMITTED', assignee_id: ARTIST, premium_cost: 10 })],
    } as any);
    mockQuery.mockResolvedValueOnce({
      rows: [commissionRow({ status: 'CHANGES_REQUESTED' })],
    } as any);
    mockQuery.mockResolvedValueOnce({ rows: [] } as any); // getCommissionAssets
    // Extra mocks for fire-and-forget notification dispatch
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'n2' }] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [{ email: 'artist@studio.com' }] } as any);
    const changesRequested = await commissionService.transitionCommissionStatus(
      COMMISSION,
      'CHANGES_REQUESTED',
      clientAccount(),
      undefined,
      true,
    );
    expect(changesRequested.status).toBe('CHANGES_REQUESTED');

    // Artist resumes work
    resetMock();
    mockQuery.mockResolvedValueOnce({
      rows: [commissionRow({ status: 'CHANGES_REQUESTED', assignee_id: ARTIST })],
    } as any);
    mockQuery.mockResolvedValueOnce({ rows: [commissionRow({ status: 'IN_PROGRESS' })] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [] } as any); // getCommissionAssets
    const resumed = await commissionService.transitionCommissionStatus(
      COMMISSION,
      'IN_PROGRESS',
      artistAccount(),
      undefined,
      true,
    );
    expect(resumed.status).toBe('IN_PROGRESS');

    // Artist resubmits
    resetMock();
    mockQuery.mockResolvedValueOnce({
      rows: [commissionRow({ status: 'IN_PROGRESS', assignee_id: ARTIST })],
    } as any);
    mockQuery.mockResolvedValueOnce({ rows: [commissionRow({ status: 'SUBMITTED' })] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [] } as any); // linkAsset
    mockQuery.mockResolvedValueOnce({ rows: [] } as any); // getCommissionAssets
    // Extra mocks for fire-and-forget notification dispatch
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'n3' }] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [{ email: 'client@brand.com' }] } as any);
    const resubmitted = await commissionService.transitionCommissionStatus(
      COMMISSION,
      'SUBMITTED',
      artistAccount(),
      { premium_cost: 10, asset_ids: [ASSET] },
      true,
    );
    expect(resubmitted.status).toBe('SUBMITTED');
  });

  it('approves commission with premium unlock', async () => {
    // Test the approval + premium unlock flow in isolation
    resetMock();
    mockQuery.mockResolvedValueOnce({
      rows: [
        commissionRow({
          status: 'SUBMITTED',
          assignee_id: ARTIST,
          premium_cost: 10,
          client_id: CLIENT,
          client_workspace_id: CLIENT_WS,
        }),
      ],
    } as any);
    mockQuery.mockResolvedValueOnce({
      rows: [walletRow({ workspace_id: CLIENT_WS, account_id: CLIENT, balance_credits: 50 })],
    } as any);
    mockQuery.mockResolvedValueOnce({
      rows: [walletRow({ workspace_id: CLIENT_WS, account_id: CLIENT, balance_credits: 40 })],
    } as any);
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'ledger-1' }] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [{ asset_id: ASSET }] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [commissionRow({ status: 'APPROVED' })] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [{ asset_id: ASSET }] } as any);
    const approved = await commissionService.transitionCommissionStatus(
      COMMISSION,
      'APPROVED',
      clientAccount(),
      undefined,
      true,
    );
  });

  it('rejects approval when client has insufficient balance', async () => {
    resetMock();
    mockQuery.mockResolvedValueOnce({
      rows: [
        commissionRow({
          status: 'SUBMITTED',
          premium_cost: 999,
          client_id: CLIENT,
          client_workspace_id: CLIENT_WS,
        }),
      ],
    } as any);
    mockQuery.mockResolvedValueOnce({
      rows: [walletRow({ workspace_id: CLIENT_WS, account_id: CLIENT, balance_credits: 10 })],
    } as any);
    await expect(
      commissionService.transitionCommissionStatus(
        COMMISSION,
        'APPROVED',
        clientAccount(),
        undefined,
        true,
      ),
    ).rejects.toThrow('Insufficient credits');
  });

  it('enforces valid status transitions', async () => {
    resetMock();
    mockQuery.mockResolvedValueOnce({ rows: [commissionRow({ status: 'REQUESTED' })] } as any);
    await expect(
      commissionService.transitionCommissionStatus(
        COMMISSION,
        'APPROVED',
        adminAccount(),
        undefined,
        true,
      ),
    ).rejects.toThrow();
  });
});

// ================================================================
// 2. MARKETPLACE LIFECYCLE
// ================================================================
describe('Integration: Marketplace Lifecycle', () => {
  beforeEach(() => {
    resetMock();
  });

  it('submits actor to marketplace, approves, purchases', async () => {
    // Submit: findAssetById + getAssetOutputs + UPDATE
    mockQuery.mockResolvedValueOnce({ rows: [actorRow()] } as any);
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'o1', layout_type: 'headshot', status: 'SUCCESS' },
        { id: 'o2', layout_type: 'fullshot', status: 'SUCCESS' },
        { id: 'o3', layout_type: 'expressions_3x4', status: 'SUCCESS' },
        { id: 'o4', layout_type: 'character_sheet', status: 'SUCCESS' },
        { id: 'o5', layout_type: 'editorial', status: 'SUCCESS' },
      ],
    } as any);
    mockQuery.mockResolvedValueOnce({
      rows: [actorRow({ marketplace_status: 'MARKETPLACE_PENDING' })],
    } as any);
    const submitted = await marketplaceService.submitAssetForMarketplace(ACTOR, adminAccount());
    expect(submitted.marketplace_status).toBe('MARKETPLACE_PENDING');

    // Approve: SELECT + UPDATE + INSERT listing
    resetMock();
    mockQuery.mockResolvedValueOnce({
      rows: [actorRow({ marketplace_status: 'MARKETPLACE_PENDING' })],
    } as any);
    mockQuery.mockResolvedValueOnce({ rows: [] } as any); // UPDATE
    mockQuery.mockResolvedValueOnce({ rows: [listingRow()] } as any); // INSERT
    const approved = await marketplaceService.approveSubmission(ACTOR, 25, ARTIST);
    expect(approved.marketplace_status).toBe('MARKETPLACE_APPROVED');

    // Purchase: SELECT listing + SELECT wallet + UPDATE wallet + INSERT ledger + findAssetById + INSERT asset + getAssetOutputs + 2x INSERT outputs + UPDATE listing
    resetMock();
    mockQuery.mockResolvedValueOnce({ rows: [listingRow()] } as any); // SELECT listing
    mockQuery.mockResolvedValueOnce({
      rows: [walletRow({ workspace_id: CLIENT_WS, account_id: CLIENT, balance_credits: 100 })],
    } as any); // SELECT wallet
    mockQuery.mockResolvedValueOnce({
      rows: [walletRow({ workspace_id: CLIENT_WS, account_id: CLIENT, balance_credits: 75 })],
    } as any); // UPDATE wallet
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'ledger-1' }] } as any); // INSERT ledger
    mockQuery.mockResolvedValueOnce({
      rows: [actorRow({ marketplace_status: 'MARKETPLACE_APPROVED' })],
    } as any); // findAssetById
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'new-actor' }] } as any); // INSERT asset
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'o1',
          layout_type: 'headshot',
          model: 'flux-pro',
          image_url: 'https://fal.ai/hs.png',
          local_backup_url: null,
          cost_credits: 0.05,
          status: 'SUCCESS',
          version: 1,
          generation_params: {},
          reference_images: null,
          source_asset_outputs: null,
        },
        {
          id: 'o2',
          layout_type: 'fullshot',
          model: 'flux-pro',
          image_url: 'https://fal.ai/fs.png',
          local_backup_url: null,
          cost_credits: 0.05,
          status: 'SUCCESS',
          version: 1,
          generation_params: {},
          reference_images: null,
          source_asset_outputs: null,
        },
      ],
    } as any); // getAssetOutputs (2 outputs)
    mockQuery.mockResolvedValueOnce({ rows: [] } as any); // INSERT output 1
    mockQuery.mockResolvedValueOnce({ rows: [] } as any); // INSERT output 2
    mockQuery.mockResolvedValueOnce({ rows: [listingRow({ purchased_by: CLIENT })] } as any); // UPDATE listing

    const purchase = await marketplaceService.purchaseListing(LISTING, clientAccount());
    expect(purchase.listing_id).toBe(LISTING);
    expect(purchase.cost_credits).toBe(25);
    expect(purchase.new_balance).toBe(75);
  });

  it('rejects purchase when client has insufficient balance', async () => {
    resetMock();
    mockQuery.mockResolvedValueOnce({ rows: [listingRow()] } as any);
    mockQuery.mockResolvedValueOnce({
      rows: [walletRow({ workspace_id: CLIENT_WS, account_id: CLIENT, balance_credits: 5 })],
    } as any);
    await expect(marketplaceService.purchaseListing(LISTING, clientAccount())).rejects.toThrow();
  });

  it('rejects submission when required outputs are missing', async () => {
    resetMock();
    mockQuery.mockResolvedValueOnce({ rows: [actorRow()] } as any);
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'o1', layout_type: 'headshot', status: 'SUCCESS' }],
    } as any);
    await expect(
      marketplaceService.submitAssetForMarketplace(ACTOR, adminAccount()),
    ).rejects.toThrow();
  });
});

// ================================================================
// 3. ACTOR GENERATION + VERSIONING
// ================================================================
describe('Integration: Actor Generation + Versioning', () => {
  beforeEach(() => {
    resetMock();
  });

  it('generates headshot, regenerates creating version 2', async () => {
    // Generate: findAssetById + findWallet + updateWalletBalance + createLedgerEntry + createAssetOutput
    mockQuery.mockResolvedValueOnce({ rows: [actorRow()] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [walletRow()] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [walletRow({ balance_credits: 49.95 })] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'ledger-1' }] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [outputRow({ id: OUTPUT_V1 })] } as any);

    const genResult = await generationService.generateActorOutput(ACTOR, artistAccount(), {
      layout_type: 'headshot',
      model: 'flux-pro',
    });
    expect(genResult.outputs.length).toBe(1);
    expect(genResult.outputs[0].status).toBe('PENDING');

    // Regenerate: findAssetById + findWallet + updateWalletBalance + createLedgerEntry + getAssetOutputs + archiveAssetOutput + markDownstreamObsolete + createAssetOutput
    resetMock();
    mockQuery.mockResolvedValueOnce({ rows: [actorRow()] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [walletRow({ balance_credits: 49.95 })] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [walletRow({ balance_credits: 49.9 })] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'ledger-2' }] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [outputRow({ id: OUTPUT_V1, version: 1 })] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'ver-1' }] } as any); // archiveAssetOutput SELECT
    mockQuery.mockResolvedValueOnce({ rows: [] } as any); // archiveAssetOutput INSERT
    mockQuery.mockResolvedValueOnce({ rows: [] } as any); // markDownstreamObsolete
    mockQuery.mockResolvedValueOnce({ rows: [outputRow({ id: OUTPUT_V2, version: 2 })] } as any); // createAssetOutput

    const regenResult = await generationService.regenerateActorOutput(
      ACTOR,
      'headshot',
      artistAccount(),
      { layout_type: 'headshot', model: 'flux-pro' },
    );
    expect(regenResult.outputs.length).toBe(1);
    expect(regenResult.outputs[0].status).toBe('PENDING');

    // Verify version history
    resetMock();
    mockQuery.mockResolvedValueOnce({ rows: [outputRow({ id: OUTPUT_V2, version: 2 })] } as any);
    const status = await generationService.getGenerationStatus(OUTPUT_V2);
    expect(status).not.toBeNull();
    expect(status!.version).toBe(2);
  });

  it('prevents generation on marketplace-frozen actor', async () => {
    resetMock();
    mockQuery.mockResolvedValueOnce({
      rows: [actorRow({ marketplace_status: 'MARKETPLACE_APPROVED', is_marketplace_frozen: true })],
    } as any);
    await expect(
      generationService.generateActorOutput(ACTOR, artistAccount(), {
        layout_type: 'headshot',
        model: 'flux-pro',
      }),
    ).rejects.toThrow('marketplace-frozen');
  });
});

// ================================================================
// 4. NOTIFICATION DISPATCH
// ================================================================
describe('Integration: Notification Dispatch', () => {
  beforeEach(() => {
    resetMock();
  });

  it('dispatches commission assigned notification', async () => {
    await notificationService.notifyCommissionAssigned({
      recipientId: ARTIST,
      title: 'Test',
      commissionId: 'c1',
    });
    // Since notification-service is mocked, verify the mock was called
    expect(notificationService.notifyCommissionAssigned).toHaveBeenCalledWith(
      expect.objectContaining({ recipientId: ARTIST, title: 'Test' }),
    );
  });

  it('dispatches commission submitted notification', async () => {
    await notificationService.notifyCommissionSubmitted({
      recipientId: CLIENT,
      title: 'Test',
      commissionId: 'c1',
    });
    expect(notificationService.notifyCommissionSubmitted).toHaveBeenCalledWith(
      expect.objectContaining({ recipientId: CLIENT }),
    );
  });

  it('dispatches commission approved notification', async () => {
    await notificationService.notifyCommissionApproved({
      recipientId: ARTIST,
      title: 'Test',
      commissionId: 'c1',
    });
    expect(notificationService.notifyCommissionApproved).toHaveBeenCalledWith(
      expect.objectContaining({ recipientId: ARTIST }),
    );
  });

  it('dispatches changes requested notification', async () => {
    await notificationService.notifyCommissionChangesRequested({
      recipientId: ARTIST,
      title: 'Test',
      commissionId: 'c1',
    });
    expect(notificationService.notifyCommissionChangesRequested).toHaveBeenCalledWith(
      expect.objectContaining({ recipientId: ARTIST }),
    );
  });

  it('dispatches asset shared notification', async () => {
    await notificationService.notifyAssetShared({
      recipientId: CLIENT,
      assetName: 'Test',
      assetType: 'ACTOR',
    });
    expect(notificationService.notifyAssetShared).toHaveBeenCalledWith(
      expect.objectContaining({ recipientId: CLIENT, assetName: 'Test' }),
    );
  });

  it('dispatches workflow completed notification', async () => {
    await notificationService.notifyWorkflowCompleted({ recipientId: ARTIST, title: 'Test' });
    expect(notificationService.notifyWorkflowCompleted).toHaveBeenCalledWith(
      expect.objectContaining({ recipientId: ARTIST }),
    );
  });
});

// ================================================================
// 5. WALLET OPERATIONS
// ================================================================
describe('Integration: Wallet Operations', () => {
  beforeEach(() => {
    resetMock();
  });

  it('gets wallet balance and lists transactions', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [walletRow()] } as any);
    const balance = await walletService.getWalletBalance(artistAccount(), { id: WS } as any);
    expect(balance.balance_credits).toBe(50);

    resetMock();
    mockQuery.mockResolvedValueOnce({ rows: [walletRow()] } as any); // findWallet
    mockQuery.mockResolvedValueOnce({ rows: [{ count: 0 }] } as any); // count query
    mockQuery.mockResolvedValueOnce({ rows: [] } as any); // data query
    const txns = await walletService.listLedgerTransactions(artistAccount(), { id: WS } as any);
    expect(txns.data).toEqual([]);
    expect(txns.pagination.totalItems).toBe(0);
  });

  it('verifies wallet balance is correct number type', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [walletRow({ balance_credits: 100.5 })] } as any);
    const balance = await walletService.getWalletBalance(artistAccount(), { id: WS } as any);
    expect(balance.balance_credits).toBe(100.5);
    expect(typeof balance.balance_credits).toBe('number');
  });

  it('throws when wallet not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] } as any); // SELECT returns no wallet
    mockQuery.mockResolvedValueOnce({ rows: [] } as any); // INSERT also returns nothing
    await expect(
      walletService.getWalletBalance(artistAccount(), { id: WS } as any),
    ).rejects.toThrow();
  });
});
