import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Loader2, RotateCcw, Sparkles } from 'lucide-react';

interface RawTextPanelProps {
  prompt: string;
  onPromptChange: (value: string) => void;
  randomize: boolean;
  onRandomizeChange: (value: boolean) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  hasImages: boolean;
}

export default function RawTextPanel({
  prompt,
  onPromptChange,
  randomize,
  onRandomizeChange,
  onGenerate,
  isGenerating,
  hasImages,
}: RawTextPanelProps) {
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="w-full max-w-xl space-y-2">
        <Label htmlFor="raw-text-prompt" className="text-center block">
          Describe your actor
        </Label>
        <Textarea
          id="raw-text-prompt"
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          placeholder="A young asian woman with cyberpunk aesthetic, neon-lit city background..."
          rows={4}
        />
      </div>

      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="text-randomize"
            checked={randomize}
            onCheckedChange={(checked) => onRandomizeChange(checked === true)}
          />
          <Label htmlFor="text-randomize" className="cursor-pointer font-normal">
            Randomize identity
          </Label>
        </div>

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
