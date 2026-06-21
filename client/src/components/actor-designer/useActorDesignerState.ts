import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { GenerationState } from '@/components/GenerationStatus';
import type { EntryMethod, LayoutStep, GenerationSession } from './types';
import { LAYOUT_STEPS, NUM_OPTIONS, createEmptyOptions } from './types';

export interface ActorDesignerState {
  // Actions
  setEntryMethod: (m: EntryMethod) => void;
  setPrompt: (p: string) => void;
  setRandomize: (r: boolean) => void;
  setReferenceImages: (imgs: string[]) => void;
  setFormValues: (v: Record<string, string>) => void;
  setCurrentStepIndex: (i: number) => void;
  setStage: (s: 1 | 2 | 3) => void;
  setActorName: (n: string) => void;
  setTaxonomyValues: (v: Record<string, string>) => void;
  handleCreateActor: () => void;
  handleGenerate: () => void;
  handleRegenerate: () => void;
  handleSelectOption: (id: string) => void;
  handleConfirmStep: () => void;
  handleSaveSettings: (sessionIndex: number) => void;
  handleSaveCurrentPrompt: () => void;
  handleRestorePrompt: (stepKey: LayoutStep) => void;
  handleSaveActor: () => void;
  handleSessionSelect: (idx: number) => void;
  // State
  stage: 1 | 2 | 3;
  entryMethod: EntryMethod;
  prompt: string;
  randomize: boolean;
  referenceImages: string[];
  formValues: Record<string, string>;
  currentStepIndex: number;
  currentStep: { key: LayoutStep; label: string };
  currentSessions: GenerationSession[];
  currentSessionIndex: number;
  currentOptions: ReturnType<typeof createEmptyOptions>;
  selectedOptionId: string | null;
  isStepConfirmed: boolean;
  confirmedSteps: Set<LayoutStep>;
  isGenerating: boolean;
  hasGeneratedImages: boolean;
  canConfirm: boolean;
  isStructuredForm: boolean;
  isReference: boolean;
  isRawText: boolean;
  actorName: string;
  taxonomyValues: Record<string, string>;
  createError: string | null;
  referenceValidationError: string | null;
  isCreating: boolean;
  isSaving: boolean;
}

