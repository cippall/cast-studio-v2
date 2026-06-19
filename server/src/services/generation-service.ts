/**
 * Generation Service — Public API
 *
 * Re-exports all generation functions from focused sub-modules.
 * Route handlers and tests import from this barrel file — no import path changes needed.
 */

export { generateActorOutput } from './generation/generate.js';
export { regenerateActorOutput } from './generation/regenerate.js';
export { generateCharacterSheet } from './generation/character-sheet.js';
export { getGenerationStatus } from './generation/status.js';

// Re-export types for consumers
export type {
  GenerateOptions,
  GenerateResponse,
  CharacterSheetResponse,
} from './generation/generation-types.js';
