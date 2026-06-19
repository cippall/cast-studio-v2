import type { GenerationState } from '@/components/GenerationStatus';

export type EntryMethod = 'PROMPT' | 'REFERENCE' | 'COMPOSITE';
export type WizardStep = 1 | 2;

export interface GeneratedOption {
  id: string;
  imageUrl: string | null;
  status: GenerationState;
  errorMessage?: string | null;
}

export const NUM_OPTIONS = 4;

export function createEmptyOptions(count: number): GeneratedOption[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `opt-${i}-${Date.now()}`,
    imageUrl: null,
    status: 'PENDING' as const,
  }));
}

export function canGenerateLook(
  entryMethod: EntryMethod,
  prompt: string,
  referenceImage: string | null,
  extractedPieces: string[],
  selectedFashionItemIds: string[],
): boolean {
  return entryMethod === 'PROMPT'
    ? prompt.trim().length > 0
    : entryMethod === 'REFERENCE'
      ? referenceImage !== null && extractedPieces.length > 0
      : selectedFashionItemIds.length > 0;
}
