import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check, RotateCcw, ChevronLeft, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import GenerationStatus from '@/components/GenerationStatus';
import type { GenerationState } from '@/components/GenerationStatus';
import type { GeneratedOption } from './look-designer-types';

interface ImageGridProps {
  options: GeneratedOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ImageGrid({ options, selectedId, onSelect }: ImageGridProps) {
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
            ) : (
              <div className="flex size-full items-center justify-center p-4">
                <GenerationStatus status={option.status} errorMessage={option.errorMessage} />
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
  lookName: string;
  onNameChange: (value: string) => void;
  onBack: () => void;
  onRegenerate: () => void;
  onSave: () => void;
  isSaving: boolean;
  isRegenerating: boolean;
}

export default function LookDesignerStep2({
  options,
  selectedId,
  onSelectOption,
  lookName,
  onNameChange,
  onBack,
  onRegenerate,
  onSave,
  isSaving,
  isRegenerating,
}: Step2Props) {
  const hasImages = options.some((o) => o.imageUrl !== null || o.status !== 'PENDING');
  const allPending = options.every((o) => o.status === 'PENDING');

  const overallStatus: GenerationState = allPending
    ? 'PENDING'
    : options.some((o) => o.status === 'FAILED')
      ? 'FAILED'
      : 'SUCCESS';

  return (
    <div className="space-y-6">
      {hasImages && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Select Option</h2>
            <GenerationStatus
              status={overallStatus}
              errorMessage={options.find((o) => o.status === 'FAILED')?.errorMessage}
              onRetry={onRegenerate}
            />
          </div>
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
          <GenerationStatus status="PENDING" />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="look-name">Look Name</Label>
        <Input
          id="look-name"
          value={lookName}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Black Slim Editorial"
        />
      </div>

      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="mr-2 size-4" />
          Back
        </Button>
        <Button onClick={onSave} disabled={isSaving || !selectedId || !lookName.trim()}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Look'
          )}
        </Button>
      </div>
    </div>
  );
}
