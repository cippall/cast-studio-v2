/**
 * TanStack React Query client configuration.
 * Query key patterns follow the project convention:
 *   ['actors']              — actor list
 *   ['actors', id]          — single actor
 *   ['looks']               — look list
 *   ['looks', id]           — single look
 *   ['fashion-items']       — fashion item list
 *   ['fashion-items', id]   — single fashion item
 *   ['auth', 'me']          — current user session
 *   ['notifications']       — notification list
 */
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
