/**
 * API hooks for wallet balance and dashboard stats.
 */
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { WalletBalance, DashboardStats, ArtistDashboard, ClientDashboard } from '@cast/types';

export function useWalletBalance() {
  return useQuery<WalletBalance>({
    queryKey: ['wallet'],
    queryFn: async () => {
      const { data } = await apiClient.get('/wallet');
      return data;
    },
  });
}

export type DashboardData = DashboardStats | ArtistDashboard | ClientDashboard;

export function useDashboardStats() {
  return useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const { data } = await apiClient.get('/dashboard');
      return data;
    },
  });
}
