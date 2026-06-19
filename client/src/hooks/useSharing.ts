/**
 * API hooks for asset sharing — share, list permissions, revoke.
 * Dispatches ASSET_SHARED notification to the grantee after successful share.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { useCreateNotification } from '@/hooks/useNotifications';

export function useShareAsset() {
  const queryClient = useQueryClient();
  const createNotification = useCreateNotification();

  return useMutation({
    mutationFn: async (input: { assetId: string; granteeId: string }) => {
      const { data } = await apiClient.post(`/assets/${input.assetId}/share`, {
        grantee_id: input.granteeId,
      });
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['actors'] });
      queryClient.invalidateQueries({ queryKey: ['looks'] });
      queryClient.invalidateQueries({ queryKey: ['fashion-items'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });

      // Dispatch notification to the grantee (fire-and-forget, non-blocking)
      createNotification.mutate({
        recipientId: variables.granteeId,
        type: 'ASSET_SHARED',
        title: 'Asset Shared With You',
        message: `An asset has been shared with you.`,
      });
    },
  });
}
