/**
 * Fashion Item Detail — full item view with image, name, taxonomy values, and actions.
 */
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { useCurrentUser } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, ImageIcon, Loader2, Lock, RotateCcw, Send, Sparkles, Trash2 } from 'lucide-react';
import GenerationStatus from '@/components/GenerationStatus';
import type { GenerationState } from '@/components/GenerationStatus';
import type { MarketplaceStatus } from '@cast/types';

interface FashionItemOutput {
  id: string;
  image_url: string | null;
  model: string;
  status: string;
  cost_credits: number;
  error_message?: string | null;
}

interface FashionItemDetail {
  id: string;
  name: string;
  asset_type: string;
  image_url: string | null;
  outputs: FashionItemOutput[];
  taxonomy_values: Record<string, string>;
  marketplace_status?: string | null;
  is_marketplace_frozen?: boolean;
  source_type?: string;
  created_at: string;
}

function getOutputStatus(output: FashionItemOutput | undefined): GenerationState {
  if (!output) return 'SUCCESS';
  return (output.status as GenerationState) ?? 'SUCCESS';
}

export default function FashionItemDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'ADMIN';
  const isArtist = user?.role === 'ARTIST' || isAdmin;

  const { data: item, isLoading } = useQuery<FashionItemDetail>({
    queryKey: ['fashion-items', id],
    queryFn: async () => {
      if (!id) throw new Error('No item ID');
      const { data } = await apiClient.get(`/fashion-items/${id}`);
      return data;
    },
    enabled: !!id,
  });

  const isFrozen = item?.is_marketplace_frozen === true;
  const marketplaceStatus = item?.marketplace_status as MarketplaceStatus | null;

  const regenerateMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post(`/fashion-items/${id}/regenerate`, {});
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fashion-items', id] });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post(`/assets/${id}/duplicate`, {
        name: `${item?.name ?? 'Item'} (copy)`,
      });
      return data;
    },
    onSuccess: (data) => {
      navigate(`/fashion-items/${data.id}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiClient.delete(`/fashion-items/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fashion-items'] });
      navigate('/fashion-items');
    },
  });

  const submitMarketplaceMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post('/marketplace/submit', {
        asset_id: id,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fashion-items', id] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="flex flex-col items-center py-24 text-center">
        <p className="text-muted-foreground">Fashion item not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/fashion-items')}>
          Back to Items
        </Button>
      </div>
    );
  }

  const output = item.outputs?.[0];
  const isGenerating = regenerateMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Top bar: image + name + actions */}
      <div className="flex items-start gap-6">
        <div className="shrink-0">
          {item.image_url ? (
            <img src={item.image_url} alt={item.name} className="size-40 rounded-lg object-cover" />
          ) : output?.image_url ? (
            <img
              src={output.image_url}
              alt={item.name}
              className="size-40 rounded-lg object-cover"
            />
          ) : (
            <div className="flex size-40 items-center justify-center rounded-lg bg-muted">
              <ImageIcon className="size-12 text-muted-foreground" />
            </div>
          )}
        </div>

        <div className="flex-1 space-y-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{item.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {Object.entries(item.taxonomy_values ?? {}).map(
                ([key, value]) =>
                  value && (
                    <Badge key={key} variant="secondary">
                      {key}: {value}
                    </Badge>
                  ),
              )}
              {marketplaceStatus && marketplaceStatus !== 'NONE' && (
                <Badge
                  variant={marketplaceStatus === 'MARKETPLACE_APPROVED' ? 'default' : 'outline'}
                >
                  <Lock className="mr-1 size-3" />
                  {marketplaceStatus.replace('MARKETPLACE_', '')}
                </Badge>
              )}
              <GenerationStatus status={getOutputStatus(output)} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {isArtist && (
              <>
                <Button variant="outline" size="sm" onClick={() => duplicateMutation.mutate()}>
                  <Copy className="mr-2 size-4" />
                  Duplicate
                </Button>
                <Button
                  size="sm"
                  disabled={isFrozen}
                  onClick={() => submitMarketplaceMutation.mutate()}
                >
                  <Send className="mr-2 size-4" />
                  Submit to Marketplace
                </Button>
              </>
            )}
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => deleteMutation.mutate()}
              >
                <Trash2 className="mr-2 size-4" />
                Delete
              </Button>
            )}
          </div>

          {isFrozen && (
            <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300">
              <Lock className="size-4" />
              This item is marketplace-listed and frozen.
            </div>
          )}
        </div>
      </div>

      {/* Main image */}
      <div className="space-y-4">
        {output?.image_url ? (
          <div className="space-y-4">
            <img src={output.image_url} alt={item.name} className="max-w-2xl rounded-lg" />
            {isArtist && !isFrozen && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => regenerateMutation.mutate()}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <RotateCcw className="mr-2 size-4" />
                )}
                Regenerate
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 py-12">
            <ImageIcon className="size-16 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {output?.status === 'PENDING' ? 'Generating item...' : 'No image generated yet.'}
            </p>
            {output?.status === 'FAILED' && output.error_message && (
              <p className="text-sm text-destructive">{output.error_message}</p>
            )}
            {isArtist && !isFrozen && (
              <Button size="sm" onClick={() => regenerateMutation.mutate()} disabled={isGenerating}>
                <Sparkles className="mr-2 size-4" />
                Generate
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Source info */}
      {item.source_type && item.source_type !== 'ORIGINAL' && (
        <div className="text-sm text-muted-foreground">
          Source: {item.source_type.replace('_', ' ').toLowerCase()}
        </div>
      )}
    </div>
  );
}
