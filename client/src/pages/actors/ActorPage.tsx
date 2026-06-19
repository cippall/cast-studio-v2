/**
 * ActorPage — full actor view with all output sections.
 */
import { useCurrentUser } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Copy, Edit3, ImageIcon, Lock, RotateCcw, Send } from 'lucide-react';
import { cn, formatLabel } from '@/lib/utils';
import GenerationStatus from '@/components/GenerationStatus';
import ErrorState from '@/components/ErrorState';
import LoadingState from '@/components/LoadingState';
import AssetDetailLayout from '@/components/layout/AssetDetailLayout';
import PageContainer from '@/components/layout/PageContainer';
import { OUTPUT_SECTIONS, getOutputStatus } from './actor-page-types';
import OutputSectionContent from './OutputSectionContent';
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

  const outputsContent = (
    <div className="space-y-4">
      {OUTPUT_SECTIONS.map((section) => {
        const output = actor.outputs?.[section.key];
        const isObsolete = output?.is_obsolete === true;
        const isOpen = openSections.has(section.key);
        const sectionStatus = getOutputStatus(output);

        return (
          <Collapsible
            key={section.key}
            open={isOpen}
            onOpenChange={() => toggleSection(section.key)}
          >
            <Card>
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold">{section.label}</h3>
                    <GenerationStatus status={sectionStatus} />
                  </div>
                  <ChevronDown
                    className={cn(
                      'size-5 text-muted-foreground transition-transform',
                      isOpen && 'rotate-180',
                    )}
                  />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <OutputSectionContent
                    sectionKey={section.key}
                    sectionLabel={section.label}
                    output={output}
                    isObsolete={isObsolete}
                    isGenerating={isGenerating}
                    isArtist={isArtist}
                    isFrozen={isFrozen}
                    characterSheetLookId={characterSheetLookId}
                    onCharacterSheetLookChange={setCharacterSheetLookId}
                    looks={looks}
                    onGenerate={(lt) => generateMutation.mutate(lt)}
                    onRegenerate={(lt) => regenerateMutation.mutate(lt)}
                  />
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}
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
        outputsContent={outputsContent}
        propertiesContent={propertiesContent}
        banner={banner}
      />
    </PageContainer>
  );
}
