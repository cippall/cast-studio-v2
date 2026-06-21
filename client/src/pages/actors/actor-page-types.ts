import type { GenerationState } from '@/components/GenerationStatus';
import type { MarketplaceStatus } from '@cast/types';

export interface ActorOutput {
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

export interface ActorDetail {
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

export type OutputSectionKey =
  | 'headshot'
  | 'fullshot'
  | 'expressions_3x4'
  | 'character_sheet'
  | 'editorial';

export const OUTPUT_SECTIONS: Array<{
  key: OutputSectionKey;
  label: string;
  dependsOn?: OutputSectionKey;
}> = [
  { key: 'headshot', label: 'Headshot' },
  { key: 'fullshot', label: 'Fullshot', dependsOn: 'headshot' },
  { key: 'expressions_3x4', label: 'Expressions', dependsOn: 'fullshot' },
  { key: 'character_sheet', label: 'Character Sheet', dependsOn: 'expressions_3x4' },
  { key: 'editorial', label: 'Editorial', dependsOn: 'fullshot' },
];

export function getOutputStatus(output: ActorOutput | null | undefined): GenerationState {
  if (!output) return 'SUCCESS';
  return (output.status as GenerationState) ?? 'SUCCESS';
}
