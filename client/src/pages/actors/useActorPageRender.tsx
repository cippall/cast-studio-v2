import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, ImageIcon, Lock, Send } from 'lucide-react';
import { formatLabel } from '@/lib/utils';
import LightboxImage from '@/components/ui/LightboxImage';
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
  onDuplicate,
  onSubmitMarketplace,
}: ActorPageRenderProps) {
  const headshotOutput = actor.outputs?.headshot;

  const imageSlot = headshotOutput?.image_url ? (
    <LightboxImage src={headshotOutput.image_url} alt={actor.name}>
      <img
        src={headshotOutput.image_url}
        alt={actor.name}
        className="w-full object-cover"
        width={512}
        height={512}
      />
    </LightboxImage>
  ) : (
    <div className="flex flex-col items-center gap-4 py-12">
      <ImageIcon className="size-16 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">No headshot generated yet.</p>
    </div>
  );

  const taxonomyEntries = Object.entries(actor.taxonomy_values ?? {}).filter(([, value]) => value);

  const renderTaxonomyList = (variant: 'stacked' | 'horizontal') =>
    taxonomyEntries.map(([key, value]) =>
      variant === 'stacked' ? (
        <div key={key} className="flex flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {formatLabel(key)}
          </p>
          <p className="text-sm text-foreground">{value}</p>
        </div>
      ) : (
        <div
          key={key}
          className="flex items-baseline justify-between gap-4 border-b border-border pb-2"
        >
          <span className="text-sm text-muted-foreground">{formatLabel(key)}</span>
          <span className="text-sm font-medium text-foreground">{value}</span>
        </div>
      ),
    );

  const overviewContent = (
    <div className="flex flex-col gap-3">
      {renderTaxonomyList('stacked')}
      {actor.source_type && actor.source_type !== 'ORIGINAL' && (
        <p className="text-sm text-muted-foreground">
          Source: {actor.source_type.replace('_', ' ').toLowerCase()}
        </p>
      )}
    </div>
  );

  const propertiesContent = (
    <div className="flex flex-col gap-3">
      {taxonomyEntries.length > 0 ? (
        renderTaxonomyList('horizontal')
      ) : (
        <p className="text-sm text-muted-foreground">No taxonomy properties set.</p>
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
    <div className="flex flex-col items-start gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="default"
          disabled={!hasRequiredOutputs || isFrozen}
          onClick={onSubmitMarketplace}
        >
          <Send className="mr-2 size-4" />
          Submit to Marketplace
        </Button>
        <Button variant="outline" size="sm" onClick={onDuplicate}>
          <Copy className="mr-2 size-4" />
          Duplicate
        </Button>
      </div>
      {!hasRequiredOutputs && !isFrozen && (
        <p className="text-xs text-muted-foreground">Missing: {missingOutputs.join(', ')}</p>
      )}
    </div>
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
