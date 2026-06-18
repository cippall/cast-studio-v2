# ADR-006: Dark Mode Theme Implementation

## Status

Accepted

## Date

2026-06-18

## Context

Cast Studio needed a dark mode toggle to improve usability in low-light environments. The existing light palette was defined in DESIGN.md (warm stone tones), but no dark equivalent existed. The implementation needed to:

- Derive a warm dark palette from the existing light palette (no cold grayscale)
- Persist user preference across sessions
- Avoid flash of wrong theme on initial render (FOUC)
- Integrate with the existing Zustand UI store

## Decision

### Dark Palette

The dark palette inverts the light palette while maintaining warm stone tones:

- Background: `#1C1917` (stone-900, warm black)
- Foreground/text: `#F5F5F4` (stone-100, warm white)
- Primary: `#44403C` (stone-700, muted warm)
- Secondary: `#292524` (stone-800, dark warm)
- Borders: `#44403C` / `#57534E` / `#78716C` (progressively lighter stone)

### Anti-FLASH Script

An inline `<script>` in `index.html` `<head>` sets `.dark` on `<html>` before React renders:

1. Reads `localStorage.getItem('cast-studio-theme')`
2. If no stored preference, checks `prefers-color-scheme: dark`
3. Adds `.dark` class to `<html>` if dark mode is active

This prevents the flash of light theme before React hydrates.

### Theme Hook (`useTheme.ts`)

- Reads/writes Zustand `ui-store` theme state
- Syncs to `localStorage` on change
- Applies/removes `.dark` class on `<html>`
- Respects `prefers-color-scheme` on first visit (no stored preference)

### Toggle Button

Ghost button with Sun/Moon icon in TopBar, right-aligned before notifications. Uses `aria-label` for accessibility.

## Alternatives Considered

### CSS `color-scheme` property

- Pros: Native browser support, simple
- Cons: Doesn't allow custom dark palette colors; browser defaults are cold grayscale
- Rejected: DESIGN.md requires warm stone tones in both modes

### `next-themes` library

- Pros: Battle-tested, handles FOUC
- Cons: Extra dependency; we already have Zustand for state management
- Rejected: Custom hook is simpler and keeps deps minimal

### Separate dark mode CSS file

- Pros: Clean separation
- Cons: Duplicates all variable definitions; harder to maintain
- Rejected: Single `.dark {}` block in index.css is maintainable and clear

## Consequences

- Theme persists across page refreshes via localStorage
- No flash of wrong theme on initial render
- Toggle is accessible (aria-label, keyboard-focusable button)
- All shadcn components automatically adapt via CSS variable overrides
- Zustand store is the single source of truth for theme state
