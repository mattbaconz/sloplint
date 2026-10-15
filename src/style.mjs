// Just enough style resolution for static checks: colors, Tailwind utilities and
// same-file CSS classes folded into one "box" per element.

const NAMED = {
  purple: '#800080', violet: '#ee82ee', indigo: '#4b0082', fuchsia: '#ff00ff', magenta: '#ff00ff',
  blueviolet: '#8a2be2', darkviolet: '#9400d3', darkorchid: '#9932cc', mediumorchid: '#ba55d3',
  mediumpurple: '#9370db', rebeccapurple: '#663399', slateblue: '#6a5acd', mediumslateblue: '#7b68ee',
  orchid: '#da70d6', gray: '#808080', grey: '#808080', darkgray: '#a9a9a9', darkgrey: '#a9a9a9',
  dimgray: '#696969', dimgrey: '#696969', slategray: '#708090', slategrey: '#708090',
  lightslategray: '#778899', silver: '#c0c0c0', black: '#000000', white: '#ffffff',
};

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: h * 60, s, l };
}

const COLOR = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch)\([^)]*\)|\b[a-z]+\b/gi;

export function parseColor(token) {
  const t = token.trim().toLowerCase();
  if (NAMED[t]) return parseColor(NAMED[t]);
  if (t[0] === '#') {
    let hex = t.slice(1);
    if (hex.length === 3 || hex.length === 4) hex = [...hex.slice(0, 3)].map((c) => c + c).join('');
    if (hex.length !== 6 && hex.length !== 8) return null;
    const n = parseInt(hex.slice(0, 6), 16);
    return rgbToHsl((n >> 16) & 255, (n >> 8) & 255, n & 255);
  }
  const fn = /^(rgba?|hsla?|oklch)\(([^)]*)\)$/.exec(t);
  if (!fn) return null;
  const parts = fn[2].split(/[\s,/]+/).filter(Boolean).map((p) => parseFloat(p));
  if (parts.length < 3 || parts.slice(0, 3).some(Number.isNaN)) return null;
  if (fn[1].startsWith('rgb')) {
    const pct = fn[2].includes('%');
    const [r, g, b] = parts.map((v) => (pct ? v * 2.55 : v));
    return rgbToHsl(r, g, b);
  }
  if (fn[1].startsWith('hsl')) return { h: parts[0], s: parts[1] / 100, l: parts[2] / 100 };
  // oklch: classify on chroma/hue directly; lightness 0..1 or %.
  const L = fn[2].includes('%') ? parts[0] / 100 : parts[0];
  return { h: parts[2], s: Math.min(1, parts[1] / 0.25), l: L, oklch: true };
}

export function colorsIn(value) {
  return [...value.matchAll(COLOR)].map((m) => parseColor(m[0])).filter(Boolean);
}

// The "AI purple": indigo through fuchsia, saturated, mid lightness.
export function isNeonPurple(c) {
  if (!c) return false;
  if (c.oklch) return c.s >= 0.45 && c.h >= 265 && c.h <= 335 && c.l >= 0.35 && c.l <= 0.85;
  return c.h >= 235 && c.h <= 320 && c.s >= 0.45 && c.l >= 0.3 && c.l <= 0.8;
}

export function isMutedGray(c) {
  return Boolean(c) && !c.oklch && c.s <= 0.22 && c.l >= 0.35 && c.l <= 0.75;
}

export function toPx(token) {
  if (!token) return null;
  const t = token.trim().toLowerCase();
  if (t === '0') return 0;
  const m = /^(-?\d*\.?\d+)(px|rem|em)$/.exec(t);
  if (!m) return null;
  const v = parseFloat(m[1]);
  return m[2] === 'px' ? v : v * 16;
}

const TW_RADIUS = { none: 0, xs: 2, sm: 2, '': 4, md: 6, lg: 8, xl: 12, '2xl': 16, '3xl': 24, '4xl': 32, full: Infinity };
export const TW_RADIUS_TOKENS = Object.entries(TW_RADIUS).filter(([k, v]) => v !== Infinity && k !== 'xs');

export function twSpacing(v) {
  if (v === 'px') return 1;
  if (v === '0') return 0;
  if (/^\d+(\.5)?$/.test(v)) return parseFloat(v) * 4;
  const arb = /^\[(.+)\]$/.exec(v);
  return arb ? toPx(arb[1]) : null;
}

function twRadius(v) {
  if (v in TW_RADIUS) return TW_RADIUS[v];
  const arb = /^\[(.+)\]$/.exec(v);
  if (!arb) return null;
  const px = toPx(arb[1]);
  return px != null && px >= 500 ? Infinity : px;
}

const PURPLE_FAMILY = /^(indigo|violet|purple|fuchsia)-\d{2,3}(\/\d+)?$/;

