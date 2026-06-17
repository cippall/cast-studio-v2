import type { AccountRow, WorkspaceRow } from '../middleware/requireSession.js';
import * as walletRepo from '../db/repositories/wallet-repo.js';
import * as stripeService from './stripe-service.js';

export type WalletBalance = {
  id: string;
  balance_credits: number;
  updated_at: string;
};

export type LedgerEntry = walletRepo.LedgerRow;

export type ListTransactionsResult = {
  data: LedgerEntry[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

export interface TopUpResult {
  wallet: WalletBalance;
  ledger: LedgerEntry;
}

export async function getWalletBalance(
  account: AccountRow,
  _workspace: WorkspaceRow,
): Promise<WalletBalance> {
  const wallet = await walletRepo.findWallet({
    workspaceId: account.workspace_id,
    accountId: account.id,
    allowCreate: true,
  });

  if (!wallet) {
    throw Object.assign(new Error('Wallet not found'), { statusCode: 404 });
  }

  return {
    id: wallet.id,
    balance_credits: wallet.balance_credits,
    updated_at: wallet.updated_at,
  };
}

export interface CreateStripeTopUpInput {
  amount: number;
}

export async function createStripeTopUp(
  _account: AccountRow,
  _workspace: WorkspaceRow,
  _input: CreateStripeTopUpInput,
  _baseUrl: string,
): Promise<{ sessionUrl: string }> {
  throw Object.assign(new Error('Stripe top-up is not implemented yet'), { statusCode: 501 });
}

export async function applyStripeTopUp(
  workspaceId: string,
  accountId: string,
  amount: number,
  _paymentIntentId: string,
): Promise<TopUpResult> {
  const wallet = await walletRepo.findWallet({
    workspaceId,
    accountId,
    allowCreate: true,
  });

  if (!wallet) {
    throw Object.assign(new Error('Wallet not found'), { statusCode: 404 });
  }

  const currentBalance = wallet.balance_credits;
  const normalizedAmount = Number(amount.toFixed(4));
  const newBalance = Number((currentBalance + normalizedAmount).toFixed(4));

  const updatedWallet = await walletRepo.updateWalletBalance(wallet.id, newBalance);

  const ledger = await walletRepo.createLedgerEntry({
    workspaceId,
    walletId: wallet.id,
    amount: Number(normalizedAmount.toFixed(4)),
    type: 'TOP_UP',
  });

  return {
    wallet: {
      id: updatedWallet.id,
      balance_credits: updatedWallet.balance_credits,
      updated_at: updatedWallet.updated_at,
    },
    ledger,
  };
}

export async function reserveCreditsForGeneration(
  account: AccountRow,
  workspace: WorkspaceRow,
  amount: number,
): Promise<{ wallet: walletRepo.WalletRow; ledger: walletRepo.LedgerRow }> {
  return walletRepo.reserveCreditsForGeneration(workspace.id, account, amount);
}

export async function listLedgerTransactions(
  account: AccountRow,
  _workspace: WorkspaceRow,
  options?: { type?: string; page?: number; pageSize?: number },
): Promise<ListTransactionsResult> {
  const wallet = await walletRepo.findWallet({
    workspaceId: account.workspace_id,
    accountId: account.id,
    allowCreate: true,
  });

  if (!wallet) {
    return {
      data: [],
      pagination: {
        page: options?.page ?? 1,
        pageSize: options?.pageSize ?? 20,
        totalItems: 0,
        totalPages: 0,
      },
    };
  }

  return walletRepo.listLedgerEntries({
    walletId: wallet.id,
    type: options?.type,
    page: options?.page,
    pageSize: options?.pageSize,
  });
}

/**
 * Handle a Stripe webhook event.
 * Verifies the event signature and processes checkout.session.completed.
 * Idempotent: duplicate events are silently ignored.
 */
export async function handleStripeWebhook(
  payload: string,
  signature: string,
  _workspaceId: string,
): Promise<void> {
  const event = await stripeService.verifyWebhookEvent(payload, signature);

  if (event.type !== 'checkout.session.completed') {
    return;
  }

  const session = event.data.object as Record<string, unknown>;
  const paymentIntentId = session.id as string;
  const metadata = session.metadata as Record<string, string> | undefined;

  if (!metadata?.workspaceId || !metadata?.accountId) {
    return;
  }

  const amount = Number.parseFloat(metadata.amount ?? '0');
  if (amount <= 0) {
    return;
  }

  // Check idempotency: if a ledger entry already exists for this session, skip
  const existingWallet = await walletRepo.findWallet({
    workspaceId: metadata.workspaceId,
    accountId: metadata.accountId,
  });

  if (existingWallet) {
    const existingEntries = await walletRepo.listLedgerEntries({
      walletId: existingWallet.id,
    });
    const alreadyProcessed = existingEntries.data.some(
      (entry) => entry.workflow_id === paymentIntentId,
    );
    if (alreadyProcessed) {
      return;
    }
  }

  await applyStripeTopUp(metadata.workspaceId, metadata.accountId, amount, paymentIntentId);
}
