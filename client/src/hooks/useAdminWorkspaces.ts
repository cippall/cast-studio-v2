/**
 * Workspace list hook — fetches all workspaces for admin filters.
 */
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export interface WorkspaceOption {
  id: string;
  name: string;
  slug: string;
}

export function useAdminWorkspaces() {
  return useQuery<WorkspaceOption[]>({
    queryKey: ['admin', 'workspaces'],
    queryFn: async () => {
      const { data } = await apiClient.get('/workspaces?pageSize=100');
      return data.data ?? data;
    },
  });
}
