/**
 * API hooks for wallet — balance, transactions, top-up.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { PaginatedResponse, PaginationParams } from '@cast/types';

export interface WalletBalance {
  id: string;
  balance_credits: number;
  updated_at: string;
}

export interface LedgerEntry {
  id: string;
  amount: number;
  type: string;
  created_at: string;
}

export function useWalletBalance() {
  return useQuery<WalletBalance>({
    queryKey: ['wallet'],
    queryFn: async () => {
      const { data } = await apiClient.get('/wallet');
      return data;
    },
  });
}

export function useWalletTransactions(filters: PaginationParams & { type?: string } = {}) {
  return useQuery<PaginatedResponse<LedgerEntry>>({
    queryKey: ['wallet', 'transactions', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.page) params.set('page', String(filters.page));
      if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
      if (filters.type) params.set('type', filters.type);
      const { data } = await apiClient.get(`/wallet/transactions?${params}`);
      return data;
    },
  });
}

export function useTopUpWallet() {
  return useMutation({
    mutationFn: async (amount: number) => {
      const { data } = await apiClient.post('/wallet/top-up', { amount });
      return data as { checkout_url: string };
    },
  });
}
