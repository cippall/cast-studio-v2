import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, ImageIcon, Lock, RotateCcw, Send } from 'lucide-react';
import { formatLabel } from '@/lib/utils';
import type { MarketplaceStatus } from '@cast/types';
import type { ActorDetail } from './actor-page-types';

interface ActorPageRenderProps {
  actor: ActorDetail;
  isArtist: boolean;
  isFrozen: boolean;
  isGenerating: boolean;
  marketplaceStatus: MarketplaceStatus | null;
  missingOutputs: string[];
  hasRequiredOutputs: boolean;
  looks: Array<{ id: string; name: string }>;
  characterSheetLookId: string;
  openSections: Set<string>;
  onCharacterSheetLookChange: (value: string) => void;
  onToggleSection: (key: string) => void;
  onGenerate: (layoutType: string) => void;
  onRegenerate: (layoutType: string) => void;
  onDuplicate: () => void;
  onSubmitMarketplace: () => void;
}

export function useActorPageRender({
  actor,
  isArtist,
  isFrozen,
  isGenerating,
  marketplaceStatus,
  missingOutputs,
  hasRequiredOutputs,
  looks,
  characterSheetLookId,
  openSections,
  onCharacterSheetLookChange,
  onToggleSection,
  onGenerate,
  onRegenerate,
  onDuplicate,
  onSubmitMarketplace,
}: ActorPageRenderProps) {
  const headshotOutput = actor.outputs?.headshot;

  const imageSlot = headshotOutput?.image_url ? (
    <img
      src={headshotOutput.image_url}
      alt={actor.name}
      className="w-full object-cover"
      width={512}
      height={512}
    />
  ) : (
    <div className="flex flex-col items-center gap-4 py-12">
      <ImageIcon className="size-16 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">No headshot generated yet.</p>
    </div>
  );

  const overviewContent = (
    <div className="flex flex-col gap-6">
      {headshotOutput?.image_url && (
        <img
          src={headshotOutput.image_url}
          alt={actor.name}
          className="max-w-md object-cover"
          width={512}
          height={512}
        />
      )}
      {Object.keys(actor.taxonomy_values ?? {}).length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(actor.taxonomy_values ?? {}).map(
            ([key, value]) =>
              value && (
                <div key={key} className="border p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {formatLabel(key)}
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
                </div>
              ),
          )}
        </div>
      )}
      {actor.source_type && actor.source_type !== 'ORIGINAL' && (
        <p className="text-sm text-muted-foreground">
          Source: {actor.source_type.replace('_', ' ').toLowerCase()}
        </p>
      )}
    </div>
  );

  const propertiesContent = (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Object.entries(actor.taxonomy_values ?? {}).map(
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
      {Object.keys(actor.taxonomy_values ?? {}).length === 0 && (
        <p className="text-sm text-muted-foreground sm:col-span-full">
          No taxonomy properties set.
        </p>
      )}
    </div>
  );

  const statusBadge =
    marketplaceStatus && marketplaceStatus !== 'NONE' ? (
      <Badge variant={marketplaceStatus === 'MARKETPLACE_APPROVED' ? 'default' : 'outline'}>
        <Lock className="mr-1 size-3" />
        {marketplaceStatus.replace('MARKETPLACE_', '')}
      </Badge>
    ) : undefined;

  const actions = isArtist ? (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={isFrozen}
        onClick={() => onRegenerate('headshot')}
      >
        <RotateCcw className="mr-2 size-4" />
        Regenerate Headshot
      </Button>
      <Button variant="outline" size="sm" onClick={onDuplicate}>
        <Copy className="mr-2 size-4" />
        Duplicate
      </Button>
      <Button size="sm" disabled={!hasRequiredOutputs || isFrozen} onClick={onSubmitMarketplace}>
        <Send className="mr-2 size-4" />
        Submit to Marketplace
      </Button>
      {!hasRequiredOutputs && !isFrozen && (
        <p className="text-xs text-muted-foreground">Missing: {missingOutputs.join(', ')}</p>
      )}
    </>
  ) : undefined;

  const banner = isFrozen ? (
    <div className="flex items-center gap-2 border border-warning/20 bg-warning/10 px-3 py-2 text-sm text-warning">
      <Lock className="size-4" />
      This actor is marketplace-listed and frozen. Editing and regeneration are disabled.
    </div>
  ) : undefined;

  return {
    imageSlot,
    overviewContent,
    propertiesContent,
    statusBadge,
    actions,
    banner,
    headshotOutput,
  };
}
