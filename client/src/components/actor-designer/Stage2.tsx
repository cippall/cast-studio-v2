import type { LayoutStep, GenerationSession, GeneratedOption, EntryMethod } from './types';
import { LAYOUT_STEPS } from './types';
import ImageGrid from './ImageGrid';
import SessionNavigator from './SessionNavigator';
import StructuredFormPanel from './StructuredFormPanel';
import ReferencePhotoPanel from './ReferencePhotoPanel';
import RawTextPanel from './RawTextPanel';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Check, ChevronRight } from 'lucide-react';

interface Stage2Props {
  entryMethod: EntryMethod;
  currentStepIndex: number;
  currentStep: { key: LayoutStep; label: string };
  currentSessions: GenerationSession[];
  currentSessionIndex: number;
  currentOptions: GeneratedOption[];
  selectedOptionId: string | null;
  isStepConfirmed: boolean;
  confirmedSteps: Set<LayoutStep>;
  isGenerating: boolean;
  hasGeneratedImages: boolean;
  canConfirm: boolean;
  isRawText: boolean;
  isReference: boolean;
  isStructuredForm: boolean;
  prompt: string;
  randomize: boolean;
  referenceImages: string[];
  formValues: Record<string, string>;
  referenceValidationError: string | null;
  onSelectOption: (id: string) => void;
  onConfirmStep: () => void;
  onGenerate: () => void;
  onStepIndexChange: (index: number) => void;
  onSessionSelect: (index: number) => void;
  onLoadSettings: () => void;
  onSaveCurrentPrompt: () => void;
  onRestorePrompt: (stepKey: LayoutStep) => void;
  onPromptChange: (value: string) => void;
  onRandomizeChange: (value: boolean) => void;
  onReferenceImagesChange: (images: string[]) => void;
  onFormValuesChange: (values: Record<string, string>) => void;
}

export default function Stage2({
  currentStepIndex,
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
  referenceValidationError,
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
  return (
    <div className="space-y-6">
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
        <div className={isStructuredForm ? 'flex justify-end' : 'flex justify-center'}>
          <Button onClick={onConfirmStep} disabled={!canConfirm}>
            Confirm Selection
            <ChevronRight className="ml-2 size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
