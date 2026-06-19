import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { ChevronRight, Loader2, FormInput, ImageIcon, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
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
];

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

export default function Stage1({
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
