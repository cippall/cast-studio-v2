import { FileText, ImageIcon, Layers, Check, Loader2, ChevronRight } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { EntryMethod } from './look-designer-types';
import { canGenerateLook } from './look-designer-types';

interface Step1Props {
  entryMethod: EntryMethod;
  onSelect: (method: EntryMethod) => void;
  prompt: string;
  onPromptChange: (value: string) => void;
  referenceImage: string | null;
  onReferenceImageChange: (value: string | null) => void;
  extractedPieces: string[];
  onExtractedPiecesChange: (pieces: string[]) => void;
  selectedFashionItemIds: string[];
  onFashionItemIdsChange: (ids: string[]) => void;
  fashionItems: Array<{ id: string; name: string; image_url: string | null }>;
  onGenerate: () => void;
  isGenerating: boolean;
  isExtracting: boolean;
  onExtractReference: (imageUrl: string) => void;
}

const METHODS: Array<{
  value: EntryMethod;
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}> = [
  {
    value: 'PROMPT',
    Icon: FileText,
    title: 'Prompt',
    desc: 'Describe the look in your own words.',
  },
  {
    value: 'REFERENCE',
    Icon: ImageIcon,
    title: 'Reference',
    desc: 'Upload a photo. Vision model extracts clothing pieces.',
  },
  {
    value: 'COMPOSITE',
    Icon: Layers,
    title: 'Compose',
    desc: 'Select from your Fashion Item library.',
  },
];

export default function LookDesignerStep1({
  entryMethod,
  onSelect,
  prompt,
  onPromptChange,
  referenceImage,
  onReferenceImageChange,
  extractedPieces,
  onExtractedPiecesChange,
  selectedFashionItemIds,
  onFashionItemIdsChange,
  fashionItems,
  onGenerate,
  isGenerating,
  isExtracting,
  onExtractReference,
}: Step1Props) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      onReferenceImageChange(dataUrl);
      onExtractReference(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const togglePiece = (piece: string) => {
    if (extractedPieces.includes(piece)) {
      onExtractedPiecesChange(extractedPieces.filter((p) => p !== piece));
    } else {
      onExtractedPiecesChange([...extractedPieces, piece]);
    }
  };

  const toggleFashionItem = (id: string) => {
    if (selectedFashionItemIds.includes(id)) {
      onFashionItemIdsChange(selectedFashionItemIds.filter((i) => i !== id));
    } else {
      onFashionItemIdsChange([...selectedFashionItemIds, id]);
    }
  };

  const canGenerate = canGenerateLook(
    entryMethod,
    prompt,
    referenceImage,
    extractedPieces,
    selectedFashionItemIds,
  );

  return (
    <div className="space-y-6">
      <RadioGroup
        value={entryMethod}
        onValueChange={(v) => onSelect(v as EntryMethod)}
        className="grid grid-cols-1 gap-3 sm:grid-cols-3"
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
          <Label htmlFor="prompt">Describe the look</Label>
          <Textarea
            id="prompt"
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder="Black slim-fit suit, editorial fashion photography, dramatic lighting..."
            rows={4}
          />
        </div>
      )}

      {entryMethod === 'REFERENCE' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reference-upload">Reference Image</Label>
            <input
              id="reference-upload"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary-foreground hover:file:bg-primary/90"
            />
          </div>

          {referenceImage && (
            <div className="flex flex-col gap-4 sm:flex-row">
              <img
                src={referenceImage}
                alt="Reference"
                className="h-32 w-32 shrink-0 rounded-lg object-cover"
                width={128}
                height={128}
              />
              <div className="flex-1 space-y-2">
                <Label>Extracted Pieces</Label>
                {isExtracting ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Analyzing image...
                  </div>
                ) : extractedPieces.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {extractedPieces.map((piece) => (
                      <div key={piece} className="flex items-center gap-2">
                        <Checkbox
                          id={`piece-${piece}`}
                          checked={extractedPieces.includes(piece)}
                          onCheckedChange={() => togglePiece(piece)}
                        />
                        <label htmlFor={`piece-${piece}`} className="text-sm">
                          {piece}
                        </label>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No pieces extracted yet. Upload an image to extract clothing categories.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {entryMethod === 'COMPOSITE' && (
        <div className="space-y-4">
          <Label>Select Fashion Items</Label>
          {fashionItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No fashion items in your library. Create some first.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {fashionItems.map((item) => (
                <Card
                  key={item.id}
                  className={cn(
                    'cursor-pointer overflow-hidden transition-all',
                    selectedFashionItemIds.includes(item.id) && 'ring-2 ring-primary',
                  )}
                  onClick={() => toggleFashionItem(item.id)}
                >
                  <div className="relative aspect-square bg-muted">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="size-full object-cover"
                        width={200}
                        height={200}
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center">
                        <ImageIcon className="size-6 text-muted-foreground" />
                      </div>
                    )}
                    {selectedFashionItemIds.includes(item.id) && (
                      <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                        <Check className="size-6 text-primary" />
                      </div>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="truncate text-xs font-medium">{item.name}</p>
                  </div>
                </Card>
              ))}
            </div>
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
              Generate Look
              <ChevronRight className="ml-2 size-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
