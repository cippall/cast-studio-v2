# Cast Studio

Minimal, zen, distraction-free.

## Overview

Cast Studio is a contemplative design system built for a digital casting platform. It embraces generous white space as a design element, letting content breathe. The warm, neutral palette recedes behind content, creating an experience that feels like a well-set page in a quiet room. Every decision prioritizes clarity and typographic precision over ornament.

**Reference:** Stitch project `Cast Studio 2` — `Admin Dashboard - Classic Sidebar Variant` is the canonical layout reference.

## Colors

All colors use OKLCH. Hex equivalents provided for reference.

### Brand Palette

| Token     | Hex       | OKLCH                  | Role                                      |
| --------- | --------- | ---------------------- | ----------------------------------------- |
| Primary   | `#78716C` | `oklch(0.53 0.02 60)`  | Stone — anchors UI elements, links, icons |
| Secondary | `#A8A29E` | `oklch(0.72 0.01 60)`  | Sage — supporting accents, dividers       |
| Tertiary  | `#1C1917` | `oklch(0.18 0.005 60)` | Warm Black — emphasis, strong headings    |

### Surface Palette

| Token                     | Hex       | OKLCH                  | Role                                |
| ------------------------- | --------- | ---------------------- | ----------------------------------- |
| Background                | `#FAFAF9` | `oklch(0.98 0.003 80)` | Page background                     |
| Surface                   | `#F5F5F4` | `oklch(0.96 0.004 70)` | Card and section backgrounds        |
| Surface Raised            | `#EFEDEB` | `oklch(0.94 0.005 65)` | Hover states, subtle callout blocks |
| Surface Container Low     | `#F3F4F3` | `oklch(0.95 0.004 70)` | Sidebar background                  |
| Surface Container         | `#EEEED`  | `oklch(0.93 0.004 70)` | Container backgrounds               |
| Surface Container High    | `#E8E8E7` | `oklch(0.91 0.004 70)` | Active/hover container              |
| Surface Container Highest | `#E2E2E2` | `oklch(0.88 0.004 70)` | Strongest container contrast        |

### Content Palette

| Token          | Hex       | OKLCH                  | Role                          |
| -------------- | --------- | ---------------------- | ----------------------------- |
| Text Primary   | `#1C1917` | `oklch(0.18 0.005 60)` | Body copy, headings           |
| Text Secondary | `#57534E` | `oklch(0.48 0.02 60)`  | Bylines, metadata, captions   |
| Text Tertiary  | `#A8A29E` | `oklch(0.72 0.01 60)`  | Placeholders, disabled labels |

### Border Palette

| Token         | Hex       | OKLCH                  |
| ------------- | --------- | ---------------------- |
| Border Subtle | `#E7E5E4` | `oklch(0.90 0.006 65)` |
| Border Medium | `#D6D3D1` | `oklch(0.83 0.008 60)` |
| Border Strong | `#A8A29E` | `oklch(0.72 0.01 60)`  |

### Semantic Colors

| Token   | Hex       | OKLCH                  |
| ------- | --------- | ---------------------- |
| Success | `#65A30D` | `oklch(0.65 0.15 135)` |
| Warning | `#CA8A04` | `oklch(0.72 0.14 85)`  |
| Error   | `#DC2626` | `oklch(0.55 0.22 25)`  |
| Info    | `#78716C` | `oklch(0.53 0.02 60)`  |

## Typography

### Font Stack

| Role             | Font                                                    |
| ---------------- | ------------------------------------------------------- |
| Display/Headings | Libre Baskerville, Georgia, 'Times New Roman', serif    |
| UI/Body          | Inter, -apple-system, 'Segoe UI', Helvetica, sans-serif |
| Mono/Code        | Source Code Pro, 'Fira Code', Consolas, monospace       |

### Type Scale

| Level      | Font              | Size | Weight | Line Height | Letter Spacing | Usage                    |
| ---------- | ----------------- | ---- | ------ | ----------- | -------------- | ------------------------ |
| Display    | Libre Baskerville | 40px | 700    | 1.2         | -0.02em        | Hero article titles      |
| Headline   | Libre Baskerville | 30px | 700    | 1.3         | -0.015em       | Post titles              |
| Subhead    | Libre Baskerville | 22px | 400    | 1.4         | -0.01em        | Section headings         |
| Body Large | Inter             | 20px | 400    | 1.75        | 0              | Featured paragraph, lede |
| Body       | Inter             | 17px | 400    | 1.8         | 0              | Default reading text     |
| Body Small | Inter             | 15px | 400    | 1.7         | 0              | Sidebar text, footnotes  |
| Caption    | Inter             | 13px | 400    | 1.5         | 0.01em         | Image captions, dates    |
| Overline   | Inter             | 11px | 600    | 1.4         | 0.08em         | Category labels          |
| Code       | Source Code Pro   | 15px | 400    | 1.7         | 0              | Inline code, code blocks |

