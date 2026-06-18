/**
 * Integration: Wallet Operations
 *
 * Tests balance fetch, transactions, and error handling using mocked DB.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  vi,
  mockQuery,
  resetMock,
  ARTIST,
  WS,
  artistAccount,
  walletRow,
} from './integration-fixtures';

import * as walletService from '../src/services/wallet-service.js';

/* eslint-disable @typescript-eslint/no-explicit-any */

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
