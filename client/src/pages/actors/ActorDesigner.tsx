/**
 * ActorDesigner — 3-stage wizard for creating actors.
 * Stage 1: Choose entry method (Form, Reference, Text)
 * Stage 2: Iterate headshot -> fullshot -> expressions
 * Stage 3: Name + properties -> save
 */
import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertCircle,
  FileText,
  ImageIcon,
  FormInput,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Check,
  RotateCcw,
  Sparkles,
  Settings2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import GenerationStatus from '@/components/GenerationStatus';
import type { GenerationState } from '@/components/GenerationStatus';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import ActorFormFields from '@/components/ActorFormFields';
import ReferenceImageUpload from '@/components/ReferenceImageUpload';

type EntryMethod = 'FORM' | 'REFERENCE' | 'TEXT';
type WizardStage = 1 | 2 | 3;
type LayoutStep = 'headshot' | 'fullshot' | 'expressions';

interface GeneratedOption {
  id: string;
  imageUrl: string | null;
  status: GenerationState;
  errorMessage?: string | null;
}

interface GenerationSession {
  id: string;
  sessionNumber: number;
  prompt: string;
  referenceImages: string[];
  randomize: boolean;
  formValues: Record<string, string>;
  images: GeneratedOption[];
}

const LAYOUT_STEPS: { key: LayoutStep; label: string }[] = [
  { key: 'headshot', label: 'Headshot' },
  { key: 'fullshot', label: 'Fullshot' },
  { key: 'expressions', label: 'Expressions' },
];

const NUM_OPTIONS = 4;

const ENTRY_METHODS = [
  {
    value: 'FORM' as EntryMethod,
    icon: FormInput,
    title: 'Structured Form',
    desc: 'Fill in actor properties using admin-defined fields.',
  },
  {
    value: 'REFERENCE' as EntryMethod,
    icon: ImageIcon,
    title: 'Reference Photo',
    desc: 'Upload a photo. Vision model extracts features.',
  },
  {
    value: 'TEXT' as EntryMethod,
    icon: FileText,
    title: 'Raw Text',
    desc: 'Describe the actor freely in your own words.',
  },
];

function createEmptyOptions(count: number): GeneratedOption[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `opt-${i}-${Date.now()}`,
    imageUrl: null,
    status: 'PENDING' as GenerationState,
  }));
}

/* -- Session Navigator -- */

