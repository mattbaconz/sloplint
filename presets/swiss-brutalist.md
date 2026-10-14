# DESIGN.md: Swiss Brutalist

International Typographic Style pushed to its blunt edge, for portfolios, cultural institutions, agencies and tools that want to look decided. A strict grid, heavy grotesque type, black hairlines, one signal red, zero radius.

## Tokens

```css
:root {
  --bg: #ffffff;
  --surface: #ffffff;
  --raised: #f2f2f2;
  --line: #111111;
  --ink: #111111;
  --ink-2: #555555;
  --accent: #e30613;
  --on-accent: #ffffff;
  --good: #00804a;
  --warn: #b26b00;
  --bad: #e30613;
  --font-body: "Archivo", "Helvetica Neue", Arial, sans-serif;
  --font-display: "Archivo", "Helvetica Neue", Arial, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
  --radius: 0px;
  --radius-inner: 0px;
  --shadow: none;
}
```

## Type

- Display: `--font-display` weight 800, tight tracking (−0.02em), leading 0.95. Sizes jump: 16, 24, 48, 96. Nothing in between.
- Body: 16px/24px, weight 400, flush left, ragged right. Never centered, never justified.
- Metadata in `--font-mono` 12px uppercase: dates, indices, file sizes, counts (with `tabular-nums`).

## Color

- Black on white. `--accent` red is a signal: the current item, a single call to action, a warning. If two things are red, one of them is wrong.
- No tints, no shadows, no gradients. Inverted blocks (white on `--ink`) for emphasis.

## Space and shape

- 12-column grid, 16px gutters, content snaps to column edges. Asymmetry is the default: 7/5, 8/4, 3/9.
- `--radius` is 0 everywhere.
- Structure comes from 1px `--line` rules spanning the full grid width, not from boxes. A section is a rule plus a heading.

## Motion

- Instant state changes or 80ms opacity. No easing curves that bounce, no scroll-triggered reveals.
- Hover: invert (ink background, white text). Focus: 2px `--accent` outline offset 2px.

## Components

- Buttons: rectangular, 1px `--ink` border, uppercase 14px label, weight 700. Primary is `--ink` fill; destructive is `--accent`. Labels say the result ("Delete 3 files", "Book a table").
- Lists over cards: an indexed list (`01`, `02`, `03` in mono) with a rule between rows.
- Tables: full-width rules, no vertical lines, numbers right-aligned in mono. Wrap each in an `overflow-x: auto` container so a phone scrolls the table, not the page.

## Avoid

- Rounded corners of any size, soft shadows, glassmorphism.
- Purple gradients and gradient headlines.
- Centered three-column icon grids.
- Gray subtitles under every heading.
- Decorative motion.
