# ADR-047: System Prompts Table for Admin-Editable Generation Templates

## Status

Accepted

## Date

2026-06-20

## Context

The generation pipeline (actor headshots, fullshots, expressions, editorial, character sheets, look generation, fashion items, reference extraction, and character sheet composition) needs system prompt templates that admins can customize without code changes. Previously, prompts were hardcoded in the generation services, meaning any prompt tweak required a code change, test cycle, and redeployment.

## Decision

Create a `system_prompts` table with columns: `id` (UUID PK), `task` (VARCHAR unique), `template` (TEXT with `{{variable}}` placeholders), `variables` (JSONB array of variable names), `updated_at`, `created_at`. Seed 9 default prompts covering all generation tasks. Admins update templates via the admin UI (prompt-routes CRUD).

Key design choices:

- **`task` is UNIQUE**: One prompt per generation task. No workspace scoping — prompts are global within a workspace (the admin who edits them is workspace-scoped via middleware).
- **`{{variable}}` syntax**: Simple string replacement via `replaceAll()`. No template engine dependency.
- **`variables` JSONB column**: Declares expected variables for UI rendering (admin form can show input fields for each variable).
- **`ON CONFLICT DO NOTHING` on seed**: Migration is idempotent — safe to re-run without duplicating seed data.
- **`IF NOT EXISTS` on table/index**: Extra safety for edge cases where migration framework retries.

## Alternatives Considered

### Hardcode prompts in service files

- Pros: Simpler, no DB table needed
- Cons: Every prompt change requires code change + redeploy; no admin customization
- Rejected: Core requirement is admin-editable prompts

### Use a template engine (Handlebars, Mustache)

- Pros: Richer template features (conditionals, loops)
- Cons: Adds dependency; `{{variable}}` replacement is sufficient for our use case; template engines can introduce XSS if misused with user content
- Rejected: `replaceAll()` is sufficient and zero-dependency

### Workspace-scoped prompts (workspace_id column)

- Pros: Different workspaces could have different prompts
- Cons: Adds complexity; no current requirement for per-workspace prompts; can add later via migration if needed
- Rejected: Start simple; global prompts per instance is sufficient for MVP

### Store prompts in a JSON config file

- Pros: No DB migration needed
- Cons: Requires file system access to edit; harder to build admin UI on top of; not versioned in DB
- Rejected: DB table is the standard pattern for admin-editable content in this project

## Consequences

- Admins can customize generation prompts without touching code
- The `prompt-service.ts` (Task 4) handles variable substitution with fallback prompts for any task missing a DB row
- Migration 010 must run before the prompt CRUD routes (Task 5) are deployed
- If a task has no matching `system_prompts` row, `resolvePrompt()` falls back to a basic hardcoded prompt — generation still works
- The `variables` column enables future UI: admin form can dynamically render input fields for each declared variable
