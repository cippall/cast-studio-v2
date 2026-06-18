# ADR-005: Input/Form components to DESIGN.md spec

## Status

Accepted

## Date

2026-06-18

## Context

The shadcn input components (input, textarea, checkbox, radio-group, select, label) used default shadcn styling — cold grayscale colors, rounded corners, shadow-based focus rings, and Geist font. These violated DESIGN.md which specifies warm stone palette, 0px radius, flat design with border-only separation, and Libre Baskerville + Inter fonts.

## Decision

Updated all 6 form components to use DESIGN.md token values directly via hex colors and explicit styling, replacing all shadcn semantic color references:

- **Input/Textarea**: `h-12` (48px), `bg-[#FAFAF9]`, `border-[#D6D3D1]`, 0px radius, `px-3 py-[12px]` (12px 16px), focus ring `0 0 0 2px #FAFAF9, 0 0 0 4px #78716C`, error `border-[#DC2626]`, disabled `bg-[#F5F5F4] opacity-50`
- **Checkbox**: `size-[18px]`, `border-[1.5px] border-[#D6D3D1]`, 0px radius, checked `bg-[#78716C] border-[#78716C]`, disabled `opacity-40`
- **Radio**: `size-[18px]`, `rounded-full` (9999px — only round element besides avatars per DESIGN.md), `border-[1.5px] border-[#D6D3D1]`, selected `border-[#78716C]` with inner dot `bg-[#78716C]`
- **Select**: Trigger matches input styling (48px height, same border/bg), popup uses `bg-[#FAFAF9]` with `border-[#E7E5E4]`, no shadows
- **Label**: `text-[13px] font-semibold text-[#57534E]` per DESIGN.md spec

All `rounded-lg`, `rounded-md`, `shadow-md`, `ring-3`, `ring-ring/50` utilities removed. Dark mode variants removed (not needed until dark mode implementation).

## Alternatives Considered

### CSS variable approach (keeping shadcn semantic names)

- Pros: Smaller diff, preserves shadcn's dark mode support
- Cons: Indirect — semantic names like `border-input` map to CSS variables that still need updating; easy to miss edge cases
- Rejected: Direct hex values are explicit and match the pattern established by T3 (Button) and T4 (Card)

### Tailwind token extension

- Pros: Reusable tokens like `border-input` would resolve to correct values
- Cons: Requires overriding every shadcn semantic token; more files to change
- Rejected: Consistent with T3/T4 approach of inline hex values

## Consequences

- Form components now fully match DESIGN.md spec
- Dark mode not yet supported for form components (will be added in T5b)
- Build output slightly smaller (removed unused dark mode CSS variants)
- Pattern matches T3 (Button) and T4 (Card) for consistency
