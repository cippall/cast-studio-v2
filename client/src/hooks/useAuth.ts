/**
 * Auth hooks: useAuth, useLogin, useLogout, useCurrentUser.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export interface Account {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'ARTIST' | 'CLIENT' | 'AGENT';
  workspace_id: string;
  is_api_able?: boolean;
}

export function useCurrentUser() {
  return useQuery<Account>({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const { data } = await apiClient.get('/auth/me');
      return data;
    },
    retry: false,
    staleTime: 1000 * 60 * 5,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const { data } = await apiClient.post('/auth/login', credentials);
      return data as Account;
    },
    onSuccess: (account) => {
      queryClient.setQueryData(['auth', 'me'], account);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await apiClient.post('/auth/logout');
    },
    onSuccess: () => {
      queryClient.setQueryData(['auth', 'me'], null);
      queryClient.clear();
    },
  });
}
