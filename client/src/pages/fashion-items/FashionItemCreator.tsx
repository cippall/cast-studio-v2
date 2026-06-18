/**
 * Fashion Item Creator — 2-step creation flow.
 * Step 1: Choose input method (Prompt, Reference)
 * Step 2: Select generated option, name, and save
 */
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  FileText,
  ImageIcon,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Check,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import GenerationStatus from '@/components/GenerationStatus';
import type { GenerationState } from '@/components/GenerationStatus';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';

type EntryMethod = 'PROMPT' | 'REFERENCE';
type WizardStep = 1 | 2;

interface GeneratedOption {
  id: string;
  imageUrl: string | null;
  status: GenerationState;
  errorMessage?: string | null;
}

const NUM_OPTIONS = 4;

const ENTRY_METHODS = [
  {
    value: 'PROMPT' as EntryMethod,
    icon: FileText,
    title: 'Prompt',
    desc: 'Describe the fashion item in your own words.',
  },
  {
    value: 'REFERENCE' as EntryMethod,
    icon: ImageIcon,
    title: 'Reference',
    desc: 'Upload a photo. Vision model extracts the item.',
  },
];

function createEmptyOptions(count: number): GeneratedOption[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `opt-${i}-${Date.now()}`,
    imageUrl: null,
    status: 'PENDING' as GenerationState,
  }));
}

/* -- Step 1: Input Method Selection -- */

interface Step1Props {
  entryMethod: EntryMethod;
  onSelect: (method: EntryMethod) => void;
  prompt: string;
  onPromptChange: (value: string) => void;
  referenceImage: string | null;
  onReferenceImageChange: (value: string | null) => void;
  onGenerate: () => void;
  isGenerating: boolean;
}

function Step1({
  entryMethod,
  onSelect,
  prompt,
  onPromptChange,
  referenceImage,
  onReferenceImageChange,
  onGenerate,
  isGenerating,
}: Step1Props) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      onReferenceImageChange(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const canGenerate = entryMethod === 'PROMPT' ? prompt.trim().length > 0 : referenceImage !== null;

  return (
    <div className="space-y-6">
      <RadioGroup
        value={entryMethod}
        onValueChange={(v) => onSelect(v as EntryMethod)}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        {ENTRY_METHODS.map((method) => (
          <Label
            key={method.value}
            htmlFor={`method-${method.value}`}
            className={cn(
              'flex cursor-pointer flex-col gap-3 rounded-lg border p-6 transition-colors',
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

      {entryMethod === 'PROMPT' && (
        <div className="space-y-2">
          <Label htmlFor="prompt">Describe the fashion item</Label>
          <Textarea
            id="prompt"
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder="Black leather jacket, product photography, white background..."
            rows={4}
          />
        </div>
      )}

      {entryMethod === 'REFERENCE' && (
        <div className="space-y-2">
          <Label htmlFor="reference-upload">Reference Image</Label>
          <input
            id="reference-upload"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary-foreground hover:file:bg-primary/90"
          />
          {referenceImage && (
            <img
              src={referenceImage}
              alt="Reference"
              className="mt-4 h-32 w-32 rounded-lg object-cover"
              width={128}
              height={128}
            />
          )}
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={onGenerate} disabled={isGenerating || !canGenerate}>
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              Generate Item
              <ChevronRight className="ml-2 size-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

/* -- Step 2: Image Grid + Name & Save -- */

interface ImageGridProps {
  options: GeneratedOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function ImageGrid({ options, selectedId, onSelect }: ImageGridProps) {
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
            if (option.status === 'SUCCESS') {
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

interface Step2Props {
  options: GeneratedOption[];
  selectedId: string | null;
  onSelectOption: (id: string) => void;
  itemName: string;
  onNameChange: (value: string) => void;
  onBack: () => void;
  onRegenerate: () => void;
  onSave: () => void;
  isSaving: boolean;
  isRegenerating: boolean;
}

function Step2({
  options,
  selectedId,
  onSelectOption,
  itemName,
  onNameChange,
  onBack,
  onRegenerate,
  onSave,
  isSaving,
  isRegenerating,
}: Step2Props) {
  const hasImages = options.some((o) => o.imageUrl !== null || o.status !== 'PENDING');
  const allPending = options.every((o) => o.status === 'PENDING');

  return (
    <div className="space-y-6">
      {hasImages && (
        <>
          <ImageGrid options={options} selectedId={selectedId} onSelect={onSelectOption} />
          <div className="flex gap-2">
            <Button variant="outline" onClick={onRegenerate} disabled={isRegenerating}>
              {isRegenerating ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <RotateCcw className="mr-2 size-4" />
              )}
              Regenerate
            </Button>
          </div>
        </>
      )}

      {allPending && (
        <div className="flex flex-col items-center gap-4 py-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Generating options...</p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="item-name">Item Name</Label>
        <Input
          id="item-name"
          value={itemName}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Black Leather Jacket"
        />
      </div>

      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="mr-2 size-4" />
          Back
        </Button>
        <Button onClick={onSave} disabled={isSaving || !selectedId || !itemName.trim()}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Item'
          )}
        </Button>
      </div>
    </div>
  );
}

/* -- Main Component -- */

export default function FashionItemCreator() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<WizardStep>(1);
  const [entryMethod, setEntryMethod] = useState<EntryMethod>('PROMPT');
  const [prompt, setPrompt] = useState('');
  const [referenceImage, setReferenceImage] = useState<string | null>(null);

  // Step 2 state
  const [itemId, setItemId] = useState<string | null>(null);
  const [options, setOptions] = useState<GeneratedOption[]>([]);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [itemName, setItemName] = useState('');

  // Create fashion item mutation
  const createItemMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        entry_method: entryMethod,
      };
      if (entryMethod === 'PROMPT') {
        body.prompt = prompt;
      } else if (entryMethod === 'REFERENCE') {
        body.reference_image = referenceImage;
      }
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
    },
  });

  // Regenerate mutation
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

  // Save mutation
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

      {step === 1 && (
        <Step1
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
        <Step2
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
