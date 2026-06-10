# VAD Control Deck — Design System

This document defines the visual and interaction language for the VAD 4300 control-room UI. It follows Cloudflare's 2026 product design direction: dark-first, surface-based hierarchy, low chrome, keyboard-optimized, and built around dense operational surfaces.

---

## Principles

1. **One surface, one task.** The primary workspace is the visual anchor. Every layout decision starts from the StageMap.

2. **Dark by default.** The interface ships dark. Light mode is a fallback, not the baseline. The background is near-black (`oklch(8.5% 0 0)`), not pure black.

3. **Surface hierarchy over decoration.** Depth comes from layered surfaces — page background → elevated card → control tint — not from shadows or gradients. Borders are thin (`1px`), muted, and secondary.

4. **Density is a feature.** The audience is a live-show operator, not a casual browser. Controls are compact, labels are short, information is scannable at a glance. Every pixel of vertical space belongs to the show.

5. **One accent, one meaning.** A warm orange (`#f6821f`) is the global brand accent for selection, primary actions, and emphasis. Module colors (VJ purple, DJ green, stage cyan, route orange) describe *state*, not interaction. Never use two accents in the same region.

6. **Keyboard-first.** All high-frequency actions must be reachable without a mouse. Space toggles play/pause. `S` stops. `R` resets. `1`–`3` switch selection modes. Visual hints are shown in the bottom strip at all times.

7. **Motion clarifies.** Transitions are fast (`150–200ms`), cubic-bezier eased, and limited to hierarchy changes, state transitions, and entry animations. No looping, no spectacle.

---

## Color

All values use the Cloudflare Kumo palette with oklch encoding.

### Neutral Surface Stack (Dark theme)

| Token | Lightness | Usage |
|-------|-----------|-------|
| `--surface` | `oklch(8.5% 0 0)` | Page background |
| `--elevated` | `oklch(14.5% 0 0)` | Barely-raised containers, drag surfaces |
| `--card` | `oklch(18% 0 0)` | Module/panel backgrounds |
| `--tint` | `oklch(26.9% 0 0)` | Hover states, secondary fills |
| `--control` | `oklch(22% 0 0)` | Input backgrounds, button rests |
| `--border` | `oklch(28% 0 0)` | All borders, dividers, outlines |
| `--contrast` | `oklch(99% 0 0)` | Primary text (white) |
| `--muted` | `oklch(55% 0 0)` | Secondary text, captions, metadata |

The surface stack inverts for light mode: surface → near-white, card → white, tint → `oklch(96% 0 0)`, border → `oklch(88% 0 0)`.

### Accent Palette

| Token | oklch | Role |
|-------|-------|------|
| Brand | `oklch(65% 0.18 45)` `#f6821f` | Selection, primary buttons, emphasis |
| Stage | `oklch(72% 0.13 225)` `#20c7ff` | Screen topology, selection mode |
| VJ | `oklch(58% 0.20 300)` `#b457ff` | Visual module state |
| DJ | `oklch(68% 0.18 145)` `#3ddb6e` | Audio module state |
| Route | `oklch(67% 0.18 55)` `#ff9a3d` | Routing module state |
| Online | `oklch(68% 0.18 145)` | Client/connection live indicator |
| Offline | `oklch(28% 0 0)` | Disconnected/absent state |
| Cue | `oklch(82% 0.15 85)` `#ffd24a` | Alert, attention, transition |

### Accessibility

- All text on elevated/card surfaces must meet WCAG AA (4.5:1 contrast).
- The 5th step of each accent scale (`oklch(58–72%)`) is the minimum contrast level for interactive elements.
- Module accent colors must remain distinguishable on card backgrounds; use saturation (`0.13–0.20`) not just lightness.

---

## Typography

- **UI stack:** `"SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`
- **Code/monospace:** `"SF Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`
- **Base size:** `12px` (12px = 1rem in the control deck context). This is smaller than a typical dashboard because the operator sits close and needs density.
- **Headings:** `11px`, weight `600`, letter-spacing `-0.01em`. Module headers only.
- **Labels:** `8px`, weight `700`, uppercase, letter-spacing `0.6px`. Section labels and metadata.
- **Body/controls:** `8–10px` depending on context. Button labels, source lists, readouts.
- **Monospace:** Tabular-nums for timestamps, IDs, levels, and technical tokens. Always `font-variant-numeric: tabular-nums`.

---

## Surface Hierarchy

```
Page background (--surface)
  └── Bar (--elevated + 1px border)
      └── Module/Card (--card + 1px border + left accent bar)
          └── Control row (--tint on hover)
              └── Button/Input (--control + 1px border)
```

- Each surface step is exactly one `oklch` lightness jump above the previous.
- Borders use `--border` (`oklch(28%)`) and exist primarily to separate surfaces of equal elevation.
- The left accent bar on cards (`2px`, 4px from edge) is the module identifier. It should never compete with content.
- Hover raises the surface by one step: `--card` → `--tint` or `--control` → `--tint`.

---

## Layout

### Frame

