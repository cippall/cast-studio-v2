# Models, System Prompts & Actor Generation Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-subagent-driven-development (recommended) or superpowers-executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make model management (fal.ai import/configure), system prompt management (CRUD templates), and the actor generation workflow (end-to-end image generation with proper prompts) fully functional.

**Architecture:** Three subsystems that build on each other: (1) Database migrations add `system_prompts` table and enhance `models` table; (2) Backend CRUD for system prompts + fix model import to store fal.ai schema data properly; (3) Wire system prompts into the generation pipeline so actor creation produces real images via fal.ai. Each phase is independently testable.

**Tech Stack:** Node.js + Express + PostgreSQL (backend), React + TanStack Query + Zustand (frontend), fal.ai REST API, Zod validation, Vitest for testing.

---

## FILE MAP

### New files to create:

- `server/src/db/migrations/007_system_prompts.up.sql` — create `system_prompts` table
- `server/src/db/migrations/007_system_prompts.down.sql` — drop `system_prompts` table
- `server/src/db/migrations/008_models_enhance.up.sql` — add `input_schema` column to `models`
- `server/src/db/migrations/008_models_enhance.down.sql` — drop `input_schema` column
- `server/src/db/repositories/prompt-repo.ts` — CRUD for system_prompts table
- `server/src/services/prompt-service.ts` — prompt template variable substitution
- `server/tests/prompt-routes.test.ts` — backend tests for prompt CRUD
- `server/tests/model-import.test.ts` — backend tests for model import with schema

### Files to modify:

- `server/src/routes/admin/prompt-routes.ts` — rewrite from stub to full CRUD
- `server/src/routes/admin/model-routes.ts` — fix import to store schema + default params
- `server/src/routes/admin/validation.ts` — add prompt + enhanced model validation schemas
- `server/src/services/generation/generate.ts` — use system prompts, store fal job ID in generation_params
- `server/src/services/generation/regenerate.ts` — use system prompts, store fal job ID, pass workspace key, add query import
- `server/src/services/generation/character-sheet.ts` — use system prompts, store fal job ID, add query import
- `server/src/services/generation/resolve-model.ts` — task-based model lookup
- `server/src/services/generation/generation-types.ts` — add `task` to GenerateOptions
- `server/src/db/repositories/model-repo.ts` — add find-by-task, update input_schema
- `server/src/routes/actors.ts` — pass `task` to generate/regenerate/character-sheet calls
- `client/src/pages/settings/ModelsPage.tsx` — fix import payload to include schema
- `client/src/pages/settings/PromptsPage.tsx` — add "Create Prompt" button + dialog
- `client/src/pages/settings/ConfiguredModels.tsx` — add "Set as default for task" row action
- `client/src/hooks/useAdminModels.ts` — add task assignment mutation
- `client/src/hooks/useFalConfig.ts` — fix import payload type
- `client/src/components/ModelParameterForm.tsx` — read schema from local DB instead of fal.ai API call

### Notes:

- `server/src/workers/generation-worker.ts` — NO CHANGES NEEDED. It already reads `fal_job_id` from `generation_params`. The fix is in generate/regenerate/character-sheet which now store the job ID after submission.

---

## PHASE 1: Database Migrations

### Task 1: Create `system_prompts` table

**Files:**

- Create: `server/src/db/migrations/007_system_prompts.up.sql`
- Create: `server/src/db/migrations/007_system_prompts.down.sql`

- [ ] **Step 1: Write the migration up**

```sql
-- 007_system_prompts.up.sql
-- System prompt templates for each generation task

BEGIN;

CREATE TABLE IF NOT EXISTS system_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task VARCHAR(100) NOT NULL UNIQUE,
    template TEXT NOT NULL,
    variables JSONB NOT NULL DEFAULT '[]',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_prompts_task ON system_prompts (task);

-- Seed default system prompts for all generation tasks
INSERT INTO system_prompts (task, template, variables) VALUES
('actor_headshot', 'Professional headshot of {{identity_description}}, {{age}} year old {{gender}}, {{ethnicity}} ethnicity, {{vibe}} style. Clean background, studio lighting, sharp focus on face, neutral expression, high resolution portrait photography.', '["identity_description","age","gender","ethnicity","vibe"]'),
('actor_fullshot', 'Full body shot of {{identity_description}}, {{age}} year old {{gender}}, {{ethnicity}} ethnicity, {{vibe}} style. Standing pose, full body visible, clean background, studio lighting, fashion photography.', '["identity_description","age","gender","ethnicity","vibe"]'),
('actor_expressions', 'Expression sheet of {{identity_description}}, {{age}} year old {{gender}}, showing multiple expressions: happy, sad, angry, surprised, neutral, confident. Grid layout, consistent lighting, white background.', '["identity_description","age","gender"]'),
('actor_editorial', 'Editorial fashion photograph of {{identity_description}}, {{age}} year old {{gender}}, wearing {{look_description}}. Dramatic lighting, magazine quality, full body or three-quarter shot, professional fashion photography.', '["identity_description","age","gender","look_description"]'),
('actor_character_sheet', 'Character reference sheet of {{identity_description}}, {{age}} year old {{gender}}, wearing {{look_description}}. Multiple angles: front, side, back. Consistent lighting, white background, character design sheet layout.', '["identity_description","age","gender","look_description"]'),
('look_generation', 'Fashion photograph of {{look_description}}. Full body shot, clean white background, studio lighting, professional clothing photography, no model visible or mannequin style.', '["look_description"]'),
('fashion_item', 'Product photograph of {{item_description}}. Clean white background, studio lighting, centered composition, professional product photography, no shadows.', '["item_description"]'),
('reference_extraction', 'Analyze this image and identify all clothing items, accessories, and fashion elements. For each item, provide: type, color, material, style, and position in the image. Return as structured JSON.', '[]'),
('character_sheet_composition', 'Create a character sheet combining the actor description "{{identity_description}}" with the clothing "{{look_description}}". Show the character from multiple angles (front, side, back) in a clean reference sheet layout. Consistent style, white background, professional character design.', '["identity_description","look_description"]')
ON CONFLICT (task) DO NOTHING;

COMMIT;
```

- [ ] **Step 2: Write the migration down**

```sql
-- 007_system_prompts.down.sql
BEGIN;
DROP TABLE IF EXISTS system_prompts;
COMMIT;
```

- [ ] **Step 3: Run the migration**

```bash
cd /home/ciprian/projects/cast-studio-v2/server && npm run migrate:up
```

Expected: Migration runs successfully, `system_prompts` table created with 9 seed rows.

- [ ] **Step 4: Verify**

```bash
cd /home/ciprian/projects/cast-studio-v2/server && npx tsx -e "
import { query } from './src/db/pool.js';
const r = await query('SELECT task, template FROM system_prompts ORDER BY task');
console.table(r.rows);
"
```

Expected: 9 rows showing all task types.

- [ ] **Step 5: Commit**

```bash
cd /home/ciprian/projects/cast-studio-v2
git add server/src/db/migrations/007_system_prompts.up.sql server/src/db/migrations/007_system_prompts.down.sql
git commit -m "feat: add system_prompts table with seed data for all generation tasks"
```

---

### Task 2: Enhance `models` table with `input_schema` column

**Files:**

- Create: `server/src/db/migrations/008_models_enhance.up.sql`
- Create: `server/src/db/migrations/008_models_enhance.down.sql`

- [ ] **Step 1: Write the migration up**

