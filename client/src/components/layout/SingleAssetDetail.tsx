/**
 * SingleAssetDetail — shared detail page for single-output assets (Looks, Fashion Items).
 *
 * Encapsulates the common pattern: fetch by ID, loading/error/empty states,
 * regenerate/duplicate/delete/marketplace mutations, and SingleAssetLayout rendering.
 * The parent provides the asset-specific data and callbacks via SingleAssetDetailConfig.
 */
import { type ReactNode } from 'react';
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

/* -- Types */

interface AssetOutput {
  id: string;
  image_url: string | null;
  model: string;
  status: string;
  cost_credits: number;
  error_message?: string | null;
}

export interface SingleAssetDetailConfig<T> {
  /** React Query key for fetching the asset (e.g. ['looks', id]) */
  queryKey: (id: string) => unknown[];
  /** Fetch the asset by ID */
  fetchById: (id: string) => Promise<T>;
  /** Regenerate the asset output */
  regenerate: (id: string) => Promise<unknown>;
  /** Duplicate the asset; returns { id: string } for navigation */
  duplicate: (id: string, name: string) => Promise<{ id: string }>;
  /** Delete the asset */
  remove: (id: string) => Promise<void>;
  /** Submit asset to marketplace */
  submitToMarketplace: (assetId: string) => Promise<unknown>;
  /** Breadcrumb library label (e.g. "Looks") */
  libraryLabel: string;
  /** Breadcrumb library path (e.g. "/looks") */
  libraryPath: string;
  /** Type badge text (e.g. "Look") */
  typeLabel: string;
  /** Asset name for display */
  assetName: (detail: T) => string;
  /** Asset outputs array */
  assetOutputs: (detail: T) => AssetOutput[];
  /** Asset taxonomy values */
  assetTaxonomy: (detail: T) => Record<string, string>;
  /** Whether the asset is marketplace-frozen */
  isFrozen: (detail: T) => boolean;
  /** Marketplace status string */
  marketplaceStatus: (detail: T) => MarketplaceStatus | null;
  /** Source type (e.g. "ORIGINAL", "BRANCH") */
  sourceType: (detail: T) => string | undefined;
  /** "Not found" message */
  notFoundMessage: string;
  /** Back navigation path on "not found" */
  backPath: string;
  /** Back button label on "not found" */
  backLabel: string;
}

/* -- Helpers */

function getOutputStatus(output: AssetOutput | undefined): GenerationState {
  if (!output) return 'SUCCESS';
  return (output.status as GenerationState) ?? 'SUCCESS';
}

/* -- Component */

export default function SingleAssetDetail<T>({ config }: { config: SingleAssetDetailConfig<T> }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'ADMIN';
  const isArtist = user?.role === 'ARTIST' || isAdmin;

  const {
    data: detail,
    isLoading,
    isError,
    error,
  } = useQuery<T>({
    queryKey: id ? config.queryKey(id) : [],
    queryFn: async () => {
      if (!id) throw new Error('No ID');
      return config.fetchById(id);
    },
    enabled: !!id,
  });

  const isFrozen = detail ? config.isFrozen(detail) : false;
  const marketplaceStatus = detail ? config.marketplaceStatus(detail) : null;

  const regenerateMutation = useMutation({
    mutationFn: async () => {
      if (!id) return;
      return config.regenerate(id);
    },
    onSuccess: () => {
      if (id) queryClient.invalidateQueries({ queryKey: config.queryKey(id) });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async () => {
      if (!id) return;
      return config.duplicate(id, `${config.assetName(detail!)} (copy)`);
    },
    onSuccess: (data) => {
      if (data) navigate(`/${config.libraryPath.split('/').pop()}/${data.id}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!id) return;
      return config.remove(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [config.libraryPath.split('/').pop()] });
      navigate(config.libraryPath);
    },
  });

  const submitMarketplaceMutation = useMutation({
    mutationFn: async () => {
      if (!id) return;
      return config.submitToMarketplace(id);
    },
    onSuccess: () => {
      if (id) queryClient.invalidateQueries({ queryKey: config.queryKey(id) });
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
          onRetry={() => id && queryClient.invalidateQueries({ queryKey: config.queryKey(id) })}
        />
      </PageContainer>
    );
  }

  if (!detail) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center py-24 text-center">
          <p className="text-muted-foreground">{config.notFoundMessage}</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate(config.backPath)}>
            {config.backLabel}
          </Button>
        </div>
      </PageContainer>
    );
  }

  const outputs = config.assetOutputs(detail);
  const output = outputs?.[0];
  const isGenerating = regenerateMutation.isPending;
  const hasImage = !!output?.image_url;

  const heroImage = hasImage ? (
    <LightboxImage src={output.image_url!} alt={config.assetName(detail)}>
      <img
        src={output.image_url!}
        alt={config.assetName(detail)}
        className="h-full w-full object-cover"
        width={800}
        height={600}
      />
    </LightboxImage>
  ) : (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-surface">
      <ImageIcon className="size-12 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        No {config.typeLabel.toLowerCase()} generated yet.
      </p>
    </div>
  );

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

  const overviewContent = (
    <div className="flex flex-col gap-4">
      {config.sourceType(detail) && config.sourceType(detail) !== 'ORIGINAL' && (
        <p className="text-sm text-muted-foreground">
          Source: {config.sourceType(detail)!.replace('_', ' ').toLowerCase()}
        </p>
      )}
      {output?.model && <p className="text-sm text-muted-foreground">Model: {output.model}</p>}
      {output?.status === 'FAILED' && output.error_message && (
        <p className="text-sm text-destructive">{output.error_message}</p>
      )}
    </div>
  );

  const taxonomyValues = config.assetTaxonomy(detail);
  const propertiesContent = (
    <div className="flex flex-col gap-3">
      {Object.entries(taxonomyValues ?? {}).map(
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
      {Object.keys(taxonomyValues ?? {}).length === 0 && (
        <p className="text-sm text-muted-foreground">No taxonomy properties set.</p>
      )}
    </div>
  );

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

  const banner = isFrozen ? (
    <div className="flex items-center gap-2 border border-warning/20 bg-warning/10 px-3 py-2 text-sm text-warning">
      <Lock className="size-4" />
      This {config.typeLabel.toLowerCase()} is marketplace-listed and frozen.
    </div>
  ) : undefined;

  return (
    <PageContainer>
      <SingleAssetLayout
        libraryLabel={config.libraryLabel}
        libraryPath={config.libraryPath}
        name={config.assetName(detail)}
        typeLabel={config.typeLabel}
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
