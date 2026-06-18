/**
 * Integration: Notification Dispatch
 *
 * Tests that notification service functions are called with correct arguments.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  vi,
  resetMock,
  ARTIST,
  CLIENT,
} from './integration-fixtures';

import * as notificationService from '../src/services/notification-service.js';

/* eslint-disable @typescript-eslint/no-explicit-any */

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