```sql
-- 008_models_enhance.up.sql
-- Add input_schema column to store fal.ai parameter schema for UI rendering

BEGIN;

ALTER TABLE models
  ADD COLUMN IF NOT EXISTS input_schema JSONB NOT NULL DEFAULT '{}';

-- Migrate existing rows: move the raw fal.ai schema out of parameters into input_schema
-- Existing parameters column may have been used for both schema and values; reset to empty JSONB
-- Admins will re-configure parameters through the UI after this migration
UPDATE models SET parameters = '{}' WHERE parameters::text LIKE '%"type"%';

COMMIT;
```

- [ ] **Step 2: Write the migration down**

```sql
-- 008_models_enhance.down.sql
BEGIN;
ALTER TABLE models DROP COLUMN IF EXISTS input_schema;
COMMIT;
```

- [ ] **Step 3: Run the migration**

```bash
cd /home/ciprian/projects/cast-studio-v2/server && npm run migrate:up
```

- [ ] **Step 4: Verify**

```bash
cd /home/ciprian/projects/cast-studio-v2/server && npx tsx -e "
import { query } from './src/db/pool.js';
const r = await query('SELECT column_name, data_type FROM information_schema.columns WHERE table_name = ''models'' ORDER BY ordinal_position');
console.table(r.rows);
"
```

Expected: `input_schema` column listed as `jsonb`.

- [ ] **Step 5: Commit**

```bash
cd /home/ciprian/projects/cast-studio-v2
git add server/src/db/migrations/008_models_enhance.up.sql server/src/db/migrations/008_models_enhance.down.sql
git commit -m "feat: add input_schema column to models table for fal.ai parameter schemas"
```

---

## PHASE 2: Backend — System Prompts CRUD

### Task 3: Create `prompt-repo.ts` data access layer

**Files:**

- Create: `server/src/db/repositories/prompt-repo.ts`

- [ ] **Step 1: Write the repository**

```typescript
import { query } from '../pool.js';

export interface SystemPromptRow {
  id: string;
  task: string;
  template: string;
  variables: string[];
  updated_at: string;
  created_at: string;
}

export async function listPrompts(): Promise<SystemPromptRow[]> {
  const result = await query('SELECT * FROM system_prompts ORDER BY task');
  return result.rows as SystemPromptRow[];
}

export async function findPromptByTask(task: string): Promise<SystemPromptRow | null> {
  const result = await query('SELECT * FROM system_prompts WHERE task = $1', [task]);
  return (result.rows[0] as SystemPromptRow) ?? null;
}

export async function createPrompt(
  task: string,
  template: string,
  variables: string[],
): Promise<SystemPromptRow> {
  const result = await query(
    `INSERT INTO system_prompts (task, template, variables)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [task, template, JSON.stringify(variables)],
  );
  return result.rows[0] as SystemPromptRow;
}

export async function updatePrompt(
  id: string,
  template: string,
  variables: string[],
): Promise<SystemPromptRow | null> {
  const result = await query(
    `UPDATE system_prompts
     SET template = $1, variables = $2, updated_at = NOW()
     WHERE id = $3
     RETURNING *`,
    [template, JSON.stringify(variables), id],
  );
  return (result.rows[0] as SystemPromptRow) ?? null;
}

export async function deletePrompt(id: string): Promise<boolean> {
  const result = await query('DELETE FROM system_prompts WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}
```

- [ ] **Step 2: Commit**

```bash
git add server/src/db/repositories/prompt-repo.ts
git commit -m "feat: add prompt-repo.ts with CRUD operations for system_prompts table"
```

---

### Task 4: Create `prompt-service.ts` for template variable substitution

**Files:**

- Create: `server/src/services/prompt-service.ts`

- [ ] **Step 1: Write the service**

```typescript
import { findPromptByTask } from '../db/repositories/prompt-repo.js';

/**
 * Resolve the system prompt template for a given task and fill in variables.
 *
 * Template variables use {{variable_name}} syntax.
 * Example template: "A {{age}} year old {{gender}} with {{vibe}} style"
 * Variables map: { age: "25", gender: "female", vibe: "cyberpunk" }
 * Result: "A 25 year old female with cyberpunk style"
 */
export async function resolvePrompt(
  task: string,
  variables: Record<string, unknown>,
): Promise<string> {
  const prompt = await findPromptByTask(task);
  if (!prompt) {
    // No system prompt configured — return a basic fallback
    return buildFallbackPrompt(task, variables);
  }

  let resolved = prompt.template;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    const replacement = String(value ?? '');
    resolved = resolved.replaceAll(placeholder, replacement);
  }

  return resolved;
}

/**
 * Build a fallback prompt when no system prompt is configured.
 * This ensures generation still works even without admin setup.
 */
function buildFallbackPrompt(task: string, variables: Record<string, unknown>): string {
  const identity = variables.identity_description
    ? String(variables.identity_description)
    : JSON.stringify(variables);

  switch (task) {
    case 'actor_headshot':
      return `Professional headshot of ${identity}. Clean background, studio lighting, sharp focus on face.`;
    case 'actor_fullshot':
      return `Full body shot of ${identity}. Standing pose, clean background, studio lighting.`;
    case 'actor_expressions':
      return `Expression sheet of ${identity}. Multiple expressions: happy, sad, angry, surprised, neutral. Grid layout.`;
    case 'actor_editorial':
      return `Editorial fashion photograph of ${identity}. Dramatic lighting, magazine quality.`;
    case 'actor_character_sheet':
      return `Character reference sheet of ${identity}. Multiple angles: front, side, back. Character design sheet layout.`;
    case 'look_generation':
      return `Fashion photograph of ${identity}. Clean white background, studio lighting, professional clothing photography.`;
    case 'fashion_item':
      return `Product photograph of ${identity}. Clean white background, studio lighting, centered composition.`;
    case 'character_sheet_composition':
      return `Character sheet combining ${identity}. Multiple angles, clean reference sheet layout.`;
    default:
      return `Generate an image of ${identity}.`;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add server/src/services/prompt-service.ts
git commit -m "feat: add prompt-service.ts for template variable substitution"
```

---

### Task 5: Rewrite `prompt-routes.ts` with full CRUD

**Files:**

- Modify: `server/src/routes/admin/prompt-routes.ts` (full rewrite)

- [ ] **Step 1: Write the failing test first**

Create `server/tests/prompt-routes.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';

vi.mock('../src/db/pool.js', () => ({
  query: vi.fn(),
  getClient: vi.fn(),
  default: {},
}));

import * as poolModule from '../src/db/pool.js';
import promptRoutes from '../src/routes/admin/prompt-routes.js';

const mockQuery = vi.mocked(poolModule.query);

const WORKSPACE_UUID = 'a0000000-0000-4000-8000-000000000001';
const ADMIN_UUID = 'd0000000-0000-4000-8000-000000000001';

function makeAdminAccount() {
  return {
    id: ADMIN_UUID,
    workspace_id: WORKSPACE_UUID,
    name: 'Admin',
    email: 'admin@studio.com',
    role: 'ADMIN',
    is_api_able: false,
    password_hash: 'x',
    created_at: '2026-06-17T10:00:00Z',
  };
}

function makeWorkspaceRow() {
  return {
    id: WORKSPACE_UUID,
    name: 'Test Workspace',
    slug: 'test-workspace',
    workspace_type: 'STUDIO',
    created_at: '2026-06-17T10:00:00Z',
  };
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).session = {
      accountId: ADMIN_UUID,
      destroy: vi.fn((cb?: (err?: unknown) => void) => {
        if (cb) cb();
      }),
    };
    (req as any).account = makeAdminAccount();
    (req as any).workspace = makeWorkspaceRow();
    next();
  });
  app.use('/api/admin', promptRoutes);
  return app;
}

function seedAuthQueries() {
  mockQuery.mockResolvedValueOnce({ rows: [makeAdminAccount()] } as any);
  mockQuery.mockResolvedValueOnce({ rows: [makeWorkspaceRow()] } as any);
}

