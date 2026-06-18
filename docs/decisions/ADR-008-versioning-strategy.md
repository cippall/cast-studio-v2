# ADR-008: Asset Output Versioning Strategy

## Status

Accepted

## Date

2026-06-17

## Context

When an asset output is regenerated (e.g., headshot is re-generated), the old version must be preserved for history and reproducibility. Downstream assets (fullshot, expressions, character sheet, editorial) that depend on the changed output become obsolete.

## Decision

### Versioning Model

- Each `asset_output` row has a `version` integer (starts at 1, increments on each regeneration)
- The main `asset_output` table always contains only the current version
- On regeneration:
  1. Current row is copied to `asset_output_versions` archive table (all fields preserved)
  2. Downstream outputs are marked `is_obsolete = TRUE` with `obsolete_reason` (e.g., "Headshot was regenerated. Regenerate to update.")
  3. New PENDING row created in `asset_output` with `version = old_version + 1`
  4. Background worker processes the new PENDING row

### Dependency Chain

```
Headshot → Fullshot → Expressions → Character Sheet / Editorial
```

- Editing/regenerating an upstream asset invalidates ALL downstream assets
- Obsolete assets show an explanatory banner with inline regenerate button in the UI
- Only headshot, fullshot, expressions are **editable**. Others are regenerate-only or create-new.

### Version History

- `GET /api/assets/:id/outputs/:outputId/versions` returns current + all archived versions
- Each version preserves: `image_url`, `model`, `generation_params`, `reference_images`, `source_asset_outputs`, `status`, `cost_credits`

### Reproducibility

- `generation_params` stores the complete JSON body sent to fal.ai
- This allows exact replay of any historical generation call
- `reference_images` stores uploaded input images with naming convention `ref_{asset_id}_{version}_{short_uuid}.png`

## Alternatives Considered

### Keep all versions in main table with `is_current` flag

- Pros: Simpler queries, no archive table
- Cons: Table grows large, queries must always filter `is_current = true`, index complexity
- Rejected: Archive table keeps the main table lean. Current version queries are fast.

### Event sourcing (store deltas)

- Pros: Complete audit trail, can reconstruct any state
- Cons: Over-engineered for this use case, harder to query
- Rejected: Full row copies in archive table are simpler and sufficient.

### No versioning (overwrite in place)

- Pros: Simplest
- Cons: Loses history, can't reproduce old results, no rollback
- Rejected: Spec requires reproducibility. Versioning is non-negotiable.

## Consequences

- `asset_output_versions` table has same schema as `asset_output` plus `archived_at` timestamp
- Regeneration is a transaction: archive old + mark obsolete + create new PENDING
- UI must handle obsolete state: banner with reason + regenerate button
- Version history endpoint must be efficient (index on `(asset_output_id, version)`)
- Storage: each version preserves image URLs (not the images themselves — fal.ai hosts them)
