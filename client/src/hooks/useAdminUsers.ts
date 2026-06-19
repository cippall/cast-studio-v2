/**
 * Admin users hooks — list and update users.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { PaginatedResponse, PaginationParams } from '@cast/types';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  workspace_id: string;
  is_api_able: boolean;
  is_active: boolean;
  created_at: string;
}

export function useAdminUsers(
  filters: PaginationParams & { role?: string; workspaceId?: string } = {},
) {
  return useQuery<PaginatedResponse<AdminUser>>({
    queryKey: ['admin', 'users', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.page) params.set('page', String(filters.page));
      if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
      if (filters.role) params.set('role', filters.role);
      if (filters.workspaceId) params.set('workspace_id', filters.workspaceId);
      const { data } = await apiClient.get(`/accounts?${params}`);
      return data;
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      name?: string;
      isApiAble?: boolean;
      role?: string | null;
    }) => {
      const { data } = await apiClient.patch(`/accounts/${input.id}`, {
        name: input.name,
        is_api_able: input.isApiAble,
        role: input.role,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}