describe('GET /api/admin/prompts', () => {
  beforeEach(() => mockQuery.mockReset());

  it('returns empty array when no prompts exist', async () => {
    seedAuthQueries();
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createApp()).get('/api/admin/prompts');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns all prompts', async () => {
    seedAuthQueries();
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'p1',
          task: 'actor_headshot',
          template: 'Headshot of {{identity}}',
          variables: ['identity'],
          updated_at: '2026-06-17T10:00:00Z',
          created_at: '2026-06-17T10:00:00Z',
        },
        {
          id: 'p2',
          task: 'actor_fullshot',
          template: 'Fullshot of {{identity}}',
          variables: ['identity'],
          updated_at: '2026-06-17T10:00:00Z',
          created_at: '2026-06-17T10:00:00Z',
        },
      ],
    } as any);

    const res = await request(createApp()).get('/api/admin/prompts');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].task).toBe('actor_headshot');
  });
});

describe('POST /api/admin/prompts', () => {
  beforeEach(() => mockQuery.mockReset());

  it('422 when task is missing', async () => {
    seedAuthQueries();
    const res = await request(createApp()).post('/api/admin/prompts').send({ template: 'test' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('422 when template is missing', async () => {
    seedAuthQueries();
    const res = await request(createApp())
      .post('/api/admin/prompts')
      .send({ task: 'actor_headshot' });
    expect(res.status).toBe(422);
  });

  it('201 creates a prompt', async () => {
    seedAuthQueries();
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'p1',
          task: 'custom_task',
          template: 'A {{variable}} template',
          variables: ['variable'],
          updated_at: '2026-06-17T10:00:00Z',
          created_at: '2026-06-17T10:00:00Z',
        },
      ],
    } as any);

    const res = await request(createApp())
      .post('/api/admin/prompts')
      .send({ task: 'custom_task', template: 'A {{variable}} template', variables: ['variable'] });

    expect(res.status).toBe(201);
    expect(res.body.task).toBe('custom_task');
    expect(res.body.template).toBe('A {{variable}} template');
  });
});

describe('PATCH /api/admin/prompts/:id', () => {
  beforeEach(() => mockQuery.mockReset());

  it('404 when prompt not found', async () => {
    seedAuthQueries();
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(createApp())
      .patch('/api/admin/prompts/nonexistent-id')
      .send({ template: 'updated' });
    expect(res.status).toBe(404);
  });

  it('200 updates a prompt', async () => {
    seedAuthQueries();
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'p1',
          task: 'actor_headshot',
          template: 'Updated template for {{identity}}',
          variables: ['identity'],
          updated_at: '2026-06-17T11:00:00Z',
          created_at: '2026-06-17T10:00:00Z',
        },
      ],
    } as any);

    const res = await request(createApp())
      .patch('/api/admin/prompts/p1')
      .send({ template: 'Updated template for {{identity}}', variables: ['identity'] });

    expect(res.status).toBe(200);
    expect(res.body.template).toBe('Updated template for {{identity}}');
  });
});

describe('DELETE /api/admin/prompts/:id', () => {
  beforeEach(() => mockQuery.mockReset());

  it('404 when prompt not found', async () => {
    seedAuthQueries();
    mockQuery.mockResolvedValueOnce({ rowCount: 0 } as any);

    const res = await request(createApp()).delete('/api/admin/prompts/nonexistent-id');
    expect(res.status).toBe(404);
  });

  it('200 deletes a prompt', async () => {
    seedAuthQueries();
    mockQuery.mockResolvedValueOnce({ rowCount: 1 } as any);

    const res = await request(createApp()).delete('/api/admin/prompts/p1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/ciprian/projects/cast-studio-v2/server && npx vitest run tests/prompt-routes.test.ts -v
```

Expected: FAIL — routes return 501 or 404 because they're stubs.

- [ ] **Step 3: Rewrite `prompt-routes.ts`**

```typescript
/**
 * System prompt routes — full CRUD for prompt templates.
 * GET/POST /api/admin/prompts
 * PATCH/DELETE /api/admin/prompts/:id
 */
import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import {
  listPrompts,
  createPrompt,
  updatePrompt,
  deletePrompt,
} from '../db/repositories/prompt-repo.js';
import { createPromptSchema, updatePromptSchema } from './validation.js';

const router = Router();

// -------------------------------------------------------------------
// GET /api/admin/prompts — list all system prompts
// -------------------------------------------------------------------
router.get('/prompts', async (_req, res) => {
  try {
    const prompts = await listPrompts();
    res.json(prompts);
  } catch (err) {
    console.error('List prompts error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to load prompts' },
    });
  }
});

// -------------------------------------------------------------------
// POST /api/admin/prompts — create a new prompt
// -------------------------------------------------------------------
router.post('/prompts', async (req, res) => {
  try {
    const parse = createPromptSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'task and template are required',
          details: parse.error.flatten().fieldErrors,
        },
      });
      return;
    }
    const { task, template, variables } = parse.data;
    const prompt = await createPrompt(task, template, variables ?? []);
    res.status(201).json(prompt);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('unique')) {
      res.status(409).json({
        error: { code: 'CONFLICT', message: `A prompt for task "${req.body.task}" already exists` },
      });
      return;
    }
    console.error('Create prompt error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create prompt' },
    });
  }
});

// -------------------------------------------------------------------
// PATCH /api/admin/prompts/:id — update a prompt
// -------------------------------------------------------------------
router.patch('/prompts/:id', async (req, res) => {
  try {
    const parse = updatePromptSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid update payload',
          details: parse.error.flatten().fieldErrors,
        },
      });
      return;
    }
    const { template, variables } = parse.data;
    if (template === undefined && variables === undefined) {
      res.status(422).json({
        error: { code: 'VALIDATION_ERROR', message: 'No fields to update' },
      });
      return;
    }
    const updated = await updatePrompt(req.params.id, template ?? '', variables ?? []);
    if (!updated) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Prompt not found' },
      });
      return;
    }
    res.json(updated);
  } catch (err) {
    console.error('Update prompt error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update prompt' },
    });
  }
});

// -------------------------------------------------------------------
// DELETE /api/admin/prompts/:id — delete a prompt
// -------------------------------------------------------------------
router.delete('/prompts/:id', async (req, res) => {
  try {
    const deleted = await deletePrompt(req.params.id);
    if (!deleted) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Prompt not found' },
      });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Delete prompt error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete prompt' },
    });
  }
});

export default router;
```

- [ ] **Step 4: Add validation schemas to `validation.ts`**

Add to `server/src/routes/admin/validation.ts`:

```typescript
// -------------------------------------------------------------------
// System prompt endpoints
// -------------------------------------------------------------------

export const createPromptSchema = z.object({
  task: z.string().min(1, { message: 'task is required' }),
  template: z.string().min(1, { message: 'template is required' }),
  variables: z.array(z.string()).optional(),
});

export const updatePromptSchema = z.object({
  template: z.string().min(1).optional(),
  variables: z.array(z.string()).optional(),
});
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /home/ciprian/projects/cast-studio-v2/server && npx vitest run tests/prompt-routes.test.ts -v
```

Expected: All tests PASS.

- [ ] **Step 6: Run full test suite to check for regressions**

```bash
cd /home/ciprian/projects/cast-studio-v2/server && npm test
```

Expected: All existing tests still pass.

- [ ] **Step 7: Commit**

```bash
git add server/src/routes/admin/prompt-routes.ts server/src/routes/admin/validation.ts server/tests/prompt-routes.test.ts
git commit -m "feat: implement full CRUD for system prompts (routes + tests)"
```

---

## PHASE 3: Backend — Fix Model Import & Task-Based Resolution

### Task 6: Add `findModelByTask` to model-repo

**Files:**

- Modify: `server/src/db/repositories/model-repo.ts`

- [ ] **Step 1: Add task-based lookup function**

Add to the existing file after `findActiveModel`:

```typescript
/**
 * Find the active model assigned to a specific Cast Studio task.
 * Returns the most recently created active model for that task.
 */