interface SessionNavigatorProps {
  sessions: GenerationSession[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onLoadSettings: () => void;
}

function SessionNavigator({
  sessions,
  selectedIndex,
  onSelect,
  onLoadSettings,
}: SessionNavigatorProps) {
  if (sessions.length <= 1) return null;

  return (
    <div className="flex items-center justify-between border border-border-subtle bg-muted/30 px-3 py-2 text-sm">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="size-7 p-0"
          disabled={selectedIndex === 0}
          onClick={() => onSelect(selectedIndex - 1)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-muted-foreground">
          Session {selectedIndex + 1} of {sessions.length}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="size-7 p-0"
          disabled={selectedIndex === sessions.length - 1}
          onClick={() => onSelect(selectedIndex + 1)}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
      <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={onLoadSettings}>
        <Settings2 className="size-3" />
        Load Settings
      </Button>
    </div>
  );
}

/* -- Stage 1: Entry Method Selection -- */

interface Stage1Props {
  entryMethod: EntryMethod;
  onSelect: (method: EntryMethod) => void;
  prompt: string;
  onPromptChange: (value: string) => void;
  randomize: boolean;
  onRandomizeChange: (value: boolean) => void;
  onCreate: () => void;
  isCreating: boolean;
}

function Stage1({
  entryMethod,
  onSelect,
  prompt,
  onPromptChange,
  randomize,
  onRandomizeChange,
  onCreate,
  isCreating,
}: Stage1Props) {
  return (
    <div className="space-y-6">
      <RadioGroup
        value={entryMethod}
        onValueChange={(v) => onSelect(v as EntryMethod)}
        className="grid grid-cols-1 gap-3 sm:grid-cols-3"
      >
        {ENTRY_METHODS.map((method) => (
          <Label
            key={method.value}
            htmlFor={`method-${method.value}`}
            className={cn(
              'flex cursor-pointer flex-col gap-3 border p-6 transition-colors',
              entryMethod === method.value ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
            )}
          >
            <RadioGroupItem
              value={method.value}
              id={`method-${method.value}`}
              className="sr-only"
            />
            <method.icon className="size-8 text-muted-foreground" />
            <div>
              <p className="font-semibold">{method.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{method.desc}</p>
            </div>
          </Label>
        ))}
      </RadioGroup>

      {entryMethod === 'TEXT' && (
        <div className="space-y-2">
          <Label htmlFor="prompt">Describe your actor</Label>
          <Textarea
            id="prompt"
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder="A young asian woman with cyberpunk aesthetic, neon-lit city background..."
            rows={4}
          />
        </div>
      )}

      {(entryMethod === 'FORM' || entryMethod === 'TEXT') && (
        <div className="flex items-center gap-2">
          <Checkbox
            id="randomize"
            checked={randomize}
            onCheckedChange={(checked) => onRandomizeChange(checked === true)}
          />
          <Label htmlFor="randomize" className="cursor-pointer font-normal">
            Randomize identity
          </Label>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={onCreate} disabled={isCreating}>
          {isCreating ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              Continue
              <ChevronRight className="ml-2 size-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

/* -- Stage 2: Image Grid for Selection -- */

interface ImageGridProps {
  options: GeneratedOption[];
  selectedId: string | null;
  isStepConfirmed: boolean;
  onSelect: (id: string) => void;
}

function ImageGrid({ options, selectedId, isStepConfirmed, onSelect }: ImageGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      {options.map((option) => (
        <Card
          key={option.id}
          className={cn(
            'cursor-pointer overflow-hidden transition-all',
            selectedId === option.id && 'ring-2 ring-primary',
            option.status === 'PENDING' && 'animate-pulse',
          )}
          onClick={() => {
            if (option.status === 'SUCCESS' && !isStepConfirmed) {
              onSelect(option.id);
            }
          }}
        >
          <div className="relative aspect-square bg-muted">
            {option.imageUrl ? (
              <img
                src={option.imageUrl}
                alt="Generated option"
                className="size-full object-cover"
                width={300}
                height={300}
              />
            ) : option.status === 'PENDING' ? (
              <div className="flex size-full items-center justify-center">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="flex size-full items-center justify-center">
                <span className="text-sm text-muted-foreground">Failed</span>
              </div>
            )}
            {selectedId === option.id && (
              <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                <Check className="size-8 text-primary" />
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

/* -- Stage 2: Structured Form Panel (left side of split) -- */

interface StructuredFormPanelProps {
  formValues: Record<string, string>;
  onFormValuesChange: (values: Record<string, string>) => void;
  randomize: boolean;
  onRandomizeChange: (value: boolean) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  hasImages: boolean;
}

function StructuredFormPanel({
  formValues,
  onFormValuesChange,
  randomize,
  onRandomizeChange,
  onGenerate,
  isGenerating,
  hasImages,
}: StructuredFormPanelProps) {
  return (
    <div className="flex flex-col">
      <div className="flex-1 space-y-4">
        <ActorFormFields values={formValues} onChange={onFormValuesChange} />
      </div>

      <div className="mt-6 space-y-4 border-t border-border-subtle pt-4">
        <div className="flex items-center gap-2">
          <Checkbox
            id="form-randomize"
            checked={randomize}
            onCheckedChange={(checked) => onRandomizeChange(checked === true)}
          />
          <Label htmlFor="form-randomize" className="cursor-pointer font-normal">
            Randomize identity
          </Label>
        </div>

        <Button onClick={onGenerate} disabled={isGenerating} className="w-full">
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Generating...
            </>
          ) : hasImages ? (
            <>
              <RotateCcw className="mr-2 size-4" />
              Regenerate
            </>
          ) : (
            <>
              <Sparkles className="mr-2 size-4" />
              Generate
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

/* -- Stage 2: Reference Photo Panel (full-width bottom section) -- */

interface ReferencePhotoPanelProps {
  referenceImages: string[];
  onReferenceImagesChange: (images: string[]) => void;
  prompt: string;
  onPromptChange: (value: string) => void;
  randomize: boolean;
  onRandomizeChange: (value: boolean) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  hasImages: boolean;
}

function ReferencePhotoPanel({
  referenceImages,
  onReferenceImagesChange,
  prompt,
  onPromptChange,
  randomize,
  onRandomizeChange,
  onGenerate,
  isGenerating,
  hasImages,
}: ReferencePhotoPanelProps) {
  return (
    <div className="flex flex-col items-center gap-6">
      {/* Reference image slots */}
      <ReferenceImageUpload
        images={referenceImages}
        onChange={onReferenceImagesChange}
        maxSlots={4}
      />

      {/* Prompt textarea */}
      <div className="w-full max-w-xl space-y-2">
        <Label htmlFor="reference-prompt" className="text-center block">
          Describe your actor
        </Label>
        <Textarea
          id="reference-prompt"
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          placeholder="A young asian woman with cyberpunk aesthetic, neon-lit city background..."
          rows={3}
        />
      </div>

      {/* Randomize + Generate */}
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="ref-randomize"
            checked={randomize}
            onCheckedChange={(checked) => onRandomizeChange(checked === true)}
          />
          <Label htmlFor="ref-randomize" className="cursor-pointer font-normal">
            Randomize identity
          </Label>
        </div>

        <Button onClick={onGenerate} disabled={isGenerating}>
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Generating...
            </>
          ) : hasImages ? (
            <>
              <RotateCcw className="mr-2 size-4" />
              Regenerate
            </>
          ) : (
            <>
              <Sparkles className="mr-2 size-4" />
              Generate
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

/* -- Stage 2: Raw Text Panel (full-width bottom section) -- */

interface RawTextPanelProps {
  prompt: string;
  onPromptChange: (value: string) => void;
  randomize: boolean;
  onRandomizeChange: (value: boolean) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  hasImages: boolean;
}

function RawTextPanel({
  prompt,
  onPromptChange,
  randomize,
  onRandomizeChange,
  onGenerate,
  isGenerating,
  hasImages,
}: RawTextPanelProps) {
  return (
    <div className="flex flex-col items-center gap-6">
      {/* Prompt textarea */}
      <div className="w-full max-w-xl space-y-2">
        <Label htmlFor="raw-text-prompt" className="text-center block">
          Describe your actor
        </Label>
        <Textarea
          id="raw-text-prompt"
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          placeholder="A young asian woman with cyberpunk aesthetic, neon-lit city background..."
          rows={4}
        />
      </div>

      {/* Randomize + Generate */}
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="text-randomize"
            checked={randomize}
            onCheckedChange={(checked) => onRandomizeChange(checked === true)}
          />
          <Label htmlFor="text-randomize" className="cursor-pointer font-normal">
            Randomize identity
          </Label>
        </div>

        <Button onClick={onGenerate} disabled={isGenerating}>
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Generating...
            </>
          ) : hasImages ? (
            <>
              <RotateCcw className="mr-2 size-4" />
              Regenerate
            </>
          ) : (
            <>
              <Sparkles className="mr-2 size-4" />
              Generate
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

/* -- Stage 3: Name & Properties Form -- */

interface Stage3Props {
  actorName: string;
  onNameChange: (value: string) => void;
  taxonomyValues: Record<string, string>;
  onTaxonomyChange: (values: Record<string, string>) => void;
  onBack: () => void;
  onSave: () => void;
  isSaving: boolean;
}

function Stage3({
  actorName,
  onNameChange,
  taxonomyValues,
  onTaxonomyChange,
  onBack,
  onSave,
  isSaving,
}: Stage3Props) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="actor-name">Actor Name</Label>
          <Input
            id="actor-name"
            value={actorName}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Cyberpunk Woman"
          />
        </div>
      </div>

      <ActorFormFields values={taxonomyValues} onChange={onTaxonomyChange} />

      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="mr-2 size-4" />
          Back
        </Button>
        <Button onClick={onSave} disabled={isSaving || !actorName.trim()}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Actor'
          )}
        </Button>
      </div>
    </div>
  );
}

/* -- Main Wizard Component -- */

export default function ActorDesigner() {
  const navigate = useNavigate();

  // Wizard state
  const [stage, setStage] = useState<WizardStage>(1);
  const [entryMethod, setEntryMethod] = useState<EntryMethod>('FORM');
  const [prompt, setPrompt] = useState('');
  const [randomize, setRandomize] = useState(false);

  // Reference Photo state
  const [referenceImages, setReferenceImages] = useState<string[]>([]);

  // Structured Form state — persists across step navigation
  const [formValues, setFormValues] = useState<Record<string, string>>({});

  // Stage 2 state
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<Record<LayoutStep, string | null>>({
    headshot: null,
    fullshot: null,
    expressions: null,
  });
  const [confirmedSteps, setConfirmedSteps] = useState<Set<LayoutStep>>(new Set());

  // Generation sessions: tracked per layout step
  const [stepSessions, setStepSessions] = useState<Record<LayoutStep, GenerationSession[]>>(() => ({
    headshot: [],
    fullshot: [],
    expressions: [],
  }));
  const [selectedSessionIndices, setSelectedSessionIndices] = useState<Record<LayoutStep, number>>({
    headshot: 0,
    fullshot: 0,
    expressions: 0,
  });

  // Stage 3 state
  const [actorName, setActorName] = useState('');
  const [taxonomyValues, setTaxonomyValues] = useState<Record<string, string>>({});

  // Track initial values for dirty detection
  const initialActorName = useMemo(() => '', []);
  const initialTaxonomyValues = useMemo(() => ({}) as Record<string, string>, []);
  const isStage3Dirty =
    actorName !== initialActorName ||
    JSON.stringify(taxonomyValues) !== JSON.stringify(initialTaxonomyValues);
  useUnsavedChanges(stage === 3 && isStage3Dirty);

  // Actor ID after creation
  const [actorId, setActorId] = useState<string | null>(null);

  // Per-step prompts for Raw Text mode — tracks what prompt was used per layout step
  const [stepPrompts, setStepPrompts] = useState<Record<LayoutStep, string>>(() => ({
    headshot: prompt,
    fullshot: prompt,
    expressions: prompt,
  }));

  const currentStep = LAYOUT_STEPS[currentStepIndex];

  // Helper: get current session's images for the active step
  const currentSessions = stepSessions[currentStep.key];
  const currentSessionIndex = selectedSessionIndices[currentStep.key];
  const currentOptions =
    currentSessions.length > 0
      ? currentSessions[currentSessionIndex].images
      : createEmptyOptions(NUM_OPTIONS);

  // Helper: check if current step has any generated images (in any session)
  const hasGeneratedImages = stepSessions[currentStep.key].some((session) =>
    session.images.some((o) => o.imageUrl !== null || o.status !== 'PENDING'),
  );

  // Create actor mutation
  const createActorMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post('/actors', {
        entry_method: entryMethod,
        ...(entryMethod === 'TEXT' && { prompt }),
        ...(entryMethod === 'FORM' && { form_data: formValues }),
        ...(randomize && { randomize: true }),
      });
      return data;
    },
    onSuccess: (data) => {
      setActorId(data.id);
      setStage(2);
      setCreateError(null);
    },
    onError: (err: unknown) => {
      const error = err as { message?: string };
      setCreateError(error.message ?? 'Failed to create actor');
    },
  });

  // Helper: create a new session from generated outputs
  const createSessionFromOutputs = useCallback(
    (
      layoutType: LayoutStep,
      outputs: Array<{
        id: string;
        image_url: string | null;
        status: string;
        error_message?: string | null;
      }>,
    ) => {
      setStepSessions((prev) => {
        const existing = prev[layoutType];
        const newSessionNumber = existing.length + 1;
        const newSession: GenerationSession = {
          id: `session-${layoutType}-${newSessionNumber}-${Date.now()}`,
          sessionNumber: newSessionNumber,
          prompt,
          referenceImages: [...referenceImages],
          randomize,
          formValues: { ...formValues },
          images: outputs.map((o) => ({
            id: o.id,
            imageUrl: o.image_url,
            status: o.status as GenerationState,
            errorMessage: o.error_message,
          })),
        };
        const updated = [...existing, newSession];
        // Set selected session to the newly created one
        setSelectedSessionIndices((prevIdx) => ({
          ...prevIdx,
          [layoutType]: updated.length - 1,
        }));
        return { ...prev, [layoutType]: updated };
      });
    },
    [prompt, referenceImages, randomize, formValues],
  );

  // Generate mutation
  const generateMutation = useMutation({
    mutationFn: async (layoutType: string) => {
      if (!actorId) return [];
      const { data } = await apiClient.post(`/actors/${actorId}/generate`, {
        layout_type: layoutType,
        options: { num_outputs: NUM_OPTIONS },
        ...(entryMethod === 'FORM' && { form_data: formValues }),
        ...(entryMethod === 'REFERENCE' && {
          reference_images: referenceImages,
        }),
        ...(entryMethod === 'TEXT' && { prompt }),
        ...(randomize && { randomize: true }),
      });
      return (data.outputs ?? []) as Array<{
        id: string;
        image_url: string | null;
        status: string;
        error_message?: string | null;
      }>;
    },
    onSuccess: (outputs) => {
      const layoutType = LAYOUT_STEPS[currentStepIndex].key;
      createSessionFromOutputs(layoutType, outputs);
      // Save the prompt used for this step (Raw Text mode)
      if (entryMethod === 'TEXT') {
        setStepPrompts((prev) => ({ ...prev, [layoutType]: prompt }));
      }
    },
  });

  // Regenerate mutation
  const regenerateMutation = useMutation({
    mutationFn: async (layoutType: string) => {
      if (!actorId) return [];
      const { data } = await apiClient.post(`/actors/${actorId}/regenerate`, {
        layout_type: layoutType,
        options: { num_outputs: NUM_OPTIONS },
        ...(entryMethod === 'FORM' && { form_data: formValues }),
        ...(entryMethod === 'REFERENCE' && {
          reference_images: referenceImages,
        }),
        ...(entryMethod === 'TEXT' && { prompt }),
        ...(randomize && { randomize: true }),
      });
      return (data.outputs ?? []) as Array<{
        id: string;
        image_url: string | null;
        status: string;
        error_message?: string | null;
      }>;
    },
    onSuccess: (outputs) => {
      const layoutType = LAYOUT_STEPS[currentStepIndex].key;
      createSessionFromOutputs(layoutType, outputs);
      setSelectedOptions((prev) => ({ ...prev, [layoutType]: null }));
      // Save the prompt used for this step (Raw Text mode)
      if (entryMethod === 'TEXT') {
        setStepPrompts((prev) => ({ ...prev, [layoutType]: prompt }));
      }
    },
  });

  // Save actor mutation
  const saveActorMutation = useMutation({
    mutationFn: async () => {
      await apiClient.patch(`/actors/${actorId}`, {
        name: actorName,
        taxonomy_values: taxonomyValues,
      });
    },
    onSuccess: () => {
      navigate(`/actors/${actorId}`);
    },
  });

  const handleSelectOption = useCallback(
    (optionId: string) => {
      setSelectedOptions((prev) => ({
        ...prev,
        [currentStep.key]: optionId,
      }));
    },
    [currentStep.key],
  );

  const handleConfirmStep = useCallback(() => {
    const stepKey = currentStep.key;
    setConfirmedSteps((prev) => new Set(prev).add(stepKey));

    if (currentStepIndex < LAYOUT_STEPS.length - 1) {
      const nextIndex = currentStepIndex + 1;
      setCurrentStepIndex(nextIndex);
      // No auto-generate — user must click explicitly
    } else {
      setStage(3);
    }
  }, [currentStep, currentStepIndex]);

  const handleGenerate = useCallback(() => {
    if (!actorId) return;
    generateMutation.mutate(currentStep.key);
  }, [actorId, currentStep.key, generateMutation]);

  const handleRegenerate = useCallback(() => {
    if (!actorId) return;
    regenerateMutation.mutate(currentStep.key);
  }, [actorId, currentStep.key, regenerateMutation]);

  // Load settings from a specific session
  const handleLoadSettings = useCallback(
    (sessionIndex: number) => {
      const session = stepSessions[currentStep.key][sessionIndex];
      if (!session) return;
      setPrompt(session.prompt);
      setRandomize(session.randomize);
      if (entryMethod === 'REFERENCE') {
        setReferenceImages([...session.referenceImages]);
      }
      if (entryMethod === 'FORM') {
        setFormValues({ ...session.formValues });
      }
      // Also update stepPrompts for Raw Text mode
      if (entryMethod === 'TEXT') {
        setStepPrompts((prev) => ({ ...prev, [currentStep.key]: session.prompt }));
      }
    },
    [currentStep.key, stepSessions, entryMethod],
  );

  const [createError, setCreateError] = useState<string | null>(null);

  const isGenerating = generateMutation.isPending || regenerateMutation.isPending;
  const selectedOptionId = selectedOptions[currentStep.key];
  const isStepConfirmed = confirmedSteps.has(currentStep.key);
  const canConfirm = selectedOptionId !== null && !isGenerating && !isStepConfirmed;

  // Whether we are in Structured Form mode at Stage 2
  const isStructuredForm = entryMethod === 'FORM' && stage === 2;
  // Whether we are in Reference Photo mode at Stage 2
  const isReference = entryMethod === 'REFERENCE' && stage === 2;
  // Whether we are in Raw Text mode at Stage 2
  const isRawText = entryMethod === 'TEXT' && stage === 2;

  return (
    <PageContainer>
      <PageHeader
        title="New Actor"
        description={
          stage === 1
            ? "Choose how to define your actor's identity."
            : stage === 2
              ? 'Generate and select the best options for each layout.'
              : 'Name your actor and set properties.'
        }
      />

      {stage === 1 && createError && (
        <div className="flex items-center gap-2 border border-error/20 bg-error/5 px-3 py-2 text-sm text-error">
          <AlertCircle className="size-4 shrink-0" />
          <span>{createError}</span>
        </div>
      )}

      {stage === 1 && (
        <Stage1
          entryMethod={entryMethod}
          onSelect={setEntryMethod}
          prompt={prompt}
          onPromptChange={setPrompt}
          randomize={randomize}
          onRandomizeChange={setRandomize}
          onCreate={() => createActorMutation.mutate()}
          isCreating={createActorMutation.isPending}
        />
      )}

      {stage === 2 && (
        <div className="space-y-6">
          {/* Full-width segmented stepper */}
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
                      // Save current prompt before switching steps (Raw Text mode)
                      if (isRawText) {
                        setStepPrompts((prev) => ({ ...prev, [currentStep.key]: prompt }));
                      }
                      setCurrentStepIndex(index);
                      // Restore prompt for the step we're navigating to (Raw Text mode)
                      if (isRawText) {
                        setPrompt(stepPrompts[step.key] ?? prompt);
                      }
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
            <GenerationStatus
              status={
                currentOptions.some((o) => o.status === 'PENDING')
                  ? 'PENDING'
                  : currentOptions.some((o) => o.status === 'FAILED')
                    ? 'FAILED'
                    : 'SUCCESS'
              }
              errorMessage={currentOptions.find((o) => o.status === 'FAILED')?.errorMessage}
              onRetry={handleRegenerate}
            />
          </div>

          {/* Structured Form: split screen layout */}
          {isStructuredForm ? (
            <div className="flex flex-col gap-6 lg:flex-row">
              {/* Left panel: form fields (1/3) */}
              <div className="w-full lg:w-1/3">
                <StructuredFormPanel
                  formValues={formValues}
                  onFormValuesChange={setFormValues}
                  randomize={randomize}
                  onRandomizeChange={setRandomize}
                  onGenerate={handleGenerate}
                  isGenerating={isGenerating}
                  hasImages={hasGeneratedImages}
                />
              </div>

              {/* Right panel: images (2/3) */}
              <div className="w-full space-y-3 lg:w-2/3">
                <ImageGrid
                  options={currentOptions}
                  selectedId={selectedOptionId}
                  isStepConfirmed={isStepConfirmed}
                  onSelect={handleSelectOption}
                />
                <SessionNavigator
                  sessions={currentSessions}
                  selectedIndex={currentSessionIndex}
                  onSelect={(idx) =>
                    setSelectedSessionIndices((prev) => ({
                      ...prev,
                      [currentStep.key]: idx,
                    }))
                  }
                  onLoadSettings={() => handleLoadSettings(currentSessionIndex)}
                />
              </div>
            </div>
          ) : (
            /* Non-form modes: full-width image grid */
            <div className="space-y-3">
              <ImageGrid
                options={currentOptions}
                selectedId={selectedOptionId}
                isStepConfirmed={isStepConfirmed}
                onSelect={handleSelectOption}
              />
              <SessionNavigator
                sessions={currentSessions}
                selectedIndex={currentSessionIndex}
                onSelect={(idx) =>
                  setSelectedSessionIndices((prev) => ({
                    ...prev,
                    [currentStep.key]: idx,
                  }))
                }
                onLoadSettings={() => handleLoadSettings(currentSessionIndex)}
              />
            </div>
          )}

          {/* Reference Photo: slots + prompt + generate below image grid */}
          {isReference && (
            <ReferencePhotoPanel
              referenceImages={referenceImages}
              onReferenceImagesChange={setReferenceImages}
              prompt={prompt}
              onPromptChange={setPrompt}
              randomize={randomize}
              onRandomizeChange={setRandomize}
              onGenerate={handleGenerate}
              isGenerating={isGenerating}
              hasImages={hasGeneratedImages}
            />
          )}

          {/* Raw Text: prompt + generate below image grid */}
          {isRawText && (
            <RawTextPanel
              prompt={prompt}
              onPromptChange={setPrompt}
              randomize={randomize}
              onRandomizeChange={setRandomize}
              onGenerate={handleGenerate}
              isGenerating={isGenerating}
              hasImages={hasGeneratedImages}
            />
          )}

          {/* Bottom actions — for non-form, non-reference, non-text modes */}
          {!isStructuredForm && !isReference && !isRawText && (
            <div className="flex flex-wrap items-center gap-3">
              {!hasGeneratedImages ? (
                <Button onClick={handleGenerate} disabled={isGenerating}>
                  {isGenerating ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 size-4" />
                  )}
                  Generate {currentStep.label}
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={handleRegenerate}
                    disabled={isGenerating || isStepConfirmed}
                  >
                    {isGenerating ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <RotateCcw className="mr-2 size-4" />
                    )}
                    Regenerate
                  </Button>
                  <Button onClick={handleConfirmStep} disabled={!canConfirm}>
                    Confirm Selection
                    <ChevronRight className="ml-2 size-4" />
                  </Button>
                </>
              )}
            </div>
          )}

          {/* For Structured Form: confirm button below the split */}
          {isStructuredForm && hasGeneratedImages && (
            <div className="flex justify-end">
              <Button onClick={handleConfirmStep} disabled={!canConfirm}>
                Confirm Selection
                <ChevronRight className="ml-2 size-4" />
              </Button>
            </div>
          )}

          {/* For Raw Text: confirm button below the panel */}
          {isRawText && hasGeneratedImages && (
            <div className="flex justify-center">
              <Button onClick={handleConfirmStep} disabled={!canConfirm}>
                Confirm Selection
                <ChevronRight className="ml-2 size-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {stage === 3 && (
        <Stage3
          actorName={actorName}
          onNameChange={setActorName}
          taxonomyValues={taxonomyValues}
          onTaxonomyChange={setTaxonomyValues}
          onBack={() => setStage(2)}
          onSave={() => saveActorMutation.mutate()}
          isSaving={saveActorMutation.isPending}
        />
      )}
    </PageContainer>
  );
}
