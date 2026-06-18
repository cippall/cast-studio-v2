import { query } from '../pool.js';
import type { AccountRow } from '../../middleware/requireSession.js';

/**
 * Simple in-memory wallet cache with TTL.
 * Cache entries are scoped per (workspaceId, accountId) and auto-expire.
 * Cleared on balance updates to prevent stale reads.
 */
const walletCache = new Map<string, { row: WalletRow; expiresAt: number }>();
const WALLET_CACHE_TTL_MS = process.env.VITEST ? 0 : 5000;

function walletCacheKey(workspaceId: string, accountId: string): string {
  return `${workspaceId}:${accountId}`;
}

function getCachedWallet(workspaceId: string, accountId: string): WalletRow | null {
  const entry = walletCache.get(walletCacheKey(workspaceId, accountId));
  if (entry && Date.now() < entry.expiresAt) return entry.row;
  if (entry) walletCache.delete(walletCacheKey(workspaceId, accountId));
  return null;
}

function setCachedWallet(workspaceId: string, accountId: string, row: WalletRow): void {
  walletCache.set(walletCacheKey(workspaceId, accountId), {
    row,
    expiresAt: Date.now() + WALLET_CACHE_TTL_MS,
  });
}

/** Invalidate all wallet cache entries. Called after balance updates. */
export function invalidateWalletCache(): void {
  walletCache.clear();
}

export interface WalletRow {
  id: string;
  workspace_id: string;
  account_id: string;
  balance_credits: number;
  updated_at: string;
}

export interface LedgerRow {
  id: string;
  workspace_id: string;
  wallet_id: string;
  workflow_id: string | null;
  api_key_id: string | null;
  amount: number;
  type: string;
  created_at: string;
}

export type LedgerType = 'CHARGE' | 'TOP_UP' | 'ESCROW_HOLD' | 'ESCROW_REFUND';

export interface FindWalletInput {
  workspaceId: string;
  accountId: string;
  forUpdate?: boolean;
  allowCreate?: boolean;
}

export interface CreateLedgerInput {
  workspaceId: string;
  walletId: string;
  amount: number;
  type: LedgerType;
  workflowId?: string | null;
  apiKeyId?: string | null;
}

export interface ListLedgerInput {
  walletId: string;
  type?: string;
  page?: number;
  pageSize?: number;
}

function asLedgerRow(row: Record<string, unknown>): LedgerRow {
  return {
    id: String(row.id),
    workspace_id: String(row.workspace_id),
    wallet_id: String(row.wallet_id),
    workflow_id:
      row.workflow_id === undefined || row.workflow_id === null ? null : String(row.workflow_id),
    api_key_id:
      row.api_key_id === undefined || row.api_key_id === null ? null : String(row.api_key_id),
    amount: Number(Number.parseFloat(String(row.amount)).toFixed(4)),
    type: String(row.type),
    created_at: String(row.created_at),
  };
}

function asWalletRow(row: Record<string, unknown>): WalletRow {
  return {
    id: String(row.id),
    workspace_id: String(row.workspace_id),
    account_id: String(row.account_id),
    balance_credits: Number(Number.parseFloat(String(row.balance_credits)).toFixed(4)),
    updated_at: String(row.updated_at),
  };
}

export async function findWallet(input: FindWalletInput): Promise<WalletRow | null> {
  const { workspaceId, accountId, allowCreate } = input;

  // Check cache first to avoid repeated DB hits within the same request
  const cached = getCachedWallet(workspaceId, accountId);
  if (cached) return cached;

  const walletResult = await query(
    `SELECT * FROM wallets WHERE workspace_id = $1 AND account_id = $2 LIMIT 1`,
    [workspaceId, accountId],
  );

  if (walletResult.rows.length > 0) {
    const row = asWalletRow(walletResult.rows[0] as Record<string, unknown>);
    setCachedWallet(workspaceId, accountId, row);
    return row;
  }

  if (!allowCreate) {
    return null;
  }

  const createdResult = await query(
    `INSERT INTO wallets (workspace_id, account_id) VALUES ($1, $2) RETURNING *`,
    [workspaceId, accountId],
  );

  const row = asWalletRow(createdResult.rows[0] as Record<string, unknown>);
  setCachedWallet(workspaceId, accountId, row);
  return row;
}

export async function createLedgerEntry(input: CreateLedgerInput): Promise<LedgerRow> {
  const result = await query(
    `INSERT INTO ledger (workspace_id, wallet_id, workflow_id, api_key_id, amount, type)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      input.workspaceId,
      input.walletId,
      input.workflowId ?? null,
      input.apiKeyId ?? null,
      Number(input.amount.toFixed(4)),
      input.type,
    ],
  );

  return asLedgerRow(result.rows[0] as Record<string, unknown>);
}

export async function updateWalletBalance(walletId: string, balance: number): Promise<WalletRow> {
  const result = await query(
    `UPDATE wallets SET balance_credits = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [Number(balance.toFixed(4)), walletId],
  );

  // Invalidate all cache entries — short TTL means this is safe,
  // and avoids needing workspace_id/account_id context here
  walletCache.clear();

  return asWalletRow(result.rows[0] as Record<string, unknown>);
}

export async function listLedgerEntries(input: ListLedgerInput): Promise<{
  data: LedgerRow[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}> {
  const { walletId, type, page = 1, pageSize = 20 } = input;
  const params: unknown[] = [walletId];
  const conditions: string[] = ['wallet_id = $1'];
  let idx = 2;

  if (type) {
    conditions.push(`type = $${idx++}`);
    params.push(type);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const countSql = `SELECT COUNT(*)::int AS count FROM ledger ${whereClause}`;
  const countResult = await query(countSql, params);
  const countRow = countResult.rows[0] as { count?: number } | undefined;
  const totalItems = typeof countRow?.count === 'number' ? countRow.count : 0;

  const offset = (page - 1) * pageSize;
  const dataSql = `
    SELECT * FROM ledger
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${idx} OFFSET $${idx + 1}
  `;
  const dataResult = await query(dataSql, [...params, pageSize, offset]);

  const data = (dataResult.rows as Record<string, unknown>[]).map(asLedgerRow);

  return {
    data,
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages: totalItems > 0 ? Math.ceil(totalItems / pageSize) : 0,
    },
  };
}

export async function reserveCreditsForGeneration(
  workspaceId: string,
  account: AccountRow,
  amount: number,
): Promise<{ wallet: WalletRow; ledger: LedgerRow }> {
  const wallet = await findWallet({ workspaceId, accountId: account.id, allowCreate: true });

  if (!wallet) {
    throw Object.assign(new Error('Wallet not found'), { statusCode: 404 });
  }

  const currentBalance = wallet.balance_credits;

  if (currentBalance < amount) {
    throw new InsufficientCreditsError(currentBalance, amount);
  }

  const newBalance = Number((currentBalance - amount).toFixed(4));
  const updatedWallet = await updateWalletBalance(wallet.id, newBalance);
  const ledger = await createLedgerEntry({
    workspaceId,
    walletId: wallet.id,
    amount: Number((-amount).toFixed(4)),
    type: 'CHARGE',
  });

  return { wallet: updatedWallet, ledger };
}

export class InsufficientCreditsError extends Error {
  constructor(
    public currentBalance: number,
    public required: number,
  ) {
    super(`Insufficient credits. Your balance: ${currentBalance}. Required: ${required}.`);
    this.name = 'InsufficientCreditsError';
  }
}