export async function findModelByTask(task: string): Promise<ModelRow | null> {
  const result = await query(
    'SELECT * FROM models WHERE task = $1 AND is_active = TRUE ORDER BY created_at DESC LIMIT 1',
    [task],
  );
  return (result.rows[0] as ModelRow) ?? null;
}

/**
 * Update the input_schema for a model (populated from fal.ai during import).
 */
export async function updateModelSchema(
  id: string,
  inputSchema: Record<string, unknown>,
): Promise<void> {
  await query('UPDATE models SET input_schema = $1 WHERE id = $2', [
    JSON.stringify(inputSchema),
    id,
  ]);
}
```

- [ ] **Step 2: Commit**

```bash
git add server/src/db/repositories/model-repo.ts
git commit -m "feat: add findModelByTask and updateModelSchema to model-repo"
```

---

### Task 7: Fix model import route to store schema data properly

**Files:**

- Modify: `server/src/routes/admin/model-routes.ts`
- Modify: `server/src/routes/admin/validation.ts`

- [ ] **Step 1: Add import validation schema**

Add to `validation.ts`:

```typescript
export const importModelSchema = z.object({
  fal_model_id: z.string().min(1, { message: 'fal_model_id is required' }),
  name: z.string().min(1, { message: 'name is required' }),
  description: z.string().optional(),
  category: z.enum(['text_to_image', 'image_to_image', 'image_to_text']),
  task: z.string().optional(), // Cast Studio task (e.g. 'actor_headshot')
  input_schema: z.record(z.string(), z.unknown()).optional(),
  default_parameters: z.record(z.string(), z.unknown()).optional(),
});
```

- [ ] **Step 2: Rewrite the import route in `model-routes.ts`**

Replace the existing `POST /models/import` handler (lines 19-45) with:

```typescript
// -------------------------------------------------------------------
// POST /api/admin/models/import — import a fal.ai model into local DB
// -------------------------------------------------------------------
router.post('/models/import', async (req, res) => {
  try {
    const parse = importModelSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'fal_model_id, name, and category are required',
          details: parse.error.flatten().fieldErrors,
        },
      });
      return;
    }
    const { fal_model_id, name, description, category, task, input_schema, default_parameters } =
      parse.data;

    const id = randomUUID();
    const result = await query(
      `INSERT INTO models (id, model_id, name, model_type, task, parameters, input_schema, is_active, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,true,NOW()) RETURNING *`,
      [
        id,
        fal_model_id,
        name,
        category,
        task ?? null,
        JSON.stringify(default_parameters ?? {}),
        JSON.stringify(input_schema ?? {}),
      ],
    );
    res.status(201).json(result.rows[0]);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('unique')) {
      res.status(409).json({
        error: { code: 'CONFLICT', message: `Model "${req.body.fal_model_id}" already exists` },
      });
      return;
    }
    console.error('Import model error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to import model' } });
  }
});
```

- [ ] **Step 3: Write a test for the import route**

Create `server/tests/model-import.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';

vi.mock('../src/db/pool.js', () => ({
  query: vi.fn(),
  getClient: vi.fn(),
  default: {},
}));

import * as poolModule from '../src/db/pool.js';
import modelRoutes from '../src/routes/admin/model-routes.js';

const mockQuery = vi.mocked(poolModule.query);

const WORKSPACE_UUID = 'a0000000-0000-4000-8000-000000000001';
const ADMIN_UUID = 'd0000000-0000-4000-8000-000000000001';

function makeAdminAccount() {
  return {
    id: ADMIN_UUID,
    workspace_id: WORKSPACE_UUID,
    name: 'Admin',
    email: 'admin@studio.com',
    role: 'ADMIN',
    is_api_able: false,
    password_hash: 'x',
    created_at: '2026-06-17T10:00:00Z',
  };
}

function makeWorkspaceRow() {
  return {
    id: WORKSPACE_UUID,
    name: 'Test',
    slug: 'test',
    workspace_type: 'STUDIO',
    created_at: '2026-06-17T10:00:00Z',
  };
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).session = {
      accountId: ADMIN_UUID,
      destroy: vi.fn((cb?: (err?: unknown) => void) => {
        if (cb) cb();
      }),
    };
    (req as any).account = makeAdminAccount();
    (req as any).workspace = makeWorkspaceRow();
    next();
  });
  app.use('/api/admin', modelRoutes);
  return app;
}

function seedAuth() {
  mockQuery.mockResolvedValueOnce({ rows: [makeAdminAccount()] } as any);
  mockQuery.mockResolvedValueOnce({ rows: [makeWorkspaceRow()] } as any);
}

describe('POST /api/admin/models/import', () => {
  beforeEach(() => mockQuery.mockReset());

  it('201 imports model with schema and default parameters', async () => {
    seedAuth();
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'm1',
          model_id: 'fal-ai/flux-pro',
          name: 'Flux Pro',
          model_type: 'text_to_image',
          task: 'actor_headshot',
          parameters: { num_inference_steps: 28, guidance_scale: 3.5 },
          input_schema: { prompt: { type: 'string' }, seed: { type: 'integer' } },
          is_active: true,
          created_at: '2026-06-17T10:00:00Z',
        },
      ],
    } as any);

    const res = await request(createApp())
      .post('/api/admin/models/import')
      .send({
        fal_model_id: 'fal-ai/flux-pro',
        name: 'Flux Pro',
        category: 'text_to_image',
        task: 'actor_headshot',
        input_schema: { prompt: { type: 'string' }, seed: { type: 'integer' } },
        default_parameters: { num_inference_steps: 28, guidance_scale: 3.5 },
      });

    expect(res.status).toBe(201);
    expect(res.body.model_id).toBe('fal-ai/flux-pro');
    expect(res.body.task).toBe('actor_headshot');
    expect(res.body.input_schema).toEqual({
      prompt: { type: 'string' },
      seed: { type: 'integer' },
    });
  });

  it('409 when model already exists', async () => {
    seedAuth();
    const dbError = new Error(
      'duplicate key value violates unique constraint "models_model_id_key"',
    );
    mockQuery.mockRejectedValueOnce(dbError);

    const res = await request(createApp())
      .post('/api/admin/models/import')
      .send({ fal_model_id: 'fal-ai/flux-pro', name: 'Flux Pro', category: 'text_to_image' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });
});
```

- [ ] **Step 4: Run the test**

```bash
cd /home/ciprian/projects/cast-studio-v2/server && npx vitest run tests/model-import.test.ts -v
```

Expected: PASS.

- [ ] **Step 5: Run full test suite**

```bash
cd /home/ciprian/projects/cast-studio-v2/server && npm test
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/admin/model-routes.ts server/src/routes/admin/validation.ts server/tests/model-import.test.ts
git commit -m "feat: fix model import to store fal.ai schema + default parameters, add tests"
```

---

### Task 8: Enhance `resolveModel()` for task-based lookup

**Files:**

- Modify: `server/src/services/generation/resolve-model.ts`

- [ ] **Step 1: Rewrite resolve-model.ts**

```typescript
import {
  listActiveModels,
  findActiveModel,
  findModelByTask,
} from '../../db/repositories/model-repo.js';
import { DEFAULT_MODEL } from './generation-constants.js';

/**
 * Error thrown when a requested model is not in the workspace's active list.
 */
