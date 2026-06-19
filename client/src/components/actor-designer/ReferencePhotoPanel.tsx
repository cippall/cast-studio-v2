import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { AlertCircle, Loader2, RotateCcw, Sparkles } from 'lucide-react';
import ReferenceImageUpload from '@/components/ReferenceImageUpload';

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
  validationError: string | null;
}

export default function ReferencePhotoPanel({
  referenceImages,
  onReferenceImagesChange,
  prompt,
  onPromptChange,
  randomize,
  onRandomizeChange,
  onGenerate,
  isGenerating,
  hasImages,
  validationError,
}: ReferencePhotoPanelProps) {
  return (
    <div className="flex flex-col items-center gap-6">
      <ReferenceImageUpload
        images={referenceImages}
        onChange={onReferenceImagesChange}
        maxSlots={4}
      />

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

        {validationError && (
          <div className="flex items-center gap-2 text-sm text-error">
            <AlertCircle className="size-4 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

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
