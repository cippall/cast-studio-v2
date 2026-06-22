/**
 * Look Designer — 2-step creation flow.
 * Step 1: Choose input method (Prompt, Reference, Compose)
 * Step 2: Select generated option, name, and save
 */
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { useFashionItems } from '@/hooks/useFashionItems';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import type { GenerationState } from '@/components/GenerationStatus';
import type { EntryMethod, GeneratedOption } from './look-designer-types';
import LookDesignerStep1 from './LookDesignerStep1';
import LookDesignerStep2 from './LookDesignerStep2';

export default function LookDesigner() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<1 | 2>(1);
  const [entryMethod, setEntryMethod] = useState<EntryMethod>('PROMPT');
  const [prompt, setPrompt] = useState('');
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [extractedPieces, setExtractedPieces] = useState<string[]>([]);
  const [selectedFashionItemIds, setSelectedFashionItemIds] = useState<string[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);

  const [lookId, setLookId] = useState<string | null>(null);
  const [options, setOptions] = useState<GeneratedOption[]>([]);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [lookName, setLookName] = useState('');

  const { data: fashionItemsData } = useFashionItems({});
  const fashionItems = fashionItemsData?.data ?? [];

  const [createError, setCreateError] = useState<string | null>(null);

  const createLookMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = { entry_method: entryMethod };
      if (entryMethod === 'PROMPT') body.prompt = prompt;
      else if (entryMethod === 'REFERENCE') body.reference_image = referenceImage;
      else if (entryMethod === 'COMPOSITE') body.fashion_item_ids = selectedFashionItemIds;
      const { data } = await apiClient.post('/looks', body);
      return data;
    },
    onSuccess: (data) => {
      setLookId(data.id);
      setLookName(data.auto_name ?? '');
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
      setCreateError(error.message ?? 'Failed to create look');
    },
  });

  const extractReferenceMutation = useMutation({
    mutationFn: async (imageUrl: string) => {
      const { data } = await apiClient.post('/looks/extract-reference', {
        image_url: imageUrl,
      });
      return data as { categories: string[] };
    },
    onMutate: () => {
      setIsExtracting(true);
    },
    onSuccess: (data) => {
      setExtractedPieces(data.categories);
    },
    onError: () => {
      setExtractedPieces([]);
    },
    onSettled: () => {
      setIsExtracting(false);
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: async () => {
      if (!lookId) return [];
      const { data } = await apiClient.post(`/looks/${lookId}/regenerate`, {
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

  const saveLookMutation = useMutation({
    mutationFn: async () => {
      await apiClient.patch(`/looks/${lookId}`, {
        selected_output_id: selectedOptionId,
        name: lookName,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['looks'] });
      navigate(`/looks/${lookId}`);
    },
  });

  const handleGenerate = useCallback(() => {
    createLookMutation.mutate();
  }, [createLookMutation]);
  const handleRegenerate = useCallback(() => {
    regenerateMutation.mutate();
  }, [regenerateMutation]);
  const handleSave = useCallback(() => {
    saveLookMutation.mutate();
  }, [saveLookMutation]);

  return (
    <PageContainer>
      <PageHeader
        title="New Look"
        description={
          step === 1
            ? 'Choose how to define your look.'
            : 'Select the best option and name your look.'
        }
      />

      {step === 1 && createError && (
        <div className="flex items-center gap-2 border border-error/20 bg-error/5 px-3 py-2 text-sm text-error">
          <AlertCircle className="size-4 shrink-0" />
          <span>{createError}</span>
        </div>
      )}

      {step === 1 && (
        <LookDesignerStep1
          entryMethod={entryMethod}
          onSelect={setEntryMethod}
          prompt={prompt}
          onPromptChange={setPrompt}
          referenceImage={referenceImage}
          onReferenceImageChange={setReferenceImage}
          extractedPieces={extractedPieces}
          onExtractedPiecesChange={setExtractedPieces}
          selectedFashionItemIds={selectedFashionItemIds}
          onFashionItemIdsChange={setSelectedFashionItemIds}
          fashionItems={fashionItems}
          onGenerate={handleGenerate}
          isGenerating={createLookMutation.isPending}
          isExtracting={isExtracting}
          onExtractReference={extractReferenceMutation.mutate}
        />
      )}

      {step === 2 && (
        <LookDesignerStep2
          options={options}
          selectedId={selectedOptionId}
          onSelectOption={setSelectedOptionId}
          lookName={lookName}
          onNameChange={setLookName}
          onBack={() => setStep(1)}
          onRegenerate={handleRegenerate}
          onSave={handleSave}
          isSaving={saveLookMutation.isPending}
          isRegenerating={regenerateMutation.isPending}
        />
      )}
    </PageContainer>
  );
}