export class InvalidModelError extends Error {
  statusCode = 422;
  constructor(modelId: string, activeModels: string[]) {
    super(
      `Model "${modelId}" is not available. Active models: ${activeModels.join(', ') || 'none configured'}`,
    );
    this.name = 'InvalidModelError';
  }
}

/**
 * Resolve the model for a generation request.
 *
 * Resolution order:
 * 1. If a specific model is requested, validate it against active models.
 * 2. If a task is provided, look up the model assigned to that task.
 * 3. Fall back to the first active model.
 * 4. Fall back to DEFAULT_MODEL if nothing is configured.
 */
export async function resolveModel(
  requestedModel?: string,
  workspaceId?: string,
  task?: string,
): Promise<string> {
  const activeModels = await listActiveModels();
  const activeModelIds = activeModels.map((m) => m.model_id);

  // 1. Specific model requested — validate it
  if (requestedModel) {
    const found = await findActiveModel(requestedModel);
    if (found) {
      return found.model_id;
    }
    throw new InvalidModelError(requestedModel, activeModelIds);
  }

  // 2. Task-based lookup — find model assigned to this task
  if (task) {
    const taskModel = await findModelByTask(task);
    if (taskModel) {
      return taskModel.model_id;
    }
  }

  // 3. First active model
  if (activeModels.length > 0) {
    return activeModels[0].model_id;
  }

  // 4. Hardcoded fallback
  return DEFAULT_MODEL;
}
```

- [ ] **Step 2: Update all callers to pass `task`**

In `generate.ts`, change line 43 from:

```typescript
const model = await resolveModel(options.model, account.workspace_id);
```

to:

```typescript
const model = await resolveModel(options.model, account.workspace_id, options.task);
```

In `regenerate.ts`, change line 45 from:

```typescript
const model = await resolveModel(options.model, account.workspace_id);
```

to:

```typescript
const model = await resolveModel(options.model, account.workspace_id, options.task);
```

In `character-sheet.ts`, change line 51 from:

```typescript
const resolvedModel = await resolveModel(model, account.workspace_id);
```

to:

```typescript
const resolvedModel = await resolveModel(
  model,
  account.workspace_id,
  'character_sheet_composition',
);
```

- [ ] **Step 3: Add `task` to `GenerateOptions` type**

In `generation-types.ts`, add to the `GenerateOptions` interface:

```typescript
export interface GenerateOptions {
  layout_type: string;
  model?: string;
  task?: string; // Cast Studio task for model resolution + prompt selection
  num_outputs?: number;
  prompt?: string;
  form_data?: Record<string, unknown>;
  reference_images?: string[];
  randomize?: boolean;
}
```

- [ ] **Step 4: Run tests**

```bash
cd /home/ciprian/projects/cast-studio-v2/server && npm test
```

Expected: All tests pass (the existing tests don't pass `task`, so they'll use the fallback path).

- [ ] **Step 5: Commit**

```bash
git add server/src/services/generation/resolve-model.ts server/src/services/generation/generate.ts server/src/services/generation/regenerate.ts server/src/services/generation/character-sheet.ts server/src/services/generation/generation-types.ts
git commit -m "feat: enhance resolveModel with task-based lookup, add task to GenerateOptions"
```

---

## PHASE 4: Backend — Wire System Prompts into Generation

### Task 9: Update `generate.ts` to use system prompts and store fal job ID

**Files:**

- Modify: `server/src/services/generation/generate.ts`

- [ ] **Step 1: Update the generate function**

Replace the prompt-building section (lines 44-48) and the fal submission section (lines 133-165) in `generate.ts`:

```typescript
import { resolvePrompt } from '../prompt-service.js';
import { getWorkspaceApiKey } from '../fal-service.js';
import * as fal from '../fal/api.js';

// ... (keep all existing imports and the top of generateActorOutput unchanged until line 43)

  // Resolve model: validate against active models, with task-based fallback
  const model = await resolveModel(options.model, account.workspace_id, options.task);
  const numOutputs = options.num_outputs ?? 1;

  // Build the prompt: use system prompt template if no explicit prompt provided
  let prompt: string;
  if (options.prompt) {
    prompt = options.prompt;
  } else {
    // Determine the task from layout_type for prompt resolution
    const promptTask = options.task ?? inferTaskFromLayout(options.layout_type);
    const identityData = (asset.prompt_recipe?.identity as Record<string, unknown>) ?? {};
    prompt = await resolvePrompt(promptTask, identityData);
  }

  // Determine seed: randomize generates a fresh random seed
  const seed = options.randomize ? generateSeed() : (asset.seed ?? generateSeed());

  // Resolve workspace-specific fal.ai key (falls back to FAL_KEY env)
  const workspaceKey = await getWorkspaceApiKey(account.workspace_id);

  // Build generation_params with all context
  const generationParams: Record<string, unknown> = {
    prompt,
    seed,
    model,
    num_outputs: 1,
    layout_type: options.layout_type,
    image_size: '1024x1024',
  };

  // Include form_data for FORM mode
  if (options.form_data) {
    generationParams.form_data = options.form_data;
  }

  // Include reference_images for REFERENCE mode
  if (options.reference_images) {
    generationParams.reference_images = options.reference_images;
  }

  // Reserve credits before generation
  const totalCost = DEFAULT_COST * numOutputs;
  const workspaceRow = {
    id: account.workspace_id, name: '', slug: '', workspace_type: '', created_at: '',
  } as WorkspaceRow;
  try {
    await reserveCreditsForGeneration(account, workspaceRow, totalCost);
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      throw Object.assign(
        new Error(`Insufficient credits. Balance: ${err.currentBalance}, Required: ${err.required}. Please top up your wallet.`),
        { statusCode: 422 },
      );
    }
    throw err;
  }

  const outputs: Array<{
    id: string; layout_type: string; status: string; model: string; cost_credits: number;
  }> = [];

  for (let i = 0; i < numOutputs; i++) {
    const outputSeed = seed + i;
    const outputGenerationParams: Record<string, unknown> = {
      ...generationParams,
      seed: outputSeed,
    };

    const input: CreateAssetOutputInput = {
      asset_id: assetId,
      layout_type: options.layout_type,
      model,
      status: 'PENDING',
      cost_credits: DEFAULT_COST,
      generation_params: outputGenerationParams,
    };

    const output = await createAssetOutput(input);

    outputs.push({
      id: output.id,
      layout_type: output.layout_type,
      status: output.status,
      model: output.model,
      cost_credits: output.cost_credits,
    });

    // Submit to fal.ai and store the job ID in generation_params for worker polling
    try {
      let jobId: string;
      if (options.reference_images && options.reference_images.length > 0) {
        const result = await fal.submitImageToImage(
          {
            model, prompt, seed: outputSeed, num_outputs: 1,
            image_url: options.reference_images[0], strength: 0.7,
            reference_images: options.reference_images,
          },
          workspaceKey,
        );
        jobId = result.jobId;
      } else {
        const result = await fal.submitTextToImage(
          {
            model, prompt, seed: outputSeed, num_outputs: 1,
            image_size: '1024x1024', form_data: options.form_data,
          },
          workspaceKey,
        );
        jobId = result.jobId;
      }

      // Store fal job ID in generation_params so the worker can poll it
      outputGenerationParams['fal_job_id'] = jobId;
      await query(
        'UPDATE asset_outputs SET generation_params = $1 WHERE id = $2',
        [JSON.stringify(outputGenerationParams), output.id],
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'fal.ai submission failed';
      console.error(`fal.ai submission error for output ${output.id}:`, err);
      await updateAssetOutputError(output.id, errorMessage);
      await refundCredits(account.workspace_id, account.id, DEFAULT_COST);
      throw Object.assign(new Error(errorMessage), { statusCode: 502 });
    }
  }

  return { outputs };
}

