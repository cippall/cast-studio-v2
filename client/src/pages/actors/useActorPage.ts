import { useState, useMemo, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { useLooks } from '@/hooks/useLooks';
import type { MarketplaceStatus } from '@cast/types';
import type { ActorDetail, ActorOutput } from './actor-page-types';

export function useActorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: looksData } = useLooks({});
  const looks = looksData?.data ?? [];

  const {
    data: actor,
    isLoading,
    isError,
    error,
  } = useQuery<ActorDetail>({
    queryKey: ['actors', id],
    queryFn: async () => {
      if (!id) throw new Error('No actor ID');
      const { data } = await apiClient.get(`/actors/${id}`);
      return data;
    },
    enabled: !!id,
  });

  const isFrozen = actor?.is_marketplace_frozen === true;
  const marketplaceStatus = actor?.marketplace_status as MarketplaceStatus | null;

  const generateMutation = useMutation({
    mutationFn: async (layoutType: string) => {
      const body: Record<string, unknown> = { layout_type: layoutType };
      if (layoutType === 'character_sheet') body.look_id = characterSheetLookIdRef.current;
      const { data } = await apiClient.post(`/actors/${id}/generate`, body);
      return (data.outputs ?? data) as ActorOutput[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actors', id] });
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: async (layoutType: string) => {
      const { data } = await apiClient.post(`/actors/${id}/regenerate`, {
        layout_type: layoutType,
      });
      return (data.outputs ?? data) as ActorOutput[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actors', id] });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post(`/assets/${id}/duplicate`, {
        name: `${actor?.name ?? 'Actor'} (copy)`,
      });
      return data;
    },
    onSuccess: (data) => {
      navigate(`/actors/${data.id}`);
    },
  });

  const submitMarketplaceMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post('/marketplace/submit', { asset_id: id });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actors', id] });
    },
  });

  const [characterSheetLookId, setCharacterSheetLookId] = useState('');
  const characterSheetLookIdRef = useRef(characterSheetLookId);
  useEffect(() => {
    characterSheetLookIdRef.current = characterSheetLookId;
  }, [characterSheetLookId]);
  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(['headshot', 'fullshot', 'expressions_3x4', 'character_sheet', 'editorial']),
  );

  const toggleSection = (key: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const requiredOutputs = ['headshot', 'fullshot', 'expressions_3x4'] as const;
  const missingOutputs = useMemo(() => {
    if (!actor?.outputs) return requiredOutputs.slice();
    return requiredOutputs.filter((key) => {
      const output = actor.outputs[key];
      return !output || output.status !== 'SUCCESS';
    });
  }, [actor?.outputs]);

  const hasRequiredOutputs = missingOutputs.length === 0;
  const isGenerating = generateMutation.isPending || regenerateMutation.isPending;

  return {
    actor,
    isLoading,
    isError,
    error,
    looks,
    isFrozen,
    marketplaceStatus,
    characterSheetLookId,
    setCharacterSheetLookId,
    openSections,
    toggleSection,
    missingOutputs,
    hasRequiredOutputs,
    isGenerating,
    generateMutation,
    regenerateMutation,
    duplicateMutation,
    submitMarketplaceMutation,
  };
}
