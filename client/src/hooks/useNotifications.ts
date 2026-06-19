/**
 * API hooks for notifications — list, unread count, mark read.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { PaginatedResponse, PaginationParams } from '@cast/types';

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export function useNotifications(filters: PaginationParams & { isRead?: boolean } = {}) {
  return useQuery<PaginatedResponse<Notification>>({
    queryKey: ['notifications', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.page) params.set('page', String(filters.page));
      if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
      if (filters.isRead !== undefined) params.set('is_read', String(filters.isRead));
      const { data } = await apiClient.get(`/notifications?${params}`);
      return data;
    },
  });
}

export function useUnreadNotificationCount() {
  return useQuery<number>({
    queryKey: ['notifications', 'unread'],
    queryFn: async () => {
      const { data } = await apiClient.get('/notifications', {
        params: { is_read: false, page: 1, pageSize: 1 },
      });
      return data.total ?? 0;
    },
    refetchInterval: 30_000, // poll every 30s
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.patch(`/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await apiClient.post('/notifications/read-all');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useCreateNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      recipientId: string;
      type: string;
      title: string;
      message: string;
    }) => {
      const { data } = await apiClient.post('/notifications', input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