export function useActorDesignerState(): ActorDesignerState {
  const navigate = useNavigate();
  const [stage, setStage] = useState<1 | 2 | 3>(1);
  const [entryMethod, setEntryMethod] = useState<EntryMethod>('FORM');
  const [prompt, setPrompt] = useState('');
  const [randomize, setRandomize] = useState(false);
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<Record<LayoutStep, string | null>>({
    headshot: null,
    fullshot: null,
    expressions: null,
  });
  const [confirmedSteps, setConfirmedSteps] = useState<Set<LayoutStep>>(new Set());
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
  const [actorName, setActorName] = useState('');
  const [taxonomyValues, setTaxonomyValues] = useState<Record<string, string>>({});
  const [actorId, setActorId] = useState<string | null>(null);
  const [stepPrompts, setStepPrompts] = useState<Record<LayoutStep, string>>(() => ({
    headshot: '',
    fullshot: '',
    expressions: '',
  }));
  const [createError, setCreateError] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [referenceValidationError, setReferenceValidationError] = useState<string | null>(null);

  // Poll actor detail for live output status updates
  const { data: actorDetail } = useQuery({
    queryKey: ['actors', actorId],
    queryFn: async () => {
      if (!actorId) return null;
      const { data } = await apiClient.get(`/actors/${actorId}`);
      return data;
    },
    enabled: !!actorId,
    refetchInterval: (query) => {
      const outputs = query.state.data?.outputs;
      if (outputs) {
        const values = Object.values(outputs);
        const hasPending = values.some((o: any) => o?.status === 'PENDING');
        if (hasPending) return 3000;
      }
      return false;
    },
  });

  // Sync polled output statuses into local session state
  useEffect(() => {
    if (!actorDetail?.outputs) return;
    setStepSessions((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const lt of ['headshot', 'fullshot', 'expressions'] as LayoutStep[]) {
        const serverOutput = actorDetail.outputs[lt];
        if (!serverOutput) continue;
        const sessions = next[lt];
        if (!sessions.length) continue;
        // Find the session/image that matches this server output ID
        const updatedSessions = sessions.map((session) => {
          const imgIdx = session.images.findIndex((img) => img.id === serverOutput.id);
          if (imgIdx === -1) return session;
          const img = session.images[imgIdx];
          const newStatus =
            serverOutput.status === 'SUCCESS'
              ? 'SUCCESS'
              : serverOutput.status === 'FAILED'
                ? 'FAILED'
                : 'PENDING';
          if (img.status === newStatus && img.imageUrl === serverOutput.image_url) return session;
          changed = true;
          const newImages = [...session.images];
          newImages[imgIdx] = {
            ...img,
            status: newStatus,
            imageUrl: serverOutput.image_url ?? img.imageUrl,
            errorMessage: serverOutput.error_message ?? img.errorMessage,
          };
          return { ...session, images: newImages };
        });
        next[lt] = updatedSessions;
      }
      return changed ? next : prev;
    });
  }, [actorDetail]);

  const currentStep = LAYOUT_STEPS[currentStepIndex];
  const currentSessions = stepSessions[currentStep.key];
  const currentSessionIndex = selectedSessionIndices[currentStep.key];
  const currentOptions =
    currentSessions.length > 0
      ? currentSessions[currentSessionIndex].images
      : createEmptyOptions(NUM_OPTIONS);
  const hasGeneratedImages = stepSessions[currentStep.key].some((s) =>
    s.images.some((o) => o.imageUrl !== null || o.status !== 'PENDING'),
  );

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
        const newSession: GenerationSession = {
          id: `session-${layoutType}-${existing.length + 1}-${Date.now()}`,
          sessionNumber: existing.length + 1,
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
        setSelectedSessionIndices((p) => ({ ...p, [layoutType]: updated.length - 1 }));
        return { ...prev, [layoutType]: updated };
      });
    },
    [prompt, referenceImages, randomize, formValues],
  );

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
      setCreateError((err as { message?: string }).message ?? 'Failed to create actor');
    },
  });

  const generateMutation = useMutation({
    mutationFn: async (layoutType: string) => {
      if (!actorId) return [];
      const { data } = await apiClient.post(`/actors/${actorId}/generate`, {
        layout_type: layoutType,
        options: { num_outputs: NUM_OPTIONS },
        ...(entryMethod === 'FORM' && { form_data: formValues }),
        ...(entryMethod === 'REFERENCE' && { reference_images: referenceImages }),
        ...(entryMethod === 'TEXT' && { prompt }),
        ...(randomize && { randomize: true }),
      });
      return data.outputs ?? [];
    },
    onSuccess: (outputs) => {
      setGenerateError(null);
      const lt = LAYOUT_STEPS[currentStepIndex].key;
      createSessionFromOutputs(lt, outputs);
      if (entryMethod === 'TEXT') setStepPrompts((p) => ({ ...p, [lt]: prompt }));
    },
    onError: (err: unknown) => {
      setGenerateError((err as { message?: string }).message ?? 'Generation failed');
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: async (layoutType: string) => {
      if (!actorId) return [];
      const { data } = await apiClient.post(`/actors/${actorId}/regenerate`, {
        layout_type: layoutType,
        options: { num_outputs: NUM_OPTIONS },
        ...(entryMethod === 'FORM' && { form_data: formValues }),
        ...(entryMethod === 'REFERENCE' && { reference_images: referenceImages }),
        ...(entryMethod === 'TEXT' && { prompt }),
        ...(randomize && { randomize: true }),
      });
      return data.outputs ?? [];
    },
    onSuccess: (outputs) => {
      const lt = LAYOUT_STEPS[currentStepIndex].key;
      createSessionFromOutputs(lt, outputs);
      setSelectedOptions((p) => ({ ...p, [lt]: null }));
      if (entryMethod === 'TEXT') setStepPrompts((p) => ({ ...p, [lt]: prompt }));
    },
  });

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

  const isGenerating = generateMutation.isPending || regenerateMutation.isPending;
  const selectedOptionId = selectedOptions[currentStep.key];
  const isStepConfirmed = confirmedSteps.has(currentStep.key);
  const canConfirm = selectedOptionId !== null && !isGenerating && !isStepConfirmed;
  const isStructuredForm = entryMethod === 'FORM' && stage === 2;
  const isReference = entryMethod === 'REFERENCE' && stage === 2;
  const isRawText = entryMethod === 'TEXT' && stage === 2;

  const handleSelectOption = useCallback(
    (id: string) => {
      setSelectedOptions((p) => ({ ...p, [currentStep.key]: id }));
    },
    [currentStep.key],
  );

  const handleConfirmStep = useCallback(() => {
    setConfirmedSteps((p) => new Set(p).add(currentStep.key));
    if (currentStepIndex < LAYOUT_STEPS.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      setStage(3);
    }
  }, [currentStep, currentStepIndex]);

  const handleGenerate = useCallback(() => {
    if (!actorId) return;
    if (entryMethod === 'REFERENCE' && !prompt.trim() && referenceImages.length === 0) {
      setReferenceValidationError('Add a description or upload at least one reference image.');
      return;
    }
    setReferenceValidationError(null);
    generateMutation.mutate(currentStep.key);
  }, [actorId, currentStep.key, generateMutation, entryMethod, prompt, referenceImages]);

  const handleRegenerate = useCallback(() => {
    if (!actorId) return;
    regenerateMutation.mutate(currentStep.key);
  }, [actorId, currentStep.key, regenerateMutation]);

  const handleSaveSettings = useCallback(
    (sessionIndex: number) => {
      const session = stepSessions[currentStep.key][sessionIndex];
      if (!session) return;
      setPrompt(session.prompt);
      setRandomize(session.randomize);
      if (entryMethod === 'REFERENCE') setReferenceImages([...session.referenceImages]);
      if (entryMethod === 'FORM') setFormValues({ ...session.formValues });
      if (entryMethod === 'TEXT')
        setStepPrompts((p) => ({ ...p, [currentStep.key]: session.prompt }));
    },
    [currentStep.key, stepSessions, entryMethod],
  );

  // Clear validation error when user provides input (prompt text or reference images)
  useEffect(() => {
    if (
      entryMethod === 'REFERENCE' &&
      referenceValidationError &&
      (prompt.trim() !== '' || referenceImages.length > 0)
    ) {
      setReferenceValidationError(null);
    }
  }, [prompt, referenceImages.length, entryMethod, referenceValidationError]);

  const handleSaveCurrentPrompt = useCallback(() => {
    setStepPrompts((p) => ({ ...p, [currentStep.key]: prompt }));
  }, [currentStep.key, prompt]);

  const handleRestorePrompt = useCallback(
    (stepKey: LayoutStep) => {
      setPrompt(stepPrompts[stepKey] ?? '');
    },
    [stepPrompts],
  );

  return {
    setEntryMethod,
    setPrompt,
    setRandomize,
    setReferenceImages,
    setFormValues,
    setCurrentStepIndex,
    setStage,
    setActorName,
    setTaxonomyValues,
    handleCreateActor: () => {
      if (entryMethod === 'TEXT' && !prompt.trim()) {
        setCreateError('Please enter a prompt to generate the actor.');
        return;
      }
      if (entryMethod === 'REFERENCE' && !prompt.trim() && referenceImages.length === 0) {
        setCreateError('Add a description or upload at least one reference image.');
        return;
      }
      createActorMutation.mutate();
    },
    handleGenerate,
    handleRegenerate,
    handleSelectOption,
    handleConfirmStep,
    handleSaveSettings,
    handleSaveCurrentPrompt,
    handleRestorePrompt,
    handleSaveActor: () => saveActorMutation.mutate(),
    handleSessionSelect: (idx: number) =>
      setSelectedSessionIndices((p) => ({ ...p, [currentStep.key]: idx })),
    stage,
    entryMethod,
    prompt,
    randomize,
    referenceImages,
    formValues,
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
    isStructuredForm,
    isReference,
    isRawText,
    actorName,
    taxonomyValues,
    createError,
    referenceValidationError,
    isCreating: createActorMutation.isPending,
    isSaving: saveActorMutation.isPending,
  };
}
