/**
 * API hooks for wallet balance and dashboard stats.
 */
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { WalletBalance, DashboardStats } from '@cast/types';

export function useWalletBalance() {
  return useQuery<WalletBalance>({
    queryKey: ['wallet'],
    queryFn: async () => {
      const { data } = await apiClient.get('/wallet');
      return data;
    },
  });
}

export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const { data } = await apiClient.get('/dashboard');
      return data;
    },
  });
}
