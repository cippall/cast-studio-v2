/**
 * ActorPage — full actor view with all output sections.
 */
import { useCurrentUser } from '@/hooks/useAuth';
import ErrorState from '@/components/ErrorState';
import LoadingState from '@/components/LoadingState';
import AssetDetailLayout from '@/components/layout/AssetDetailLayout';
import PageContainer from '@/components/layout/PageContainer';
import ActorOutputs from './ActorOutputs';
import { useActorPage } from './useActorPage';
import { useActorPageRender } from './useActorPageRender';

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
    isStale,
    clearStale,
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
        </div>
      </PageContainer>
    );

  const { imageSlot, overviewContent, propertiesContent, statusBadge, actions, banner } =
    useActorPageRender({
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
      onCharacterSheetLookChange: setCharacterSheetLookId,
      onToggleSection: toggleSection,
      onGenerate: (lt) => generateMutation.mutate(lt),
      onRegenerate: (lt) => regenerateMutation.mutate(lt),
      onDuplicate: () => duplicateMutation.mutate(),
      onSubmitMarketplace: () => submitMarketplaceMutation.mutate(),
    });

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
            isStale={isStale}
            onRetryStale={(lt) => {
              clearStale(lt);
              generateMutation.mutate(lt);
            }}
          />
        }
        propertiesContent={propertiesContent}
        banner={banner}
      />
    </PageContainer>
  );
}
