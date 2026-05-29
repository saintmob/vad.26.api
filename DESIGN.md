# VAD Control Deck Design System

This document is the source of truth for the 4300 control-room UI. The reference point is Cloudflare's current dashboard language in 2026: dark-first, streamlined, low-chrome, keyboard-friendly, and built around dense operational surfaces rather than decorative dashboards.

## Reference Frame

- Cloudflare's current public UI leans toward dark surfaces, compact controls, and consistent button sizing.
- The dashboard direction is streamlined: one page, one task, one primary surface, fewer nested panels.
- Helper content should be subdued. Status, navigation, and operational tables should do the work.

## Visual Thesis

- Calm, technical, and authoritative.
- Dark surfaces with a single warm control accent.
- Dense information, but always legible.
- The first screen should feel like an operator workspace, not a card grid.

## Core Principles

1. Keep the primary workspace dominant.
2. Prefer one control lane and one inspector lane.
3. Treat routes, logs, and clients as operational tables, not separate product areas.
4. Use consistent button sizes and tight spacing.
5. Keep low-frequency settings in modal dialogs or hidden drawers.
6. Use borders, spacing, and hierarchy before adding decoration.
7. Preserve a keyboard-first feel. High-frequency actions must remain one click away.

## Layout Contract

The desktop shell should read in this order:

1. Brand and connection strip
2. Playback transport
3. Tab switcher
4. Primary workspace
5. Right-side routing inspector

Rules:

- The main workspace should be the visual anchor.
- The routing inspector should take as much height as possible.
- Event logs should live under routing in a compact companion block.
- Client presence should be merged into route rows when possible.
- Avoid a persistent bottom drawer for logs or clients.
- Keep any remaining settings in a modal, not a rail.

## Surface Language

- Prefer flat or lightly raised surfaces.
- Use thin borders and restrained shadows.
- Avoid decorative gradients inside routine controls.
- Keep surfaces distinct enough to scan, but not so separated that the page feels fragmented.
- Use one warm brand accent for global actions and selection; keep module colors for state only.

## Typography

- Prefer a Geist-like stack: `Geist Sans`, `Geist`, then clean system sans fallbacks.
- Headlines should be compact and utility-driven.
- Labels should be short and descriptive.
- Use monospace only for IDs, URLs, or technical tokens.
- Avoid decorative typography and oversized display treatment.

## Color

- Background: quiet, dark, and slightly cooler than the controls.
- Brand accent: warm orange for primary actions, selection, and emphasis.
- Module colors: keep blue, green, and other status colors only when they explain module state.
- Do not let multiple accents compete in the same region.
- If a control is selected and no context-specific accent exists, prefer the brand accent.

## Density Rules

- Default desktop target: `1200x960`.
- Preserve one uninterrupted primary workspace at that size.
- Keep header, transport, and tab rows compact enough that they do not wrap.
- Route rows must stay readable without turning into tall blocks.
- Logs should be legible at a glance and small enough to stay subordinate.
- Use scrollable panes for long lists; never let them push the workspace off screen.
- On shorter desktop viewports, trim padding before hiding core controls.

## Component Rules

- Buttons: compact, uniform height, small radius, clear selected state.
- Chips: single-line, information dense, no stacked text unless essential.
- Panels: plain surfaces with a clear border and limited shadow.
- Tables and lists: tight vertical rhythm, ellipsis for long values, explicit small labels for secondary metadata.
- Modals: centered, focused, and small enough to avoid competing with the workspace.

## Interaction Rules

- High-frequency actions should be reachable in one click.
- Secondary configuration should take at least one extra step.
- Motion should clarify hierarchy and state transitions, not add spectacle.
- Hover, selected, and disabled states must be easy to distinguish without relying on color alone.
- Selection, focus, and active states should feel consistent across the shell.

## Refactor Target For This Project

- Keep the top shell compact.
- Make the transport bar feel like a dedicated control strip.
- Let the screen topology own the center of the page.
- Collapse route details, logs, and client presence into a single right-side operational column.
- Use a warm accent to make the deck feel closer to Cloudflare's current product language.
- Reduce perceived height without hiding functionality.

## Anti-Patterns

- Dashboard-card mosaics.
- Competing accent colors in one region.
- Thick shadows and decorative gradients.
- Large rounded rectangles everywhere.
- Repeating the same information in multiple panels.
- Long explanatory copy in the working surface.
- Persistent bottom drawers for operational data.

## Acceptance Check

- The brand is visible immediately.
- The playback state is visible immediately.
- The screen topology is the visual anchor.
- The routing inspector feels taller and more usable than before.
- Route, client, and log information are readable in one scan.
- Nothing wraps awkwardly at the common desktop sizes.
- The page still feels disciplined if shadows are removed.

## Reference Sources

- Cloudflare Style Guide: https://developers.cloudflare.com/style-guide/
- Cloudflare dashboard dark mode and streamlined UI updates: https://developers.cloudflare.com/changelog/2025-04-30-zero-trust-dashboard-dark-mode/ and https://developers.cloudflare.com/changelog/post/2026-01-20-kv-dash-ui-homepage/
- Cloudflare current homepage language: https://www.cloudflare.com/