## Spacing

### Base Unit

| Property  | Value                           |
| --------- | ------------------------------- |
| Base unit | 12px                            |
| Scale     | 12, 24, 36, 48, 60, 72, 96, 120 |

### Component Padding

| Property               | Value |
| ---------------------- | ----- |
| Component padding — xs | 8px   |
| Component padding — sm | 12px  |
| Component padding — md | 24px  |
| Component padding — lg | 48px  |
| Component padding — xl | 72px  |

### Section Spacing

| Property                  | Value          |
| ------------------------- | -------------- |
| Section spacing — mobile  | 60px           |
| Section spacing — tablet  | 84px           |
| Section spacing — desktop | 120px          |
| Page section gap (`mb`)   | 48px (`mb-12`) |

### Standard Element Spacing

| Element                  | Value                                         | Usage                                      |
| ------------------------ | --------------------------------------------- | ------------------------------------------ |
| Nav item padding         | `px-3 py-3`                                   | Sidebar leaf nav items                     |
| Child nav indent         | `pl-[52px]`                                   | Sidebar child nav items (expanded)         |
| Logo area height         | `h-20` (80px)                                 | Sidebar header/logo area                   |
| Logo-to-nav gap          | `pt-6` (24px)                                 | Space between logo and first nav item      |
| Nav group gap            | `gap-3` (12px)                                | Space between nav groups                   |
| Bottom controls padding  | `p-2` (8px)                                   | Sidebar bottom section padding             |
| Bottom row gap           | `gap-1` (4px)                                 | Space between bottom control buttons       |
| User avatar gap          | `gap-2` (8px)                                 | Space between avatar and menu chevron      |
| Sidebar width expanded   | `w-64` (256px)                                | Expanded sidebar width                     |
| Sidebar width collapsed  | `w-16` (64px)                                 | Collapsed sidebar width                    |
| Content margin expanded  | `lg:ml-64`                                    | Main content offset when sidebar expanded  |
| Content margin collapsed | `lg:ml-16`                                    | Main content offset when sidebar collapsed |
| Dashboard padding        | `px-4 py-4 md:px-6 md:py-6 lg:px-12 lg:py-12` | Page container responsive padding          |
| Card padding             | `p-6` (24px)                                  | Standard card internal padding             |
| Section header margin    | `mb-8` (32px)                                 | Space below section headers                |
| Stats row cell padding   | `p-6` (24px)                                  | Individual stat cell padding               |

## Border Radius

| Token  | Value  | Usage                  |
| ------ | ------ | ---------------------- |
| None   | 0px    | All elements — default |
| Small  | 0px    | Not used               |
| Medium | 0px    | Not used               |
| Large  | 0px    | Not used               |
| XL     | 0px    | Not used               |
| Full   | 9999px | Avatars only           |

All interactive and container elements use sharp, geometric edges (0px radius). Only avatars use full rounding.

## Shadows

**Philosophy:** Cast Studio is completely flat. No shadows are used. Separation is achieved exclusively through borders and white space.

| Level   | CSS Value | Usage |
| ------- | --------- | ----- |
| Subtle  | `none`    | —     |
| Medium  | `none`    | —     |
| Large   | `none`    | —     |
| Overlay | `none`    | —     |

**Special — Focus Ring:** `0 0 0 2px var(--background), 0 0 0 4px var(--primary)` — used for keyboard focus indicators.

## Components

### Buttons

**Primary**

- Background: `var(--primary)` / `#78716C`
- Text: `var(--primary-foreground)` / `#FAFAF9`
- Border: none
- Font: Inter, weight 600
- Radius: 0px
- Hover: `color-mix(in oklch, var(--primary), black 15%)`
- Active: `translate-y(1px)`
- Focus: `outline-2 outline-offset-2 outline-[var(--ring)]`

**Secondary / Outline**

- Background: transparent
- Text: `var(--foreground)` / `#1C1917`
- Border: `1px solid var(--border)`
- Font: Inter, weight 600
- Radius: 0px
- Hover: Background `var(--muted)`