/**
 * Infer the Cast Studio task from the layout_type when no explicit task is provided.
 */
function inferTaskFromLayout(layoutType: string): string {
  switch (layoutType) {
    case 'headshot': return 'actor_headshot';
    case 'fullshot': return 'actor_fullshot';
    case 'expressions_3x4': return 'actor_expressions';
    case 'editorial': return 'actor_editorial';
    case 'character_sheet': return 'actor_character_sheet';
    default: return 'actor_headshot';
  }
}
```

- [ ] **Step 2: Update the actors route to pass `task`**

In `server/src/routes/actors.ts`, change the generate handler (line 318-331) to pass `task`:

```typescript
const result = await generationService.generateActorOutput(
  req.params.id,
  req.account!,
  {
    layout_type: parsed.data.layout_type,
    model: parsed.data.model,
    task: inferTaskFromLayout(parsed.data.layout_type),
    num_outputs: parsed.data.options?.num_outputs,
    prompt: parsed.data.options?.prompt,
    form_data: parsed.data.form_data,
    reference_images: parsed.data.reference_images,
    randomize: parsed.data.randomize,
  },
  adminBypass,
);
```

Add the helper function at the bottom of `actors.ts`:

```typescript
function inferTaskFromLayout(layoutType: string): string {
  switch (layoutType) {
    case 'headshot':
      return 'actor_headshot';
    case 'fullshot':
      return 'actor_fullshot';
    case 'expressions_3x4':
      return 'actor_expressions';
    case 'editorial':
      return 'actor_editorial';
    case 'character_sheet':
      return 'actor_character_sheet';
    default:
      return 'actor_headshot';
  }
}
```

- [ ] **Step 3: Run tests**

```bash
cd /home/ciprian/projects/cast-studio-v2/server && npm test
```

Expected: All existing tests pass. The generation tests mock `fal-service.js` so the fal submission is mocked.

- [ ] **Step 4: Commit**

```bash
git add server/src/services/generation/generate.ts server/src/routes/actors.ts
git commit -m "feat: wire system prompts into generation pipeline, store fal job ID for worker polling"
```

---

### Task 10: Update `regenerate.ts` to use system prompts and store fal job ID

**Files:**

- Modify: `server/src/services/generation/regenerate.ts`

- [ ] **Step 1: Apply the same prompt + job ID changes**

In `regenerate.ts`:

1. Add `import { resolvePrompt } from '../prompt-service.js';` and `import { getWorkspaceApiKey } from '../fal-service.js';` and `import * as fal from '../fal/api.js';`
2. Replace the prompt building (lines 46-49) with system prompt resolution using `resolvePrompt()`
3. After `fal.submitTextToImage()`, store the returned `jobId` in `generationParams['fal_job_id']` and UPDATE the row
4. Add the `inferTaskFromLayout` helper

The changes mirror Task 9 exactly. Key diff:

```typescript
// Replace lines 46-49 (old prompt building):
const prompt =
  (options.prompt ?? (asset.prompt_recipe?.identity as Record<string, unknown>))
    ? JSON.stringify(asset.prompt_recipe.identity)
    : '';

// With:
let prompt: string;
if (options.prompt) {
  prompt = options.prompt;
} else {
  const promptTask = inferTaskFromLayout(layoutType);
  const identityData = (asset.prompt_recipe?.identity as Record<string, unknown>) ?? {};
  prompt = await resolvePrompt(promptTask, identityData);
}

// After fal.submitTextToImage() on line 136, add:
const submitResult = await fal.submitTextToImage(
  { model, prompt, seed, num_outputs: 1, image_size: '1024x1024' },
  workspaceKey,
);
generationParams['fal_job_id'] = submitResult.jobId;
await query('UPDATE asset_outputs SET generation_params = $1 WHERE id = $2', [
  JSON.stringify(generationParams),
  output.id,
]);
```

- [ ] **Step 2: Run tests**

```bash
cd /home/ciprian/projects/cast-studio-v2/server && npm test
```

- [ ] **Step 3: Commit**

```bash
git add server/src/services/generation/regenerate.ts
git commit -m "feat: wire system prompts into regeneration pipeline, store fal job ID"
```

---

### Task 11: Update `character-sheet.ts` to use system prompts and store fal job ID

**Files:**

- Modify: `server/src/services/generation/character-sheet.ts`

- [ ] **Step 1: Apply prompt + job ID changes**

Same pattern as Tasks 9-10. Key changes:

```typescript
// Replace lines 52-54:
const prompt = (asset.prompt_recipe?.identity as Record<string, unknown>)
  ? JSON.stringify(asset.prompt_recipe.identity)
  : '';

// With:
const identityData = (asset.prompt_recipe?.identity as Record<string, unknown>) ?? {};
identityData['look_description'] = lookAsset.name ?? 'outfit';
const prompt = await resolvePrompt('character_sheet_composition', identityData);

// After fal.submitTextToImage(), store job ID:
const submitResult = await fal.submitTextToImage(
  { model: resolvedModel, prompt, seed, num_outputs: 1, image_size: '1024x1024' },
  workspaceKey,
);
generationParams['fal_job_id'] = submitResult.jobId;
await query('UPDATE asset_outputs SET generation_params = $1 WHERE id = $2', [
  JSON.stringify(generationParams),
  output.id,
]);
```

- [ ] **Step 2: Run tests**

```bash
cd /home/ciprian/projects/cast-studio-v2/server && npm test
```

- [ ] **Step 3: Commit**

```bash
git add server/src/services/generation/character-sheet.ts
git commit -m "feat: wire system prompts into character sheet generation, store fal job ID"
```

---

### Task 12: Add `query` import to `regenerate.ts` and `character-sheet.ts`

**Files:**

- Modify: `server/src/services/generation/regenerate.ts`
- Modify: `server/src/services/generation/character-sheet.ts`

Both files will call `await query(...)` after fal submission to store the job ID (Tasks 10-11), but neither currently imports `query`.

- [ ] **Step 1: Add import to `regenerate.ts`**

At the top of `regenerate.ts`, add after the existing imports:

```typescript
import { query } from '../../db/pool.js';
import { getWorkspaceApiKey } from '../fal-service.js';
import * as fal from '../fal/api.js';
```

Note: `getWorkspaceApiKey` and `fal` are needed because regenerate.ts currently calls `fal.submitTextToImage()` without a workspace key (it only passes the params object). The fix is to resolve the workspace key and pass it, matching the pattern in `generate.ts`.

- [ ] **Step 2: Add import to `character-sheet.ts`**

At the top of `character-sheet.ts`, add after the existing imports:

```typescript
import { query } from '../../db/pool.js';
import { getWorkspaceApiKey } from '../fal-service.js';
import * as fal from '../fal/api.js';
```

- [ ] **Step 3: Update `regenerate.ts` to pass workspace key**

In the fal submission section of `regenerate.ts` (around line 128-139), add workspace key resolution and pass it:

```typescript
// Resolve workspace fal.ai key
const workspaceKey = await getWorkspaceApiKey(account.workspace_id);

// Submit to fal.ai (non-blocking)
try {
  const submitResult = await fal.submitTextToImage(
    {
      model,
      prompt,
      seed,
      num_outputs: 1,
      image_size: '1024x1024',
    },
    workspaceKey,
  );

  // Store fal job ID in generation_params for worker polling
  generationParams['fal_job_id'] = submitResult.jobId;
  await query('UPDATE asset_outputs SET generation_params = $1 WHERE id = $2', [
    JSON.stringify(generationParams),
    output.id,
  ]);
} catch (err) {
  console.error(`fal.ai submission error for regenerated output ${output.id}:`, err);
}
```

- [ ] **Step 4: Update `character-sheet.ts` to pass workspace key**

Same pattern — add `const workspaceKey = await getWorkspaceApiKey(account.workspace_id);` before the fal call, pass it as the second argument, and store the job ID:

```typescript
const workspaceKey = await getWorkspaceApiKey(account.workspace_id);

