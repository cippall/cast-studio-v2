/**
 * Integration: Marketplace Lifecycle
 *
 * Tests submit → approve → purchase workflow using mocked DB.
 * Single purchase model: ownership transfers to buyer, no duplication.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  vi,
  mockQuery,
  resetMock,
  mockPoolClient,
  ACTOR,
  ARTIST,
  CLIENT,
  CLIENT_WS,
  LISTING,
  ASSET,
  actorRow,
  walletRow,
  listingRow,
  adminAccount,
  clientAccount,
} from './integration-fixtures';

import * as marketplaceService from '../src/services/marketplace/index.js';
import * as poolModule from '../src/db/pool.js';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Get the mock client from the mocked pool module
async function getMockPoolClient() {
  return (await poolModule.getClient!()) as any;
}

describe('Integration: Marketplace Lifecycle (Single Purchase Model)', () => {
  beforeEach(() => {
    resetMock();
    mockPoolClient.query.mockReset().mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it('submits actor to marketplace, approves, purchases with ownership transfer', async () => {
    // --- Submit phase ---
    // Transaction: BEGIN + SELECT FOR UPDATE + getAssetOutputs (module query) + UPDATE + COMMIT
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
    mockPoolClient.query.mockResolvedValueOnce({ rows: [actorRow()] }); // SELECT FOR UPDATE
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'o1', layout_type: 'headshot', status: 'SUCCESS' },
        { id: 'o2', layout_type: 'fullshot', status: 'SUCCESS' },
        { id: 'o3', layout_type: 'expressions_3x4', status: 'SUCCESS' },
        { id: 'o4', layout_type: 'character_sheet', status: 'SUCCESS' },
        { id: 'o5', layout_type: 'editorial', status: 'SUCCESS' },
      ],
    } as any); // getAssetOutputs (uses module-level query)
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // UPDATE marketplace_status
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // COMMIT

    const submitted = await marketplaceService.submitAssetForMarketplace(ACTOR, adminAccount());
    expect(submitted.marketplace_status).toBe('MARKETPLACE_PENDING');

    // --- Approve phase ---
    resetMock();
    mockPoolClient.query.mockReset().mockResolvedValue({ rows: [], rowCount: 0 });
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
    mockPoolClient.query.mockResolvedValueOnce({
      rows: [actorRow({ marketplace_status: 'MARKETPLACE_PENDING' })],
    }); // SELECT FOR UPDATE
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // UPDATE assets
    mockPoolClient.query.mockResolvedValueOnce({ rows: [{ id: LISTING }] }); // INSERT listing
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // COMMIT

    const approved = await marketplaceService.approveSubmission(ACTOR, 25, ARTIST);
    expect(approved.marketplace_status).toBe('MARKETPLACE_APPROVED');

    // --- Purchase phase (duplicate asset into buyer workspace) ---
    resetMock();
    mockPoolClient.query.mockReset().mockResolvedValue({ rows: [], rowCount: 0 });
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
    mockPoolClient.query.mockResolvedValueOnce({
      rows: [listingRow()],
    }); // SELECT listing FOR UPDATE
    mockPoolClient.query.mockResolvedValueOnce({
      rows: [walletRow({ workspace_id: CLIENT_WS, account_id: CLIENT, balance_credits: 100 })],
    }); // SELECT wallet FOR UPDATE
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // UPDATE wallet (deduct)
    mockPoolClient.query.mockResolvedValueOnce({ rows: [{ id: 'ledger-1' }] }); // INSERT ledger CHARGE

    // findAssetById (module-level query)
    mockQuery.mockResolvedValueOnce({ rows: [actorRow()] } as any);

    // duplicateAsset (module-level query)
    const newAssetId = 'new-asset-uuid-0001';
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: newAssetId,
          workspace_id: CLIENT_WS,
          creator_id: CLIENT,
          asset_type: 'ACTOR',
          name: 'Test Actor',
          source_asset_id: ACTOR,
          source_type: 'MARKETPLACE_PURCHASE',
          client_id: null,
          marketplace_status: null,
          is_marketplace_frozen: false,
          deleted_at: null,
          seed: 12345,
          prompt_recipe: { identity: { age: 25 } },
          sold_at: null,
          created_at: '2026-06-22T10:00:00.000Z',
        },
      ],
    } as any);

    // duplicateAssetOutputs (module-level query)
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    // Freeze original asset
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // UPDATE assets (freeze)
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // UPDATE listing purchased_by
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // COMMIT

    const purchase = await marketplaceService.purchaseListing(LISTING, clientAccount());
    expect(purchase.listing_id).toBe(LISTING);
    expect(purchase.cost_credits).toBe(25);
    expect(purchase.new_balance).toBe(75);
  });

  it('rejects purchase when client has insufficient balance', async () => {
    resetMock();
    mockPoolClient.query.mockReset().mockResolvedValue({ rows: [], rowCount: 0 });
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
    mockPoolClient.query.mockResolvedValueOnce({ rows: [listingRow()] }); // SELECT listing
    mockPoolClient.query.mockResolvedValueOnce({
      rows: [walletRow({ workspace_id: CLIENT_WS, account_id: CLIENT, balance_credits: 5 })],
    }); // SELECT wallet
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // ROLLBACK (insufficient balance)

    await expect(marketplaceService.purchaseListing(LISTING, clientAccount())).rejects.toThrow();
  });

  it('rejects purchase when listing is already purchased', async () => {
    resetMock();
    mockPoolClient.query.mockReset().mockResolvedValue({ rows: [], rowCount: 0 });
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
    mockPoolClient.query.mockResolvedValueOnce({
      rows: [listingRow({ purchased_by: CLIENT })],
    }); // SELECT listing (already purchased)
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    await expect(marketplaceService.purchaseListing(LISTING, clientAccount())).rejects.toThrow(
      /already been purchased/,
    );
  });

  it('rejects submission when required outputs are missing', async () => {
    resetMock();
    mockPoolClient.query.mockReset().mockResolvedValue({ rows: [], rowCount: 0 });
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
    mockPoolClient.query.mockResolvedValueOnce({ rows: [actorRow()] }); // SELECT FOR UPDATE
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'o1', layout_type: 'headshot', status: 'SUCCESS' }],
    } as any); // getAssetOutputs
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    await expect(
      marketplaceService.submitAssetForMarketplace(ACTOR, adminAccount()),
    ).rejects.toThrow();
  });
});

describe('Single purchase model: duplication verification', () => {
  beforeEach(() => {
    resetMock();
    mockPoolClient.query.mockReset().mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it('duplicates asset into buyer workspace and freezes original', async () => {
    resetMock();
    mockPoolClient.query.mockReset().mockResolvedValue({ rows: [], rowCount: 0 });
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN (0)
    mockPoolClient.query.mockResolvedValueOnce({
      rows: [listingRow()],
    }); // SELECT listing FOR UPDATE (1)
    mockPoolClient.query.mockResolvedValueOnce({
      rows: [walletRow({ workspace_id: CLIENT_WS, account_id: CLIENT, balance_credits: 100 })],
    }); // SELECT wallet FOR UPDATE (2)
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // UPDATE wallet (3)
    mockPoolClient.query.mockResolvedValueOnce({ rows: [{ id: 'ledger-1' }] }); // INSERT ledger (4)

    // findAssetById (module-level query) (5)
    mockQuery.mockResolvedValueOnce({ rows: [actorRow()] } as any);

    // duplicateAsset (module-level query) (6)
    const newAssetId = 'new-asset-uuid-0002';
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: newAssetId,
          workspace_id: CLIENT_WS,
          creator_id: CLIENT,
          asset_type: 'ACTOR',
          name: 'Test Actor',
          source_asset_id: ACTOR,
          source_type: 'MARKETPLACE_PURCHASE',
          client_id: null,
          marketplace_status: null,
          is_marketplace_frozen: false,
          deleted_at: null,
          seed: 12345,
          prompt_recipe: { identity: { age: 25 } },
          sold_at: null,
          created_at: '2026-06-22T10:00:00.000Z',
        },
      ],
    } as any);

    // duplicateAssetOutputs (module-level query) (7)
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    // Freeze original asset (8)
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // UPDATE assets (freeze)
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // UPDATE listing purchased (9)
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // COMMIT (10)

    await marketplaceService.purchaseListing(LISTING, clientAccount());

    // Verify the freeze UPDATE was called
    const freezeCall = mockPoolClient.query.mock.calls.find(
      (call) =>
        (call[0] as string).includes('UPDATE assets SET') &&
        (call[0] as string).includes('is_marketplace_frozen'),
    );
    expect(freezeCall).toBeDefined();
    expect(freezeCall![1]).toContain(ACTOR); // original asset id

    // Verify duplicateAsset was called with buyer workspace
    const duplicateCall = mockQuery.mock.calls.find(
      (call) =>
        (call[0] as string).includes('INSERT INTO assets') &&
        (call[0] as string).includes('source_asset_id'),
    );
    expect(duplicateCall).toBeDefined();
    expect(duplicateCall![1]![0]).toBe(CLIENT_WS); // buyer's workspace
    expect(duplicateCall![1]![1]).toBe(CLIENT); // buyer as creator
  });
});
