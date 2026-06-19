/**
 * Zod validation schemas for admin routes.
 * Each schema validates req.body and returns typed, sanitized data.
 */
import { z } from 'zod';

// -------------------------------------------------------------------
// fal.ai key endpoints
// -------------------------------------------------------------------

export const saveFalKeySchema = z.object({
  api_key: z.string().min(1, { message: 'api_key is required' }),
});

export const testFalKeySchema = z.object({
  api_key: z.string().min(1, { message: 'api_key is required' }),
});

// -------------------------------------------------------------------
// Model endpoints
// -------------------------------------------------------------------

export const importModelSchema = z.object({
  fal_model_id: z.string().min(1, { message: 'fal_model_id is required' }),
  name: z.string().min(1, { message: 'name is required' }),
  description: z.string().optional(),
  category: z.string().min(1, { message: 'category is required' }),
  parameters: z.record(z.string(), z.unknown()).optional(),
});

export const createModelSchema = z.object({
  model_id: z.string().min(1, { message: 'model_id is required' }),
  name: z.string().min(1, { message: 'name is required' }),
  model_type: z.string().optional(),
  task: z.string().optional(),
  parameters: z.record(z.string(), z.unknown()).optional(),
});

export const updateModelSchema = z.object({
  name: z.string().min(1, { message: 'name must not be empty' }).optional(),
  model_type: z.string().optional(),
  task: z.string().optional(),
  parameters: z.record(z.string(), z.unknown()).optional(),
  is_active: z.boolean().optional(),
});

// -------------------------------------------------------------------
// Taxonomy endpoints
// -------------------------------------------------------------------

export const createTaxonomySchema = z.object({
  workspace_id: z.string().uuid().optional(),
  category: z.string().min(1, { message: 'category is required' }),
  key: z.string().min(1, { message: 'key is required' }),
  label: z.string().min(1, { message: 'label is required' }),
  input_type: z.string().optional(),
  options: z.array(z.unknown()).optional(),
  is_required: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

export const updateTaxonomySchema = z.object({
  category: z.string().min(1, { message: 'category must not be empty' }).optional(),
  key: z.string().min(1, { message: 'key must not be empty' }).optional(),
  label: z.string().min(1, { message: 'label must not be empty' }).optional(),
  input_type: z.string().optional(),
  options: z.array(z.unknown()).optional(),
  is_required: z.boolean().optional(),
  sort_order: z.number().int().optional(),
  is_active: z.boolean().optional(),
});

// -------------------------------------------------------------------
// Inferred types
// -------------------------------------------------------------------

export type SaveFalKeyInput = z.infer<typeof saveFalKeySchema>;
export type TestFalKeyInput = z.infer<typeof testFalKeySchema>;
export type ImportModelInput = z.infer<typeof importModelSchema>;
export type CreateModelInput = z.infer<typeof createModelSchema>;
export type UpdateModelInput = z.infer<typeof updateModelSchema>;
export type CreateTaxonomyInput = z.infer<typeof createTaxonomySchema>;
export type UpdateTaxonomyInput = z.infer<typeof updateTaxonomySchema>;
