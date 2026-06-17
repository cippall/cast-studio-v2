/**
 * ActorPage — full actor view with all output sections.
 * Shows headshot, name, action buttons, collapsible output sections,
 * obsolete banners, character sheet look selector, and marketplace freeze.
 */
import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { useCurrentUser } from '@/hooks/useAuth';
import { useLooks } from '@/hooks/useLooks';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertCircle,
  ChevronDown,
  Copy,
  Edit3,
  ImageIcon,
  Loader2,
  Lock,
  RotateCcw,
  Send,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import GenerationStatus from '@/components/GenerationStatus';
import type { GenerationState } from '@/components/GenerationStatus';
import type { MarketplaceStatus } from '@cast/types';

interface ActorOutput {
  id: string;
  layout_type: string;
  image_url: string | null;
  model: string;
  status: string;
  is_obsolete: boolean;
  obsolete_reason: string | null;
  cost_credits: number;
  error_message?: string | null;
}

interface ActorDetail {
  id: string;
  name: string;
  asset_type: string;
  seed: number;
  prompt_recipe: Record<string, unknown>;
  outputs: Record<string, ActorOutput | null>;
  taxonomy_values: Record<string, string>;
  marketplace_status?: string | null;
  is_marketplace_frozen?: boolean;
  source_type?: string;
  created_at: string;
}

type OutputSectionKey = 'headshot' | 'fullshot' | 'expressions' | 'character_sheet' | 'editorial';

const OUTPUT_SECTIONS: {
  key: OutputSectionKey;
  label: string;
  dependsOn?: OutputSectionKey;
}[] = [
  { key: 'headshot', label: 'Headshot' },
  { key: 'fullshot', label: 'Fullshot', dependsOn: 'headshot' },
  { key: 'expressions', label: 'Expressions', dependsOn: 'fullshot' },
  { key: 'character_sheet', label: 'Character Sheet', dependsOn: 'expressions' },
  { key: 'editorial', label: 'Editorial', dependsOn: 'fullshot' },
];

function getOutputStatus(output: ActorOutput | null | undefined): GenerationState {
  if (!output) return 'SUCCESS';
  return (output.status as GenerationState) ?? 'SUCCESS';
}

/* -- Output Section Content -- */

interface OutputSectionContentProps {
  sectionKey: OutputSectionKey;
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
}

