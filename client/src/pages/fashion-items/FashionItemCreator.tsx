/**
 * Fashion Item Creator — 2-step creation flow.
 * Step 1: Choose input method (Prompt, Reference)
 * Step 2: Select generated option, name, and save
 */
import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react';
import apiClient from '@/lib/api-client';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import type { GenerationState } from '@/components/GenerationStatus';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import type { FashionEntryMethod, FashionGeneratedOption } from './fashion-creator-types';
import FashionItemCreatorStep1 from './FashionItemCreatorStep1';
import FashionItemCreatorStep2 from './FashionItemCreatorStep2';

export default function FashionItemCreator() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [createError, setCreateError] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [entryMethod, setEntryMethod] = useState<FashionEntryMethod>('PROMPT');
  const [prompt, setPrompt] = useState('');
  const [referenceImage, setReferenceImage] = useState<string | null>(null);

  const [itemId, setItemId] = useState<string | null>(null);
  const [options, setOptions] = useState<FashionGeneratedOption[]>([]);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [itemName, setItemName] = useState('');

  const isStep2Dirty = useMemo(
    () => step === 2 && (selectedOptionId !== null || itemName.trim().length > 0),
    [step, selectedOptionId, itemName],
  );
  useUnsavedChanges(isStep2Dirty);

  const createItemMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = { entry_method: entryMethod };
      if (entryMethod === 'PROMPT') body.prompt = prompt;
      else if (entryMethod === 'REFERENCE') body.reference_image = referenceImage;
      const { data } = await apiClient.post('/fashion-items', body);
      return data;
    },
    onSuccess: (data) => {
      setItemId(data.id);
      setItemName(data.auto_name ?? '');
      const outputs = (data.outputs ?? []) as Array<{
        id: string;
        image_url: string | null;
        status: string;
        error_message?: string | null;
      }>;
      setOptions(
        outputs.map((o) => ({
          id: o.id,
          imageUrl: o.image_url,
          status: o.status as GenerationState,
          errorMessage: o.error_message,
        })),
      );
      setStep(2);
      setCreateError(null);
    },
    onError: (err: unknown) => {
      const error = err as { message?: string };
      setCreateError(error.message ?? 'Failed to create fashion item');
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: async () => {
      if (!itemId) return [];
      const { data } = await apiClient.post(`/fashion-items/${itemId}/regenerate`, {
        entry_method: entryMethod,
      });
      return (data.outputs ?? data) as Array<{
        id: string;
        image_url: string | null;
        status: string;
        error_message?: string | null;
      }>;
    },
    onSuccess: (outputs) => {
      setOptions(
        outputs.map((o) => ({
          id: o.id,
          imageUrl: o.image_url,
          status: o.status as GenerationState,
          errorMessage: o.error_message,
        })),
      );
      setSelectedOptionId(null);
    },
  });

  const saveItemMutation = useMutation({
    mutationFn: async () => {
      await apiClient.patch(`/fashion-items/${itemId}`, {
        selected_output_id: selectedOptionId,
        name: itemName,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fashion-items'] });
      navigate(`/fashion-items/${itemId}`);
    },
  });

  const handleGenerate = useCallback(() => {
    createItemMutation.mutate();
  }, [createItemMutation]);
  const handleRegenerate = useCallback(() => {
    regenerateMutation.mutate();
  }, [regenerateMutation]);
  const handleSave = useCallback(() => {
    saveItemMutation.mutate();
  }, [saveItemMutation]);

  return (
    <PageContainer>
      <PageHeader
        title="New Fashion Item"
        description={
          step === 1
            ? 'Choose how to define your fashion item.'
            : 'Select the best option and name your item.'
        }
      />

      {step === 1 && createError && (
        <div className="flex items-center gap-2 border border-error/20 bg-error/5 px-3 py-2 text-sm text-error">
          <AlertCircle className="size-4 shrink-0" />
          <span>{createError}</span>
        </div>
      )}

      {step === 1 && (
        <FashionItemCreatorStep1
          entryMethod={entryMethod}
          onSelect={setEntryMethod}
          prompt={prompt}
          onPromptChange={setPrompt}
          referenceImage={referenceImage}
          onReferenceImageChange={setReferenceImage}
          onGenerate={handleGenerate}
          isGenerating={createItemMutation.isPending}
        />
      )}

      {step === 2 && (
        <FashionItemCreatorStep2
          options={options}
          selectedId={selectedOptionId}
          onSelectOption={setSelectedOptionId}
          itemName={itemName}
          onNameChange={setItemName}
          onBack={() => setStep(1)}
          onRegenerate={handleRegenerate}
          onSave={handleSave}
          isSaving={saveItemMutation.isPending}
          isRegenerating={regenerateMutation.isPending}
        />
      )}
    </PageContainer>
  );
}
