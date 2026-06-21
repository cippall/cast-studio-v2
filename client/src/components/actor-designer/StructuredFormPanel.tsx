import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Loader2, RotateCcw, Sparkles } from 'lucide-react';
import ActorFormFields from '@/components/ActorFormFields';

interface StructuredFormPanelProps {
  formValues: Record<string, string>;
  onFormValuesChange: (values: Record<string, string>) => void;
  randomize: boolean;
  onRandomizeChange: (value: boolean) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  hasImages: boolean;
  selectedModelName?: string;
}

export default function StructuredFormPanel({
  formValues,
  onFormValuesChange,
  randomize,
  onRandomizeChange,
  onGenerate,
  isGenerating,
  hasImages,
  selectedModelName,
}: StructuredFormPanelProps) {
  return (
    <div className="flex flex-col">
      <div className="flex-1 space-y-4">
        <ActorFormFields values={formValues} onChange={onFormValuesChange} />
      </div>

      <div className="mt-6 space-y-4 border-t border-border-subtle pt-4">
        {selectedModelName && (
          <p className="text-xs text-muted-foreground">
            Model: <span className="font-medium text-foreground">{selectedModelName}</span>
          </p>
        )}
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