export function twNeonStop(cls) {
  const base = cls.slice(cls.lastIndexOf(':') + 1);
  const m = /^(from|via|to|shadow|drop-shadow)-(.+)$/.exec(base);
  if (!m) return null;
  const arb = /^\[(.+)\]$/.exec(m[2]);
  if (PURPLE_FAMILY.test(m[2]) || (arb && isNeonPurple(parseColor(arb[1])))) return m[1];
  return null;
}

// Tailwind classes -> partial box. Structural props only read unprefixed utilities
// (variants like md:/hover: describe other states).
export function twBox(classes) {
  const b = {};
  let padX;
  let padY;
  let pad;
  for (const raw of classes) {
    const c = raw.slice(raw.lastIndexOf(':') + 1).replace(/^!/, '');
    if (c === 'grid-cols-3') b.grid3 = true;
    if (raw.includes(':')) continue;
    let m;
    if ((m = /^rounded(?:-(none|xs|sm|md|lg|xl|2xl|3xl|4xl|full|\[[^\]]+\]))?$/.exec(c))) {
      const r = twRadius(m[1] ?? '');
      if (r != null) { b.radius = r; b.radiusClass = raw; }
    } else if ((m = /^p([xy]?)-(.+)$/.exec(c))) {
      const v = twSpacing(m[2]);
      if (v != null) {
        if (m[1] === 'x') padX = v;
        else if (m[1] === 'y') padY = v;
        else pad = v;
      }
    } else if (/^(border(-[0248])?|border-\[\d[^\]]*\]|ring(-[1248])?)$/.test(c)) b.border = true;
    else if ((m = /^size-(.+)$/.exec(c))) b.w = b.h = twSpacing(m[1]);
    else if ((m = /^w-(.+)$/.exec(c))) b.w = twSpacing(m[1]);
    else if ((m = /^h-(.+)$/.exec(c))) b.h = twSpacing(m[1]);
    else if (/^text-(gray|slate|zinc|neutral|stone)-(300|400|500|600)$|^text-muted(-foreground)?$/.test(c)) b.muted = true;
    else if (c === 'tabular-nums') b.tabular = true;
    else if (/^(absolute|fixed)$/.test(c)) b.overlay = true;
    else if (/^overflow(-x)?-(auto|scroll|hidden|clip)$/.test(c)) b.scroll = true;
  }
  if (padX != null || padY != null) b.pad = Math.min(padX ?? pad ?? Infinity, padY ?? pad ?? Infinity);
  else if (pad != null) b.pad = pad;
  return b;
}

