import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import {
  ChevronRight,
  Loader2,
  FormInput,
  ImageIcon,
  FileText,
  AlertCircle,
  Shuffle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ActorFormFields from '@/components/ActorFormFields';
import ReferenceImageUpload from '@/components/ReferenceImageUpload';
import type { EntryMethod } from './types';

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
  {
    value: 'RANDOMIZE' as EntryMethod,
    icon: Shuffle,
    title: 'Randomize',
    desc: 'Generate a random actor identity automatically.',
  },
];

interface Stage1Props {
  entryMethod: EntryMethod;
  onSelect: (method: EntryMethod) => void;
  prompt: string;
  onPromptChange: (value: string) => void;
  randomize: boolean;
  onRandomizeChange: (value: boolean) => void;
  formValues: Record<string, string>;
  onFormValuesChange: (values: Record<string, string>) => void;
  referenceImages: string[];
  onReferenceImagesChange: (images: string[]) => void;
  onCreate: () => void;
  isCreating: boolean;
}

export default function Stage1({
  entryMethod,
  onSelect,
  prompt,
  onPromptChange,
  randomize,
  onRandomizeChange,
  formValues,
  onFormValuesChange,
  referenceImages,
  onReferenceImagesChange,
  onCreate,
  isCreating,
}: Stage1Props) {
  const validationError = (() => {
    if (entryMethod === 'TEXT' && !prompt.trim()) {
      return 'Please enter a description to continue.';
    }
    if (entryMethod === 'REFERENCE' && !prompt.trim() && referenceImages.length === 0) {
      return 'Add a description or upload at least one reference image.';
    }
    return null;
  })();

  const isContinueDisabled = isCreating || validationError !== null;

  return (
    <div className="space-y-6">
      <RadioGroup
        value={entryMethod}
        onValueChange={(v) => onSelect(v as EntryMethod)}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
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

      {entryMethod === 'FORM' && (
        <div className="space-y-4">
          <ActorFormFields values={formValues} onChange={onFormValuesChange} />
        </div>
      )}

      {entryMethod === 'REFERENCE' && (
        <div className="space-y-4">
          <ReferenceImageUpload
            images={referenceImages}
            onChange={onReferenceImagesChange}
            maxSlots={4}
          />
          <div className="space-y-2">
            <Label htmlFor="reference-prompt">Describe your actor</Label>
            <Textarea
              id="reference-prompt"
              value={prompt}
              onChange={(e) => onPromptChange(e.target.value)}
              placeholder="A young asian woman with cyberpunk aesthetic, neon-lit city background..."
              rows={3}
            />
          </div>
        </div>
      )}

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

      {entryMethod === 'RANDOMIZE' && (
        <div className="flex items-center gap-2 border border-border-subtle bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          <Shuffle className="size-4 shrink-0" />
          <span>
            A random actor identity will be generated. You can edit all properties in Stage 3.
          </span>
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

      {validationError && (
        <div className="flex items-center gap-2 text-sm text-error">
          <AlertCircle className="size-4 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={onCreate} disabled={isContinueDisabled}>
          {isCreating ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Creating...
            </>
          ) : entryMethod === 'RANDOMIZE' ? (
            <>
              Generate Random Actor
              <Shuffle className="ml-2 size-4" />
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
