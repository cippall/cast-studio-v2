# ADR-003: Button component DESIGN.md compliance

## Status

Accepted

## Date

2026-06-18

## Context

The Button component (button.tsx) was using default shadcn/ui styles — cold grayscale colors, rounded corners (rounded-lg), shadow utilities, and non-spec sizing. DESIGN.md defines a warm stone palette with 0px radius, flat styling (no shadows), specific hex colors, and exact padding/font-size sizes.

## Decision

Updated buttonVariants CVA in button.tsx to match DESIGN.md button spec exactly:

- Primary: bg #78716C, text #FAFAF9, border #78716C, hover #57534E
- Secondary: transparent bg, text #78716C, border #D6D3D1, hover #F5F5F4
- Ghost: transparent bg, text #78716C, no border, hover #F5F5F4
- Destructive: bg #DC2626, text #FAFAF9, border #DC2626, hover #B91C1C
- Sizes: sm (8px 16px / 13px), md (12px 24px / 15px), lg (16px 36px / 17px)
- Radius: 0px everywhere (removed rounded-lg)
- Shadows: removed all shadow utilities
- Disabled: opacity 0.4, pointer-events-none prevents hover changes
- Font: Inter (inherited from body), weight 600 (font-semibold)
- Preserved forwardRef wrapper and Base UI Button primitive

## Alternatives Considered

### Keep shadcn defaults with CSS variable overrides

- Pros: Less code change, leverages shadcn theming
- Cons: shadcn defaults include rounded-lg, shadow classes, and color tokens that don't map cleanly to DESIGN.md hex values. Would still need variant-level overrides.
- Rejected: Direct hex values in variants are more reliable and explicit for this design system.

### Use Tailwind semantic tokens (bg-primary etc.)

- Pros: Consistent with Tailwind conventions
- Cons: DESIGN.md specifies exact hex values that differ from default shadcn token mappings. The CSS variables are already set to DESIGN.md values, but some tokens (like secondary) don't match DESIGN.md button spec.
- Partially adopted: outline variant still uses semantic tokens since it matches; all other variants use explicit hex values.

## Consequences

- Button component now renders with correct warm stone colors, flat edges, and spec-compliant sizing
- All existing Button usages across 33 pages will automatically get the new styles
- No API changes — variant names and props are unchanged
- tsc --noEmit and vite build pass cleanly
