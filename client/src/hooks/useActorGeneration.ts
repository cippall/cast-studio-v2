/**
 * Actor generation hooks — generate, regenerate, and poll for PENDING status.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { GenerationStatus } from '@cast/types';

export interface GenerationOutput {
  id: string;
  layout_type: string;
  status: GenerationStatus | string;
  model: string;
  cost_credits: number;
  image_url?: string | null;
  error_message?: string | null;
}

export interface GenerateRequest {
  layout_type: string;
  model?: string;
  options?: Record<string, unknown>;
}

const POLL_INTERVAL_MS = 2000;

function outputsToRecord(outputs: GenerationOutput[]): Record<string, GenerationOutput> {
  const record: Record<string, GenerationOutput> = {};
  for (const output of outputs) {
    record[output.layout_type] = output;
  }
  return record;
}

/**
 * Generate a specific layout for an actor.
 * Returns 202 with PENDING outputs. Poll useGenerationJob for status.
 */
export function useGenerateActor(actorId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (req: GenerateRequest) => {
      const { data } = await apiClient.post(`/actors/${actorId}/generate`, req);
      return (data.outputs ?? data) as GenerationOutput[];
    },
    onSuccess: (outputs) => {
      // Merge new outputs into the actor cache
      queryClient.setQueryData(
        ['actors', actorId],
        (old: { outputs?: Record<string, GenerationOutput> } | undefined) => {
          if (!old) return old;
          const newOutputs = outputsToRecord(outputs);
          return {
            ...old,
            outputs: { ...(old.outputs ?? {}), ...newOutputs },
          };
        },
      );
      // Invalidate to trigger refetch
      queryClient.invalidateQueries({ queryKey: ['actors', actorId] });
    },
  });
}

/**
 * Regenerate a specific layout (archives old, creates new PENDING).
 */
export function useRegenerateActor(actorId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (req: GenerateRequest) => {
      const { data } = await apiClient.post(`/actors/${actorId}/regenerate`, req);
      return (data.outputs ?? data) as GenerationOutput[];
    },
    onSuccess: (outputs) => {
      queryClient.setQueryData(
        ['actors', actorId],
        (old: { outputs?: Record<string, GenerationOutput> } | undefined) => {
          if (!old) return old;
          const newOutputs = outputsToRecord(outputs);
          return {
            ...old,
            outputs: { ...(old.outputs ?? {}), ...newOutputs },
          };
        },
      );
      queryClient.invalidateQueries({ queryKey: ['actors', actorId] });
    },
  });
}

/**
 * Poll a single generation job by output ID.
 */
export function useGenerationJob(outputId: string | null) {
  return useQuery({
    queryKey: ['generation-jobs', outputId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/generation-jobs/${outputId}`);
      return data as GenerationOutput;
    },
    enabled: !!outputId,
    refetchInterval: (query) => {
      const state = query.state.data;
      if (state && (state.status === 'SUCCESS' || state.status === 'FAILED')) {
        return false;
      }
      return POLL_INTERVAL_MS;
    },
  });
}

/**
 * Poll all PENDING outputs for an actor.
 * Refetches actor data when any output is PENDING.
 */
export function usePollActorGeneration(
  actorId: string,
  outputs: Record<string, GenerationOutput> | undefined,
) {
  const queryClient = useQueryClient();

  const pendingOutputs = outputs
    ? Object.values(outputs).filter((o) => o.status === 'PENDING')
    : [];

  return useQuery({
    queryKey: ['actors', actorId, 'poll-generation'],
    queryFn: async () => {
      const { data } = await apiClient.get(`/actors/${actorId}`);
      const result = data as { outputs: Record<string, GenerationOutput> };
      // Update the main actor cache with fresh data
      queryClient.setQueryData(['actors', actorId], (old: unknown) => {
        if (!old) return result;
        return { ...(old as object), outputs: result.outputs };
      });
      return result;
    },
    enabled: pendingOutputs.length > 0,
    refetchInterval: POLL_INTERVAL_MS,
  });
}
