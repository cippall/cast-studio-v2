/**
 * Integration: Marketplace Lifecycle
 *
 * Tests submit → approve → purchase workflow using mocked DB.
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

import * as marketplaceService from '../src/services/marketplace-service.js';
import * as poolModule from '../src/db/pool.js';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Get the mock client from the mocked pool module
async function getMockPoolClient() {
  return (await poolModule.getClient!()) as any;
}

describe('Integration: Marketplace Lifecycle', () => {
  beforeEach(() => {
    resetMock();
    mockPoolClient.query.mockReset().mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it('submits actor to marketplace, approves, purchases', async () => {
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
    }); // getAssetOutputs (uses module-level query)
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

    // --- Purchase phase ---
    resetMock();
    mockPoolClient.query.mockReset().mockResolvedValue({ rows: [], rowCount: 0 });
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
    mockPoolClient.query.mockResolvedValueOnce({ rows: [listingRow()] }); // SELECT listing FOR UPDATE
    mockPoolClient.query.mockResolvedValueOnce({
      rows: [walletRow({ workspace_id: CLIENT_WS, account_id: CLIENT, balance_credits: 100 })],
    }); // SELECT wallet FOR UPDATE
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // UPDATE wallet
    mockPoolClient.query.mockResolvedValueOnce({ rows: [{ id: 'ledger-1' }] }); // INSERT ledger
    mockPoolClient.query.mockResolvedValueOnce({
      rows: [actorRow({ marketplace_status: 'MARKETPLACE_APPROVED' })],
    }); // SELECT source asset
    mockPoolClient.query.mockResolvedValueOnce({ rows: [{ id: 'new-actor' }] }); // INSERT duplicate asset
    mockPoolClient.query.mockResolvedValueOnce({
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
    }); // SELECT source outputs
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // INSERT duplicate outputs
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // UPDATE listing purchased
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

  it('rejects submission when required outputs are missing', async () => {
    resetMock();
    mockPoolClient.query.mockReset().mockResolvedValue({ rows: [], rowCount: 0 });
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
    mockPoolClient.query.mockResolvedValueOnce({ rows: [actorRow()] }); // SELECT FOR UPDATE
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'o1', layout_type: 'headshot', status: 'SUCCESS' }],
    }); // getAssetOutputs
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    await expect(
      marketplaceService.submitAssetForMarketplace(ACTOR, adminAccount()),
    ).rejects.toThrow();
  });
});