const submitResult = await fal.submitTextToImage(
  {
    model: resolvedModel,
    prompt,
    seed,
    num_outputs: 1,
    image_size: '1024x1024',
  },
  workspaceKey,
);
generationParams['fal_job_id'] = submitResult.jobId;
await query('UPDATE asset_outputs SET generation_params = $1 WHERE id = $2', [
  JSON.stringify(generationParams),
  output.id,
]);
```

- [ ] **Step 5: Run tests**

```bash
cd /home/ciprian/projects/cast-studio-v2/server && npm test
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add server/src/services/generation/regenerate.ts server/src/services/generation/character-sheet.ts
git commit -m "fix: add query import and pass workspace key in regenerate + character-sheet"
```

---

### Task 13: Add "Set as default for task" to ConfiguredModels

**Files:**

- Modify: `client/src/pages/settings/ConfiguredModels.tsx`
- Modify: `client/src/hooks/useAdminModels.ts`

- [ ] **Step 1: Add task assignment mutation to `useAdminModels.ts`**

Add after the existing `useSaveModelParameters` function:

```typescript
export function useAssignModelTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; task: string }) => {
      const { data } = await apiClient.patch(`/admin/models/${input.id}`, {
        task: input.task,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'models'] });
    },
  });
}
```

- [ ] **Step 2: Add task options constant to `ConfiguredModels.tsx`**

At the top of the file, after imports:

```typescript
const TASK_OPTIONS = [
  { value: 'actor_headshot', label: 'Actor Headshot' },
  { value: 'actor_fullshot', label: 'Actor Fullshot' },
  { value: 'actor_expressions', label: 'Actor Expressions' },
  { value: 'actor_editorial', label: 'Actor Editorial' },
  { value: 'actor_character_sheet', label: 'Actor Character Sheet' },
  { value: 'look_generation', label: 'Look Generation' },
  { value: 'fashion_item', label: 'Fashion Item' },
  { value: 'character_sheet_composition', label: 'Character Sheet Composition' },
  { value: 'reference_extraction', label: 'Reference Extraction' },
];
```

- [ ] **Step 3: Add task assignment state and handler**

After existing state declarations in `ConfiguredModels`:

```typescript
const assignTask = useAssignModelTask();
const [assigningModel, setAssigningModel] = useState<ModelConfig | null>(null);
const [selectedTask, setSelectedTask] = useState('');
```

Add handler after `handleConfigureSave`:

```typescript
const handleAssignTask = async () => {
  if (!assigningModel || !selectedTask) return;
  try {
    await assignTask.mutateAsync({ id: assigningModel.id, task: selectedTask });
    toast.success(`${assigningModel.name} assigned to ${selectedTask}`);
    setAssigningModel(null);
    setSelectedTask('');
  } catch (err: unknown) {
    const e = err as { message?: string };
    toast.error(e.message ?? 'Failed to assign task');
  }
};
```

- [ ] **Step 4: Add "Assign to task" row action**

In the `rowActions` array inside `DataTable`, add after the "Configure" action:

```typescript
<button
  key="assign"
  className="flex w-full cursor-pointer items-center px-2 py-1.5 text-sm"
  onClick={() => {
    setAssigningModel(row);
    setSelectedTask(row.task ?? '');
  }}
>
  <Settings2 className="mr-2 size-4" />
  Assign to task