const isVar = (v) => /var\(|calc\(|env\(/.test(v);

export function cssBox(decls) {
  const b = {};
  for (const d of decls) {
    const v = d.value.replace(/!important/i, '').trim();
    switch (d.prop) {
      case 'border-radius': {
        if (isVar(v)) break;
        const first = v.split(/\s+/)[0];
        if (/^(50|100)%$/.test(first)) b.radius = Infinity;
        else {
          const px = toPx(first);
          if (px != null) b.radius = px >= 500 ? Infinity : px;
        }
        b.radiusDecl = d;
        break;
      }
      case 'padding': {
        if (isVar(v)) break;
        const vals = v.split(/\s+/).slice(0, 2).map(toPx);
        if (vals.every((x) => x != null)) b.pad = Math.min(...vals);
        break;
      }
      case 'border':
      case 'outline':
        if (!/^(none|0|0px)\b/.test(v)) b.border = true;
        break;
      case 'border-width':
        if (toPx(v.split(/\s+/)[0]) > 0) b.border = true;
        break;
      case 'color':
        if (isMutedGray(parseColor(v))) b.muted = true;
        break;
      case 'font-variant-numeric':
        if (/tabular-nums/.test(v)) b.tabular = true;
        break;
      case 'font-feature-settings':
        if (/tnum/.test(v)) b.tabular = true;
        break;
      case 'grid-template-columns':
        if (/^repeat\(\s*3\s*,/.test(v) || /^(\S+)\s+\1\s+\1$/.test(v)) b.grid3 = true;
        break;
      case 'width': b.w = toPx(v); break;
      case 'height': b.h = toPx(v); break;
      case 'position':
        if (/^(absolute|fixed)$/.test(v)) b.overlay = true;
        break;
      case 'overflow':
      case 'overflow-x':
        if (/^(auto|scroll|hidden|clip)\b/.test(v)) b.scroll = true;
        break;
      default:
    }
  }
  return b;
}

// Class list from class/className/:class, including string literals inside expressions.
export function classAttr(el) {
  return el.attrs.className ?? el.attrs.class ?? el.attrs[':class'] ?? null;
}

export function classList(el) {
  const a = classAttr(el);
  if (!a) return [];
  const text = a.expr ? [...a.value.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)].map((m) => m[2]).join(' ') : a.value;
  return text.split(/\s+/).filter(Boolean);
}

// Selectors that resolve statically: compounds of tag, classes and id joined by descendant or
// child combinators. Pseudo-classes, attribute and sibling selectors are skipped.
function compileSelector(sel) {
  const chain = [];
  let comb = ' ';
  for (const part of sel.replace(/\s*>\s*/g, ' > ').trim().split(/\s+/)) {
    if (part === '>') { comb = '>'; continue; }
    const m = /^([a-z][\w-]*|\*)?((?:[.#][\w-]+)*)$/i.exec(part);
    if (!m || !part) return null;
    chain.push({ comb, tag: m[1] && m[1] !== '*' ? m[1].toLowerCase() : null, id: /#([\w-]+)/.exec(m[2])?.[1], classes: [...m[2].matchAll(/\.([\w-]+)/g)].map((x) => x[1]) });
    comb = ' ';
  }
  return chain.length ? chain : null;
}

const isElement = (n) => n && n.name !== '#root';

function matchChain(chain, i, el) {
  const c = chain[i];
  if (c.tag && c.tag !== el.name.toLowerCase()) return false;
  if (c.id && el.attrs?.id?.value !== c.id) return false;
  if (c.classes.length && !c.classes.every((x) => classList(el).includes(x))) return false;
  if (i === 0) return true;
  if (c.comb === '>') return isElement(el.parent) && matchChain(chain, i - 1, el.parent);
  for (let p = el.parent; isElement(p); p = p.parent) if (matchChain(chain, i - 1, p)) return true;
  return false;
}

export function matchesSelector(sel, el) {
  const chain = compileSelector(sel);
  return Boolean(chain) && matchChain(chain, chain.length - 1, el);
}

// Does a @media or @container prelude hold on a screen `width` px wide? Features other than width count as holding.
export function holdsAt(prelude, width) {
  if (!/^@(media|container)\b/i.test(prelude)) return true;
  return prelude.replace(/^@\w+/, '').split(',').some((q) => {
    if (/\bprint\b/i.test(q) && !/\bscreen\b/i.test(q)) return false;
    for (const m of q.matchAll(/\(\s*(?:(min|max)-width\s*:|width\s*([<>])=?)\s*([\d.]+)(px|r?em)\s*\)/gi)) {
      const px = parseFloat(m[3]) * (m[4].toLowerCase() === 'px' ? 1 : 16);
      const min = m[1] ? m[1].toLowerCase() === 'min' : m[2] === '>';
      if (min ? width < px : width > px) return false;
    }
    return true;
  });
}

// Narrowest a grid-template-columns value can get: column count and minimum width in px, or null when unknowable.
export function gridMin(value, gap) {
  let v = value.replace(/\[[^\]]*\]/g, ' ').trim();
  if (/var\(|subgrid|masonry|^none$/i.test(v)) return null;
  // auto-fit and auto-fill drop to one repetition on a narrow screen.
  v = v.replace(/repeat\(\s*(auto-fit|auto-fill|\d+)\s*,\s*((?:[^()]|\([^()]*\))*)\)/gi, (_, n, inner) => (/^auto/i.test(n) ? inner : Array(Number(n)).fill(inner).join(' ')));
  const tracks = v.match(/[\w-]+\((?:[^()]|\([^()]*\))*\)|[^\s()]+/g) ?? [];
  const min = (t) => toPx(/^minmax\(/i.test(t) ? t.slice(7).split(',')[0] : t) ?? 0;
  return { n: tracks.length, width: tracks.reduce((sum, t) => sum + min(t), 0) + Math.max(0, tracks.length - 1) * gap };
}

// CSS rules -> (element -> its declarations in cascade order: specificity, then source order).
export function cssMatcher(rules) {
  const index = new Map();
  let order = 0;
  for (const r of rules) {
    for (const sel of r.selector.split(',')) {
      const chain = compileSelector(sel);
      order++;
      if (!chain) continue;
      const last = chain[chain.length - 1];
      const key = last.classes.length ? `.${last.classes[0]}` : last.id ? `#${last.id}` : last.tag ?? '*';
      const spec = chain.reduce((n, c) => n + (c.id ? 10000 : 0) + c.classes.length * 100 + (c.tag ? 1 : 0), 0);
      index.set(key, [...(index.get(key) ?? []), { chain, spec, order, decls: r.decls }]);
    }
  }
  return (el) => {
    const id = el.attrs?.id?.value;
    const keys = [el.name.toLowerCase(), '*', ...classList(el).map((c) => `.${c}`), ...(id ? [`#${id}`] : [])];
    return [...new Set(keys.flatMap((k) => index.get(k) ?? []))]
      .filter((s) => matchChain(s.chain, s.chain.length - 1, el))
      .sort((a, b) => a.spec - b.spec || a.order - b.order)
      .flatMap((s) => s.decls);
  };
}

export function merge(...boxes) {
  return Object.assign({}, ...boxes);
}
