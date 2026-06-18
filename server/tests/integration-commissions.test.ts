/**
 * Integration: Commission Lifecycle
 *
 * Tests the full commission workflow using mocked DB.
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
  COMMISSION,
  ARTIST,
  ASSET,
  CLIENT,
  CLIENT_WS,
  artistAccount,
  clientAccount,
  adminAccount,
  commissionRow,
  walletRow,
} from './integration-fixtures';

import * as commissionService from '../src/services/commission-service.js';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('Integration: Commission Lifecycle', () => {
  beforeEach(() => {
    resetMock();
  });

  it('runs complete flow: create → assign → in_progress → submit → changes → in_progress → submit', async () => {
    // Create commission: SELECT studio workspace + INSERT
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'a0000000-0000-4000-8000-000000000001' }],
    } as any); // SELECT studio workspace
    mockQuery.mockResolvedValueOnce({ rows: [commissionRow()] } as any); // INSERT commission
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
    // Extra mocks for fire-and-forget notification dispatch
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
    resetMock();
    mockPoolClient.query.mockReset().mockResolvedValue({ rows: [], rowCount: 0 });
    // findCommissionByIdUnfiltered
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
    // Transaction: BEGIN + SELECT wallet FOR UPDATE + UPDATE wallet + INSERT ledger + SELECT assets + UPDATE assets + COMMIT
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
    mockPoolClient.query.mockResolvedValueOnce({
      rows: [walletRow({ workspace_id: CLIENT_WS, account_id: CLIENT, balance_credits: 50 })],
    }); // SELECT wallet FOR UPDATE
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // UPDATE wallet
    mockPoolClient.query.mockResolvedValueOnce({ rows: [{ id: 'ledger-1' }] }); // INSERT ledger
    mockPoolClient.query.mockResolvedValueOnce({ rows: [{ asset_id: ASSET }] }); // SELECT commission_assets
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // UPDATE assets ownership
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // COMMIT
    // updateCommissionStatus
    mockQuery.mockResolvedValueOnce({
      rows: [commissionRow({ status: 'APPROVED' })],
    } as any);
    // getCommissionAssets
    mockQuery.mockResolvedValueOnce({ rows: [{ asset_id: ASSET }] } as any);
    const approved = await commissionService.transitionCommissionStatus(
      COMMISSION,
      'APPROVED',
      clientAccount(),
      undefined,
      true,
    );
    expect(approved.status).toBe('APPROVED');
  });

  it('rejects approval when client has insufficient balance', async () => {
    resetMock();
    mockPoolClient.query.mockReset().mockResolvedValue({ rows: [], rowCount: 0 });
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
    // Transaction: BEGIN + SELECT wallet FOR UPDATE (insufficient) + ROLLBACK
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
    mockPoolClient.query.mockResolvedValueOnce({
      rows: [walletRow({ workspace_id: CLIENT_WS, account_id: CLIENT, balance_credits: 10 })],
    }); // SELECT wallet FOR UPDATE
    mockPoolClient.query.mockResolvedValueOnce({ rows: [] }); // ROLLBACK
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
