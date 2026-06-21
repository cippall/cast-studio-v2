# ADR-048: LookDetail uses SingleAssetLayout

## Status

Accepted

## Date

2026-06-21

## Context

LookDetail was using the old `AssetDetailLayout` which showed the same image in three places: the sidebar, the Overview tab, and the Outputs tab. This was redundant and wasted screen space. The properties tab used a card grid for taxonomy values, which was inconsistent with the key-value list pattern established in ActorPage (AR-5).

AR-4 had already split `AssetDetailLayout` into two specialized layouts:

- `MultiOutputAssetLayout` for Actors (sidebar image + Overview/Outputs/Properties tabs)
- `SingleAssetLayout` for Looks and Fashion Items (full-width hero image + Overview/Properties tabs, no redundant Outputs tab)

LookDetail needed to migrate to `SingleAssetLayout` to eliminate redundancy and match the intended architecture.

## Decision

Migrate LookDetail from `AssetDetailLayout` to `SingleAssetLayout`.

Key changes:

1. **Hero image fills content width** — uses `aspect-[4/3] w-full` container from SingleAssetLayout, image uses `h-full w-full object-cover`, no `max-w-2xl` constraint
2. **No Outputs tab** — SingleAssetLayout only renders Overview + Properties tabs; the hero image IS the output
3. **Overview tab shows source info only** — no duplicate image, shows source_type, model, and error messages
4. **Properties tab uses key-value list** — `border-b border-border` separators with label on left, value on right (matching ActorPage pattern from AR-5)
5. **Generation controls inline** — regenerate/generate button rendered below the hero image via `generationControls` prop, not hidden in a tab
6. **Contextual empty state** — "No look generated yet" message in the hero image area when no image exists
7. **Status badges use semantic tokens** — `GenerationStatus` component uses `text-success` design token, `Badge` uses `variant="default"` or `variant="outline"`

## Alternatives Considered

### Keep AssetDetailLayout with modifications

- Pros: Less code change
- Cons: Would still have redundant image display; doesn't match the architecture established in AR-4
- Rejected: The whole point of AR-4 was to split the layout; not using it defeats the purpose

### Create a new custom layout just for LookDetail

- Pros: Full control
- Cons: FashionItemDetail has the same single-asset pattern; would duplicate layout logic
- Rejected: SingleAssetLayout already handles this case; FashionItemDetail will use it too

## Consequences

- LookDetail is now consistent with the SingleAssetLayout pattern
- FashionItemDetail (AR-7, next task) will use the same layout
- The old `AssetDetailLayout` is now only used by no pages (can be deprecated)
- Properties tab now matches the key-value list pattern from ActorPage (AR-5)
- Generation controls are always visible below the image, improving discoverability
