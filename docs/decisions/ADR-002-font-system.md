# ADR-002: Font System — Libre Baskerville + Inter + Source Code Pro

## Status

Accepted

## Date

2026-06-18

## Context

Cast Studio requires a typography system that matches DESIGN.md: serif headings (Libre Baskerville), sans-serif body (Inter), and monospace code (Source Code Pro). The project previously used Geist (a variable font) which does not match the design spec. Fonts must be self-hosted via @fontsource packages for reliability and to avoid external CDN dependencies.

## Decision

Install three @fontsource packages and wire them into both CSS custom properties and Tailwind v3 fontFamily config:

- `@fontsource/libre-baskerville` — weights 400, 400 italic, 700
- `@fontsource/inter` — weights 400, 500, 600, 700
- `@fontsource/source-code-pro` — weights 400, 600

CSS variables `--font-heading`, `--font-body`, `--font-mono` are defined in `@theme inline` and applied via:

- `body { font-family: var(--font-body) }`
- `h1-h6 { font-family: var(--font-heading) }`
- `code, pre, kbd, samp { font-family: var(--font-mono) }`

Tailwind `fontFamily` maps `sans` → Inter, `serif` → Libre Baskerville, `mono` → Source Code Pro, plus semantic `heading` and `body` keys.

## Alternatives Considered

### Google Fonts CDN (link tags)

- Pros: Simpler setup, browser caching across sites
- Cons: External dependency, requires network access, privacy concerns, no offline dev
- Rejected: @fontsource gives self-hosted reliability with the same npm workflow

### Variable fonts (@fontsource-variable packages)

- Pros: Single file covers all weights, smaller total size
- Cons: Not all @fontsource variable packages available for these fonts; adds complexity
- Rejected: Fixed-weight @fontsource packages are simpler and well-supported for all three fonts

### System font stack

- Pros: Zero install, instant load
- Cons: Inconsistent across OS, does not match DESIGN.md serif heading requirement
- Rejected: DESIGN.md mandates specific fonts

## Consequences

- Removed `@fontsource-variable/geist` dependency entirely
- All three fonts load eagerly via CSS @import (no FOIT/FOUT from JS-based loading)
- Tailwind `font-sans` now maps to Inter (was Geist), `font-serif` to Libre Baskerville
- Existing `font-sans` classes across components automatically switch to Inter
- No behavioral changes to components — purely visual/typographic