</button>,
```

- [ ] **Step 5: Add task assignment dialog**

After the configure dialog, add:

```typescript
{/* Assign task dialog */}
<Dialog open={!!assigningModel} onOpenChange={() => setAssigningModel(null)}>
  <DialogContent className="max-w-md">
    <DialogHeader>
      <DialogTitle>Assign Model to Task</DialogTitle>
      {assigningModel && (
        <p className="text-sm text-muted-foreground">
          {assigningModel.name} ({assigningModel.model_id})
        </p>
      )}
    </DialogHeader>
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="task-select">Task</Label>
        <select
          id="task-select"
          value={selectedTask}
          onChange={(e) => setSelectedTask(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">— Not assigned —</option>
          {TASK_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          The assigned model will be used by default for this generation task.
        </p>
      </div>
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setAssigningModel(null)}>
        Cancel
      </Button>
      <Button onClick={handleAssignTask} disabled={assignTask.isPending || !selectedTask}>
        {assignTask.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : 'Assign'}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

- [ ] **Step 6: Run typecheck**

```bash
cd /home/ciprian/projects/cast-studio-v2 && npm run typecheck
```

Expected: No type errors.

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/settings/ConfiguredModels.tsx client/src/hooks/useAdminModels.ts
git commit -m "feat: add 'Assign to task' action in ConfiguredModels with task dropdown"
```

---

### Task 14: Update ModelParameterForm to read schema from local DB

**Files:**

- Modify: `client/src/components/ModelParameterForm.tsx`
- Modify: `client/src/hooks/useAdminModels.ts`

Currently `ModelParameterForm` receives schema from `useModelSchema` which calls `GET /api/admin/models/:id/schema` (fal.ai REST API). After the migration, the schema is stored locally in `models.input_schema`. Use the local schema as the primary source, with the fal.ai API as fallback.

- [ ] **Step 1: Add `useLocalModelSchema` hook to `useAdminModels.ts`**

```typescript
/**
 * Get the model's input_schema from the local DB (populated during import).
 * Falls back to fetching from fal.ai REST API if not available locally.
 */
export function useLocalModelSchema(modelId: string | null) {
  return useQuery<ModelParameterSchema>({
    queryKey: ['admin', 'model-local-schema', modelId],
    queryFn: async () => {
      if (!modelId) return { input: {}, output: {} };
      // First try: get from local DB via the models list endpoint
      const { data: model } = await apiClient.get(`/admin/models`);
      const found = (model as ModelConfig[]).find((m) => m.id === modelId);
      if (found && found.input_schema && Object.keys(found.input_schema).length > 0) {
        return { input: found.input_schema as Record<string, FalModelSchemaField>, output: {} };
      }
      // Fallback: fetch from fal.ai REST API
      const { data } = await apiClient.get(`/admin/models/${modelId}/schema`);
      return data;
    },
    enabled: !!modelId,
  });
}
```

- [ ] **Step 2: Update `ConfiguredModels.tsx` to use local schema**

In `ConfiguredModels.tsx`, change the import and hook usage:

```typescript
// Change from:
import { useModelSchema } from '@/hooks/useAdminModels';
// To:
import { useLocalModelSchema } from '@/hooks/useAdminModels';

// Change from:
const { data: modelSchema, isLoading: schemaLoading } = useModelSchema(
  configuringModel?.id ?? null,
);
// To:
const { data: modelSchema, isLoading: schemaLoading } = useLocalModelSchema(
  configuringModel?.id ?? null,
);
```

- [ ] **Step 3: Run typecheck**

```bash
cd /home/ciprian/projects/cast-studio-v2 && npm run typecheck
```

Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/hooks/useAdminModels.ts client/src/pages/settings/ConfiguredModels.tsx
git commit -m "feat: read model schema from local DB first, fall back to fal.ai API"
```

---

## PHASE 5: Frontend — Wire Up Pages

### Task 12: Fix ModelsPage import payload

**Files:**

- Modify: `client/src/pages/settings/ModelsPage.tsx`

- [ ] **Step 1: Fix the import handler**

Replace the `handleImportModel` function (lines 32-49):

```typescript
const handleImportModel = async (model: FalModel) => {
  setImportingId(model.id);
  try {
    await importModel.mutateAsync({
      fal_model_id: model.id,
      name: model.name,
      description: model.description,
      category: model.category,
      input_schema: model.inputSchema ?? {},
      default_parameters: extractDefaultParams(model.inputSchema),
    });
    toast.success(`Imported ${model.name}`);
  } catch (err: unknown) {
    const e = err as { message?: string };
    toast.error(e.message ?? 'Failed to import model');
  } finally {
    setImportingId(null);
  }
};

/** Extract default values from fal.ai schema for initial parameters. */
function extractDefaultParams(
  schema: Record<string, { default?: unknown; type: string }> | undefined,
): Record<string, unknown> {
  if (!schema) return {};
  const defaults: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(schema)) {
    if (field.default !== undefined) {
      defaults[key] = field.default;
    }
  }
  return defaults;
}
```

- [ ] **Step 2: Update `useFalConfig.ts` import type**

Change the `useImportFalModel` mutation input type:

```typescript
export function useImportFalModel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      fal_model_id: string;
      name: string;
      description?: string;
      category: 'text_to_image' | 'image_to_image' | 'image_to_text';
      task?: string;
      input_schema?: Record<string, unknown>;
      default_parameters?: Record<string, unknown>;
    }) => {
      const { data } = await apiClient.post('/admin/models/import', input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'models'] });
    },
  });
}
```

- [ ] **Step 3: Run frontend typecheck**

```bash
cd /home/ciprian/projects/cast-studio-v2 && npm run typecheck
```

Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/settings/ModelsPage.tsx client/src/hooks/useFalConfig.ts
git commit -m "fix: update model import payload to include schema and default parameters"
```

---

### Task 13: Add "Create Prompt" to PromptsPage

**Files:**

- Modify: `client/src/pages/settings/PromptsPage.tsx`

- [ ] **Step 1: Add create prompt state and handler**

Add after line 34 (after `deletePrompt` declaration):

```typescript
const createPrompt = useCreatePrompt();
const [createTask, setCreateTask] = useState('');
const [createTemplate, setCreateTemplate] = useState('');
const [createVariables, setCreateVariables] = useState('');
const [showCreate, setShowCreate] = useState(false);
```

Add the create handler after `handleDelete`:

```typescript
const handleCreate = async () => {
  if (!createTask.trim() || !createTemplate.trim()) {
    toast.error('Task and template are required');
    return;
  }
  try {
    const vars = createVariables
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    await createPrompt.mutateAsync({
      task: createTask.trim(),
      template: createTemplate.trim(),
      variables: vars,
    });
    toast.success('Prompt created');
    setShowCreate(false);
    setCreateTask('');
    setCreateTemplate('');
    setCreateVariables('');
  } catch (err: unknown) {
    const error = err as { message?: string };
    toast.error(error.message ?? 'Failed to create prompt');
  }
};
```

- [ ] **Step 2: Add create button to PageHeader**

Change the PageHeader (lines 76-79) to include a create button:

```typescript
<PageHeader
  title="System Prompts"
  description="Edit prompt templates used for generation"
>
  <Button size="sm" onClick={() => setShowCreate(true)}>
    <FileText className="mr-2 size-4" />
    New Prompt
  </Button>
</PageHeader>
```

- [ ] **Step 3: Add create dialog after the delete dialog (before closing `</div>`)**

```typescript
{/* Create dialog */}
<Dialog open={showCreate} onOpenChange={() => setShowCreate(false)}>
  <DialogContent className="max-w-2xl">
    <DialogHeader>
      <DialogTitle>Create Prompt Template</DialogTitle>
    </DialogHeader>
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="create-task">Task</Label>
        <Input
          id="create-task"
          value={createTask}
          onChange={(e) => setCreateTask(e.target.value)}
          placeholder="e.g. actor_headshot"
        />
        <p className="text-xs text-muted-foreground">
          Unique identifier for this generation task.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="create-template">Template</Label>
        <Textarea
          id="create-template"
          value={createTemplate}
          onChange={(e) => setCreateTemplate(e.target.value)}
          rows={6}
          className="font-mono text-sm"
          placeholder="Professional headshot of {{identity_description}}, {{age}} year old {{gender}}..."
        />
        <p className="text-xs text-muted-foreground">
          Use {'{{variable}}'} syntax for dynamic values.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="create-variables">Variables (comma-separated)</Label>
        <Input
          id="create-variables"
          value={createVariables}
          onChange={(e) => setCreateVariables(e.target.value)}
          placeholder="identity_description, age, gender"
        />
      </div>
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setShowCreate(false)}>
        Cancel
      </Button>
      <Button onClick={handleCreate} disabled={createPrompt.isPending}>
        {createPrompt.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : 'Create'}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

- [ ] **Step 4: Run frontend typecheck**

```bash
cd /home/ciprian/projects/cast-studio-v2 && npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/settings/PromptsPage.tsx
git commit -m "feat: add create prompt button and dialog to PromptsPage"
```

---

## PHASE 6: Verification & Integration

### Task 16: Run full test suite and verify

- [ ] **Step 1: Run all backend tests**

```bash
cd /home/ciprian/projects/cast-studio-v2/server && npm test
```

Expected: All tests pass (437+ tests).

- [ ] **Step 2: Run typecheck**

```bash
cd /home/ciprian/projects/cast-studio-v2 && npm run typecheck
```

Expected: No type errors.

- [ ] **Step 3: Run linter**

```bash
cd /home/ciprian/projects/cast-studio-v2 && npm run lint
```

Expected: No lint errors.

- [ ] **Step 4: Verify migrations are idempotent**

```bash
cd /home/ciprian/projects/cast-studio-v2/server && npm run migrate:down && npm run migrate:up
```

Expected: Down and up both succeed without errors.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: verify all tests pass, migrations idempotent, lint clean"
```

---

## SUMMARY OF CHANGES

| Subsystem              | Before                                                                     | After                                                                                                   |
| ---------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Database**           | No `system_prompts` table; `models` has no `input_schema`                  | `system_prompts` table with 9 seed rows; `models.input_schema` column                                   |
| **Prompt CRUD**        | All endpoints return 501                                                   | Full CRUD: GET/POST/PATCH/DELETE working                                                                |
| **Model Import**       | Saves raw schema as parameters, no task assignment                         | Saves schema in `input_schema`, defaults in `parameters`, supports task                                 |
| **Model Resolution**   | First active model or hardcoded fallback                                   | Task-based lookup → first active → fallback                                                             |
| **Generation**         | Raw JSON identity as prompt; no fal job ID stored; no workspace key passed | System prompt template with variables; fal job ID stored for polling; workspace key resolved and passed |
| **Regeneration**       | Same as generation; no workspace key passed                                | Same prompt + job ID + workspace key fixes                                                              |
| **Character Sheet**    | Same as generation; no workspace key passed                                | Uses `character_sheet_composition` prompt with look description; workspace key passed                   |
| **Models Page**        | Import sends wrong payload                                                 | Import sends schema + defaults                                                                          |
| **Prompts Page**       | No create button                                                           | Create button + dialog working                                                                          |
| **ConfiguredModels**   | No task assignment UI                                                      | "Assign to task" row action with dropdown dialog                                                        |
| **ModelParameterForm** | Fetches schema from fal.ai API every time                                  | Reads from local DB first, falls back to fal.ai API                                                     |
| **generation-worker**  | Already reads `fal_job_id` from generation_params                          | No changes needed — works with the job IDs now stored by generate/regenerate/character-sheet            |
