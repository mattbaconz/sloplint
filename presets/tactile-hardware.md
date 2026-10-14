# DESIGN.md: Tactile Hardware

Interface modeled on physical equipment: field recorders, test gear, synthesizers, industrial panels. Warm gray housings, keys that look pressable, safety-orange for the one control that matters, and labels printed like silkscreen.

## Tokens

```css
:root {
  --bg: #d9d5ce;
  --surface: #e8e5df;
  --raised: #f4f2ee;
  --line: #b5afa5;
  --ink: #26231f;
  --ink-2: #5d5850;
  --accent: #ff5a1f;
  --on-accent: #1a0d05;
  --good: #3d7a3a;
  --warn: #a87300;
  --bad: #c2361b;
  --font-body: "Chivo", system-ui, sans-serif;
  --font-display: "Chivo", system-ui, sans-serif;
  --font-mono: "Chivo Mono", ui-monospace, monospace;
  --radius: 10px;
  --radius-inner: 6px;
  --shadow: inset 0 1px 0 rgb(255 255 255 / 0.6), 0 1px 0 rgb(0 0 0 / 0.18), 0 2px 4px rgb(0 0 0 / 0.12);
}
```

## Type

- Body: `--font-body` 15px/22px, weight 400.
- Silkscreen labels: `--font-mono` 11px uppercase, letter-spacing 0.1em, `--ink-2`, placed above or beside the control they name.
- Readouts: `--font-mono` with `tabular-nums`, set in a recessed display panel (`--ink` background, `--accent` or `--raised` digits).

## Color

- Housings are warm grays (`--bg`, `--surface`, `--raised`). The accent is safety orange and goes on exactly one control per panel: record, arm, deploy.
- Status LEDs use `--good`, `--warn`, `--bad` as small dots next to a text label.
- No gradients except the physical ones produced by `--shadow` lighting.

## Space and shape

- 4px grid; controls on an 8px rhythm.
- `--radius` 10px on panels and keys; elements inside a padded panel use `--radius-inner` (panel radius minus padding) so corners nest.
- Group controls in recessed wells (`--bg` inset into `--surface`) rather than drawing borders around borders.

## Motion

- Key press: `transform: translateY(1px)` and a reduced `--shadow` over 60ms. Release over 120ms.
- Toggles snap; no springy overshoot. Transitions list properties explicitly (transform, box-shadow, background-color).
- Respect `prefers-reduced-motion`: keep the color change, drop the movement.

## Components

- Keys (buttons): 40px tall, `--raised` face, `--shadow`, `--radius`. Primary key uses `--accent` with `--on-accent` label. Label names the action ("Start recording", "Arm channel 2").
- Switches and segmented selectors over dropdowns for fewer than five options.
- Readout panels for numbers that change; the layout never reflows when a value grows.

## Avoid

- Neon purple accents and glows; this is equipment, not a nightclub.
- Icon circles in a three-column grid.
- Muted subtitles under every section label.
- Boxes inside boxes inside boxes.
- `transition: all` and spinners that resize keys.
