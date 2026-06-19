import type { GenerationState } from '@/components/GenerationStatus';

export type EntryMethod = 'FORM' | 'REFERENCE' | 'TEXT';
export type WizardStage = 1 | 2 | 3;
export type LayoutStep = 'headshot' | 'fullshot' | 'expressions';

export interface GeneratedOption {
  id: string;
  imageUrl: string | null;
  status: GenerationState;
  errorMessage?: string | null;
}

export interface GenerationSession {
  id: string;
  sessionNumber: number;
  prompt: string;
  referenceImages: string[];
  randomize: boolean;
  formValues: Record<string, string>;
  images: GeneratedOption[];
}

export const LAYOUT_STEPS: { key: LayoutStep; label: string }[] = [
  { key: 'headshot', label: 'Headshot' },
  { key: 'fullshot', label: 'Fullshot' },
  { key: 'expressions', label: 'Expressions' },
];

export const NUM_OPTIONS = 4;

export function createEmptyOptions(count: number): GeneratedOption[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `opt-${i}-${Date.now()}`,
    imageUrl: null,
    status: 'PENDING' as GenerationState,
  }));
}