**Ghost**

- Background: transparent
- Text: `var(--foreground)`
- Border: none
- Font: Inter, weight 600
- Radius: 0px
- Hover: Background `var(--muted)`

**Destructive**

- Background: `var(--destructive)` / `#DC2626`
- Text: `var(--destructive-foreground)` / `#FAFAF9`
- Border: none
- Font: Inter, weight 600
- Radius: 0px
- Hover: `color-mix(in oklch, var(--destructive), black 15%)`

**Button Sizes**

| Size    | Height | Padding | Font Size | Usage          |
| ------- | ------ | ------- | --------- | -------------- |
| xs      | 24px   | `px-2`  | 11px      | Compact inline |
| sm      | 32px   | `px-4`  | 13px      | Small actions  |
| default | 48px   | `px-6`  | 15px      | Standard       |
| lg      | 56px   | `px-9`  | 17px      | Prominent CTA  |
| icon    | 48px   | square  | —         | Icon button    |
| icon-sm | 32px   | square  | —         | Small icon     |

**Disabled:** Opacity 0.4, cursor not-allowed, no hover change.

### Cards

**Default**

- Background: `#FAFAF9`
- Border: `1px solid #E7E5E4`
- Radius: 0px
- Padding: 36px
- Shadow: none
- Hover: Border `#D6D3D1`

**Elevated**

- Background: `#F5F5F4`
- Border: `1px solid #D6D3D1`
- Radius: 0px
- Padding: 36px
- Shadow: none

### Inputs

**Text Input**

- Height: 48px
- Background: `#FAFAF9`
- Border: `1px solid #D6D3D1`
- Radius: 0px
- Padding: 12px 16px
- Font: Inter, 15px, weight 400
- Text color: `#1C1917`
- Placeholder color: `#A8A29E`
- Focus: Border `#78716C`, ring `0 0 0 2px #FAFAF9, 0 0 0 4px #78716C`
- Error: Border `#DC2626`
- Disabled: Background `#F5F5F4`, opacity 0.5

**Label:** Inter, 13px, weight 600, color `#57534E`, margin-bottom 8px.

**Helper Text:** Inter, 13px, weight 400, color `#A8A29E`, margin-top 6px. Error helper color `#DC2626`.

### Chips / Badges

**Status Label** (used in activity cards, list items)

- Padding: 4px 12px
- Font: Inter, 11px, weight 600, uppercase, letter-spacing 0.08em
- Radius: 0px
- Default: Background `var(--surface-container)`, text `var(--foreground)`, border `1px solid var(--border)`
- Success: Background `oklch(0.65 0.15 135 / 0.1)`, text `var(--success)`, border `1px solid oklch(0.65 0.15 135 / 0.2)`
- Warning: Background `oklch(0.72 0.14 85 / 0.1)`, text `var(--warning)`, border `1px solid oklch(0.72 0.14 85 / 0.2)`
- Error: Background `oklch(0.55 0.22 25 / 0.1)`, text `var(--error)`, border `1px solid oklch(0.55 0.22 25 / 0.2)`

**Filter Chip**

- Background: transparent
- Border: `1px solid var(--border-medium)` / `1px solid #D6D3D1`
- Radius: 0px
- Padding: 6px 14px
- Font: Inter, 13px, weight 500
- Text: `var(--text-secondary)` / `#57534E`
- Selected: Background `var(--primary)`, text `var(--primary-foreground)`, border `var(--primary)`

### Lists

**Default List Item**

- Padding: 16px 0
- Border bottom: `1px solid #E7E5E4`
- Font: Inter, 15px, weight 400
- Text: `#1C1917`
- Secondary text: `#A8A29E`, 13px
- Hover: Background `#F5F5F4`
- Active: Background `#EFEDEB`
- Leading element: 20px icon, color `#78716C`

### Checkboxes

- Size: 18px
- Border: `1.5px solid #D6D3D1`
- Radius: 0px
- Background: `#FAFAF9`
- Checked: Background `#78716C`, border `#78716C`, checkmark `#FAFAF9`
- Indeterminate: Background `#78716C`, dash `#FAFAF9`
- Hover: Border `#78716C`
- Focus: Ring `0 0 0 2px #FAFAF9, 0 0 0 4px #78716C`
- Disabled: Opacity 0.4
- Label: Inter, 15px, weight 400, margin-left 10px

