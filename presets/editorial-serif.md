# DESIGN.md: Editorial Serif

Print-inspired interface for reading-heavy products: publications, documentation, research tools, long-form reports. Warm paper, a confident serif display face, oxblood as the only accent.

## Tokens

```css
:root {
  --bg: #f7f4ee;
  --surface: #fffdf8;
  --raised: #efe9df;
  --line: #d9d1c3;
  --ink: #1d1a16;
  --ink-2: #5f574c;
  --accent: #7a1f2b;
  --on-accent: #fff8f0;
  --good: #2f6b4f;
  --warn: #8a6a12;
  --bad: #a3242f;
  --font-body: "Public Sans", system-ui, sans-serif;
  --font-display: "Newsreader", Georgia, serif;
  --font-mono: "IBM Plex Mono", ui-monospace, monospace;
  --radius: 2px;
  --radius-inner: 0px;
  --shadow: none;
}
```

## Type

- Display: `--font-display`, weight 500, optical size high, leading 1.1. Headlines carry the page; set them large (40–64px) and let them wrap naturally with `text-wrap: balance`.
- Body: `--font-body` 17px/28px, measure 62–70ch. Paragraph spacing equals one line.
- Small caps or uppercase labels at 12px with 0.08em tracking for section kickers, never above every heading.
- Numbers in tables and figures: `font-variant-numeric: tabular-nums lining-nums`.

## Color

- Ink on paper. `--accent` is for links, the active navigation item, and one highlighted word or figure per view.
- Rules (`--line`) separate sections the way a newspaper column rule does. Prefer a hairline over a box.
- No gradients, no tinted cards. Emphasis comes from type size, weight and italics.

## Space and shape

- Baseline rhythm of 4px; vertical spacing in multiples of the body line (28px).
- Asymmetric layouts: a wide reading column with a narrow margin column for notes, figures and metadata.
- Corners are square or nearly so (`--radius` 2px). Images are full-bleed or set in the column, never in rounded cards.

## Motion

- Almost none. Link underlines and focus rings change color in 120ms; nothing slides or scales.
- Respect `prefers-reduced-motion` by default.

## Components

- Links: underlined, `text-underline-offset: 0.2em`, `--accent` color.
- Buttons: text-like, uppercase 13px label with a 1px `--ink` border; primary is `--accent` fill. Labels name the action ("Subscribe for $8/month", "Download the PDF").
- Pull quotes: `--font-display` italic, 28px, with a real name and role.
- Footnotes and sources are first-class: numbered, linked both ways.

## Avoid

- Hero gradients, glows and gradient text.
- Icon-circle feature grids and stock testimonial copy.
- A gray subtitle under each heading.
- Cards inside cards.
- Generic buttons ("Submit", "Learn more").
