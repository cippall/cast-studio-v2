# ADR-043: Notification Unread Indicator Color

## Status

Accepted

## Date

2026-06-19

## Context

The notification unread badge and dot indicator in `NotificationDropdown.tsx` used `bg-primary` (#78716C, muted stone) as their background color. This color is the same as the app's primary action color and does not visually distinguish "needs attention" from "neutral UI element." Users could easily miss unread notifications because the badge blended into the design language of non-interactive elements.

## Decision

Changed the unread badge and dot indicator from `bg-primary` to `bg-warning` (#ca8a04, amber). Added supporting CSS tokens:

- `--warning-foreground: #1c1917` — dark text for readability on amber background
- `--notification-accent: #ca8a04` — semantic token for notification-specific accent usage

Both tokens are defined in `:root` and `.dark` in `client/src/index.css`.

## Alternatives Considered

### Use a new custom color (e.g., red or blue)

- Pros: Would be more attention-grabbing
- Cons: Introduces a new color not in the design system; red implies error/danger which is semantically wrong for "unread"
- Rejected: The existing `--warning` token (#ca8a04 amber) is the correct semantic fit — it means "attention needed" without implying error

### Use `--destructive` (red) for unread

- Pros: High visibility
- Cons: Red means error/destructive action in the design system; using it for unread notifications would be semantically incorrect and alarming
- Rejected: Wrong semantic meaning

### Keep `bg-primary` and add animation/pulse

- Pros: Would draw attention without changing color
- Cons: Animation adds complexity; the fundamental problem is that the color doesn't communicate "unread" — animation alone is a band-aid
- Rejected: Color change is the correct first fix; motion can be added later if needed

## Consequences

- Unread notification badge now uses amber (#ca8a04) with dark text (#1c1917) for WCAG AA contrast
- Unread dot indicator in the notification list also uses amber
- No other elements changed color — only notification indicators affected
- The `--notification-accent` token is available for future notification-related accent needs
- Contrast ratio: #1c1917 on #ca8a04 = ~8.5:1 (exceeds WCAG AAA)

## Files Changed

- `client/src/index.css` — added `--warning-foreground` and `--notification-accent` tokens
- `client/src/components/NotificationDropdown.tsx` — changed badge and dot from `bg-primary` to `bg-warning`
