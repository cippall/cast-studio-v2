/**
 * ActorDesigner — 3-stage wizard for creating actors.
 * Stage 1: Choose entry method (Form, Reference, Text)
 * Stage 2: Iterate headshot -> fullshot -> expressions
 * Stage 3: Name + properties -> save
 */
import { AlertCircle } from 'lucide-react';
import GenerationStatus from '@/components/GenerationStatus';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import Stage1 from '@/components/actor-designer/Stage1';
import Stage2 from '@/components/actor-designer/Stage2';
import Stage3 from '@/components/actor-designer/Stage3';
import { useActorDesignerState } from '@/components/actor-designer/useActorDesignerState';

export default function ActorDesigner() {
  const s = useActorDesignerState();

  // Stage 1: dirty if user changed anything from initial defaults
  const stage1Dirty =
    s.stage === 1 &&
    (s.entryMethod !== 'FORM' ||
      s.prompt !== '' ||
      s.referenceImages.length > 0 ||
      Object.keys(s.formValues).length > 0);

  // Stage 2: dirty if any images have been generated
  const stage2Dirty = s.stage === 2 && s.hasGeneratedImages;

  // Stage 3: dirty if name or taxonomy edited
  const stage3Dirty =
    s.stage === 3 && (s.actorName !== '' || JSON.stringify(s.taxonomyValues) !== '{}');

  useUnsavedChanges(stage1Dirty || stage2Dirty || stage3Dirty);

  return (
    <PageContainer>
      <PageHeader
        title="New Actor"
        description={
          s.stage === 1
            ? "Choose how to define your actor's identity."
            : s.stage === 2
              ? 'Generate and select the best options for each layout.'
              : 'Name your actor and set properties.'
        }
      />

      {s.stage === 1 && s.createError && (
        <div className="flex items-center gap-2 border border-error/20 bg-error/5 px-3 py-2 text-sm text-error">
          <AlertCircle className="size-4 shrink-0" />
          <span>{s.createError}</span>
        </div>
      )}

      {s.stage === 1 && (
        <Stage1
          entryMethod={s.entryMethod}
          onSelect={s.setEntryMethod}
          prompt={s.prompt}
          onPromptChange={s.setPrompt}
          randomize={s.randomize}
          onRandomizeChange={s.setRandomize}
          formValues={s.formValues}
          onFormValuesChange={s.setFormValues}
          referenceImages={s.referenceImages}
          onReferenceImagesChange={s.setReferenceImages}
          onCreate={s.handleCreateActor}
          isCreating={s.isCreating}
        />
      )}

      {s.stage === 2 && (
        <div className="space-y-4">
          <Stage2
            entryMethod={s.entryMethod}
            currentStepIndex={s.currentStepIndex}
            currentStep={s.currentStep}
            currentSessions={s.currentSessions}
            currentSessionIndex={s.currentSessionIndex}
            currentOptions={s.currentOptions}
            selectedOptionId={s.selectedOptionId}
            isStepConfirmed={s.isStepConfirmed}
            confirmedSteps={s.confirmedSteps}
            isGenerating={s.isGenerating}
            hasGeneratedImages={s.hasGeneratedImages}
            canConfirm={s.canConfirm}
            isRawText={s.isRawText}
            isReference={s.isReference}
            isStructuredForm={s.isStructuredForm}
            prompt={s.prompt}
            randomize={s.randomize}
            referenceImages={s.referenceImages}
            formValues={s.formValues}
            generateError={s.generateError}
            generateErrorCode={s.generateErrorCode}
            referenceValidationError={s.referenceValidationError}
            models={s.models}
            selectedModel={s.selectedModel}
            onModelChange={s.setModel}
            numOutputs={s.numOutputs}
            onNumOutputsChange={s.setNumOutputs}
            onSelectOption={s.handleSelectOption}
            onConfirmStep={s.handleConfirmStep}
            onGenerate={s.handleGenerate}
            onStepIndexChange={s.setCurrentStepIndex}
            onSessionSelect={s.handleSessionSelect}
            onLoadSettings={() => s.handleSaveSettings(s.currentSessionIndex)}
            onSaveCurrentPrompt={s.handleSaveCurrentPrompt}
            onRestorePrompt={s.handleRestorePrompt}
            onPromptChange={s.setPrompt}
            onRandomizeChange={s.setRandomize}
            onReferenceImagesChange={s.setReferenceImages}
            onFormValuesChange={s.setFormValues}
          />

          <GenerationStatus
            status={
              s.currentOptions.some((o) => o.status === 'PENDING')
                ? 'PENDING'
                : s.currentOptions.some((o) => o.status === 'FAILED')
                  ? 'FAILED'
                  : 'SUCCESS'
            }
            errorMessage={s.currentOptions.find((o) => o.status === 'FAILED')?.errorMessage}
            onRetry={s.handleRegenerate}
          />
        </div>
      )}

      {s.stage === 3 && (
        <Stage3
          actorName={s.actorName}
          onNameChange={s.setActorName}
          taxonomyValues={s.taxonomyValues}
          onTaxonomyChange={s.setTaxonomyValues}
          onBack={() => s.setStage(2)}
          onSave={s.handleSaveActor}
          isSaving={s.isSaving}
        />
      )}
    </PageContainer>
  );
}
