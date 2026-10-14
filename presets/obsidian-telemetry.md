# DESIGN.md: Obsidian Telemetry

Dark instrument-panel interface for dense, numeric products: monitoring, trading, developer tools, admin consoles. Quiet surfaces, one amber signal color, monospaced numbers that never jitter.

## Tokens

```css
:root {
  --bg: #0e0f11;
  --surface: #15171a;
  --raised: #1c1f23;
  --line: #2a2e34;
  --ink: #e8e6e1;
  --ink-2: #9a9ea6;
  --accent: #f2a33a;
  --on-accent: #1a1206;
  --good: #5fbf8f;
  --warn: #e6c15a;
  --bad: #ef6b5b;
  --font-body: "IBM Plex Sans", system-ui, sans-serif;
  --font-display: "IBM Plex Sans", system-ui, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, monospace;
  --radius: 6px;
  --radius-inner: 2px;
  --shadow: none;
}
```

## Type

- Body: `--font-body` 14px/20px, weight 400. Long-form text 16px/26px with a 68ch measure.
- Labels: 12px/16px, weight 500, uppercase, letter-spacing 0.06em, color `--ink-2`.
- Headings: weight 600, tight leading (1.15). Scale: 12, 14, 16, 20, 28, 40. No other sizes.
- Numbers: `--font-mono` with `font-variant-numeric: tabular-nums` anywhere a value can change: tables, counters, prices, timers, axis labels.

## Color

- `--accent` marks the single thing that needs attention on a screen: the primary action, the selected series, a threshold that was crossed. It is never decoration.
- `--good`, `--warn`, `--bad` are for status only, always paired with a word or icon so meaning survives color blindness.
- No gradients. Depth is one step of surface (`--bg` → `--surface` → `--raised`) plus a 1px `--line` border.
- Secondary text uses `--ink-2` and only where it carries information (units, timestamps, helper text), not as an echo under every heading.

## Space and shape

- 4px grid: 4, 8, 12, 16, 24, 32, 48, 64.
- `--radius` on outer containers. Anything nested inside a padded, rounded parent uses `--radius-inner` so corners stay concentric (inner = outer − padding).
- One bordered container per region. Rows inside it are separated by `border-top: 1px solid var(--line)`, never by another box.

## Motion

- 120–160ms `ease-out`, on color, background-color, border-color, opacity and transform only. Name the properties; `transition: all` animates layout.
- Wrap anything over 200ms in `@media (prefers-reduced-motion: no-preference)`.
- Loading keeps geometry: skeleton rows at their final height; buttons keep their label in the layout (visibility hidden) with the spinner overlaid.

## Components

- Buttons: 32px tall, 12px horizontal padding, `--radius`. Primary = `--accent` fill with `--on-accent` text; secondary = transparent with `--line` border. Labels are verb + object ("Export CSV", "Mute alert").
- Tables: 32px rows, right-aligned numeric columns, sticky header on `--surface`, no zebra striping. Wrap each in an `overflow-x: auto` container so a phone scrolls the table, not the page.
- Charts: `--accent` for the series that matters, `--ink-2` for comparison series, gridlines in `--line`.
- Errors: say what failed, the likely cause, and the next action, inline next to the thing that failed.

## Avoid

- Purple or indigo gradients, glows, glassmorphism and gradient text.
- Three equal feature cards with icons in circles.
- A muted subtitle under every heading.
- Nested bordered boxes.
- `transition: all`, spinners that replace content, proportional digits in data.
