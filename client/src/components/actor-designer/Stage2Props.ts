import type { LayoutStep, GenerationSession, GeneratedOption, EntryMethod } from './types';

export interface Stage2Props {
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
