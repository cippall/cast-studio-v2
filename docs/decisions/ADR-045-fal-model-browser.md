# ADR-045: fal.ai Model Browser

## Status

Accepted

## Date

2026-01-19

## Context

Admins need to browse and select which fal.ai models are available for each generation task (text-to-image, image-to-image, image-to-text). The fal.ai REST API (`rest.fal.ai`) provides categorized model listings with schema information. The existing system already stores fal.ai API keys encrypted at rest and has a local `models` table for managing model configurations.

## Decision

Implemented a two-tab Models page:

1. **Model Browser tab** — Fetches available models from fal.ai REST API (`GET /rest.fal.ai/models?category=<cat>`) grouped by category (text_to_image, image_to_image, image_to_text). Each model card shows name, description, supported input features (from the model's input schema), and endpoint ID. Admins can "import" a model, which creates a record in the local `models` table.

2. **Configured Models tab** — Shows locally imported models with activate/deactivate toggles and delete. This is the existing model management table.

New API endpoints:

- `GET /api/admin/fal-models` — Proxy to fal.ai REST API using workspace-stored key
- `POST /api/admin/models/import` — Import a fal.ai model into the local DB

## Alternatives Considered

### Direct fal.ai API calls from frontend

- Pros: Fewer backend changes
- Cons: Would expose API key to the client, even temporarily; violates the pattern of keeping secrets server-side
- Rejected: Security risk

### Sync all fal.ai models automatically on key connect

- Pros: No manual import step
- Cons: Would flood the local table with dozens of models the admin may not want; harder to curate
- Rejected: Admin should explicitly choose which models to make available

### Separate "fal_models" table for browsable models

- Pros: Cleaner separation of concerns
- Cons: Unnecessary complexity; the existing `models` table already serves both purposes (fal.ai model_id is stored in `model_id`, task maps to category)
- Rejected: Reuse existing schema

## Consequences

- Admins can browse fal.ai models without leaving the UI
- Imported models appear in the Configured tab for task assignment
- The `inputSchema` from fal.ai is stored in the `parameters` JSONB column for potential future dynamic form generation
- If fal.ai adds new categories, they need to be added to the `CATEGORY_ORDER` and `CATEGORY_LABELS` constants in ModelsPage.tsx
- Model browsing requires a valid fal.ai API key (same key used for generation)
