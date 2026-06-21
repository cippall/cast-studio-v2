import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertCircle, ImageIcon, RotateCcw, Sparkles } from 'lucide-react';
import type { ActorOutput } from './actor-page-types';

interface OutputSectionContentProps {
  sectionKey: string;
  sectionLabel: string;
  output: ActorOutput | null | undefined;
  isObsolete: boolean;
  isGenerating: boolean;
  isArtist: boolean;
  isFrozen: boolean;
  characterSheetLookId: string;
  onCharacterSheetLookChange: (value: string) => void;
  looks: Array<{ id: string; name: string }>;
  onGenerate: (layoutType: string) => void;
  onRegenerate: (layoutType: string) => void;
  isStale: boolean;
  onRetryStale: (layoutType: string) => void;
}

export default function OutputSectionContent({
  sectionKey,
  sectionLabel,
  output,
  isObsolete,
  isGenerating,
  isArtist,
  isFrozen,
  characterSheetLookId,
  onCharacterSheetLookChange,
  looks,
  onGenerate,
  onRegenerate,
  isStale,
  onRetryStale,
}: OutputSectionContentProps) {
  const isOptional = sectionKey === 'character_sheet' || sectionKey === 'editorial';
  const canRegenerate = isArtist && !isFrozen && !isOptional && output !== null;

  return (
    <>
      {isObsolete && output && (
        <div className="mb-4 flex items-center gap-2 border border-warning/20 bg-warning/10 px-3 py-2 text-sm text-warning">
          <AlertCircle className="size-4 shrink-0" />
          <span>
            {output.obsolete_reason ??
              'This asset is based on a previous version. Regenerate to update.'}
          </span>
          {canRegenerate && (
            <Button
              variant="outline"
              size="xs"
              className="ml-auto"
              onClick={() => onRegenerate(sectionKey)}
            >
              Regenerate
            </Button>
          )}
        </div>
      )}

      {isStale && output?.status === 'PENDING' && (
        <div className="mb-4 flex items-center gap-2 border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          <span>Generation timed out. The request may have failed silently.</span>
          {isArtist && !isFrozen && (
            <Button
              variant="outline"
              size="xs"
              className="ml-auto"
              onClick={() => onRetryStale(sectionKey)}
            >
              Retry
            </Button>
          )}
        </div>
      )}

      {!isOptional && output?.image_url && (
        <div className="space-y-4">
          <img
            src={output.image_url}
            alt={sectionLabel}
            className="max-w-md object-cover"
            width={512}
            height={512}
          />
          {canRegenerate && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRegenerate(sectionKey)}
              disabled={isGenerating}
            >
              <RotateCcw className="mr-2 size-4" />
              Regenerate
            </Button>
          )}
        </div>
      )}

      {!isOptional && !output?.image_url && (
        <div className="flex flex-col items-center gap-4 py-8">
          <ImageIcon className="size-12 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No {sectionLabel.toLowerCase()} generated yet.
          </p>
          {isArtist && !isFrozen && (
            <Button size="sm" onClick={() => onGenerate(sectionKey)} disabled={isGenerating}>
              <Sparkles className="mr-2 size-4" />
              Generate {sectionLabel}
            </Button>
          )}
        </div>
      )}

      {sectionKey === 'character_sheet' && (
        <div className="space-y-4">
          <div className="flex items-end gap-4">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium">Select Look</label>
              <Select
                value={characterSheetLookId}
                onValueChange={(val) => onCharacterSheetLookChange(val ?? '')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a look from the library..." />
                </SelectTrigger>
                <SelectContent>
                  {looks.map((look) => (
                    <SelectItem key={look.id} value={look.id}>
                      {look.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => onGenerate('character_sheet')}
              disabled={isGenerating || !characterSheetLookId || isFrozen}
            >
              <Sparkles className="mr-2 size-4" />
              Generate Character Sheet
            </Button>
          </div>
          {output?.image_url && (
            <img
              src={output.image_url}
              alt="Character Sheet"
              className="max-w-md object-cover"
              width={512}
              height={512}
            />
          )}
        </div>
      )}

      {sectionKey === 'editorial' && (
        <div className="space-y-4">
          {output?.image_url ? (
            <>
              <img
                src={output.image_url}
                alt="Editorial"
                className="max-w-md object-cover"
                width={512}
                height={512}
              />
              {isArtist && !isFrozen && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onRegenerate('editorial')}
                  disabled={isGenerating}
                >
                  <Sparkles className="mr-2 size-4" />
                  Generate New
                </Button>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-4 py-8">
              <ImageIcon className="size-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No editorial shots generated yet.</p>
              {isArtist && !isFrozen && (
                <Button size="sm" onClick={() => onGenerate('editorial')} disabled={isGenerating}>
                  <Sparkles className="mr-2 size-4" />
                  Generate Editorial
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
