/**
 * Look Detail — full look view with image, name, taxonomy values, and actions.
 *
 * Uses SingleAssetLayout: hero image at top, metadata below, no redundant Outputs tab.
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
import LightboxImage from '@/components/ui/LightboxImage';
import type { GenerationState } from '@/components/GenerationStatus';
import type { MarketplaceStatus } from '@cast/types';
import SingleAssetLayout from '@/components/layout/SingleAssetLayout';
import PageContainer from '@/components/layout/PageContainer';
import { formatLabel } from '@/lib/utils';

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
  const hasImage = !!output?.image_url;

  /* -- Hero image slot for SingleAssetLayout -- */

  const heroImage = hasImage ? (
    <LightboxImage src={output.image_url!} alt={look.name}>
      <img
        src={output.image_url!}
        alt={look.name}
        className="h-full w-full object-cover"
        width={800}
        height={600}
      />
    </LightboxImage>
  ) : (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-surface">
      <ImageIcon className="size-12 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">No look generated yet.</p>
    </div>
  );

  /* -- Generation controls (inline below image) -- */

  const generationControls =
    isArtist && !isFrozen ? (
      <Button
        variant="outline"
        size="sm"
        onClick={() => regenerateMutation.mutate()}
        disabled={isGenerating}
      >
        {isGenerating ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : hasImage ? (
          <RotateCcw className="mr-2 size-4" />
        ) : (
          <Sparkles className="mr-2 size-4" />
        )}
        {hasImage ? 'Regenerate' : 'Generate'}
      </Button>
    ) : undefined;

  /* -- Overview tab: source info only, no duplicate image -- */

  const overviewContent = (
    <div className="flex flex-col gap-4">
      {look.source_type && look.source_type !== 'ORIGINAL' && (
        <p className="text-sm text-muted-foreground">
          Source: {look.source_type.replace('_', ' ').toLowerCase()}
        </p>
      )}
      {output?.model && <p className="text-sm text-muted-foreground">Model: {output.model}</p>}
      {output?.status === 'FAILED' && output.error_message && (
        <p className="text-sm text-destructive">{output.error_message}</p>
      )}
    </div>
  );

  /* -- Properties tab: taxonomy as key-value list, not card grid -- */

  const propertiesContent = (
    <div className="flex flex-col gap-3">
      {Object.entries(look.taxonomy_values ?? {}).map(
        ([key, value]) =>
          value && (
            <div
              key={key}
              className="flex items-baseline justify-between gap-4 border-b border-border pb-2"
            >
              <span className="text-sm text-muted-foreground">{formatLabel(key)}</span>
              <span className="text-sm font-medium text-foreground">{value}</span>
            </div>
          ),
      )}
      {Object.keys(look.taxonomy_values ?? {}).length === 0 && (
        <p className="text-sm text-muted-foreground">No taxonomy properties set.</p>
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
          <Button
            size="default"
            disabled={isFrozen}
            onClick={() => submitMarketplaceMutation.mutate()}
          >
            <Send className="mr-2 size-4" />
            Submit to Marketplace
          </Button>
          <Button variant="outline" size="sm" onClick={() => duplicateMutation.mutate()}>
            <Copy className="mr-2 size-4" />
            Duplicate
          </Button>
        </>
      )}
      {isAdmin && (
        <Button
          variant="outline"
          size="sm"
          className="text-destructive"
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
      <SingleAssetLayout
        libraryLabel="Looks"
        libraryPath="/looks"
        name={look.name}
        typeLabel="Look"
        statusBadge={statusBadge}
        actions={actions}
        heroImage={heroImage}
        generationControls={generationControls}
        overviewContent={overviewContent}
        propertiesContent={propertiesContent}
        banner={banner}
      />
    </PageContainer>
  );
}
