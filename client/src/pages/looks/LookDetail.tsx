/**
 * Look Detail — full look view with image, name, taxonomy values, and actions.
 */
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { useCurrentUser } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, ImageIcon, Loader2, Lock, RotateCcw, Send, Sparkles, Trash2 } from 'lucide-react';
import GenerationStatus from '@/components/GenerationStatus';
import ErrorState from '@/components/ErrorState';
import LoadingState from '@/components/LoadingState';
import type { GenerationState } from '@/components/GenerationStatus';
import type { MarketplaceStatus } from '@cast/types';
import AssetDetailLayout from '@/components/layout/AssetDetailLayout';
import PageContainer from '@/components/layout/PageContainer';

interface LookOutput {
  id: string;
  image_url: string | null;
  model: string;
  status: string;
  cost_credits: number;
  error_message?: string | null;
}

interface LookDetail {
  id: string;
  name: string;
  asset_type: string;
  image_url: string | null;
  outputs: LookOutput[];
  taxonomy_values: Record<string, string>;
  marketplace_status?: string | null;
  is_marketplace_frozen?: boolean;
  source_type?: string;
  created_at: string;
}

function getOutputStatus(output: LookOutput | undefined): GenerationState {
  if (!output) return 'SUCCESS';
  return (output.status as GenerationState) ?? 'SUCCESS';
}

export default function LookDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'ADMIN';
  const isArtist = user?.role === 'ARTIST' || isAdmin;

  const {
    data: look,
    isLoading,
    isError,
    error,
  } = useQuery<LookDetail>({
    queryKey: ['looks', id],
    queryFn: async () => {
      if (!id) throw new Error('No look ID');
      const { data } = await apiClient.get(`/looks/${id}`);
      return data;
    },
    enabled: !!id,
  });

  const isFrozen = look?.is_marketplace_frozen === true;
  const marketplaceStatus = look?.marketplace_status as MarketplaceStatus | null;

  const regenerateMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post(`/looks/${id}/regenerate`, {});
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['looks', id] });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post(`/assets/${id}/duplicate`, {
        name: `${look?.name ?? 'Look'} (copy)`,
      });
      return data;
    },
    onSuccess: (data) => {
      navigate(`/looks/${data.id}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiClient.delete(`/looks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['looks'] });
      navigate('/looks');
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
      queryClient.invalidateQueries({ queryKey: ['looks', id] });
    },
  });

  if (isLoading) {
    return (
      <PageContainer>
        <LoadingState variant="detail" />
      </PageContainer>
    );
  }

  if (isError) {
    return (
      <PageContainer>
        <ErrorState
          message={error instanceof Error ? error.message : undefined}
          onRetry={() => queryClient.invalidateQueries({ queryKey: ['looks', id] })}
        />
      </PageContainer>
    );
  }

  if (!look) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center py-24 text-center">
          <p className="text-muted-foreground">Look not found.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/looks')}>
            Back to Looks
          </Button>
        </div>
      </PageContainer>
    );
  }

  const output = look.outputs?.[0];
  const isGenerating = regenerateMutation.isPending;

  /* -- Render helpers for AssetDetailLayout slots -- */

  const imageSlot = output?.image_url ? (
    <img
      src={output.image_url}
      alt={look.name}
      className="w-full object-cover"
      width={800}
      height={600}
    />
  ) : (
    <div className="flex flex-col items-center gap-4 py-12">
      <ImageIcon className="size-16 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        {output?.status === 'PENDING' ? 'Generating look...' : 'No image generated yet.'}
      </p>
      {output?.status === 'FAILED' && output.error_message && (
        <p className="text-sm text-destructive">{output.error_message}</p>
      )}
    </div>
  );

  const overviewContent = (
    <div className="flex flex-col gap-6">
      {output?.image_url && (
        <img
          src={output.image_url}
          alt={look.name}
          className="max-w-2xl object-cover"
          width={800}
          height={600}
        />
      )}
      {look.source_type && look.source_type !== 'ORIGINAL' && (
        <p className="text-sm text-muted-foreground">
          Source: {look.source_type.replace('_', ' ').toLowerCase()}
        </p>
      )}
    </div>
  );

  const outputsContent = (
    <div className="flex flex-col gap-4">
      {output?.image_url ? (
        <div className="flex flex-col gap-4">
          <img
            src={output.image_url}
            alt={look.name}
            className="max-w-2xl object-cover"
            width={800}
            height={600}
          />
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
            {output?.status === 'PENDING' ? 'Generating look...' : 'No image generated yet.'}
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
  );

  const propertiesContent = (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Object.entries(look.taxonomy_values ?? {}).map(
        ([key, value]) =>
          value && (
            <div key={key} className="border p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {key}
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
            </div>
          ),
      )}
      {Object.keys(look.taxonomy_values ?? {}).length === 0 && (
        <p className="text-sm text-muted-foreground sm:col-span-full">
          No taxonomy properties set.
        </p>
      )}
    </div>
  );

  /* -- Status badge -- */

  const statusBadge = (
    <>
      <GenerationStatus status={getOutputStatus(output)} />
      {marketplaceStatus && marketplaceStatus !== 'NONE' && (
        <Badge variant={marketplaceStatus === 'MARKETPLACE_APPROVED' ? 'default' : 'outline'}>
          <Lock className="mr-1 size-3" />
          {marketplaceStatus.replace('MARKETPLACE_', '')}
        </Badge>
      )}
    </>
  );

  /* -- Actions -- */

  const actions = (
    <>
      {isArtist && (
        <>
          <Button variant="outline" size="sm" onClick={() => duplicateMutation.mutate()}>
            <Copy className="mr-2 size-4" />
            Duplicate
          </Button>
          <Button size="sm" disabled={isFrozen} onClick={() => submitMarketplaceMutation.mutate()}>
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
    </>
  );

  /* -- Banner -- */

  const banner = isFrozen ? (
    <div className="flex items-center gap-2 border border-warning/20 bg-warning/10 px-3 py-2 text-sm text-warning">
      <Lock className="size-4" />
      This look is marketplace-listed and frozen.
    </div>
  ) : undefined;

  return (
    <PageContainer>
      <AssetDetailLayout
        libraryLabel="Looks"
        libraryPath="/looks"
        name={look.name}
        typeLabel="Look"
        statusBadge={statusBadge}
        actions={actions}
        image={imageSlot}
        overviewContent={overviewContent}
        outputsContent={outputsContent}
        propertiesContent={propertiesContent}
        banner={banner}
      />
    </PageContainer>
  );
}