```
Shell (100vh, 4px padding)
├── TopStrip (32px)        — Brand mark, connection dot, show label, settings
├── TransportBar (38px)    — Play/Pause/Stop/Reset, BPM, lock, sync
├── Workspace (1fr)        — StageMap (1fr) | InspectorPanel (230px, tabs)
└── BottomStrip (28px)     — Ack message, event stream, keyboard hints
```

- Gaps between rows/columns: `4px`.
- The workspace is `grid-template-columns: 1fr 230px`. The inspector panel is deliberately narrow to keep the StageMap dominant.
- No scroll on the shell itself. Each panel scrolls independently.

### Module Panel

```
Module (flex column, Card bg + 1px border + left accent)
├── Module Header (32px)   — Title + optional actions (thin bottom separator)
└── Module Body (flex 1)   — Controls grid, scrolls if needed
```

- Header is flush with the card top, separated by a `1px solid var(--border)` line.
- No card shadow. No rounded corners on individual controls inside the card.
- The left accent bar uses the module's state color (`--color-vj`, `--color-dj`, etc.) at 50% opacity.

---

## Component Patterns

### Buttons

- Compact: `h-6` (24px), `text-[9px]`, padding `px-2`.
- Variants: `default` (brand fill), `outline` (1px border, transparent bg), `secondary` (tint fill), `ghost` (no border, no bg).
- Icon-only buttons: `w-6 h-6 p-0`.
- Selected state: `default` variant. Do not use outline + colored border for selection; use the filled variant as the sole selected indicator.
- Hover: raise tint. Active: scale `0.96`.

### Tabs

- Styled as underline indicators, not filled pills. The active tab has a `2px` bottom border in its module accent color.
- Compact height: `30px`. Labels are `9px`, uppercase, `600` weight.
- A colored dot precedes the label to indicate module association.

### Chips / Badges

- Height: `22px` or `20px`. Padding: `0 8px`. Font: `8–9px`.
- Single-line, information-dense. Never stack text.
- Used for: status indicators, metadata, sync labels, client counts.

### Selection Modes

- Icon buttons in the StageMap header: `w-7 h-7` (28px). Active state uses `default` variant with brand accent.
- Three modes: `solid` (click to route), `dashed` (click to sequence), `box` (drag to multi-select).

### Modals

- Centered, `max-w-[420px]`, `animation: dialog-enter 0.2s cubic-bezier(0.16, 1, 0.3, 1)`.
- Never wider than the workspace. Should not compete with the StageMap.
- Settings, route composer, and confirmations only. No modals for operational controls.

### Keyboard Hints

- Bottom strip shows live keyboard hints: `kbd` elements with `7px` monospace, `1px` border, `3px` radius.
- Hints must update if context changes (e.g., show different hints when settings are open).

---

## Motion

| Event | Duration | Easing | Purpose |
|-------|----------|--------|---------|
| Entry | 200ms | `cubic-bezier(0.16, 1, 0.3, 1)` | Panels, dialogs |
| Hover | 150ms | `ease-out` | Button tints, border highlights |
| Transition | 200ms | `cubic-bezier(0.25, 0.46, 0.45, 0.94)` | Theme switch, state change |
| Slide | 300ms | `cubic-bezier(0.16, 1, 0.3, 1)` | Events entering the bottom strip |
| Pending | 1.5s loop | `ease-in-out` | Action-in-progress glow |

Respect `prefers-reduced-motion`. When reduced motion is active, zero all animation/transition durations to `0.01ms`.

---

## Anti-Patterns

- Dashboard-card mosaics with competing accent colors.
- Thick shadows, decorative gradients, or glassmorphism.
- Persistent bottom drawers for logs or client lists.
- Long explanatory copy in the working surface (labels are `8–10px`, not paragraphs).
- Repeating the same information in multiple panels.
- Buttons taller than `28px` or wider than necessary.
- Nested borders (e.g., card inside card without an elevation gap).

---

## Acceptance Check

- [ ] The brand is visible in the top strip immediately.
- [ ] Connection state is readable at a glance (dot + label).
- [ ] The StageMap occupies >60% of workspace width at 1200px viewport.
- [ ] Playback transport is always one click away (header strip).
- [ ] Keyboard shortcuts work without any mouse interaction.
- [ ] Route, audio, and VJ controls are organized in tabs, not stacked in panels.
- [ ] Events stream in the bottom strip without stealing focus.
- [ ] Nothing wraps awkwardly at 1280×800 or 1920×1080.
- [ ] The page still feels structured and calm if all shadows are removed.
- [ ] Dark/light mode toggle preserves readability on all surfaces.

---

## Reference

- Cloudflare Design System: `https://cloudflare.design`
- Cloudflare Style Guide: `https://developers.cloudflare.com/style-guide/`
- Cloudflare Dashboard dark mode: `https://blog.cloudflare.com/dark-mode/`
- Kumo theme tokens (2026): oklch neutral scale with `kumo-surface`, `kumo-recessed`, `kumo-elevated`, `kumo-tint` semantics.
