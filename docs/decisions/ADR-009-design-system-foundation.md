# ADR-001: Adopt DESIGN.md Warm Stone Palette as Source of Truth

## Status

Accepted

## Date

2026-06-18

## Context

The Cast Studio v2 frontend was initialized with default shadcn/ui CSS variables — cold grayscale palette (oklch-based), Geist font, 10px border radius, and shadow utilities. This contradicts DESIGN.md which specifies a warm stone palette (#78716C primary, #FAFAF9 background, #1C1917 text), 0px radius everywhere, Libre Baskerville + Inter + Source Code Pro fonts, and completely flat design (no shadows).

Every component built on the wrong foundation would need to be re-styled later. Fixing the foundation first (CSS variables + Tailwind config) ensures all future component work inherits the correct design language automatically.

## Decision

Rewrite `client/src/index.css` :root and .dark variables to use DESIGN.md color tokens as CSS custom properties, and update `client/tailwind.config.js` to map Tailwind color utilities to those CSS variables.

Key changes:

- All colors converted from oklch to hex per DESIGN.md
- `--radius` set to `0px` (was `0.625rem`)
- All shadow utilities removed from Tailwind config
- Semantic colors added: success (#65A30D), warning (#CA8A04), error (#DC2626)
- Border colors added: subtle (#E7E5E4), medium (#D6D3D1), strong (#A8A29E)
- Dark mode uses warm dark equivalents (stone-900 bg, stone-100 text)
- Surface tokens added: --surface (#F5F5F4), --surface-raised (#EFEDEB)
- Focus ring defined: `0 0 0 2px #FAFAF9, 0 0 0 4px #78716C`

## Alternatives Considered

### Keep shadcn defaults, override per-component

- Pros: Less upfront work, shadcn components work out of the box
- Cons: Every component needs manual overrides; easy to miss some; design drift over time
- Rejected: Violates DESIGN.md, creates inconsistency, more work long-term

### Use Tailwind stone palette directly (no CSS variables)

- Pros: Simpler config, no abstraction layer
- Cons: Harder to theme (dark mode), can't use CSS custom properties for runtime theming
- Rejected: CSS variables needed for dark mode toggle and future theming

### Convert DESIGN.md colors to oklch

- Pros: Consistent with shadcn's native format
- Cons: DESIGN.md specifies hex values; oklch conversion may produce slightly different visual results
- Rejected: DESIGN.md hex values are the spec; use them directly

## Consequences

- All future components automatically inherit the correct warm stone palette
- Dark mode toggle will work with warm dark colors (no cold grayscale in dark mode)
- shadcn components will render with 0px radius and stone colors without per-component overrides
- Font change (Geist → Libre Baskerville/Inter/Source Code Pro) is a separate task (UI-T2)
- Build passes, TypeScript passes, no runtime errors