### Radio Buttons

- Size: 18px
- Border: `1.5px solid #D6D3D1`
- Radius: 9999px
- Background: `#FAFAF9`
- Selected: Border `#78716C`, inner dot `#78716C` (8px)
- Hover: Border `#78716C`
- Focus: Ring `0 0 0 2px #FAFAF9, 0 0 0 4px #78716C`
- Disabled: Opacity 0.4
- Label: Inter, 15px, weight 400, margin-left 10px

### Tooltips

- Background: `#1C1917`
- Text: `#FAFAF9`
- Font: Inter, 13px, weight 500
- Padding: 8px 14px
- Radius: 0px
- Max width: 240px
- Arrow: 6px, same background
- Delay: 300ms enter, 0ms leave
- Shadow: none

## Layout

### App Shell

- **Desktop (≥1024px):** Fixed left sidebar (w-64 expanded / w-16 collapsed) + main content area with dynamic `ml`
- **Mobile (<1024px):** Sidebar hidden, Sheet drawer triggered by hamburger in PageContainer
- **No top bar** — all controls live in the sidebar

### Sidebar

- Background: `var(--surface-container-low)` / `#F3F4F3`
- Border-right: `1px solid var(--border)` / `1px solid #E7E5E4`
- Width: 256px (w-64) expanded, 64px (w-16) collapsed
- Position: fixed, left-0, top-0, h-full
- **Header:** h-20, `border-b`, Libre Baskerville 28px bold `-0.02em`, or "CS" 20px when collapsed
- **Nav gap:** `pt-6` (24px) between logo and first nav item
- **Nav Items:** All uppercase, Inter 11px semibold `tracking-widest`
  - Leaf: icon (always visible) + label (hidden when collapsed)
  - Children: icon (always visible) + label (hidden when collapsed), indented `pl-[52px]` when expanded
  - Active: `bg-surface-container-highest text-foreground`
  - Hover: `bg-surface-container-highest`
- **Nav Groups:** Section labels same style as nav items, `border-b` separator
- **Bottom section:** Single row — theme toggle + notifications + user avatar + menu chevron. When collapsed: centered icons only. User name/email below when expanded.
- **Collapse toggle:** Bottom of sidebar, `hidden lg:block`, chevron rotates 180°

### Page Container

- Max-width: `max-w-7xl` (1280px) centered on desktop
- Padding: 16px (mobile) / 24px (tablet) / 48px (desktop)
- **Mobile hamburger:** Menu icon at top of content, visible `< lg`, triggers sidebar drawer
- Section spacing: 48px (`mb-12`) between major sections

### Stats Row

- Grid: 5-column on desktop, 2-column on mobile
- `border-y border-border` on outer container
- `border-r border-border` between stat items
- Last item (highlight): `bg-surface-container-low`, value in `text-primary`
- Label: Inter 11px semibold uppercase tracking-widest, `text-muted-foreground`
- Value: Libre Baskerville 30px bold, `-0.015em` letter-spacing

### Quick Actions

- Grid: 3-column on desktop
- Card: `border border-border`, p-6, h-48, `bg-surface-bright`
- Icon: 32px, `text-primary`, mb-4
- Heading: Inter 20px, `text-foreground`
- CTA: Icon button (Plus), bottom-left

### Recent Activity

- Horizontal scrollable row with snap
- Item: w-64, thumbnail h-40 with `border border-border`
- Title: Inter 17px, `text-foreground`
- Time: Inter 13px, `text-muted-foreground`
- Status label: rectangular chip (see Chips / Badges)

## Do's and Don'ts

1. **Do** let white space dominate — margins and padding should feel generous and contemplative.
2. **Do** keep headlines in Libre Baskerville for literary warmth; never use it for UI labels.
3. **Do** use `#E7E5E4` hairline borders to separate sections instead of shadows or color blocks.
4. **Don't** add decorative elements, gradients, or illustrations that compete with the text.
5. **Don't** use more than two font weights on a single screen — restraint is the ethos.
6. **Do** set body text at 17px or above with 1.8 line height for comfortable long-form reading.
7. **Don't** use color to convey meaning alone — pair with text or icons for accessibility.
8. **Do** maintain a maximum content width of 680px for body text to preserve optimal reading measure.
9. **Don't** introduce rounded corners — sharp edges reinforce the clean geometric identity.
10. **Do** favor vertical rhythm aligned to the 12px base unit across all spacing decisions.
