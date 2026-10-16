// Distinctive design systems from a seed and an optional one-line brief. The same input
// always gives the same system: a seeded pick from curated type pairings, an OKLCH palette
// solved for WCAG contrast, shape, motion and a layout archetype. Pure and browser-safe.

// ─── Seeded choice ───────────────────────────────────────────────────────────

function hashString(s) {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
  return h >>> 0;
}

// mulberry32: small, fast and plenty for picking from short curated lists.
function stream(key) {
  let a = hashString(key);
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    pick: (list) => list[Math.floor(next() * list.length)],
    range: ([lo, hi]) => lo + (hi - lo) * next(),
    chance: (p) => next() < p,
    take(list, n) {
      const pool = [...list];
      const out = [];
      while (out.length < n && pool.length) out.push(pool.splice(Math.floor(next() * pool.length), 1)[0]);
      return out;
    },
  };
}

// ─── Color: OKLCH in, sRGB hex out, WCAG contrast ────────────────────────────

const gamma = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);

function oklchToLinear(L, C, H) {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const toHex = (lin) => `#${lin.map((v) => Math.round(gamma(Math.min(1, Math.max(0, v))) * 255).toString(16).padStart(2, '0')).join('')}`;

// Lowers chroma until the color fits in sRGB, then rounds to hex.
function oklch(L, C, H) {
  const l = Math.min(1, Math.max(0, L));
  let c = Math.max(0, C);
  while (c > 0 && oklchToLinear(l, c, H).some((v) => v < 0 || v > 1)) c = Math.max(0, c - 0.002);
  return { L: l, C: c, H, hex: toHex(oklchToLinear(l, c, H)) };
}

function luminance(hex) {
  const n = parseInt(hex.slice(1, 7), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((v) => (v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

// Walks lightness away from `against` until the pair reaches `ratio`.
function reach(c, against, ratio) {
  const step = luminance(against) > 0.2 ? -0.01 : 0.01;
  let out = c;
  for (let L = c.L; contrast(out.hex, against) < ratio && L > 0 && L < 1; ) {
    L += step;
    out = oklch(L, c.C, c.H);
  }
  return out;
}

// [r, g, b, alpha] (0-255, alpha 0-1) for a CSS color literal, or null.
export function rgbaOf(literal) {
  const t = literal.trim().toLowerCase();
  if (t[0] === '#') {
    let hex = t.slice(1);
    if (hex.length === 3 || hex.length === 4) hex = [...hex].map((c) => c + c).join('');
    if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/.test(hex)) return null;
    const n = parseInt(hex.slice(0, 6), 16);
    return [n >> 16, (n >> 8) & 255, n & 255, hex.length === 8 ? parseInt(hex.slice(6), 16) / 255 : 1];
  }
  const fn = /^(rgba?|hsla?|oklch)\(([^)]*)\)$/.exec(t);
  if (!fn) return null;
  const raw = fn[2].split(/[\s,/]+/).filter(Boolean);
  if (raw.length < 3) return null;
  const num = (s, scale = 1) => (s.endsWith('%') ? (parseFloat(s) / 100) * scale : parseFloat(s));
  const alpha = raw[3] == null ? 1 : num(raw[3], 1);
  let rgb;
  if (fn[1].startsWith('rgb')) rgb = raw.slice(0, 3).map((s) => num(s, 255));
  else if (fn[1].startsWith('hsl')) {
    const [h, s, l] = [parseFloat(raw[0]), num(raw[1].endsWith('%') ? raw[1] : `${raw[1]}%`, 1), num(raw[2].endsWith('%') ? raw[2] : `${raw[2]}%`, 1)];
    const f = (k) => { const n = (k + h / 30) % 12; return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(n - 3, 9 - n, 1)); };
    rgb = [f(0), f(8), f(4)].map((v) => v * 255);
  } else {
    const hex = toHex(oklchToLinear(num(raw[0], 1), parseFloat(raw[1]), parseFloat(raw[2])));
    return [...rgbaOf(hex).slice(0, 3), alpha];
  }
  return rgb.some(Number.isNaN) || Number.isNaN(alpha) ? null : [...rgb.map((v) => Math.round(v)), alpha];
}

// ─── Curated data ────────────────────────────────────────────────────────────

// Google Fonts families with the weights each system loads. `npm run check:fonts` asks the
// Google Fonts CSS API for every one; run it after adding a family.
export const FONT = {
  'Instrument Serif': { w: [400], kind: 'serif' },
  Fraunces: { w: [400, 600], kind: 'serif' },
  Newsreader: { w: [400, 600], kind: 'serif' },
  Gloock: { w: [400], kind: 'serif' },
  'Source Serif 4': { w: [400, 600], kind: 'serif' },
  'Libre Caslon Display': { w: [400], kind: 'serif' },
  'Libre Caslon Text': { w: [400, 700], kind: 'serif' },
  'EB Garamond': { w: [400, 600], kind: 'serif' },
  'Bodoni Moda': { w: [400, 600], kind: 'serif' },
  'Cormorant Garamond': { w: [400, 600], kind: 'serif' },
  'Young Serif': { w: [400], kind: 'serif' },
  Petrona: { w: [400, 600], kind: 'serif' },
  Gelasio: { w: [400, 600], kind: 'serif' },
  Spectral: { w: [400, 600], kind: 'serif' },
  Italiana: { w: [400], kind: 'serif' },
  'Instrument Sans': { w: [400, 600], kind: 'sans' },
  'Work Sans': { w: [400, 600], kind: 'sans' },
  'Public Sans': { w: [400, 600], kind: 'sans' },
  Commissioner: { w: [400, 600], kind: 'sans' },
  Karla: { w: [400, 600], kind: 'sans' },
  Figtree: { w: [400, 600], kind: 'sans' },
  'Hanken Grotesk': { w: [400, 600], kind: 'sans' },
  'Albert Sans': { w: [400, 600], kind: 'sans' },
  'Schibsted Grotesk': { w: [400, 700], kind: 'sans' },
  'Familjen Grotesk': { w: [400, 700], kind: 'sans' },
  'Bricolage Grotesque': { w: [400, 700], kind: 'sans' },
  Archivo: { w: [400, 600, 800], kind: 'sans' },
  'Archivo Black': { w: [400], kind: 'sans' },
  Barlow: { w: [400, 600], kind: 'sans' },
  'Big Shoulders Display': { w: [800], kind: 'sans' },
  Chivo: { w: [400, 700], kind: 'sans' },
  'Red Hat Display': { w: [700], kind: 'sans' },
  'Red Hat Text': { w: [400, 600], kind: 'sans' },
  'Inter Tight': { w: [400, 600], kind: 'sans' },
  Manrope: { w: [400, 600], kind: 'sans' },
  Onest: { w: [400, 600], kind: 'sans' },
  'Golos Text': { w: [400, 600], kind: 'sans' },
  Syne: { w: [700], kind: 'sans' },
  Unbounded: { w: [600], kind: 'sans' },
  Jost: { w: [400, 500], kind: 'sans' },
  'Atkinson Hyperlegible': { w: [400, 700], kind: 'sans' },
  'Libre Franklin': { w: [400, 600], kind: 'sans' },
  'Source Sans 3': { w: [400, 600], kind: 'sans' },
  'IBM Plex Sans': { w: [400, 600], kind: 'sans' },
  'Darker Grotesque': { w: [800], kind: 'sans' },
  Anton: { w: [400], kind: 'sans' },
  Rubik: { w: [400, 600], kind: 'sans' },
  'IBM Plex Mono': { w: [400, 500], kind: 'mono' },
  'JetBrains Mono': { w: [400, 500], kind: 'mono' },
  'DM Mono': { w: [400, 500], kind: 'mono' },
  'Space Mono': { w: [400, 700], kind: 'mono' },
  'Fragment Mono': { w: [400], kind: 'mono' },
  'Martian Mono': { w: [400, 500], kind: 'mono' },
  'Spline Sans Mono': { w: [400, 500], kind: 'mono' },
  'Azeret Mono': { w: [400, 500], kind: 'mono' },
  'Red Hat Mono': { w: [400, 500], kind: 'mono' },
  'Chivo Mono': { w: [400, 500], kind: 'mono' },
  'Source Code Pro': { w: [400, 500], kind: 'mono' },
  'Courier Prime': { w: [400, 700], kind: 'mono' },
};

const LAYOUTS = {
  specimen: {
    first: 'The product at poster scale: a real screen or table cropped large so it bleeds off the right edge (the section clips it, so nothing scrolls sideways), with the headline at `--step-display` above its top-left corner.',
    name: 'Specimen',
    lines: [
      'The first viewport shows the real product (a table, a terminal, a screen) at full width, with the headline in a narrow column beside or above it.',
      'Features are an index: one row each, the name on the left and the concrete detail on the right. No card grid.',
    ],
  },
  ledger: {
    first: 'One oversized figure in the mono face at `--step-display`, taken from the product itself (an amount, a count or a time from its sample data, never an unsourced claim), with its label beneath it and the headline under that at `--step-4`.',
    name: 'Ledger',
    lines: [
      'Sections are numbered rows separated by hairline rules: the claim on the left, the evidence on the right.',
      'Figures sit in the mono face, right-aligned, so they read as a column.',
    ],
  },
  manifesto: {
    first: 'The headline alone fills the first screen at `--step-display`, flush left and broken into lines by meaning; the proof sentence and the action sit in a narrow column at the bottom right.',
    name: 'Manifesto',
    lines: [
      'The first viewport is one typographic statement at the top of the display scale. No hero image, no illustration.',
      'Proof starts directly below: one short paragraph, then the product itself.',
    ],
  },
  split: {
    first: 'A color field: the narrow column is solid `--accent` (or `--ink`) holding the headline at `--step-display`, and the wide column shows the product on `--bg`.',
    name: 'Split',
    lines: [
      'An asymmetric 5/7 grid: the headline and primary action stay sticky in the narrow column while proof scrolls in the wide one.',
      'Under 768px the sticky column becomes a normal block above the proof.',
    ],
  },
  catalog: {
    first: 'The catalog is the hero: the real items (commands, parts, plans, places) set as a dense multi-column specimen that runs off the bottom of the first screen, under a headline at `--step-display`.',
    name: 'Catalog',
    lines: [
      'A dense, scannable grid of specifics (integrations, commands, plans, parts) in small type with real labels.',
      'Grouping and filtering instead of decoration: every tile carries a fact, none carries only an icon.',
    ],
  },
  letter: {
    first: 'A salutation at `--step-display` in the display face (the first words of the letter), with the date and signature in the mono face; the reading column starts directly below.',
    name: 'Letter',
    lines: [
      'One reading column of about 62 characters, written in the first person, with figures and screenshots inline.',
      'Claims carry footnotes, and the primary action closes the page like a signature.',
    ],
  },
  console: {
    first: 'The working panel at full width on an inverted `--ink` field, with the one figure that matters in it at `--step-display`; the copy is one line above.',
    name: 'Console',
    lines: [
      'The hero is a working panel with plausible, labeled data; the copy is one line above it.',
      'Later sections reuse the panel grammar: rows, units, timestamps, status tags.',
    ],
  },
  poster: {
    first: 'A full-bleed `--accent` field as tall as the viewport, with the headline at `--step-display` in `--on-accent`, set so large the edges almost crop it.',
    name: 'Poster',
    lines: [
      'Full-bleed blocks, one per section, alternating `--surface` and `--accent`; type set large.',
      'Each block holds one idea and at most one number.',
    ],
  },
};

const SIGNATURES = {
  'big-number': 'Oversized tabular numerals at display size for the one number that matters on the page.',
  hairlines: 'Hairline rules (1px `--line`) between sections and rows instead of boxed cards.',
  'margin-numbers': 'Section numbers (01, 02, 03) in the mono face, set in the left margin.',
  footnotes: 'Footnoted claims: every figure links to a numbered source at the end of its section.',
  'accent-section': 'One full-bleed `--accent` section per page, never two.',
  captions: 'Mono captions under every figure and screenshot.',
  'grid-lines': 'A faint 12-column grid in `--line` visible behind the first viewport.',
  pullquote: 'One pull quote from a named customer, set in the display face at twice the body size.',
  commands: 'Primary actions are copyable commands in the mono face: the real CLI or API call.',
  'text-nav': 'Text-only navigation; the current item gets a 2px `--accent` underline.',
  dropcap: 'A drop cap three lines tall, in the display face, on the opening paragraph.',
  'mono-tags': 'Status and category labels as small mono tags with a 1px border, never colored pills.',
};

// Accent hues in OKLCH degrees. Nothing between 262 and 335: that band is the stock AI purple.
// lightHues drops yellows, which a light background would darken to olive.
const MOOD = {
  editorial: {
    display: { max: 7, tracking: '-0.03em' },
    imagery: 'Printed-page ornament: crop marks at the corners of the first screen, a hairline baseline rule, figures set as captioned plates.',
    words: /\b(blog|magazine|news|journal|publish\w*|newsletter|essays?|books?|writ(?:er|ers|ing)|poetry|research|archive|museum|library|culture|reviews?|editorial|podcast|stor(?:y|ies)|literary)\b/gi,
    dark: 0.12,
    hues: [27, 38, 152, 195, 75],
    chroma: [0.1, 0.15],
    accentL: [[0.42, 0.52], [0.7, 0.78]],
    neutral: { hues: [70, 85], chroma: [0.006, 0.014] },
    radius: [0, 2, 3],
    border: 1,
    shadow: 'none',
    ratio: 1.333,
    base: 17,
    leading: 1.6,
    tracking: '-0.01em',
    section: [112, 64],
    fonts: [
      ['Instrument Serif', 'Instrument Sans', 'JetBrains Mono'],
      ['Fraunces', 'Work Sans', 'DM Mono'],
      ['Newsreader', 'Public Sans', 'IBM Plex Mono'],
      ['Gloock', 'Source Serif 4', 'Source Code Pro'],
      ['Libre Caslon Display', 'Libre Caslon Text', 'Courier Prime'],
      ['EB Garamond', 'Figtree', 'Fragment Mono'],
      ['Spectral', 'Karla', 'Space Mono'],
    ],
    layouts: ['letter', 'ledger', 'manifesto', 'split'],
    signatures: ['dropcap', 'footnotes', 'margin-numbers', 'pullquote', 'hairlines', 'captions'],
    motion: { ms: 200, ease: 'cubic-bezier(0.2, 0, 0, 1)', note: 'Fades only, the entrance included; nothing slides.' },
    names: ['Folio', 'Quire', 'Vellum', 'Broadsheet', 'Colophon', 'Gazette'],
    avoid: ['Stock hero photos and abstract 3D shapes: show the writing itself.', 'Centered body text: set prose ragged-right in one column.'],
    voice: ['Write like an editor: short declarative sentences, concrete nouns, no exclamation marks.', 'Headlines state a finding ("Reading time fell by half"), not a promise.'],
  },
  technical: {
    display: { max: 5.5, tracking: '-0.04em' },
    imagery: 'A faint dot or 12-column grid in `--line` behind the first screen; coordinates, timestamps and version numbers as small mono marginalia.',
    words: /\b(dev(?:eloper)?s?|apis?|cli|sdk|infra\w*|databases?|devops|terminal|monitor\w*|observability|logs?|metrics|kubernetes|cloud|servers?|code|compiler|git|deploy\w*|data|analytics|queues?|latency|uptime|edge|cache|hardware|open[- ]source)\b/gi,
    dark: 0.6,
    hues: [75, 130, 48, 205, 165, 28],
    chroma: [0.13, 0.19],
    accentL: [[0.5, 0.6], [0.74, 0.84]],
    neutral: { hues: [240, 250, null], chroma: [0.004, 0.012] },
    radius: [2, 4, 6],
    border: 1,
    shadow: 'none',
    ratio: 1.2,
    base: 15,
    leading: 1.55,
    tracking: '-0.02em',
    section: [80, 48],
    fonts: [
      ['Chivo', 'Chivo', 'Chivo Mono'],
      ['Martian Mono', 'Hanken Grotesk', 'Martian Mono'],
      ['Archivo', 'Archivo', 'Azeret Mono'],
      ['Red Hat Display', 'Red Hat Text', 'Red Hat Mono'],
      ['Schibsted Grotesk', 'Schibsted Grotesk', 'Spline Sans Mono'],
      ['Inter Tight', 'Inter Tight', 'JetBrains Mono'],
      ['IBM Plex Sans', 'IBM Plex Sans', 'IBM Plex Mono'],
    ],
    layouts: ['console', 'specimen', 'catalog', 'ledger'],
    signatures: ['big-number', 'commands', 'margin-numbers', 'mono-tags', 'hairlines', 'grid-lines'],
    motion: { ms: 120, ease: 'cubic-bezier(0.2, 0, 0, 1)', note: 'Feedback is instant; numbers update in place without animating.' },
    names: ['Signal', 'Relay', 'Telemetry', 'Circuit', 'Vector', 'Kernel'],
    avoid: ['Glowing borders, mesh gradients and fake terminal typing effects.', 'Code screenshots that are not the product\'s real API.'],
    voice: ['Write like a changelog: exact names, numbers with units, and commands in the mono face.', 'Say what it does in one line; show how in a code sample, not an adjective.'],
  },
  warm: {
    display: { max: 6, tracking: '-0.025em' },
    imagery: 'Paper grain at 3 to 5% opacity (an inline SVG `feTurbulence` filter) and soft cut-paper shapes in `--surface-2`; photographs of the real work when there are some.',
    words: /\b(food|recipes?|bakery|cafe|coffee|restaurants?|garden\w*|plants?|wellness|yoga|therapy|famil(?:y|ies)|community|crafts?|pottery|ceramics?|local|home|pets?|dogs?|cats?|farms?|kitchen|tea|care|parenting|knit\w*|bread)\b/gi,
    dark: 0.08,
    hues: [40, 115, 80, 145, 52, 30],
    chroma: [0.1, 0.15],
    accentL: [[0.48, 0.58], [0.72, 0.8]],
    neutral: { hues: [65, 80], chroma: [0.01, 0.022] },
    radius: [6, 10, 16],
    border: 1,
    shadow: 'soft',
    ratio: 1.25,
    base: 17,
    leading: 1.6,
    tracking: '-0.005em',
    section: [104, 64],
    fonts: [
      ['Fraunces', 'Commissioner', 'DM Mono'],
      ['Young Serif', 'Karla', 'Spline Sans Mono'],
      ['Bricolage Grotesque', 'Figtree', 'Space Mono'],
      ['Gelasio', 'Albert Sans', 'Azeret Mono'],
      ['Petrona', 'Hanken Grotesk', 'Fragment Mono'],
    ],
    layouts: ['letter', 'split', 'poster', 'specimen'],
    signatures: ['pullquote', 'captions', 'accent-section', 'dropcap', 'text-nav'],
    motion: { ms: 220, ease: 'cubic-bezier(0.3, 0, 0, 1)', note: 'Soft fades for images; controls respond instantly.' },
    names: ['Kiln', 'Hearth', 'Loam', 'Larder', 'Orchard', 'Meadow'],
    avoid: ['Clip-art illustrations and stock smiles: use real photos of the work.', 'Script fonts.'],
    voice: ['Write like a neighbor: "we" and "you", plain words, one specific detail per section (a place, a person, a time).', 'Warm, never cute: no puns on buttons and no exclamation marks in errors.'],
  },
  brutalist: {
    display: { max: 8, tracking: '-0.01em' },
    imagery: 'Registration marks, rubber-stamp labels, oversized index numbers and hard rules at `--border`; images, if any, printed full-bleed in one color.',
    words: /\b(art|artists?|galler(?:y|ies)|studios?|architecture|agency|portfolio|music|festival|zines?|clubs?|records|label|posters?|exhibitions?|streetwear|skate\w*|print\w*|type(?:face|foundry))\b/gi,
    dark: 0.35,
    hues: [28, 48, 255, 105, 145],
    lightHues: [28, 48, 255, 145],
    chroma: [0.18, 0.24],
    accentL: [[0.5, 0.62], [0.72, 0.86]],
    neutral: { hues: [null], chroma: [0, 0.004] },
    radius: [0, 0, 0],
    border: 2,
    shadow: 'offset',
    ratio: 1.5,
    base: 16,
    leading: 1.45,
    tracking: '0',
    upper: true,
    section: [96, 56],
    fonts: [
      ['Archivo Black', 'Archivo', 'Space Mono'],
      ['Big Shoulders Display', 'Barlow', 'IBM Plex Mono'],
      ['Familjen Grotesk', 'Familjen Grotesk', 'JetBrains Mono'],
      ['Darker Grotesque', 'Work Sans', 'Space Mono'],
      ['Anton', 'Inter Tight', 'DM Mono'],
    ],
    layouts: ['poster', 'manifesto', 'catalog', 'split'],
    signatures: ['big-number', 'accent-section', 'grid-lines', 'margin-numbers', 'mono-tags'],
    motion: { ms: 80, ease: 'linear', note: 'States switch almost instantly; hover inverts ink and background. The entrance cuts in step by step, without fades.' },
    names: ['Concrete', 'Rebar', 'Slab', 'Stencil', 'Bulletin', 'Plinth'],
    avoid: ['Soft shadows, rounded corners and pastel tints.', 'Grain or noise overlays that hide the type.'],
    voice: ['Write in fragments and imperatives: few words, set large, no hedging.', 'Labels are single nouns or verbs; numbers carry the argument.'],
  },
  luxe: {
    display: { max: 6.5, tracking: '-0.02em' },
    imagery: 'Wide margins, a thin double rule, small mono captions in uppercase and one large crop of the product or its material.',
    words: /\b(luxury|hotels?|resorts?|wines?|winery|jewel(?:ry|lery)|watch(?:es)?|perfumes?|fragrance|fashion|couture|spa|real estate|boutique|bespoke|tailor\w*|yachts?|champagne|interiors?)\b/gi,
    dark: 0.5,
    hues: [85, 160, 15, 245, 40],
    chroma: [0.06, 0.11],
    accentL: [[0.4, 0.5], [0.74, 0.82]],
    neutral: { hues: [75, null], chroma: [0.004, 0.012] },
    radius: [0, 0, 2],
    border: 1,
    shadow: 'none',
    ratio: 1.414,
    base: 16,
    leading: 1.65,
    tracking: '0',
    section: [144, 80],
    fonts: [
      ['Bodoni Moda', 'Jost', 'DM Mono'],
      ['Cormorant Garamond', 'Albert Sans', 'Fragment Mono'],
      ['Italiana', 'Manrope', 'DM Mono'],
      ['Gloock', 'Instrument Sans', 'Fragment Mono'],
      ['Instrument Serif', 'Hanken Grotesk', 'Azeret Mono'],
    ],
    layouts: ['manifesto', 'split', 'letter', 'poster'],
    signatures: ['hairlines', 'captions', 'pullquote', 'text-nav', 'margin-numbers'],
    motion: { ms: 320, ease: 'cubic-bezier(0.2, 0.7, 0.1, 1)', note: 'Slow crossfades for imagery; after the entrance, text never moves.' },
    names: ['Atelier', 'Velvet', 'Marble', 'Linen', 'Brass', 'Salon'],
    avoid: ['Gold gradients, foil textures and script fonts.', 'More than one accent per view.'],
    voice: ['Write sparingly: fewer sentences, no superlatives, no urgency.', 'Name materials, places and makers instead of piling up adjectives.'],
  },
  playful: {
    display: { max: 7.5, tracking: '-0.035em' },
    imagery: 'Stickers: pieces of the real UI rotated a few degrees with `--shadow`, and flat shapes cut from `--accent` and `--surface-2`.',
    words: /\b(kids?|children|games?|gaming|toys?|learn(?:ing)?|quiz\w*|social|party|parties|fun|dating|stickers?|creators?|memes?|camps?|schools?|students?)\b/gi,
    dark: 0.15,
    hues: [30, 85, 140, 230, 20, 0],
    lightHues: [30, 140, 230, 20, 0],
    chroma: [0.15, 0.21],
    accentL: [[0.55, 0.66], [0.74, 0.84]],
    neutral: { hues: [null, 90], chroma: [0.008, 0.02] },
    radius: [10, 16, 24],
    border: 2,
    shadow: 'offset',
    ratio: 1.333,
    base: 17,
    leading: 1.55,
    tracking: '-0.015em',
    section: [96, 56],
    fonts: [
      ['Bricolage Grotesque', 'Onest', 'Space Mono'],
      ['Syne', 'Manrope', 'Martian Mono'],
      ['Unbounded', 'Golos Text', 'JetBrains Mono'],
      ['Rubik', 'Rubik', 'DM Mono'],
      ['Young Serif', 'Figtree', 'Spline Sans Mono'],
    ],
    layouts: ['poster', 'catalog', 'split', 'specimen'],
    signatures: ['big-number', 'accent-section', 'mono-tags', 'pullquote', 'captions'],
    motion: { ms: 180, ease: 'cubic-bezier(0.34, 1.3, 0.64, 1)', note: 'A small overshoot on press, toggle and the entrance; nothing loops.' },
    names: ['Kite', 'Pogo', 'Confetti', 'Doodle', 'Jelly', 'Sprout'],
    avoid: ['Purple-to-pink gradients, 3D blobs and floating emoji.', 'Bounce on every element: motion marks interaction, not decoration.'],
    voice: ['Write like a friendly guide: second person, short sentences, active verbs.', 'Jokes belong in examples and empty states, never in errors or prices.'],
  },
  institutional: {
    display: { max: 4.5, tracking: '-0.025em' },
    imagery: 'A ruled-ledger texture (the hairlines of the table it replaces) and one stamp-style status mark (Paid, Matched, Filed) in `--accent` as the only ornament.',
    words: /\b(banks?|banking|financ\w*|fintech|accounting|accountants?|invoic\w*|tax(?:es)?|insurance|legal|law|health\w*|clinics?|hospitals?|medical|patients?|government|gov|civic|compliance|payroll|hr|enterprise|b2b|crm|erp|procurement|audits?|pensions?|loans?|mortgages?|bookkeeping)\b/gi,
    dark: 0.05,
    hues: [250, 190, 155, 235, 30],
    chroma: [0.08, 0.13],
    accentL: [[0.42, 0.5], [0.72, 0.8]],
    neutral: { hues: [240, null], chroma: [0.004, 0.01] },
    radius: [4, 6, 8],
    border: 1,
    shadow: 'soft',
    ratio: 1.25,
    base: 16,
    leading: 1.6,
    tracking: '-0.01em',
    section: [88, 56],
    fonts: [
      ['Familjen Grotesk', 'IBM Plex Sans', 'IBM Plex Mono'],
      ['Source Serif 4', 'Source Sans 3', 'Source Code Pro'],
      ['Gloock', 'Public Sans', 'IBM Plex Mono'],
      ['Archivo', 'Libre Franklin', 'DM Mono'],
      ['Newsreader', 'Atkinson Hyperlegible', 'IBM Plex Mono'],
    ],
    layouts: ['ledger', 'specimen', 'split', 'console', 'letter', 'manifesto'],
    signatures: ['footnotes', 'big-number', 'hairlines', 'text-nav', 'mono-tags'],
    motion: { ms: 150, ease: 'cubic-bezier(0.2, 0, 0, 1)', note: 'Apart from the entrance, motion only confirms an action.' },
    names: ['Charter', 'Harbor', 'Bastion', 'Registry', 'Almanac', 'Treasury'],
    avoid: ['Stock photos of handshakes and people pointing at screens.', 'Security or compliance badges without the certificate behind them.'],
    voice: ['Write like a careful advisor: plain words, exact figures, the consequence before the feature.', 'State fees, limits and dates outright; a "from" price always has the full price nearby.'],
  },
};

export const MOODS = Object.keys(MOOD);
const AI_BAND = [262, 335];
const STACK = { serif: 'Georgia, "Times New Roman", serif', sans: 'system-ui, sans-serif', mono: 'ui-monospace, Menlo, Consolas, monospace' };

// The mood whose keywords the brief mentions most, or null.
export function moodFor(brief = '') {
  let best = null;
  let most = 0;
  for (const [name, m] of Object.entries(MOOD)) {
    const n = (brief.match(m.words) ?? []).length;
    if (n > most) [best, most] = [name, n];
  }
  return best;
}

function palette(m, dark, rnd) {
  let hue = (rnd.pick((!dark && m.lightHues) || m.hues) + rnd.range([-8, 8]) + 360) % 360;
  if (hue >= AI_BAND[0] && hue <= AI_BAND[1]) hue = hue < 298 ? AI_BAND[0] - 8 : (AI_BAND[1] + 10) % 360;
  const nh = rnd.pick(m.neutral.hues) ?? hue;
  const tint = rnd.range(m.neutral.chroma);
  let bg, surface, surface2, line, ink, ink2;
  if (dark) {
    const L = rnd.range([0.15, 0.2]);
    bg = oklch(L, tint, nh);
    surface = oklch(L + 0.035, tint, nh);
    surface2 = oklch(L + 0.07, tint, nh);
    line = oklch(L + 0.15, tint, nh);
    ink = reach(oklch(rnd.range([0.92, 0.96]), tint * 0.6, nh), bg.hex, 12);
    ink2 = reach(oklch(0.7, tint, nh), surface2.hex, 4.6);
  } else {
    const L = rnd.range([0.962, 0.985]);
    bg = oklch(L, tint, nh);
    surface = oklch(Math.min(0.995, L + 0.015), tint * 0.5, nh);
    surface2 = oklch(L - 0.035, tint * 1.2, nh);
    line = oklch(L - 0.13, tint * 1.4, nh);
    ink = reach(oklch(rnd.range([0.18, 0.25]), tint * 1.6, nh), bg.hex, 12);
    ink2 = reach(oklch(0.55, tint * 1.6, nh), surface2.hex, 4.6);
  }
  let accent = reach(oklch(rnd.range(m.accentL[dark ? 1 : 0]), rnd.range(m.chroma), hue), bg.hex, 3);
  const pale = oklch(0.985, 0.012, hue);
  const deep = oklch(0.2, 0.03, hue);
  const onAccent = contrast(pale.hex, accent.hex) >= contrast(deep.hex, accent.hex) ? pale : deep;
  accent = reach(accent, onAccent.hex, 4.5);
  const status = (h) => reach(oklch(dark ? 0.78 : 0.52, 0.13, h), bg.hex, 4.5);
  return {
    bg, surface, 'surface-2': surface2, line, ink, 'ink-2': ink2,
    accent, 'accent-ink': reach(accent, bg.hex, 4.5), 'on-accent': onAccent,
    ok: status(150), warn: status(75), danger: status(27),
  };
}

function typeScale(m) {
  const size = (i) => (m.base / 16) * m.ratio ** i;
  const rem = (x) => `${+x.toFixed(3)}rem`;
  const fluid = (i) => `clamp(${rem(size(3))}, ${+(((size(i) * 16) / 1280) * 100).toFixed(2)}vw, ${rem(size(i))})`;
  // The first-screen headline: the mood's maximum at 1280px, scaling down to 2.5rem on phones.
  const display = `clamp(2.5rem, ${+(((m.display.max * 16) / 1280) * 100).toFixed(2)}vw, ${m.display.max}rem)`;
  return { '-1': rem(size(-1)), 0: rem(size(0)), 1: rem(size(1)), 2: rem(size(2)), 3: rem(size(3)), 4: fluid(4), 5: fluid(5), display };
}

function typefaces([display, text, mono]) {
  const stack = (f) => `"${f}", ${STACK[FONT[f].kind]}`;
  const weights = new Map();
  for (const f of [display, text, mono]) weights.set(f, [...new Set([...(weights.get(f) ?? []), ...FONT[f].w])].sort((a, b) => a - b));
  const href = `https://fonts.googleapis.com/css2?${[...weights].map(([f, w]) => `family=${f.replace(/ /g, '+')}:wght@${w.join(';')}`).join('&')}&display=swap`;
  const tw = FONT[text].w;
  return {
    display: { family: display, weight: Math.max(...FONT[display].w), stack: stack(display) },
    text: { family: text, weight: tw.includes(400) ? 400 : tw[0], strong: tw.find((w) => w >= 600) ?? Math.max(...tw), stack: stack(text) },
    mono: { family: mono, weight: FONT[mono].w[0], stack: stack(mono) },
    href,
  };
}

export function resolveMood(name) {
  const key = String(name).trim().toLowerCase();
  const found = MOODS.find((m) => m === key || m.startsWith(key));
  if (!found) throw Object.assign(new Error(`Unknown mood "${name}". Choose one of: ${MOODS.join(', ')}`), { usage: true });
  return found;
}

// seed: any text (project name by default). brief: one line about the product; its words
// steer the mood. mood and mode override the seeded choice.
export function generateStyle({ seed = 'sloplint', brief = '', mood, mode } = {}) {
  const moodName = mood ? resolveMood(mood) : moodFor(`${brief} ${seed.replace(/[-_.]+/g, " ")}`) ?? stream(`${seed}:mood`).pick(MOODS);
  if (mode && mode !== 'light' && mode !== 'dark') throw Object.assign(new Error(`--mode must be light or dark, got "${mode}"`), { usage: true });
  const m = MOOD[moodName];
  const rnd = (key) => stream(`${seed}:${moodName}:${key}`);
  const dark = mode ? mode === 'dark' : rnd('mode').chance(m.dark);
  const colors = palette(m, dark, rnd('color'));
  const layout = rnd('layout').pick(m.layouts);
  return {
    seed,
    brief,
    mood: moodName,
    mode: dark ? 'dark' : 'light',
    name: `${rnd('name').pick(m.names)} ${LAYOUTS[layout].name}`,
    fonts: typefaces(rnd('type').pick(m.fonts)),
    colors: Object.fromEntries(Object.entries(colors).map(([k, c]) => [k, c.hex])),
    type: { base: m.base, ratio: m.ratio, leading: m.leading, tracking: m.tracking, displayTracking: m.display.tracking, upper: Boolean(m.upper), steps: typeScale(m) },
    shape: { radius: m.radius, border: m.border, shadow: dark && m.shadow === 'soft' ? 'none' : m.shadow },
    space: { section: m.section },
    // One first-screen entrance, three state changes long, held between 400 and 700ms.
    motion: { ...m.motion, entrance: Math.min(700, Math.max(400, m.motion.ms * 3)) },
    imagery: m.imagery,
    layout: { key: layout, ...LAYOUTS[layout] },
    signatures: rnd('signature').take(m.signatures, 2).map((k) => SIGNATURES[k]),
    voice: m.voice,
    avoid: m.avoid,
  };
}

// ─── Rendering ───────────────────────────────────────────────────────────────

const ratio = (a, b) => `${contrast(a, b).toFixed(1)}:1`;

function shadowValue(style) {
  const { shadow } = style.shape;
  if (shadow === 'offset') return `${style.shape.border * 2}px ${style.shape.border * 2}px 0 var(--ink)`;
  if (shadow !== 'soft') return 'none';
  const [r, g, b] = rgbaOf(style.colors.ink);
  return `0 1px 2px rgb(${r} ${g} ${b} / 0.06), 0 8px 24px rgb(${r} ${g} ${b} / 0.06)`;
}

export function tokensCss(style) {
  const { colors, fonts, type, shape, motion } = style;
  const lines = [
    ...Object.entries(colors).map(([k, v]) => `  --${k}: ${v};`),
    `  --font-display: ${fonts.display.stack};`,
    `  --font-text: ${fonts.text.stack};`,
    `  --font-mono: ${fonts.mono.stack};`,
    ...Object.entries(type.steps).map(([k, v]) => `  --step-${k}: ${v};`),
    `  --tracking-display: ${type.displayTracking};`,
    `  --leading: ${type.leading};`,
    `  --measure: 62ch;`,
    `  --radius-sm: ${shape.radius[0]}px;`,
    `  --radius: ${shape.radius[1]}px;`,
    `  --radius-lg: ${shape.radius[2]}px;`,
    `  --border: ${shape.border}px;`,
    `  --shadow: ${shadowValue(style)};`,
    `  --duration: ${motion.ms}ms;`,
    `  --duration-entrance: ${motion.entrance}ms;`,
    `  --ease: ${motion.ease};`,
  ];
  return `@import url("${fonts.href}");\n\n:root {\n${lines.join('\n')}\n}`;
}

export function designDoc(style) {
  const { colors: c, fonts, type, shape, motion, layout } = style;
  const marker = JSON.stringify({ seed: style.seed, brief: style.brief || undefined, mood: style.mood, mode: style.mode }).replace(/--/g, '- -');
  const display = `${fonts.display.family} ${fonts.display.weight}`;
  return `<!-- sloplint:style ${marker} -->
# DESIGN.md: ${style.name}

${style.mood[0].toUpperCase()}${style.mood.slice(1)}, ${style.mode}. Generated by sloplint from the seed \`${style.seed}\`; \`npx @sloplint/cli init --seed "${style.seed}" --mood ${style.mood} --mode ${style.mode}\` rebuilds it. Every color, typeface, radius and duration comes from this file. When it is silent, choose the option that makes this page unlike other pages, within these tokens.

## Tokens

\`\`\`css
${tokensCss(style)}
\`\`\`

Contrast on \`--bg\`: ink ${ratio(c.ink, c.bg)}, ink-2 ${ratio(c['ink-2'], c.bg)}, accent-ink ${ratio(c['accent-ink'], c.bg)}. \`--on-accent\` on \`--accent\`: ${ratio(c['on-accent'], c.accent)}.

With Tailwind, expose the tokens to the theme (v4: \`@theme { --color-accent: var(--accent); }\`; v3: \`colors: { accent: 'var(--accent)' }\`) and write \`bg-accent\`, never palette classes such as \`bg-blue-600\`.

## Type

- Display: ${display}${type.upper ? ', uppercase' : ''}. The first-screen headline, one per page, is set at \`--step-display\` with line height ${type.upper ? 0.92 : 0.98} and \`--tracking-display\`. Other headings use steps 3 to 5, line height 1.05, letter-spacing ${type.tracking}. Headings never use the text face.
- Text: ${fonts.text.family} ${fonts.text.weight} at \`--step-0\` with line height ${type.leading}; ${fonts.text.strong} for emphasis; measure \`--measure\`.
- Mono: ${fonts.mono.family} for figures that change, code, captions and labels, always with \`font-variant-numeric: tabular-nums\`.
- Scale ratio ${type.ratio}: steps -1 to 5 plus \`--step-display\`. Steps 4, 5 and display are fluid; if the longest headline word still overflows at 375px, shorten the headline instead of shrinking it.

## Color

- \`--accent\` marks the primary action, the one highlighted figure per view and focus rings. Flat, never a gradient. Use \`--accent-ink\` when the accent is text.
- Color blocking: at least one full-bleed section per page is a solid field, either \`--accent\` with \`--on-accent\` text (${ratio(c['on-accent'], c.accent)}) or inverted \`--ink\` with \`--bg\` text (${ratio(c.bg, c.ink)}). Buttons inside a field use a \`--bg\` fill with \`--ink\` text. The first screen and the closing call to action are the usual places.
- Elsewhere, depth comes from \`--surface\` and \`--surface-2\` steps and \`--border\` lines in \`--line\`. Shadow: \`--shadow\`.
- \`--ok\`, \`--warn\` and \`--danger\` mean status and nothing else.

## Layout: ${layout.name}

- First screen: ${layout.first} It must hold at 1280px and at 375px, and the page should be recognizable from it as a thumbnail. A heading, a paragraph and two buttons on an empty background is the generic answer; do not ship it.
${layout.lines.map((l) => `- ${l}`).join('\n')}
${style.signatures.map((s) => `- Signature: ${s}`).join('\n')}
- Grid: 12 columns, 24px gutters, content max 1200px. Sections ${style.space.section[0]}px apart, ${style.space.section[1]}px under 640px.
- At 375px nothing scrolls sideways: below 768px grids become one column (\`grid-template-columns: minmax(0, 1fr)\`; spanning all 12 still leaves 11 gutters), navigation wraps or collapses, and tables scroll inside their own \`overflow-x: auto\` wrapper.

## Components

- Buttons: 40px tall, 16px side padding, \`--radius\`, label is verb + object. Primary: \`--accent\` fill with \`--on-accent\` text. Secondary: \`--border\` in \`--line\`, \`--ink\` text.
- Inputs: 40px tall, \`--surface\` fill, \`--border\` in \`--line\`, a visible label above and the error below in \`--danger\`.
- Tables: hairline rows, right-aligned mono figures, inside an \`overflow-x: auto\` wrapper.
- Nested corners: inner radius = outer radius minus the padding between them (\`--radius-lg\` outside, \`--radius-sm\` inside).

## Voice

${style.voice.map((v) => `- ${v}`).join('\n')}
- Buttons and links name the action ("Send invoice", not "Submit"); headings and buttons start with words, never emoji.
- Every figure, customer count or certification has a source next to it. No real figure yet: leave the claim out.

## Imagery

- The hero visual is the real product, built in HTML and CSS with plausible, labeled data: the screen, table, receipt or object people will use. No stock photos, 3D blobs or illustrated people.
- Ornament: ${style.imagery}
- Ornaments and visuals that bleed off an edge sit inside a section with \`overflow: clip\`, so they never widen the page at 375px.

## Motion

- ${motion.ms}ms with \`--ease\` for hover, focus and state changes. Name the properties; never \`transition: all\`.
- One orchestrated entrance on the first screen only: ${motion.entrance}ms in all (\`--duration-entrance\`), staggered by meaning (headline, then the product, then the action), opacity and transform only. Nothing below the fold animates on scroll. Under \`prefers-reduced-motion: reduce\` everything appears at once.
- ${motion.note} Respect \`prefers-reduced-motion\`.

## Avoid

- Purple or indigo gradients, glows and gradient text.
- Three equal cards that each open with an icon; emoji used as icons or heading decoration.
- Colors and typefaces that are not in this file.
- Invented figures, customer logos, testimonials and certifications. Use real ones with a source, or leave the slot out.
${style.avoid.map((a) => `- ${a}`).join('\n')}
`;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);

// A standalone specimen page: swatches with contrast, the type scale and core components.
export function specimenHtml(style) {
  const { colors: c, fonts, type } = style;
  // Each swatch shows the pairing that matters for it: ink on a surface, a foreground on --bg.
  const pairing = (name, hex) => {
    if (name === 'bg' || name.startsWith('surface')) return `ink ${ratio(c.ink, hex)}`;
    if (name === 'accent' || name === 'on-accent') return `on-accent ${ratio(c['on-accent'], c.accent)}`;
    return `on bg ${ratio(hex, c.bg)}`;
  };
  const swatch = ([name, hex]) => `<figure class="swatch"><div class="chip" style="background: var(--${name})"></div><figcaption><b>--${name}</b><span>${hex}</span><span>${pairing(name, hex)}</span></figcaption></figure>`;
  const samples = [
    [5, 'Clear first.'],
    [4, 'Every figure has a source.'],
    [3, 'Read it once, trust it after.'],
    [2, 'Settings that explain themselves'],
    [1, 'Twelve rows, one decision'],
  ];
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(style.name)} specimen</title>
<style>
${tokensCss(style)}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: ${fonts.text.weight} var(--step-0)/var(--leading) var(--font-text); }
main { max-width: 1120px; margin: 0 auto; padding: 48px 24px 96px; }
h1, .display { font-family: var(--font-display); font-weight: ${fonts.display.weight}; line-height: 1.05; letter-spacing: ${type.tracking};${type.upper ? ' text-transform: uppercase;' : ''} margin: 0; }
h1 { font-size: var(--step-display); letter-spacing: var(--tracking-display); line-height: ${type.upper ? 0.92 : 0.98}; }
.field { background: var(--accent); color: var(--on-accent); }
.field div { max-width: 1120px; margin: 0 auto; padding: 72px 24px 56px; }
.lede { max-width: var(--measure); margin: 24px 0 0; }
section { border-top: var(--border) solid var(--line); padding: 32px 0; display: grid; grid-template-columns: 180px minmax(0, 1fr); gap: 24px; }
h2 { font: 500 var(--step--1)/1.4 var(--font-mono); color: var(--ink-2); margin: 0; }
.swatches { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
.swatch { margin: 0; background: var(--surface); }
.chip { height: 56px; border: var(--border) solid var(--line); }
figcaption { display: grid; padding: 8px 0; font: 400 var(--step--1)/1.5 var(--font-mono); font-variant-numeric: tabular-nums; }
figcaption span { color: var(--ink-2); }
.scale p { margin: 0 0 12px; }
.body { max-width: var(--measure); margin: 0; }
.row { display: flex; flex-wrap: wrap; gap: 12px; align-items: end; }
.btn { height: 40px; padding: 0 16px; border-radius: var(--radius); border: var(--border) solid var(--line); background: var(--surface); color: var(--ink); font: ${fonts.text.strong} var(--step-0)/1 var(--font-text); box-shadow: var(--shadow); transition: background-color var(--duration) var(--ease), border-color var(--duration) var(--ease); }
.btn.primary { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
label { display: grid; gap: 6px; font-size: var(--step--1); color: var(--ink-2); }
input { height: 40px; width: 240px; max-width: 100%; padding: 0 12px; border-radius: var(--radius); border: var(--border) solid var(--line); background: var(--surface); color: var(--ink); font: inherit; }
.table { overflow-x: auto; margin-top: 24px; }
table { border-collapse: collapse; min-width: 420px; width: 100%; font-variant-numeric: tabular-nums; }
th, td { text-align: left; padding: 10px 12px 10px 0; border-bottom: 1px solid var(--line); }
th { font: 500 var(--step--1)/1.4 var(--font-mono); color: var(--ink-2); }
td.num, th.num { text-align: right; font-family: var(--font-mono); }
.tag { font: 400 var(--step--1)/1 var(--font-mono); border: 1px solid var(--line); padding: 4px 6px; border-radius: var(--radius-sm); }
.tag.due { color: var(--danger); }
ul { margin: 12px 0 0; padding-left: 20px; max-width: var(--measure); }
@media (max-width: 640px) { section { grid-template-columns: minmax(0, 1fr); } }
</style>
</head>
<body>
<header class="field">
  <div>
    <h1>${esc(style.name)}</h1>
    <p class="lede">${esc(style.mood)}, ${esc(style.mode)}. ${esc(fonts.display.family)}, ${esc(fonts.text.family)} and ${esc(fonts.mono.family)}. Seed: ${esc(style.seed)}.</p>
  </div>
</header>
<main>
  <section>
    <h2>Type</h2>
    <div class="scale">
      ${samples.map(([step, text]) => `<p class="display" style="font-size: var(--step-${step})">${text}</p>`).join('\n      ')}
      <p class="body">Body text sits at a comfortable measure with generous leading, so a paragraph like this one reads as easily on a phone as on a wide monitor.</p>
    </div>
  </section>
  <section>
    <h2>Components</h2>
    <div>
      <div class="row">
        <button class="btn primary" type="button">Send invoice</button>
        <button class="btn" type="button">Save draft</button>
        <label>Client email<input type="email" value="ines@harbourstudio.co"></label>
      </div>
      <div class="table">
        <table>
          <thead><tr><th>Item</th><th>Status</th><th class="num">Amount</th></tr></thead>
          <tbody>
            <tr><td>Studio rent</td><td><span class="tag">Paid</span></td><td class="num">1,240.00</td></tr>
            <tr><td>Lens rental</td><td><span class="tag">Due 18 Oct</span></td><td class="num">310.50</td></tr>
            <tr><td>Insurance</td><td><span class="tag due">Overdue</span></td><td class="num">96.20</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
  <section>
    <h2>Color</h2>
    <div class="swatches">${Object.entries(c).map(swatch).join('')}</div>
  </section>
  <section>
    <h2>Layout</h2>
    <div>
      <p class="body"><b>${esc(style.layout.name)}.</b> ${esc([style.layout.first, ...style.layout.lines].join(' ').replace(/`/g, ''))}</p>
      <ul>${style.signatures.map((s) => `<li>${esc(s.replace(/`/g, ''))}</li>`).join('')}</ul>
    </div>
  </section>
  <section>
    <h2>Motion</h2>
    <p class="body">${style.motion.ms}ms, ${esc(style.motion.ease)}; one ${style.motion.entrance}ms first-screen entrance. ${esc(style.motion.note)}</p>
  </section>
</main>
</body>
</html>
`;
}

// ─── Reading a DESIGN.md back ────────────────────────────────────────────────

const GENERIC = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'emoji', 'math', 'fangsong', 'inherit', 'initial', 'unset', 'revert', 'revert-layer']);
export const isGenericFont = (name) => GENERIC.has(name.toLowerCase()) || /^var\(/i.test(name);

// Palette and typefaces from the :root block of a DESIGN.md, or null when it has none.
export function parseDesign(text) {
  const root = /:root\s*\{([^}]*)\}/.exec(text ?? '');
  if (!root) return null;
  const colors = [];
  const fonts = new Set();
  for (const [, name, value] of root[1].matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    for (const lit of value.match(/#[0-9a-f]{3,8}\b/gi) ?? []) {
      const rgba = rgbaOf(lit);
      if (rgba) colors.push({ name, hex: lit.toLowerCase(), rgb: rgba.slice(0, 3) });
    }
    if (/^font/.test(name)) {
      for (const part of value.split(',')) {
        const family = part.trim().replace(/^["']|["']$/g, '');
        if (family && !isGenericFont(family)) fonts.add(family);
      }
    }
  }
  return colors.length || fonts.size ? { colors, fonts: [...fonts] } : null;
}