function OutputSectionContent({
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
}: OutputSectionContentProps) {
  const isOptional = sectionKey === 'character_sheet' || sectionKey === 'editorial';
  const canRegenerate = isArtist && !isFrozen && !isOptional && output !== null;

  return (
    <>
      {isObsolete && output && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300">
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

      {!isOptional && output?.image_url && (
        <div className="space-y-4">
          <img src={output.image_url} alt={sectionLabel} className="max-w-md rounded-lg" />
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
            <img src={output.image_url} alt="Character Sheet" className="max-w-md rounded-lg" />
          )}
        </div>
      )}

      {sectionKey === 'editorial' && (
        <div className="space-y-4">
          {output?.image_url ? (
            <>
              <img src={output.image_url} alt="Editorial" className="max-w-md rounded-lg" />
              {isArtist && !isFrozen && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onGenerate('editorial')}
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

/* -- Main Actor Page -- */

export default function ActorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'ADMIN';
  const isArtist = user?.role === 'ARTIST' || isAdmin;

  const [characterSheetLookId, setCharacterSheetLookId] = useState('');
  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(OUTPUT_SECTIONS.map((s) => s.key)),
  );

  const { data: actor, isLoading } = useQuery<ActorDetail>({
    queryKey: ['actors', id],
    queryFn: async () => {
      if (!id) throw new Error('No actor ID');
      const { data } = await apiClient.get(`/actors/${id}`);
      return data;
    },
    enabled: !!id,
  });

  const { data: looksData } = useLooks({});
  const looks = looksData?.data ?? [];

  const isFrozen = actor?.is_marketplace_frozen === true;
  const marketplaceStatus = actor?.marketplace_status as MarketplaceStatus | null;

  const generateMutation = useMutation({
    mutationFn: async (layoutType: string) => {
      const body: Record<string, unknown> = { layout_type: layoutType };
      if (layoutType === 'character_sheet' && characterSheetLookId) {
        body.look_id = characterSheetLookId;
      }
      const { data } = await apiClient.post(`/actors/${id}/generate`, body);
      return (data.outputs ?? data) as ActorOutput[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actors', id] });
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: async (layoutType: string) => {
      const { data } = await apiClient.post(`/actors/${id}/regenerate`, {
        layout_type: layoutType,
      });
      return (data.outputs ?? data) as ActorOutput[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actors', id] });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post(`/assets/${id}/duplicate`, {
        name: `${actor?.name ?? 'Actor'} (copy)`,
      });
      return data;
    },
    onSuccess: (data) => {
      navigate(`/actors/${data.id}`);
    },
  });

  const submitMarketplaceMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post('/marketplace/submit', {
        asset_id: id,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actors', id] });
    },
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const hasRequiredOutputs = useMemo(() => {
    if (!actor?.outputs) return false;
    const required = ['headshot', 'fullshot', 'expressions'];
    return required.every((key) => {
      const output = actor.outputs[key];
      return output && output.status === 'SUCCESS';
    });
  }, [actor?.outputs]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!actor) {
    return (
      <div className="flex flex-col items-center py-24 text-center">
        <p className="text-muted-foreground">Actor not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/actors')}>
          Back to Actors
        </Button>
      </div>
    );
  }

  const headshotOutput = actor.outputs?.headshot;
  const isGenerating = generateMutation.isPending || regenerateMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Top bar: name + headshot + actions */}
      <div className="flex items-start gap-6">
        <div className="shrink-0">
          {headshotOutput?.image_url ? (
            <img
              src={headshotOutput.image_url}
              alt={actor.name}
              className="size-40 rounded-lg object-cover"
            />
          ) : (
            <div className="flex size-40 items-center justify-center rounded-lg bg-muted">
              <ImageIcon className="size-12 text-muted-foreground" />
            </div>
          )}
        </div>

        <div className="flex-1 space-y-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{actor.name}</h1>
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(actor.taxonomy_values ?? {}).map(
                ([key, value]) =>
                  value && (
                    <Badge key={key} variant="secondary">
                      {key}: {value}
                    </Badge>
                  ),
              )}
              {marketplaceStatus && marketplaceStatus !== 'NONE' && (
                <Badge
                  variant={marketplaceStatus === 'MARKETPLACE_APPROVED' ? 'default' : 'outline'}
                >
                  <Lock className="mr-1 size-3" />
                  {marketplaceStatus.replace('MARKETPLACE_', '')}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {isArtist && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isFrozen}
                  onClick={() => navigate(`/actors/${id}/edit`)}
                >
                  <Edit3 className="mr-2 size-4" />
                  Edit Fields
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isFrozen}
                  onClick={() => regenerateMutation.mutate('headshot')}
                >
                  <RotateCcw className="mr-2 size-4" />
                  Regenerate Headshot
                </Button>
                <Button variant="outline" size="sm" onClick={() => duplicateMutation.mutate()}>
                  <Copy className="mr-2 size-4" />
                  Duplicate
                </Button>
                <Button
                  size="sm"
                  disabled={!hasRequiredOutputs || isFrozen}
                  onClick={() => submitMarketplaceMutation.mutate()}
                >
                  <Send className="mr-2 size-4" />
                  Submit to Marketplace
                </Button>
              </>
            )}
          </div>

          {isFrozen && (
            <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300">
              <Lock className="size-4" />
              This actor is marketplace-listed and frozen. Editing and regeneration are disabled.
            </div>
          )}
        </div>
      </div>

      {/* Output sections */}
      <div className="space-y-4">
        {OUTPUT_SECTIONS.map((section) => {
          const output = actor.outputs?.[section.key];
          const isObsolete = output?.is_obsolete === true;
          const isOpen = openSections.has(section.key);
          const sectionStatus = getOutputStatus(output);

          return (
            <Collapsible
              key={section.key}
              open={isOpen}
              onOpenChange={() => toggleSection(section.key)}
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
                      onCharacterSheetLookChange={setCharacterSheetLookId}
                      looks={looks}
                      onGenerate={(lt) => generateMutation.mutate(lt)}
                      onRegenerate={(lt) => regenerateMutation.mutate(lt)}
                    />
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}
