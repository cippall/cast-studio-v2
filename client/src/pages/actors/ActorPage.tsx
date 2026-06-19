/**
 * ActorPage — full actor view with all output sections.
 */
import { useCurrentUser } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, Edit3, ImageIcon, Lock, RotateCcw, Send } from 'lucide-react';
import { formatLabel } from '@/lib/utils';
import ErrorState from '@/components/ErrorState';
import LoadingState from '@/components/LoadingState';
import AssetDetailLayout from '@/components/layout/AssetDetailLayout';
import PageContainer from '@/components/layout/PageContainer';
import OutputSectionContent from './OutputSectionContent';
import ActorOutputs from './ActorOutputs';
import { useActorPage } from './useActorPage';

export default function ActorPage() {
  const { data: user } = useCurrentUser();
  const isAdmin = user?.role === 'ADMIN';
  const isArtist = user?.role === 'ARTIST' || isAdmin;

  const {
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
  } = useActorPage();

  if (isLoading)
    return (
      <PageContainer>
        <LoadingState variant="detail" />
      </PageContainer>
    );
  if (isError)
    return (
      <PageContainer>
        <ErrorState message={error instanceof Error ? error.message : undefined} />
      </PageContainer>
    );
  if (!actor)
    return (
      <PageContainer>
        <div className="flex flex-col items-center py-24 text-center">
          <p className="text-muted-foreground">Actor not found.</p>
          <Button variant="outline" className="mt-4" onClick={() => {}}>
            Back to Actors
          </Button>
        </div>
      </PageContainer>
    );

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
      <Button variant="outline" size="sm" disabled={isFrozen} onClick={() => {}}>
        <Edit3 className="mr-2 size-4" />
        Edit Fields
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={isFrozen}
        onClick={() => regenerateMutation.mutate('headshot')}
      >
        <RotateCcw className="mr-2 size-4" />
        Regenerate Headshot
      </Button>
      <Button variant="outline" size="sm" onClick={() => duplicateMutation.mutate()}>
        <Copy className="mr-2 size-4" />
        Duplicate
      </Button>
      <Button
        size="sm"
        disabled={!hasRequiredOutputs || isFrozen}
        onClick={() => submitMarketplaceMutation.mutate()}
      >
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

  return (
    <PageContainer>
      <AssetDetailLayout
        libraryLabel="Actors"
        libraryPath="/actors"
        name={actor.name}
        typeLabel="Actor"
        statusBadge={statusBadge}
        actions={actions}
        image={imageSlot}
        overviewContent={overviewContent}
        outputsContent={
          <ActorOutputs
            actor={actor}
            looks={looks}
            isArtist={isArtist}
            isFrozen={isFrozen}
            isGenerating={isGenerating}
            characterSheetLookId={characterSheetLookId}
            onCharacterSheetLookChange={setCharacterSheetLookId}
            openSections={openSections}
            onToggleSection={toggleSection}
            onGenerate={(lt) => generateMutation.mutate(lt)}
            onRegenerate={(lt) => regenerateMutation.mutate(lt)}
          />
        }
        propertiesContent={propertiesContent}
        banner={banner}
      />
    </PageContainer>
  );
}
