import { FileText, ImageIcon, Check, Loader2, ChevronRight } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { FashionEntryMethod } from './fashion-creator-types';
import { canGenerateFashionItem } from './fashion-creator-types';

interface FashionStep1Props {
  entryMethod: FashionEntryMethod;
  onSelect: (method: FashionEntryMethod) => void;
  prompt: string;
  onPromptChange: (value: string) => void;
  referenceImage: string | null;
  onReferenceImageChange: (value: string | null) => void;
  onGenerate: () => void;
  isGenerating: boolean;
}

const METHODS: Array<{
  value: FashionEntryMethod;
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}> = [
  {
    value: 'PROMPT',
    Icon: FileText,
    title: 'Prompt',
    desc: 'Describe the fashion item in your own words.',
  },
  {
    value: 'REFERENCE',
    Icon: ImageIcon,
    title: 'Reference',
    desc: 'Upload a photo. Vision model extracts the item.',
  },
];

export default function FashionItemCreatorStep1({
  entryMethod,
  onSelect,
  prompt,
  onPromptChange,
  referenceImage,
  onReferenceImageChange,
  onGenerate,
  isGenerating,
}: FashionStep1Props) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      onReferenceImageChange(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const canGenerate = canGenerateFashionItem(entryMethod, prompt, referenceImage);

  return (
    <div className="space-y-6">
      <RadioGroup
        value={entryMethod}
        onValueChange={(v) => onSelect(v as FashionEntryMethod)}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        {METHODS.map((method) => (
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
            <method.Icon className="size-8 text-muted-foreground" />
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
            className="block w-full text-sm text-muted-foreground file:mr-4 file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary-foreground hover:file:bg-primary/90"
          />
          {referenceImage && (
            <img
              src={referenceImage}
              alt="Reference"
              className="mt-4 h-32 w-32 object-cover"
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
