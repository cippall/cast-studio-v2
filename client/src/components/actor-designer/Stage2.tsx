import type { LayoutStep, GenerationSession, GeneratedOption } from './types';
import type { Stage2Props } from './Stage2Props';
import type { ModelConfig } from '@/hooks/useAdminModels';
import { LAYOUT_STEPS } from './types';
import ImageGrid from './ImageGrid';
import SessionNavigator from './SessionNavigator';
import StructuredFormPanel from './StructuredFormPanel';
import ReferencePhotoPanel from './ReferencePhotoPanel';
import RawTextPanel from './RawTextPanel';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Check, ChevronRight } from 'lucide-react';

export default function Stage2({
  currentStepIndex,
  currentStep,
  currentSessions,
  currentSessionIndex,
  currentOptions,
  selectedOptionId,
  isStepConfirmed,
  confirmedSteps,
  isGenerating,
  hasGeneratedImages,
  canConfirm,
  isRawText,
  isReference,
  isStructuredForm,
  prompt,
  randomize,
  referenceImages,
  formValues,
  generateError,
  generateErrorCode,
  referenceValidationError,
  models,
  selectedModel,
  onModelChange,
  onSelectOption,
  onConfirmStep,
  onGenerate,
  onStepIndexChange,
  onSessionSelect,
  onLoadSettings,
  onSaveCurrentPrompt,
  onRestorePrompt,
  onPromptChange,
  onRandomizeChange,
  onReferenceImagesChange,
  onFormValuesChange,
}: Stage2Props) {
  const activeModels = models.filter((m) => m.is_active);
  return (
    <div className="space-y-6">
      {/* Model selector */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <label htmlFor="model-select" className="text-sm font-medium text-muted-foreground">
            Model
          </label>
          {activeModels.length > 0 ? (
            <Select
              value={selectedModel}
              onValueChange={(val) => onModelChange(val ?? selectedModel)}
            >
              <SelectTrigger id="model-select" className="w-[240px]">
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                {activeModels.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="flex items-center gap-2 text-sm text-warning">
              <AlertCircle className="size-4" />
              <span>
                No models configured. Go to{' '}
                <a href="/settings/models" className="font-medium underline underline-offset-2">
                  Settings → Models
                </a>{' '}
                to add one.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Stepper */}
      <div className="flex w-full border border-border-subtle">
        {LAYOUT_STEPS.map((step, index) => {
          const isActive = index === currentStepIndex;
          const isComplete = confirmedSteps.has(step.key);
          const isUpcoming = !isActive && !isComplete;
          const canNavigate = isComplete && !isActive;
          return (
            <button
              key={step.key}
              type="button"
              disabled={isUpcoming}
              onClick={() => {
                if (canNavigate) {
                  if (isRawText) onSaveCurrentPrompt();
                  onStepIndexChange(index);
                  if (isRawText) onRestorePrompt(step.key);
                }
              }}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 border-r border-border-subtle px-4 py-3 text-sm font-medium transition-colors last:border-r-0',
                isActive && 'bg-primary text-primary-foreground',
                isComplete &&
                  !isActive &&
                  'bg-muted/50 text-muted-foreground hover:bg-muted cursor-pointer',
                isUpcoming && 'text-muted-foreground/50 cursor-not-allowed',
              )}
            >
              {isComplete && !isActive && <Check className="size-4" />}
              {step.label}
            </button>
          );
        })}
      </div>

      {/* Step header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">
            {currentStep.label}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              Step {currentStepIndex + 1} of {LAYOUT_STEPS.length}
            </span>
          </h2>
        </div>
      </div>

      {/* Generate error banner */}
      {generateError && (
        <div className="flex items-center gap-2 border border-error/20 bg-error/5 px-3 py-2 text-sm text-error">
          <span>{generateError}</span>
          {generateError.toLowerCase().includes('insufficient credits') && (
            <a
              href="/settings/wallet"
              className="font-medium underline underline-offset-2 hover:text-error/80"
            >
              Top up wallet
            </a>
          )}
        </div>
      )}

      {/* Image grid area */}
      {isStructuredForm ? (
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="w-full lg:w-1/3">
            <StructuredFormPanel
              formValues={formValues}
              onFormValuesChange={onFormValuesChange}
              randomize={randomize}
              onRandomizeChange={onRandomizeChange}
              onGenerate={onGenerate}
              isGenerating={isGenerating}
              hasImages={hasGeneratedImages}
              selectedModelName={models.find((m) => m.id === selectedModel)?.name}
            />
          </div>
          <div className="w-full space-y-3 lg:w-2/3">
            <ImageGrid
              options={currentOptions}
              selectedId={selectedOptionId}
              isStepConfirmed={isStepConfirmed}
              onSelect={onSelectOption}
            />
            <SessionNavigator
              sessions={currentSessions}
              selectedIndex={currentSessionIndex}
              onSelect={onSessionSelect}
              onLoadSettings={onLoadSettings}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <ImageGrid
            options={currentOptions}
            selectedId={selectedOptionId}
            isStepConfirmed={isStepConfirmed}
            onSelect={onSelectOption}
          />
          <SessionNavigator
            sessions={currentSessions}
            selectedIndex={currentSessionIndex}
            onSelect={onSessionSelect}
            onLoadSettings={onLoadSettings}
          />
        </div>
      )}

      {isReference && (
        <ReferencePhotoPanel
          referenceImages={referenceImages}
          onReferenceImagesChange={onReferenceImagesChange}
          prompt={prompt}
          onPromptChange={onPromptChange}
          randomize={randomize}
          onRandomizeChange={onRandomizeChange}
          onGenerate={onGenerate}
          isGenerating={isGenerating}
          hasImages={hasGeneratedImages}
          validationError={referenceValidationError}
        />
      )}

      {isRawText && (
        <RawTextPanel
          prompt={prompt}
          onPromptChange={onPromptChange}
          randomize={randomize}
          onRandomizeChange={onRandomizeChange}
          onGenerate={onGenerate}
          isGenerating={isGenerating}
          hasImages={hasGeneratedImages}
        />
      )}

      {hasGeneratedImages && (
        <ConfirmButton
          isStructuredForm={isStructuredForm}
          canConfirm={canConfirm}
          onConfirm={onConfirmStep}
        />
      )}
    </div>
  );
}

function ConfirmButton({
  isStructuredForm,
  canConfirm,
  onConfirm,
}: {
  isStructuredForm: boolean;
  canConfirm: boolean;
  onConfirm: () => void;
}) {
  return (
    <div className={isStructuredForm ? 'flex justify-end' : 'flex justify-center'}>
      <Button onClick={onConfirm} disabled={!canConfirm}>
        Confirm Selection
        <ChevronRight className="ml-2 size-4" />
      </Button>
    </div>
  );
}
