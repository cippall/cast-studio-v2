import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a taxonomy key for display.
 * Capitalises the first letter and replaces underscores with spaces.
 * e.g. "vibe" → "Vibe", "hair_color" → "Hair color"
 */
export function formatLabel(key: string): string {
  return key.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}
