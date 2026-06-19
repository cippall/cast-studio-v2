import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import GenerationStatus from '@/components/GenerationStatus';
import type { ActorDetail, ActorOutput } from './actor-page-types';
import { OUTPUT_SECTIONS, getOutputStatus } from './actor-page-types';
import OutputSectionContent from './OutputSectionContent';

interface ActorOutputsProps {
  actor: ActorDetail;
  looks: Array<{ id: string; name: string }>;
  isArtist: boolean;
  isFrozen: boolean;
  isGenerating: boolean;
  characterSheetLookId: string;
  onCharacterSheetLookChange: (value: string) => void;
  openSections: Set<string>;
  onToggleSection: (key: string) => void;
  onGenerate: (layoutType: string) => void;
  onRegenerate: (layoutType: string) => void;
}

export default function ActorOutputs({
  actor,
  looks,
  isArtist,
  isFrozen,
  isGenerating,
  characterSheetLookId,
  onCharacterSheetLookChange,
  openSections,
  onToggleSection,
  onGenerate,
  onRegenerate,
}: ActorOutputsProps) {
  return (
    <div className="space-y-4">
      {OUTPUT_SECTIONS.map((section) => {
        const output = actor.outputs?.[section.key] as ActorOutput | null | undefined;
        const isObsolete = output?.is_obsolete === true;
        const isOpen = openSections.has(section.key);
        const sectionStatus = getOutputStatus(output);

        return (
          <Collapsible
            key={section.key}
            open={isOpen}
            onOpenChange={() => onToggleSection(section.key)}
          >
            <Card>
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold">{section.label}</h3>
                    <GenerationStatus status={sectionStatus} />
                  </div>
                  <ChevronDown
                    className={cn(
                      'size-5 text-muted-foreground transition-transform',
                      isOpen && 'rotate-180',
                    )}
                  />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <OutputSectionContent
                    sectionKey={section.key}
                    sectionLabel={section.label}
                    output={output}
                    isObsolete={isObsolete}
                    isGenerating={isGenerating}
                    isArtist={isArtist}
                    isFrozen={isFrozen}
                    characterSheetLookId={characterSheetLookId}
                    onCharacterSheetLookChange={onCharacterSheetLookChange}
                    looks={looks}
                    onGenerate={onGenerate}
                    onRegenerate={onRegenerate}
                  />
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}
    </div>
  );
}
