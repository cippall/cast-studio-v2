# ADR-004: Card component DESIGN.md compliance

## Status

Accepted

## Date

2026-06-18

## Context

The shadcn/ui Card component was installed with default Tailwind v4 styling: `rounded-xl` corners, `ring-1 ring-foreground/10` shadow-border hybrid, no explicit color background, and ring-based elevation. This violates DESIGN.md which mandates:

- 0px radius everywhere (sharp geometric edges)
- Border-only separation (no rings, no shadows)
- Explicit warm stone background colors
- Hover state via border color change, not shadow

## Decision

Rewrote `client/src/components/ui/card.tsx` to match DESIGN.md Cards section:

- Removed `rounded-xl` entirely (all corners sharp)
- Replaced `ring-1 ring-foreground/10` with `border border-border` (solid `#E7E5E4`)
- Default card: `bg-card` (#FAFAF9), hover: `border-border-medium` (#D6D3D1)
- Added `variant="elevated"` with `bg-surface` (#F5F5F4), `border-border-medium` (#D6D3D1)
- Removed `ring-offset-background` shadow artifacts from CardHeader/CardFooter
- CardFooter uses explicit `border-t border-border` (not inherited ring)

## Alternatives Considered

### Keep shadcn defaults with CSS overrides

- Pros: Less code change, shadcn updates easier
- Cons: Fighting the framework, specificity wars, `--card-spacing` abstraction doesn't match DESIGN.md's 36px padding requirement
- Rejected: DESIGN.md overrides shadcn defaults per project rules

### Use `ring` with `--ring` CSS var set to border color

- Pros: Minimal code change
- Cons: Still uses ring/box-shadow rendering path instead of real borders; hover shadow changes are DESIGN.md violation
- Rejected: ring is semantically a focus/shadow indicator, not a border

## Consequences

- Card now renders flat with 1px solid borders, matching DESIGN.md spec
- `variant` prop is now a top-level prop (was implicit via className)
- CardHeader's footer border separator uses `border-border` (#E7E5E4) for consistency
- All subcomponents (CardHeader, CardFooter, CardContent) align to the 0px radius system
- Build and typecheck pass cleanly
