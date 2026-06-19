export type FashionEntryMethod = 'PROMPT' | 'REFERENCE';
export type FashionWizardStep = 1 | 2;

export interface FashionGeneratedOption {
  id: string;
  imageUrl: string | null;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  errorMessage?: string | null;
}

export function createEmptyFashionOptions(count: number): FashionGeneratedOption[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `opt-${i}-${Date.now()}`,
    imageUrl: null,
    status: 'PENDING' as const,
  }));
}

export function canGenerateFashionItem(
  entryMethod: FashionEntryMethod,
  prompt: string,
  referenceImage: string | null,
): boolean {
  return entryMethod === 'PROMPT' ? prompt.trim().length > 0 : referenceImage !== null;
}
