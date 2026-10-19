// The rule catalog. Each rule is deterministic: same text + path in, same findings out.
// check(ctx) returns [{ start, end, message?, fix?, severity? }] with absolute offsets.

import { matchPair, callArgs } from './lex.mjs';
import { colorsIn, isNeonPurple, twNeonStop, TW_RADIUS_TOKENS, classAttr, classList, cssBox, toPx, twSpacing, gridMin, holdsAt, matchesSelector } from './style.mjs';
import { rgbaOf, isGenericFont } from './design.mjs';

export const DOMAINS = {
  UI: 'UI/UX & Motion',
  SEC: 'Security',
  BE: 'Backend & Architecture',
  COPY: 'UX Writing',
  TEST: 'Testing & DX',
  MOTION: 'Motion Video',
};

const SCRIPT = ['js', 'jsx', 'html', 'vue', 'py'];
const MARKUP = ['jsx', 'html', 'vue'];
const STYLED = ['jsx', 'html', 'vue', 'css', 'js'];
const COPY = ['jsx', 'html', 'vue', 'js', 'py', 'md'];

const hit = (start, end, message, extra = {}) => ({ start, end, message, ...extra });
const firstLineEnd = (text, start, end) => {
  const nl = text.indexOf('\n', start);
  return nl < 0 || nl > end ? end : nl;
};

function descendants(el) {
  const out = [];
  const walk = (e) => { for (const c of e.children) { out.push(c); walk(c); } };
  walk(el);
  return out;
}

function nextSibling(el) {
  const sibs = el.parent?.children ?? [];
  return sibs[sibs.indexOf(el) + 1] ?? null;
}

function ownRaw(ctx, el) {
  return el.text.map((t) => ctx.text.slice(t.start, t.end)).join(' ');
}

function stripBraces(s) {
  let out = '';
  let depth = 0;
  for (const c of s) {
    if (c === '{') depth++;
    else if (c === '}') depth = Math.max(0, depth - 1);
    else if (!depth) out += c;
  }
  return out;
}

function textContent(ctx, el) {
  const inner = ctx.text.slice(el.openEnd, el.closeStart ?? el.openEnd).replace(/<[^>]*>/g, ' ');
  return stripBraces(inner).replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

// Splits a masked block into top-level statements on ';' and newlines.
function statements(body) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const c of body) {
    if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) depth--;
    if (depth === 0 && (c === ';' || c === '\n')) {
      if (cur.trim()) out.push(cur.trim());
      cur = '';
    } else cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

// Start of the statement containing offset i: walks back over balanced (), [] and {} so
// `const r = await fetch(url, { ... }).catch(...)` is one statement, not three.
function statementStart(code, i) {
  let depth = 0;
  for (let j = i - 1; j >= 0; j--) {
    const c = code[j];
    if (c === ')' || c === ']' || (c === '}' && depth > 0)) depth++;
    else if (c === '(' || c === '[' || c === '{') {
      if (depth === 0) return j + 1;
      depth--;
    } else if (depth === 0 && (c === ';' || c === '}')) return j + 1;
  }
  return 0;
}

function statementEnd(code, i) {
  let depth = 0;
  for (let j = i; j < code.length; j++) {
    const c = code[j];
    if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) { if (--depth < 0) return j; }
    else if (depth === 0 && (c === ';' || c === '\n')) return j;
  }
  return code.length;
}

// Frame span of an interpolate() input range: `[10, 30]` -> 20, `[d, d + 15]` -> 15.
function rangeSpan(src) {
  const m = /^\[([^,\]]+),([^,\]]+)\]$/.exec(src);
  if (!m) return null;
  const num = /^-?\d+(?:\.\d+)?$/;
  if (num.test(m[1]) && num.test(m[2])) return Number(m[2]) - Number(m[1]);
  const plus = m[2].split('+');
  return plus.length === 2 && plus[0] === m[1] && num.test(plus[1]) ? Number(plus[1]) : null;
}

// Python: body lines of the block whose header sits on line `k` (masked code).
function pyBlock(ctx, k) {
  const lines = ctx.lines;
  const head = lines[k];
  const indent = /^\s*/.exec(head.text)[0].length;
  const inline = head.text.slice(head.text.indexOf(':') + 1).trim();
  if (inline) return [{ ...head, text: inline }];
  const body = [];
  for (let j = k + 1; j < lines.length; j++) {
    const t = lines[j].text;
    if (!t.trim()) continue;
    if (/^\s*/.exec(t)[0].length <= indent) break;
    body.push(lines[j]);
  }
  return body;
}

const nearestRadiusClass = (px) => {
  const [name] = TW_RADIUS_TOKENS.reduce((best, cur) => (Math.abs(cur[1] - px) < Math.abs(best[1] - px) ? cur : best));
  return name === '' ? 'rounded' : `rounded-${name}`;
};

function classTokenAt(el, cls) {
  const a = classAttr(el);
  if (!a) return null;
  const esc = cls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`(^|[\\s'"\`])(${esc})(?=[\\s'"\`]|$)`).exec(a.value);
  return m ? a.start + m.index + m[1].length : null;
}

function blurOf(value) {
  const plain = value.replace(/\b(?:rgba?|hsla?|oklch)\([^)]*\)|#[0-9a-f]{3,8}\b/gi, ' ');
  let max = 0;
  for (const part of plain.split(',')) {
    const nums = [...part.matchAll(/(-?\d*\.?\d+)(px|rem|em)?/g)];
    if (nums[2]) max = Math.max(max, parseFloat(nums[2][1]) * (nums[2][2] && nums[2][2] !== 'px' ? 16 : 1));
  }
  return max;
}

const SENSITIVE = /(SECRET|PASSWORD|PASSWD|TOKEN|API_?KEY|PRIVATE|SALT|CREDENTIAL|JWT|SIGNING|ENCRYPT|SESSION_KEY|COOKIE_KEY|DATABASE_URL|DB_PASS)/i;
const PUBLIC_ENV = /^(NEXT_PUBLIC|VITE|PUBLIC|REACT_APP|EXPO_PUBLIC|NUXT_PUBLIC)_/;
const sensitive = (name) => SENSITIVE.test(name) && !PUBLIC_ENV.test(name);
const SQL = /^\s*(?:select\s[\s\S]*?\bfrom\b|insert\s+into\b|update\s+[\w."`]+\s+set\b|delete\s+from\b|with\s+\w+\s+as\s*\()/i;
const ALLOWLIST = "(process.env.CORS_ORIGINS ?? '').split(',')";
const SAFE_HTML = /^\s*(?:(?:esc|escape\w*|sanitize\w*|DOMPurify\.sanitize|purify\w*|encode\w*)\s*\(|[\w$.]*\.(?:length|size)\s*$|\d+\s*$)/;
const unsafeExpr = (src) => !SAFE_HTML.test(src) && !/\.toFixed\(/.test(src);
// A decoy hash compared when the user is unknown keeps login timing constant; it is a defence, not mock data.
const DECOY = /hash|digest/i;
const TRANSITION_PROPS = ['color', 'background-color', 'border-color', 'opacity', 'transform'];

// Body range of the function whose parameter list, `async` or arrow starts at `from` (masked code).
function functionBody(code, from) {
  let i = from;
  const bare = /^\s*(?:async\s+)?[\w$]+\s*=>/.exec(code.slice(i));
  if (bare) i += bare[0].length;
  else {
    const paren = code.indexOf('(', i);
    const close = paren < 0 ? -1 : matchPair(code, paren, '(', ')', false);
    if (close < 0) return null;
    i = close + 1;
  }
  const rest = /^\s*(=>)?\s*/.exec(code.slice(i));
  const arrow = Boolean(bare || rest[1]);
  i += rest[0].length;
  if (code[i] === '{') {
    const close = matchPair(code, i, '{', '}', false);
    return close > i ? { start: i + 1, end: close } : null;
  }
  return arrow ? { start: i, end: statementEnd(code, i) } : null;
}

// The handler a submit binding points at: an inline function, `name`, `this.name` or
// react-hook-form's `handleSubmit(name)`. Returns the body range or null.
function handlerBody(ctx, expr, at) {
  const code = ctx.code;
  if (/\bfunction\b|=>/.test(expr)) {
    const lead = /^\s*(?:async\s+(?=function))?(?:function\s*[\w$]*\s*)?/.exec(expr)[0].length;
    return functionBody(code, at + lead);
  }
  const name = (/^\s*[\w$.]+\s*\(\s*([\w$]+)\s*\)\s*$/.exec(expr) ?? /([\w$]+)\s*$/.exec(expr))?.[1];
  if (!name) return null;
  const n = name.replace(/\$/g, '\$');
  const def = new RegExp(String.raw`\bfunction\s+${n}\s*(?=\()|\b(?:const|let|var)\s+${n}\s*=\s*(?:useCallback\s*\(\s*)?(?:async\s*)?(?:function\b\s*)?|(?:^|[\s,;{])(?:async\s+)?${n}\s*(?=\([^()]*\)\s*\{)`, 'm').exec(code);
  return def ? functionBody(code, def.index + def[0].length) : null;
}

const LOCAL_CALL = /^(?:set[A-Z][\w$]*|(?:[\w$]+\.)*(?:preventDefault|stopPropagation|stopImmediatePropagation|classList\.(?:add|remove|toggle|replace)|querySelector(?:All)?|getElementById|closest|focus|blur|reset|setAttribute|removeAttribute|toggleAttribute|scrollIntoView|get|getAll|has|trim|toLowerCase|toUpperCase|includes|test|match|replace|split|join|map|filter|forEach|some|every|log|info|warn|error|debug)|setTimeout|clearTimeout|requestAnimationFrame|alert|toast(?:\.[\w$]+)?|FormData|Object\.(?:fromEntries|entries|keys|values)|String|Number|Boolean|parseInt|parseFloat|Promise|resolve|[a-z]|if|for|while|switch|catch|return|function|new|typeof|await)$/;
const SUCCESS_SETTER = /\bset(?:Is)?(?:Submitted|Success(?:ful)?|Sent|Done|Subscribed|Joined|Completed?|SignedUp|Registered|Confirmed|ThankYou|Thanks|Finished|Status|State|Message)\s*\(\s*(?!false\b|null\b|''|"")/;
const SUCCESS_WORDS = /thank|success|subscribed|welcome|you'?re (?:in|on the list|all set)|received|confirmed|provisioned|signed up|registered|on its way|check your (?:inbox|email)|we'?ll be in touch|(?:request|message) sent|all set/i;
const SHOWS = /\b(?:textContent|innerText|innerHTML|alert|toast|classList|hidden|display|navigate|location|replaceWith|insertAdjacent\w*)\b/;

// Inline-code offsets that hold a Tailwind palette color class (bg-blue-600, text-gray-500/80).
const TW_PALETTE = /(?:^|:)(?:bg|text|border(?:-[trblxyse])?|ring(?:-offset)?|from|via|to|fill|stroke|shadow|outline|decoration|divide|placeholder|accent|caret)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}(?:\/\d+)?$/;
const COLOR_LITERAL = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch)\([^)]*\)/gi;
const COLOR_ATTRS = ['fill', 'stroke', 'color', 'stop-color', 'stopColor', 'bgcolor', 'background'];

function onPalette(design, rgba) {
  if (!rgba) return true;
  const [r, g, b, a] = rgba;
  if (a < 1 && ((r < 8 && g < 8 && b < 8) || (r > 247 && g > 247 && b > 247))) return true; // shadows and scrims
  return design.colors.some((c) => Math.max(Math.abs(c.rgb[0] - r), Math.abs(c.rgb[1] - g), Math.abs(c.rgb[2] - b)) <= 3);
}

function nearestToken(design, rgba) {
  const d = (c) => (c.rgb[0] - rgba[0]) ** 2 + (c.rgb[1] - rgba[1]) ** 2 + (c.rgb[2] - rgba[2]) ** 2;
  return design.colors.reduce((best, c) => (d(c) < d(best) ? c : best));
}

const PROOF_COUNT = String.raw`\d[\d,.]*\s*(?:k|m|million|thousand|billion)?`;
const PROOF_WHO = String.raw`(?:happy\s+|active\s+|paying\s+)?(?:teams|companies|customers|clients|businesses|users|developers|engineers|brands|organi[sz]ations|creators|founders|agencies|startups|enterprises|merchants|banks|clinics|stores|shops|freelancers|professionals|accountants|marketers|designers|members|subscribers|readers|students|schools|hospitals|restaurants)`;
const PROOF = new RegExp([
  String.raw`\b${PROOF_COUNT}\+\s+${PROOF_WHO}\b`,
  String.raw`\b(?:trusted|used|loved|chosen|relied on)\s+by\s+(?:over\s+|more than\s+)?${PROOF_COUNT}\+?(?:\s+${PROOF_WHO})?`,
  String.raw`\bjoin(?:ed by)?\s+(?:over\s+|more than\s+)?${PROOF_COUNT}\+?\s+${PROOF_WHO}\b`,
  String.raw`\b[3-5]\.\d\s*(?:\/\s*5|out of 5)\b|\brated\s+[3-5](?:\.\d)?\s*(?:\/\s*5|out of 5|stars?)`,
  String.raw`★{4,5}`,
  String.raw`\b\d{2,3}(?:\.\d+)?\s?%\s+(?:uptime|accuracy|availability|satisfaction|retention|match rate|first[- ]pass\w*|on[- ]time|of (?:teams|customers|users))\b`,
  String.raw`\b\d+(?:\.\d+)?\s?[x×]\s+(?:faster|more|cheaper|quicker|better|higher|lower|less|roi)\b`,
  String.raw`\b\d{1,3}\s?%\s+(?:faster|cheaper|quicker|more (?:revenue|conversions|leads|sales|productive)|less time|fewer (?:errors|bugs|tickets))`,
  String.raw`\bsav(?:e|es|ed|ing)\s+(?:up to\s+|over\s+|an average of\s+)?\d+\+?\s+(?:hours|hrs|minutes|days)\b`,
  String.raw`\bSOC\s?2(?:\s+Type\s+(?:II|I|1|2))?\b|\bISO\s?27001\b|\bHIPAA[- ]compliant\b|\bPCI[- ]DSS\b|\bGDPR[- ]compliant\b|\bFedRAMP\b`,
].join('|'), 'gi');
// A footnote, citation or external link right next to the claim counts as its source; a CTA does not.
const SOURCED = /<sup\b|<cite\b|<a\s[^>]*href=["']https?:|\[\^?\d+\]|\]\(https?:|†|‡|\bsource:|\baccording to\b|\bas of (?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|q[1-4]|\d{4})/i;
// Random avatar and photo services: what fills an image slot when nobody has the real picture.
const PLACEHOLDER_IMAGE = /(?:https?:)?\/\/((?:i\.)?pravatar\.cc|via\.placeholder\.com|placehold\.(?:co|it)|picsum\.photos|randomuser\.me|dummyimage\.com|placekitten\.com|loremflickr\.com|source\.unsplash\.com|fakeimg\.pl|placeimg\.com)\b[^\s"'`)<>]*/gi;
// Leading emoji, plus the sparkle dingbats (✦ ✧ ✶ …) that generated badges use the same way.
const EMOJI_LEAD = /^(?:\p{Emoji_Presentation}|\p{Extended_Pictographic}️|[✦✧✶✷✸✹✺❋])(?:️|‍(?:\p{Emoji_Presentation}|\p{Extended_Pictographic})️?|[\u{1F3FB}-\u{1F3FF}])*\s*/u;

export const RULES = [
  // ───────────────────────────── UI/UX & Motion ─────────────────────────────
  {
    id: 'UI-001',
    slug: 'neon-gradient',
    severity: 'warn',
    weight: 4,
    title: 'Purple/indigo gradient or glow used as the default accent',
    rationale:
      'Indigo-to-fuchsia gradients and purple glows are the most recognisable signature of generated UI: models reach for them because a decade of startup marketing did. They carry no brand meaning, fight with data colors, and fail contrast once text sits on top.',
    fix: 'Pick one brand hue from DESIGN.md and use it flat. If a surface needs depth, use a two-stop tonal shift inside that one hue.',
    sample: 'html',
    langs: STYLED,
    check(ctx) {
      const out = [];
      for (const d of ctx.cssDecls) {
        // Gradient-ness comes from the declaration itself, so `background: var(--grad)` is left to --grad's own
        // definition; colors and blur come through custom properties, so `0 8px 24px var(--brand)` is a glow.
        const gradient = /gradient\(/i.test(d.value);
        if (!gradient && !/^(box-shadow|text-shadow|filter)$/.test(d.prop)) continue;
        const value = ctx.resolveVars(d.value);
        if (!colorsIn(value).some(isNeonPurple)) continue;
        if (gradient) out.push(hit(d.start, d.end, 'Purple/indigo gradient: the stock AI accent'));
        else if (blurOf(value) >= 16) out.push(hit(d.start, d.end, 'Neon purple glow shadow'));
      }
      for (const s of ctx.classStrings) {
        const tokens = [...s.text.matchAll(/\S+/g)];
        const gradient = tokens.some((t) => /(^|:)bg-(gradient-to|linear-to|radial|conic)/.test(t[0]));
        const bad = tokens.find((t) => {
          const kind = twNeonStop(t[0]);
          return kind && (kind.includes('shadow') || gradient);
        });
        if (bad) {
          const start = s.start + bad.index;
          out.push(hit(start, start + bad[0].length, gradient ? 'Tailwind purple/indigo gradient stop' : 'Tailwind purple glow shadow'));
        }
      }
      return out;
    },
  },
  {
    id: 'UI-002',
    slug: 'icon-circle-grid',
    severity: 'warn',
    weight: 4,
    title: 'Symmetrical 3-column grid of icon-badge feature cards',
    rationale:
      'Three equal cards, each opening with an icon or emoji in a tinted circle or tile, is the template answer to "show some features". It flattens priority (every feature looks equally important) and readers skip it because they have seen it on every generated landing page.',
    fix: 'Rank the features. Lead with one in depth (screenshot, real numbers), then list the rest compactly. Drop decorative icon badges; use real product imagery or nothing.',
    sample: 'html',
    langs: MARKUP,
    check(ctx) {
      const out = [];
      const icon = (el) => el.children.some((c) => /^(svg|i|img)$|Icon$/.test(c.name)) || /^\p{Extended_Pictographic}/u.test(stripBraces(ownRaw(ctx, el)).trim());
      // A circle, or a small rounded square tile holding an icon or emoji: the same template, newer styling.
      const circle = (el) => {
        const b = ctx.box(el);
        if (b.radius === Infinity) return (b.w != null && b.w === b.h) || icon(el);
        return b.radius > 0 && b.w != null && b.w === b.h && b.w <= 72 && icon(el);
      };
      // The circle has to open the card. An avatar in a testimonial's footer is not the feature-grid pattern.
      const leads = (card) => {
        for (let e = card.children[0], depth = 0; e && depth < 4; e = e.children[0], depth++) if (circle(e)) return true;
        return false;
      };
      for (const el of ctx.markup.elements) {
        if (!ctx.box(el).grid3) continue;
        const cards = el.children.filter(leads);
        const mapped = /\.map\(/.test(ctx.text.slice(el.openEnd, el.closeStart ?? el.end)) && el.children.some(leads);
        if (cards.length >= 3 || mapped) out.push(hit(el.start, el.openEnd, `3-column grid of icon-badge cards${cards.length >= 3 ? ` (${cards.length} cards)` : ''}`));
      }
      return out;
    },
  },
  {
    id: 'UI-003',
    slug: 'redundant-subtitle',
    severity: 'warn',
    weight: 2,
    title: 'Muted gray subtitle under nearly every heading',
    rationale:
      'A gray sentence restating the heading under every section doubles reading cost and halves contrast. Generated layouts apply it mechanically, so the page reads as heading, echo, heading, echo.',
    fix: 'Write headings that stand alone. Keep a supporting line only where it adds a fact the heading cannot carry, and set it in body color.',
    sample: 'html',
    langs: MARKUP,
    check(ctx) {
      const heads = ctx.markup.elements.filter((e) => /^h[1-6]$/i.test(e.name));
      const pairs = heads.filter((h) => {
        const sib = nextSibling(h);
        return sib && /^(p|span|div|small)$/i.test(sib.name) && ctx.box(sib).muted;
      });
      if (pairs.length < 3 || pairs.length < heads.length * 0.6) return [];
      const first = nextSibling(pairs[0]);
      return [hit(first.start, first.openEnd, `${pairs.length} of ${heads.length} headings are followed by a muted subtitle`)];
    },
  },
  {
    id: 'UI-004',
    slug: 'border-soup',
    severity: 'warn',
    weight: 3,
    title: 'Box-in-box border soup',
    rationale:
      'Three or more nested bordered containers draw a line around every group, so nothing reads as a group. It is the visual equivalent of over-indented code and usually means spacing was never designed.',
    fix: 'Keep one border at the outermost surface. Separate inner groups with spacing, a background step, or a single divider.',
    sample: 'html',
    langs: MARKUP,
    check(ctx) {
      const out = [];
      const skip = /^(input|textarea|select|button|img|hr|option)$/i;
      const bordered = (el) => !skip.test(el.name) && ctx.box(el).border;
      const seen = new Set();
      for (const el of ctx.markup.elements) {
        if (!bordered(el)) continue;
        const chain = [el];
        for (let p = el.parent; p && p.name !== '#root'; p = p.parent) if (bordered(p)) chain.push(p);
        const outer = chain[chain.length - 1];
        if (chain.length >= 3 && !seen.has(outer)) {
          seen.add(outer);
          out.push(hit(el.start, el.openEnd, `${chain.length} nested bordered boxes`));
        }
      }
      return out;
    },
  },
  {
    id: 'UI-005',
    slug: 'missing-tabular-nums',
    severity: 'warn',
    weight: 2,
    title: 'Numbers in tables or stats render with proportional digits',
    rationale:
      'Proportional digits have different widths, so columns of figures do not align and live counters jitter as values change. Tabular figures are one CSS property away.',
    fix: 'Add `font-variant-numeric: tabular-nums` (Tailwind `tabular-nums`) to tables, stat values, prices and any number that updates.',
    sample: 'html',
    langs: STYLED,
    check(ctx) {
      const tabDecl = (d) => (d.prop === 'font-variant-numeric' && /tabular-nums/.test(d.value)) || (d.prop === 'font-feature-settings' && /tnum/.test(d.value));
      const NUM_CLASS = /(^|[-_\s])(price|amount|total|count|stat|stats|metric|balance|score|kpi|qty|quantity)([-_\s]|$)/i;
      if (ctx.lang === 'css') {
        if (ctx.cssDecls.some(tabDecl)) return [];
        const r = ctx.cssRules.find((x) => NUM_CLASS.test(x.selector.split(/[\s>+~]+/).pop()));
        return r ? [hit(r.start, r.selEnd, 'Numeric style without tabular-nums')] : [];
      }
      if (!ctx.markup) return [];
      const tabRules = ctx.cssRules.filter((r) => r.decls.some(tabDecl));
      const global = tabRules.some((r) => /(^|,)\s*(html|body|:root|\*)\s*(,|$)/.test(r.selector));
      const table = tabRules.some((r) => /\b(table|td|th)\b/.test(r.selector));
      const NUM_TEXT = /^[-+−]?[$€£¥]?\s?\d[\d,.]*\s?(%|[kmb]|ms|x)?$/i;
      const NUM_EXPR = /toFixed\(|toLocaleString\(|NumberFormat|format(?:Number|Currency|Price|Amount|Percent)\(/;
      const numeric = (el) => {
        const raw = ownRaw(ctx, el);
        if (NUM_EXPR.test(raw)) return true;
        const cell = /^t[dh]$/i.test(el.name);
        if (!cell && !NUM_CLASS.test(classList(el).join(' '))) return false;
        const visible = stripBraces(raw).trim();
        return (NUM_TEXT.test(visible) && /\d.*\d/.test(visible)) || /\{[^}]*\b(count|total|price|amount|balance|score|sum)\b/i.test(raw);
      };
      const covered = (el) => {
        if (global || (table && /^t[dh]$/i.test(el.name))) return true;
        for (let p = el; p && p.name !== '#root'; p = p.parent) if (ctx.box(p).tabular) return true;
        return false;
      };
      const bad = ctx.markup.elements.filter((el) => numeric(el) && !covered(el));
      return bad.length >= 2 ? [hit(bad[0].start, bad[0].openEnd, `${bad.length} numeric values render without tabular-nums`)] : [];
    },
  },
  {
    id: 'UI-006',
    slug: 'nonconcentric-radius',
    severity: 'warn',
    weight: 2,
    title: 'Nested border radius is not concentric',
    rationale:
      'When a rounded element sits inside a rounded, padded parent, the inner radius must be the outer radius minus the gap, or the corners pinch. Generated code reuses one radius token everywhere, so nested cards look slightly wrong.',
    fix: 'Inner radius = outer radius − padding − border width, clamped at 0. In CSS: `border-radius: calc(var(--radius) - var(--pad))`.',
    sample: 'html',
    langs: STYLED,
    check(ctx) {
      const out = [];
      // Corners only interact when the gap is smaller than the outer radius. Pills (>= 99px) are a shape, not a nested corner.
      const bad = (r, R, gap) => R > 0 && R !== Infinity && gap > 0 && gap < R && r > 0 && r < 99 && r > Math.max(0, R - gap) + 2;
      const msg = (r, R, gap) => `Inner radius ${r}px inside ${R}px with ${gap}px gap; concentric is ${Math.max(0, R - gap)}px`;
      if (ctx.markup) {
        for (const el of ctx.markup.elements) {
          const b = ctx.box(el);
          let gap = 0;
          let p = el.parent;
          while (p && p.name !== '#root' && ctx.box(p).radius == null) { gap += ctx.box(p).pad ?? 0; p = p.parent; }
          if (!p || p.name === '#root') continue;
          const pb = ctx.box(p);
          gap += pb.pad ?? 0;
          if (!bad(b.radius, pb.radius, gap)) continue;
          const expected = Math.max(0, pb.radius - gap);
          const at = b.radiusClass ? classTokenAt(el, b.radiusClass) : null;
          if (at != null) {
            const prefix = b.radiusClass.slice(0, b.radiusClass.lastIndexOf(':') + 1);
            out.push(hit(at, at + b.radiusClass.length, msg(b.radius, pb.radius, gap), { fix: { start: at, end: at + b.radiusClass.length, text: prefix + nearestRadiusClass(expected) } }));
          } else if (b.radiusDecl) {
            const d = b.radiusDecl;
            out.push(hit(d.start, d.end, msg(b.radius, pb.radius, gap), { fix: { start: d.valueStart, end: d.end, text: `${expected}px` } }));
          }
        }
      }
      if (ctx.lang === 'css') {
        const bySel = new Map();
        for (const r of ctx.cssRules) bySel.set(r.selector, [...(bySel.get(r.selector) ?? []), ...r.decls]);
        for (const r of ctx.cssRules) {
          const parts = r.selector.split(/\s*>\s*|\s+/);
          if (parts.length < 2 || r.selector.includes(',')) continue;
          const parentSel = r.selector.slice(0, r.selector.lastIndexOf(parts[parts.length - 1])).replace(/[\s>]+$/, '');
          const parent = bySel.get(parentSel);
          if (!parent) continue;
          const pb = cssBox(parent);
          const b = cssBox(r.decls);
          const gap = pb.pad ?? 0;
          if (!b.radiusDecl || !bad(b.radius, pb.radius, gap)) continue;
          const d = b.radiusDecl;
          out.push(hit(d.start, d.end, msg(b.radius, pb.radius, gap), { fix: { start: d.valueStart, end: d.end, text: `${Math.max(0, pb.radius - gap)}px` } }));
        }
      }
      return out;
    },
  },
  {
    id: 'UI-007',
    slug: 'transition-all',
    severity: 'warn',
    weight: 3,
    title: 'Transition on every property',
    rationale:
      'Animating every property makes the browser watch layout properties too: width, padding and font-size changes animate by accident, and hover states lag. It also hides intent; nobody can tell which change the motion was for.',
    fix: 'Name what moves: `transition: opacity 150ms ease-out, transform 150ms ease-out`, or Tailwind `transition-colors` / `transition-transform`.',
    sample: 'css',
    langs: STYLED,
    check(ctx) {
      const out = [];
      for (const s of ctx.classStrings) {
        for (const m of s.text.matchAll(/(^|\s)((?:[\w-]+:)*)transition-all(?=\s|$)/g)) {
          const start = s.start + m.index + m[1].length;
          const end = start + m[2].length + 'transition-all'.length;
          out.push(hit(start, end, 'Tailwind transition-all', { fix: { start, end, text: `${m[2]}transition` } }));
        }
        for (const m of s.text.matchAll(/transition\s*:\s*all\b/g)) out.push(hit(s.start + m.index, s.start + m.index + m[0].length, 'CSS-in-JS transition on every property'));
      }
      for (const d of ctx.cssDecls) {
        if (d.prop === 'transition-property' && /^all\b/.test(d.value)) {
          out.push(hit(d.start, d.end, 'transition-property covers every property', { fix: { start: d.valueStart, end: d.end, text: TRANSITION_PROPS.join(', ') } }));
        } else if (d.prop === 'transition') {
          const items = d.value.split(/,(?![^(]*\))/).map((x) => x.trim());
          const implicit = (x) => /^all\b/.test(x) || /^[\d.]+m?s\b/.test(x);
          if (items.length === 1 && implicit(items[0]) && !/^(none|0s?)$/.test(items[0])) {
            const rest = items[0].replace(/^all\s*/, '');
            out.push(hit(d.start, d.end, 'transition covers every property', { fix: { start: d.valueStart, end: d.end, text: TRANSITION_PROPS.map((p) => `${p} ${rest}`).join(', ') } }));
          } else if (items.some((x) => /^all\b/.test(x))) out.push(hit(d.start, d.end, 'transition list includes every property'));
        }
      }
      if (ctx.code && ctx.lang !== 'css' && ctx.lang !== 'py') {
        for (const m of ctx.text.matchAll(/\btransition\s*:\s*(['"`])all\b/g)) if (ctx.isCode(m.index)) out.push(hit(m.index, m.index + m[0].length, 'Inline style transitions every property'));
      }
      return out;
    },
  },
  {
    id: 'UI-008',
    slug: 'layout-shift-spinner',
    severity: 'warn',
    weight: 3,
    title: 'Spinner swaps out content and shifts layout',
    rationale:
      'Replacing a label or a whole view with a spinner changes its size twice: once when loading starts and again when it ends. Buttons jump, content below reflows, and clicks land on the wrong target.',
    fix: 'Keep the box: overlay the spinner on the existing label (`absolute` + `invisible` text), or render a skeleton with the final dimensions. Mark the region `aria-busy`.',
    sample: 'tsx',
    langs: MARKUP,
    check(ctx) {
      const out = [];
      const NAME = /(^|\.)(?:\w*Spinner\w*|Loader\w*|Loading\w*|CircularProgress|Spin|\w+Loader)$/;
      const isSpinner = (el) => NAME.test(el.name) || classList(el).some((c) => /(^|:)animate-spin$/.test(c));
      const src = ctx.lang === 'jsx' ? ctx.code : ctx.text;
      for (const el of ctx.markup.elements) {
        if (!isSpinner(el) || (el.parent && el.parent.name !== '#root' && isSpinner(el.parent))) continue;
        if (ctx.box(el).overlay || (el.parent?.attrs && ctx.box(el.parent).overlay)) continue;
        const before = src.slice(Math.max(0, el.start - 200), el.start);
        let message = null;
        if (/[?:]\s*\(?\s*$/.test(before)) message = 'Spinner replaces content in a ternary; size changes on load';
        else if (/&&\s*\(?\s*$/.test(before)) message = 'Spinner inserted conditionally; content below reflows';
        else if (/\breturn\s*\(?\s*$/.test(before) && /\bif\s*\([^)]*(load|pending|fetching|busy|submitting)/i.test(before)) message = 'Early-return spinner swaps the whole layout';
        else if (Object.keys(el.attrs).some((a) => /^(v-if|v-else-if|v-show)$/.test(a))) message = 'Spinner toggled with v-if; size changes on load';
        else if (/\{[#:](?:if|else)[^}]*\}\s*$/.test(before)) message = 'Spinner swapped by an {#if} block; size changes on load';
        if (message) out.push(hit(el.start, el.openEnd, message));
      }
      return out;
    },
  },
  {
    id: 'UI-009',
    slug: 'gradient-text',
    severity: 'warn',
    weight: 2,
    title: 'Gradient-filled headline text',
    rationale:
      'Clipping a gradient into text is the second most common generated-UI tell after purple backgrounds. It lowers contrast on half the glyphs, breaks in forced-colors mode, and dates the page instantly.',
    fix: 'Set headlines in solid text color. Create emphasis with weight, size or a single accent-colored word.',
    sample: 'html',
    langs: STYLED,
    check(ctx) {
      const out = [];
      for (const s of ctx.classStrings) {
        const t = s.text;
        const clip = /(^|\s)((?:[\w-]+:)*bg-clip-text)(?=\s|$)/.exec(t);
        if (clip && /(^|\s)(?:[\w-]+:)*text-transparent(?=\s|$)/.test(t) && /(^|\s)(?:[\w-]+:)*(bg-(gradient|linear|radial|conic)|from-)/.test(t)) {
          const start = s.start + clip.index + clip[1].length;
          out.push(hit(start, start + clip[2].length, 'Gradient clipped into text'));
        }
      }
      for (const r of ctx.cssRules) {
        const has = (prop, re) => r.decls.some((d) => d.prop === prop && re.test(d.value));
        const clip = has('background-clip', /^text/) || has('-webkit-background-clip', /^text/);
        const transparent = has('color', /^transparent/) || has('-webkit-text-fill-color', /^transparent/);
        const gradient = has('background', /gradient\(/) || has('background-image', /gradient\(/);
        if (clip && transparent && gradient) out.push(hit(r.start, r.selEnd, 'Gradient clipped into text'));
      }
      return out;
    },
  },

  {
    id: 'UI-010',
    slug: 'fake-success',
    severity: 'error',
    weight: 5,
    title: 'Form shows success without sending anything',
    rationale:
      'Generated forms often end in preventDefault, a short timeout and a thank-you message. The visitor believes they signed up, booked or paid, but nothing left the browser. It looks like a working feature in review and silently drops every submission in production.',
    fix: 'Send the data first (fetch to a real endpoint, a server action, or the form\'s own action) and show success only after a successful response. On failure, keep the input and say what went wrong.',
    sample: 'tsx',
    langs: ['js', 'jsx', 'html', 'vue'],
    when: (ctx) => !ctx.isTest && !ctx.isFixture,
    check(ctx) {
      const out = [];
      const bindings = [];
      for (const el of ctx.markup?.elements ?? []) {
        for (const name of ['onSubmit', 'onsubmit', '@submit', '@submit.prevent', 'v-on:submit', 'v-on:submit.prevent']) {
          const a = el.attrs[name];
          if (a?.value.trim()) bindings.push({ at: a.start, end: a.end, expr: a.value, raw: !a.expr && ctx.lang === 'html' });
        }
      }
      for (const m of ctx.text.matchAll(/\b(?:addEventListener\s*\(\s*(['"`])submit\1\s*,|\.onsubmit\s*=)\s*/g)) {
        if (!ctx.isCode(m.index)) continue;
        const at = m.index + m[0].length;
        bindings.push({ at, end: at, from: m.index, expr: ctx.code.slice(at, statementEnd(ctx.code, at)), raw: false });
      }
      for (const b of bindings) {
        const body = b.raw ? { start: b.at, end: b.end } : handlerBody(ctx, b.expr, b.at);
        if (!body) continue;
        const raw = ctx.text.slice(body.start, body.end);
        const masked = b.raw ? raw : ctx.code.slice(body.start, body.end);
        if (!SUCCESS_SETTER.test(masked) && !(SUCCESS_WORDS.test(raw) && SHOWS.test(masked))) continue;
        if ([...masked.matchAll(/([\w$][\w$.]*)\s*\(/g)].some((m) => !LOCAL_CALL.test(m[1]))) continue;
        const start = b.from ?? b.at;
        const message = /\bsetTimeout\s*\(/.test(masked) ? 'Fake delay, then success: nothing is sent' : 'Shows success without sending anything';
        out.push(hit(start, firstLineEnd(ctx.text, start, Math.max(b.end, b.at + 1)), message));
      }
      return out;
    },
  },
  {
    id: 'UI-011',
    slug: 'off-palette-color',
    severity: 'warn',
    weight: 3,
    title: 'Color outside the DESIGN.md palette',
    rationale:
      'With the design system out of sight, agents reach for framework defaults: Tailwind blue-600 and gray-500, the charting library purple, a hex that is almost the brand color. Each stray value is small; together they are why generated pages look generic, and why a rebrand turns into a search through every file.',
    fix: 'Use the token (`var(--accent)`, or `bg-accent` once the Tailwind theme maps it). If the system needs a new color, add it to DESIGN.md first.',
    sample: 'css',
    langs: STYLED,
    design: true,
    when: (ctx) => Boolean(ctx.design?.colors.length) && !ctx.isTest && !ctx.isFixture,
    check(ctx) {
      const out = [];
      const seen = new Set();
      const report = (start, end, key, message) => {
        if (seen.has(key.toLowerCase())) return;
        seen.add(key.toLowerCase());
        out.push(hit(start, end, message));
      };
      const literal = (start, lit) => {
        const rgba = rgbaOf(lit);
        if (onPalette(ctx.design, rgba)) return;
        const near = nearestToken(ctx.design, rgba);
        report(start, start + lit.length, lit, `Off-palette color ${lit}; the nearest token is --${near.name} (${near.hex})`);
      };
      for (const d of ctx.cssDecls) {
        for (const m of ctx.text.slice(d.valueStart, d.end).matchAll(COLOR_LITERAL)) literal(d.valueStart + m.index, m[0]);
      }
      for (const s of ctx.classStrings) {
        for (const t of s.text.matchAll(/\S+/g)) {
          const start = s.start + t.index;
          if (TW_PALETTE.test(t[0])) {
            report(start, start + t[0].length, t[0].replace(/^.*:/, ''), `Tailwind palette class ${t[0]} bypasses the DESIGN.md tokens`);
            continue;
          }
          const arb = /-\[(#[0-9a-f]{3,8}|(?:rgba?|hsla?|oklch)\([^\]]*\))\]/i.exec(t[0]);
          if (arb) literal(start + arb.index + 2, arb[1]);
        }
      }
      if (ctx.lang !== 'css') {
        for (const s of ctx.strings) {
          const m = /^\s*(#[0-9a-f]{3,8}|(?:rgba?|hsla?|oklch)\([^)]*\))\s*$/i.exec(s.value);
          if (m) literal(s.start + 1 + s.value.indexOf(m[1]), m[1]);
        }
        for (const el of ctx.markup?.elements ?? []) {
          for (const name of COLOR_ATTRS) {
            const a = el.attrs[name];
            if (a && !a.expr) for (const m of a.value.matchAll(COLOR_LITERAL)) literal(a.start + m.index, m[0]);
          }
        }
      }
      return out;
    },
  },
  {
    id: 'UI-012',
    slug: 'off-system-font',
    severity: 'warn',
    weight: 3,
    title: 'Typeface outside the DESIGN.md type system',
    rationale:
      'Inter, Roboto and the system stack are what a page gets when nobody chose a typeface. Generated code imports them by reflex even in a project that has a type system, and the page snaps back to the look of every other generated page.',
    fix: 'Use the DESIGN.md faces through their tokens (`font-family: var(--font-text)`). To change the type system, change DESIGN.md first.',
    sample: 'css',
    langs: STYLED,
    design: true,
    when: (ctx) => Boolean(ctx.design?.fonts.length) && !ctx.isTest && !ctx.isFixture,
    check(ctx) {
      const out = [];
      const seen = new Set();
      const allowed = new Set(ctx.design.fonts.map((f) => f.toLowerCase()));
      const report = (name, start, end) => {
        const key = name.toLowerCase();
        if (!name || isGenericFont(name) || allowed.has(key) || seen.has(key)) return;
        seen.add(key);
        out.push(hit(start, end, `Typeface "${name}" is not in DESIGN.md (${ctx.design.fonts.slice(0, 3).join(', ')})`));
      };
      // The first family in a list is the one that renders; the rest are fallbacks.
      const first = (start, list) => {
        const raw = list.split(',')[0];
        const name = raw.trim().replace(/^["']|["']$/g, '').trim();
        const at = start + raw.indexOf(name);
        report(name, at, at + name.length);
      };
      for (const d of ctx.cssDecls) {
        const value = ctx.text.slice(d.valueStart, d.end);
        if (d.prop === 'font-family') first(d.valueStart, value);
        else if (d.prop === 'font') {
          const m = /(?:^|\s)[\d.]+(?:px|r?em|%|pt)(?:\s*\/\s*[\w.%-]+)?\s+(\S.*)$/.exec(value);
          if (m) first(d.valueStart + m.index + m[0].length - m[1].length, m[1]);
        }
      }
      for (const m of ctx.text.matchAll(/fonts\.googleapis\.com\/css2?\?[^"'\s)<>]*/g)) {
        for (const f of m[0].matchAll(/family=([^:&;]+)/g)) {
          const start = m.index + f.index + 7;
          report(decodeURIComponent(f[1]).replace(/\+/g, ' '), start, start + f[1].length);
        }
      }
      for (const m of ctx.text.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]next\/font\/google['"]/g)) {
        if (!ctx.isCode(m.index)) continue;
        for (const n of m[1].matchAll(/[A-Z]\w*/g)) {
          const start = m.index + m[0].indexOf(m[1]) + n.index;
          report(n[0].replace(/_/g, ' '), start, start + n[0].length);
        }
      }
      for (const s of ctx.classStrings) {
        for (const t of s.text.matchAll(/(?:^|[\s:])font-\[['"]?([^\]'"]+)['"]?\]/g)) {
          // `family-name:` is Tailwind's type hint; a var() is the DESIGN.md token itself, and a number is a weight.
          const value = t[1].replace(/^family-name:/, '');
          if (/^(var\(|\d)/.test(value)) continue;
          const start = s.start + t.index + t[0].indexOf(value);
          report(value.replace(/_/g, ' ').split(',')[0].trim(), start, start + value.length);
        }
      }
      if (ctx.lang !== 'css') {
        for (const s of ctx.strings) {
          if (/\bfontFamily\s*:\s*(?:\{[^{}]*?[\w$'"]+\s*:\s*)?\[?\s*$/.test(ctx.code.slice(Math.max(0, s.start - 80), s.start))) first(s.start + 1, s.value);
        }
      }
      return out;
    },
  },
  {
    id: 'UI-013',
    slug: 'dead-link',
    severity: 'warn',
    weight: 2,
    title: 'Link that goes nowhere',
    rationale:
      'Generated pages fill navigation, footers and pricing cards with `href="#"`: Privacy, Careers, Twitter, Get started. Each one jumps the visitor to the top of the page or does nothing, which reads as an unfinished product, and an anchor that runs a script is announced to screen readers as a link.',
    fix: 'Link to the real page, or leave the link out until the page exists. An action that is not navigation is a `<button>`.',
    sample: 'html',
    langs: MARKUP,
    when: (ctx) => !ctx.isTest && !ctx.isFixture,
    check(ctx) {
      const out = [];
      for (const el of ctx.markup.elements) {
        if (el.name.toLowerCase() !== 'a' && !/Link$/.test(el.name)) continue;
        const href = el.attrs.href ?? el.attrs.to;
        if (!href || href.expr || !/^(#|javascript:.*)?$/i.test(href.value.trim())) continue;
        // A logo linking to "#" returns to the top of a one-page site, which is where it promises to go.
        const names = ['class', 'className', 'id', 'aria-label'].map((name) => el.attrs[name]?.value ?? '').join(' ');
        if (href.value.trim() === '#' && /\b(logo|brand|home|wordmark)\b/i.test(names)) continue;
        const handled = ['onClick', 'onclick', '@click', 'v-on:click'].some((name) => el.attrs[name]);
        out.push(hit(el.start, el.openEnd, handled ? `Link used as a button (href="${href.value.trim()}"); use <button>` : `Link to nowhere (href="${href.value.trim()}")`));
      }
      return out;
    },
  },
  {
    id: 'UI-014',
    slug: 'grid-too-wide',
    severity: 'warn',
    weight: 3,
    title: 'Grid cannot fit a 375px screen',
    rationale:
      'Children that span all twelve columns still sit in a twelve-column grid with eleven gaps, and fixed-minimum tracks keep their minimum. Generated layouts stack the children on phones and leave the grid alone, so the whole page scrolls sideways.',
    fix: 'Collapse the grid on small screens: `grid-template-columns: minmax(0, 1fr)` below 768px (Tailwind `grid-cols-1 md:grid-cols-12`), or let it wrap with `repeat(auto-fit, minmax(min(16rem, 100%), 1fr))`.',
    sample: 'css',
    langs: STYLED,
    check(ctx) {
      // ponytail: assumes 16px page gutters on a 375px phone; the real container width is unknown statically.
      const PHONE = 375;
      const ROOM = PHONE - 32;
      const out = [];
      const msg = (g, gap) => `${g.n}-column grid needs ${Math.round(g.width)}px on a ${PHONE}px screen${gap ? ` (${g.n - 1} gaps of ${gap}px)` : ''}; the page scrolls sideways`;
      // A scroll wrapper contains the overflow. html and body do not count: hiding overflow there clips the page instead.
      const contained = (el) => {
        for (let p = el; p && p.name !== '#root'; p = p.parent) if (!/^(html|body)$/i.test(p.name) && ctx.box(p).scroll) return true;
        return false;
      };
      const bySel = new Map();
      for (const r of ctx.cssRules) {
        if (!r.media.every((m) => holdsAt(m, PHONE))) continue;
        for (const sel of r.selector.split(',')) {
          const key = sel.trim().replace(/\s+/g, ' ');
          const e = bySel.get(key) ?? {};
          for (const d of r.decls) e[d.prop] = d;
          bySel.set(key, e);
        }
      }
      for (const [sel, e] of bySel) {
        const cols = e['grid-template-columns'];
        const value = (p) => e[p]?.value.trim() ?? '';
        if (!cols || (value('display') && !/grid/.test(value('display'))) || /^(auto|scroll|hidden|clip)\b/.test(value('overflow-x') || value('overflow'))) continue;
        const gapDecl = e['column-gap'] ?? e['grid-column-gap'] ?? e.gap ?? e['grid-gap'];
        const parts = gapDecl ? gapDecl.value.trim().split(/\s+/) : [];
        const gap = toPx(/^(grid-)?gap$/.test(gapDecl?.prop ?? '') ? (parts[1] ?? parts[0]) : parts[0]) ?? 0;
        const g = gridMin(cols.value, gap);
        if (!g || g.width <= ROOM) continue;
        if (ctx.markup && !ctx.markup.elements.some((el) => matchesSelector(sel, el) && !contained(el))) continue;
        out.push(hit(cols.start, cols.end, msg(g, gap)));
      }
      for (const el of ctx.markup?.elements ?? []) {
        const all = classList(el);
        // Unprefixed utilities and max-* variants are in force on a phone, and max-* wins.
        const phone = [...all.filter((c) => /^max-[^:]+:[^:]+$/.test(c)).map((c) => c.slice(c.indexOf(':') + 1)), ...all.filter((c) => !c.includes(':'))];
        const pick = (re) => phone.map((c) => re.exec(c)).find(Boolean);
        const cols = pick(/^grid-cols-(?:(\d+)|\[(.+)\])$/);
        const display = pick(/^(grid|inline-grid|block|inline-block|inline|flex|inline-flex|hidden|contents|table)$/);
        if (!cols || (display && !/grid/.test(display[0])) || contained(el)) continue;
        const gm = pick(/^gap-x-(.+)$/) ?? pick(/^gap-(?!y-)(.+)$/);
        const gap = (gm && twSpacing(gm[1])) ?? 0;
        const g = cols[1] ? { n: Number(cols[1]), width: (Number(cols[1]) - 1) * gap } : gridMin(cols[2].replace(/_/g, ' '), gap);
        if (g && g.width > ROOM) out.push(hit(el.start, el.openEnd, msg(g, gap)));
      }
      return out;
    },
  },
  {
    id: 'UI-015',
    slug: 'table-too-wide',
    severity: 'warn',
    weight: 3,
    title: 'Table pushes a 375px page sideways',
    rationale:
      'Generated pages put releases, prices and schedules in five- and six-column tables and stop at the desktop. On a phone the table keeps its width and the whole page scrolls sideways. A scroll wrapper only contains what it is the containing block for: visually hidden labels are `position: absolute`, so inside a wrapper that is not positioned they escape it and widen the page anyway.',
    fix: 'Below 600px, stack each row into a card (`display: block` on `tr` and `td`, with the column name as a label), or put the table in a `position: relative; overflow-x: auto` wrapper with a visible edge.',
    sample: 'html',
    langs: MARKUP,
    when: (ctx) => !ctx.isTest && !ctx.isFixture,
    check(ctx) {
      const out = [];
      const tag = (el, re) => re.test(el.name.toLowerCase());
      // Rules in force on a phone but not on a desktop, and Tailwind classes that change with the breakpoint.
      const narrow = ctx.cssRules.filter((r) => r.media.length && r.media.every((m) => holdsAt(m, 375)) && !r.media.every((m) => holdsAt(m, 1280)));
      const restyled = (el) => narrow.some((r) => r.selector.split(',').some((sel) => matchesSelector(sel.trim(), el))) || classList(el).some((c) => /^(?:sm|md|lg|xl|2xl|max-[\w-]+):/.test(c));
      for (const table of ctx.markup.elements.filter((el) => tag(el, /^table$/))) {
        const inside = descendants(table);
        let wrapper = null;
        for (let p = table; p && p.name !== '#root' && !wrapper; p = p.parent) if (!tag(p, /^(html|body)$/) && ctx.box(p).scroll) wrapper = p;
        if (wrapper) {
          // An absolutely positioned descendant is clipped only if its containing block is the wrapper or inside it.
          const escapes = (el) => {
            for (let p = el.parent; p && p !== wrapper; p = p.parent) if (ctx.box(p).positioned) return false;
            return !ctx.box(wrapper).positioned;
          };
          if (inside.some((el) => ctx.box(el).overlay && !ctx.box(el).offLeft && escapes(el))) {
            out.push(hit(wrapper.start, wrapper.openEnd, 'Absolutely positioned content in this table escapes its scroll wrapper, which is not positioned, and widens the page at 375px; add `position: relative` to the wrapper'));
          }
          continue;
        }
        const cols = Math.max(0, ...inside.filter((el) => tag(el, /^tr$/)).map((tr) => tr.children.filter((c) => tag(c, /^t[hd]$/)).reduce((n, c) => n + (Number((c.attrs.colspan ?? c.attrs.colSpan)?.value) || 1), 0)));
        if (cols <= 4 || [table, ...inside].some(restyled)) continue;
        out.push(hit(table.start, table.openEnd, `${cols}-column table with no scroll wrapper and no narrow-screen layout; the page scrolls sideways at 375px`));
      }
      return out;
    },
  },

  // ──────────────────────────────── Security ────────────────────────────────
  {
    id: 'SEC-001',
    slug: 'fallback-secret',
    severity: 'error',
    weight: 10,
    title: 'Secret falls back to a hard-coded value',
    rationale:
      'A fallback like a dev secret means production boots fine with a missing variable and signs tokens with a string that is in your git history. Generated code reuses the same few fallbacks, so attackers try them first.',
    fix: 'Read secrets once at boot and crash if they are missing. Never ship a default for anything that signs, encrypts or authenticates.',
    sample: 'ts',
    langs: SCRIPT,
    check(ctx) {
      const out = [];
      if (ctx.lang === 'py') {
        for (const m of ctx.text.matchAll(/\bos\.(?:environ\.get|getenv)\(\s*(['"])(\w+)\1\s*,\s*[rbuf]{0,2}['"]/g)) {
          if (!ctx.isCode(m.index) || !sensitive(m[2])) continue;
          const open = m.index + m[0].indexOf('(');
          const close = matchPair(ctx.code, open, '(', ')', false);
          if (close < 0) continue;
          out.push(hit(m.index, close + 1, `${m[2]} falls back to a hard-coded default`, { fix: { start: m.index, end: close + 1, text: `os.environ["${m[2]}"]` } }));
        }
        return out;
      }
      const ENV = /\b(?:process\.env|import\.meta\.env|Bun\.env)(?:\.([A-Za-z_]\w*)|\[\s*(['"])([A-Za-z_]\w*)\2\s*\])\s*(?:\|\||\?\?)\s*(?=['"`])/g;
      for (const m of ctx.text.matchAll(ENV)) {
        const name = m[1] ?? m[3];
        if (!ctx.isCode(m.index) || !sensitive(name)) continue;
        const tok = ctx.stringAt(m.index + m[0].length);
        if (!tok) continue;
        const ref = m[0].replace(/\s*(?:\|\||\?\?)\s*$/, '');
        out.push(hit(m.index, tok.end, `${name} silently falls back to ${tok.value ? 'a hard-coded value' : 'an empty string'}`, {
          fix: { start: m.index, end: tok.end, text: `(${ref} || (() => { throw new Error('${name} is not set'); })())` },
        }));
      }
      for (const m of ctx.text.matchAll(/\bDeno\.env\.get\(\s*(['"])(\w+)\1\s*\)\s*(?:\|\||\?\?)\s*(?=['"`])/g)) {
        if (ctx.isCode(m.index) && sensitive(m[2])) out.push(hit(m.index, m.index + m[0].length, `${m[2]} silently falls back to a hard-coded value`));
      }
      for (const m of ctx.code.matchAll(/\{([^{}]*)\}\s*=\s*process\.env\b/g)) {
        const inner = ctx.text.slice(m.index, m.index + m[1].length + 1);
        for (const d of inner.matchAll(/(\w+)\s*=\s*['"`]/g)) {
          if (sensitive(d[1])) out.push(hit(m.index + d.index, m.index + d.index + d[1].length, `${d[1]} defaults to a hard-coded value`));
        }
      }
      for (const m of ctx.code.matchAll(/\bjwt\.(sign|verify)\s*\(/g)) {
        const ca = callArgs(ctx.code, m.index + m[0].length - 1);
        const arg = ca?.args[1];
        if (!arg) continue;
        const first = ctx.text.slice(arg.start, arg.end).search(/\S/);
        if (first >= 0 && /['"`]/.test(ctx.text[arg.start + first])) out.push(hit(arg.start + first, arg.end, `JWT ${m[1]} uses a string-literal secret`));
      }
      return out;
    },
  },
  {
    id: 'SEC-002',
    slug: 'permissive-cors',
    severity: 'error',
    weight: 8,
    title: 'CORS allows every origin',
    rationale:
      '`cors()` with no options, `origin: "*"` or a reflected origin lets any site call your API from a visitor\'s browser. Combined with cookies or bearer tokens kept in the page, that is cross-site data access.',
    fix: 'Allow an explicit list of origins from configuration, and only enable credentials for those origins.',
    sample: 'ts',
    langs: SCRIPT,
    check(ctx) {
      const out = [];
      const add = (m, message, extra) => out.push(hit(m.index, m.index + m[0].length, message, extra));
      if (ctx.lang === 'py') {
        for (const m of ctx.text.matchAll(/allow_origins\s*=\s*\[\s*(['"])\*\1\s*\]/g)) if (ctx.isCode(m.index)) add(m, 'allow_origins lets every site call this API');
        for (const m of ctx.text.matchAll(/\bCORS\(\s*app\s*\)/g)) if (ctx.isCode(m.index)) add(m, 'flask-cors without origins allows every site');
        for (const m of ctx.text.matchAll(/\bCORS_(?:ALLOW_ALL_ORIGINS|ORIGIN_ALLOW_ALL)\s*=\s*True\b/g)) if (ctx.isCode(m.index)) add(m, 'Django CORS allows every origin');
        for (const m of ctx.text.matchAll(/(['"])Access-Control-Allow-Origin\1\s*[:,]\s*(['"])\*\2/gi)) if (ctx.isCode(m.index)) add(m, 'Wildcard Access-Control-Allow-Origin header');
        return out;
      }
      for (const m of ctx.code.matchAll(/\bcors\(\s*\)/g)) add(m, 'cors() with no options allows every origin', { fix: { start: m.index, end: m.index + m[0].length, text: `cors({ origin: ${ALLOWLIST} })` } });
      for (const m of ctx.text.matchAll(/\borigin\s*:\s*(['"`])\*\1/g)) {
        if (!ctx.isCode(m.index)) continue;
        const q = m.index + m[0].indexOf(m[1]);
        add(m, 'CORS origin "*" allows every site', { fix: { start: q, end: m.index + m[0].length, text: ALLOWLIST } });
      }
      for (const m of ctx.code.matchAll(/\borigin\s*:\s*true\b/g)) {
        if (/\bcors\s*\(/.test(ctx.code.slice(Math.max(0, m.index - 400), m.index))) add(m, 'CORS reflects any requesting origin');
      }
      for (const m of ctx.text.matchAll(/(['"`])Access-Control-Allow-Origin\1\s*[,:]\s*(['"`])\*\2/gi)) if (ctx.isCode(m.index)) add(m, 'Wildcard Access-Control-Allow-Origin header');
      return out;
    },
  },
  {
    id: 'SEC-003',
    slug: 'sql-interpolation',
    severity: 'error',
    weight: 10,
    title: 'SQL assembled from interpolated strings',
    rationale:
      'Template literals, f-strings, `%` formatting and `+` concatenation put values into the query text, so a quote in user input rewrites the query. Tagged templates (sql`...`) and placeholders keep values out of the SQL grammar.',
    fix: 'Use placeholders (`$1`, `?`, `%s` with a params tuple) or a tagged template from your driver. Allowlist identifiers such as sort columns.',
    sample: 'ts',
    langs: SCRIPT,
    check(ctx) {
      const out = [];
      const py = ctx.lang === 'py';
      // Names bound once to a literal (`const COLUMNS = 'id, total'`, `PAGE_SIZE = 50`) carry no input.
      const constants = new Set();
      for (const tok of ctx.strings) {
        if (tok.exprs?.length || (py && /f/i.test(tok.prefix ?? ''))) continue;
        const m = (py ? /(?:^|\n)([A-Z_][A-Z0-9_]*)\s*=\s*$/ : /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*$/).exec(ctx.code.slice(Math.max(0, tok.start - 80), tok.start));
        if (m) constants.add(m[1]);
      }
      for (const m of ctx.code.matchAll(py ? /^([A-Z_][A-Z0-9_]*)\s*=\s*\d+\s*$/gm : /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*\d+\s*[;\n]/g)) constants.add(m[1]);
      const constant = (expr) => constants.has(expr.trim());
      for (const tok of ctx.strings) {
        if (!SQL.test(tok.value)) continue;
        const after = ctx.code.slice(tok.end, tok.end + 24);
        const before = ctx.code.slice(Math.max(0, tok.start - 24), tok.start);
        let message = null;
        if (py) {
          if (/f/i.test(tok.prefix) && /\{[^}]+\}/.test(tok.value) && ![...tok.value.matchAll(/\{([^{}]+)\}/g)].every((x) => constant(x[1]))) message = 'SQL built with an f-string';
          else if (/^\s*(%|\.format\(|\+)/.test(after) || /\+\s*$/.test(before)) message = 'SQL built by string formatting';
        } else if (tok.quote === '`') {
          if (!tok.tagged && tok.exprs.length && !tok.exprs.every((e) => constant(ctx.text.slice(e.start, e.end)))) message = 'SQL built with template interpolation';
        } else if (/^\s*\+/.test(after) || /\+\s*$/.test(before)) message = 'SQL built by string concatenation';
        if (message) out.push(hit(tok.start, firstLineEnd(ctx.text, tok.start, tok.end), message));
      }
      return out;
    },
  },
  {
    id: 'SEC-004',
    slug: 'prompt-injection',
    severity: 'error',
    weight: 8,
    title: 'Raw request input interpolated into an LLM prompt',
    rationale:
      'Pasting request fields straight into a prompt lets any user rewrite your instructions, exfiltrate the system prompt, or drive tool calls. Input that never passed a schema also has no length cap, so one request can burn your token budget.',
    fix: 'Validate input with a schema (type, length, allowed values) first. Send user text as its own user-role message, delimited, never inside the system prompt.',
    sample: 'ts',
    langs: SCRIPT,
    check(ctx) {
      if (!/\b(openai|anthropic|@ai-sdk|langchain|ollama|generativeai|genai|cohere|mistral|groq|completions\.create|messages\.create|generateText|streamText|generateObject|ChatCompletion)\b/i.test(ctx.text)) return [];
      const out = [];
      if (ctx.lang === 'py') {
        for (const tok of ctx.strings) {
          if (!/f/i.test(tok.prefix) || !/\{[^}]*\b(request\.(json|form|args|get_json|data|values)|body\.|payload\.)/.test(tok.value)) continue;
          const before = ctx.text.slice(Math.max(0, tok.start - 80), tok.start);
          if (/\b(system|prompt|content|instructions|input)\s*=\s*$|['"](content|system|prompt)['"]\s*:\s*$/.test(before)) {
            out.push(hit(tok.start, firstLineEnd(ctx.text, tok.start, tok.end), 'Request input formatted straight into an LLM prompt'));
          }
        }
        return out;
      }
      const REQ = /\b(?:req|request|ctx\.request|event)\.(?:body|query|params|json|form|args|values)\b|\bbody\??\.\w+|searchParams\.get\(|formData\.get\(/;
      for (const tok of ctx.strings) {
        if (tok.quote !== '`' || tok.tagged || !tok.exprs.some((e) => REQ.test(ctx.text.slice(e.start, e.end)))) continue;
        const before = ctx.code.slice(Math.max(0, tok.start - 80), tok.start);
        if (/\b(system|systemPrompt|prompt|content|instructions|input)\s*[:=]\s*$/.test(before) || /\.(create|generate\w*|invoke|stream\w*|complete|chat|call)\(\s*$/.test(before)) {
          out.push(hit(tok.start, firstLineEnd(ctx.text, tok.start, tok.end), 'Request input interpolated straight into an LLM prompt'));
        }
      }
      return out;
    },
  },
  {
    id: 'SEC-005',
    slug: 'client-only-auth',
    severity: 'error',
    weight: 6,
    title: 'Authentication decided in the browser',
    rationale:
      'A `useEffect` redirect or a flag in localStorage only hides the page; the data still loads for anyone who calls the API or edits storage. Tokens in localStorage are also readable by any injected script.',
    fix: 'Check the session on the server (middleware, server component, route handler) and return 401/403 there. Keep tokens in httpOnly cookies.',
    sample: 'tsx',
    langs: ['js', 'jsx', 'vue', 'html'],
    when: (ctx) => ctx.isClient && !ctx.isServerPath,
    check(ctx) {
      const out = [];
      for (const m of ctx.text.matchAll(/localStorage\.(getItem|setItem)\(\s*(['"`])(\w+)\2/g)) {
        if (ctx.isCode(m.index) && /^(token|jwt|auth\w*|access_?token|id_?token|session\w*|is_?admin|role|user_?role|is_?logged_?in|logged_?in)$/i.test(m[3])) {
          out.push(hit(m.index, m.index + m[0].length, `Auth state "${m[3]}" kept in localStorage`));
        }
      }
      for (const m of ctx.code.matchAll(/\b(?:router\.(?:push|replace)\(|navigate\(|redirect\(|window\.location(?:\.href)?\s*=)\s*(?=['"`])/g)) {
        const tok = ctx.stringAt(m.index + m[0].length);
        if (!tok || !/^\/(login|signin|sign-in|auth)\b/.test(tok.value)) continue;
        const before = ctx.code.slice(Math.max(0, m.index - 240), m.index);
        if (/\bif\s*\(\s*!\s*[\w$.?]*\b(user|session|token|auth\w*|isAuthenticated|isLoggedIn|loggedIn|currentUser)\b/i.test(before)) {
          out.push(hit(m.index, tok.end, 'Route protected only by a browser redirect'));
        }
      }
      return out;
    },
  },
  {
    id: 'SEC-006',
    slug: 'unverified-webhook',
    severity: 'error',
    weight: 9,
    title: 'Webhook handler never verifies the signature',
    rationale:
      'Webhook URLs leak through logs and dashboards. Without a signature check anyone can POST a fake "payment succeeded" event and your handler will fulfil it.',
    fix: 'Verify the provider signature against the raw body with a timing-safe compare (Stripe `constructEvent`, Svix `verify`, HMAC + `timingSafeEqual`) before parsing JSON. Reject with 400 on mismatch.',
    sample: 'ts',
    langs: SCRIPT,
    check(ctx) {
      if (/constructEvent|construct_event|verifySignature|verify_signature|verifyWebhook|validateRequest|webhooks?\.verify|new Webhook\(|\.verify\(|createHmac|timingSafeEqual|compare_digest|hmac\.new|x-hub-signature|stripe-signature|svix-signature|x-signature|x-slack-signature/i.test(ctx.text)) return [];
      const out = [];
      if (ctx.lang === 'py') {
        for (const m of ctx.text.matchAll(/@\w+\.(?:post|route|api_route)\(\s*(['"])([^'"]*webhook[^'"]*)\1/gi)) {
          if (ctx.isCode(m.index)) out.push(hit(m.index, m.index + m[0].length, `Webhook route ${m[2]} trusts the payload without verifying its signature`));
        }
        return out;
      }
      for (const m of ctx.text.matchAll(/\.(?:post|all|put)\(\s*(['"`])([^'"`\n]*webhook[^'"`\n]*)\1/gi)) {
        if (ctx.isCode(m.index)) out.push(hit(m.index + 1, m.index + m[0].length, `Webhook route ${m[2]} trusts the payload without verifying its signature`));
      }
      if (/webhook/i.test(ctx.path)) {
        for (const m of ctx.code.matchAll(/export\s+(?:async\s+)?function\s+POST\b|export\s+const\s+POST\b/g)) out.push(hit(m.index, m.index + m[0].length, 'Webhook handler trusts the payload without verifying its signature'));
      }
      return out;
    },
  },
  {
    id: 'SEC-007',
    slug: 'unsanitized-html',
    severity: 'error',
    weight: 8,
    title: 'Interpolated values written as raw HTML',
    rationale:
      'Assigning interpolated strings to `innerHTML`, `dangerouslySetInnerHTML`, `v-html` or `{@html}` executes any markup in the data. One user-controlled field becomes stored XSS.',
    fix: 'Render text with `textContent` / framework bindings. If HTML is required, pass every value through an escaper or DOMPurify at the sink.',
    sample: 'js',
    langs: ['js', 'jsx', 'html', 'vue'],
    check(ctx) {
      const out = [];
      const { code, text } = ctx;
      const checkValue = (from, to, sink, at) => {
        const lead = text.slice(from, to).search(/\S/);
        if (lead < 0) return;
        const start = from + lead;
        const tok = ctx.stringAt(start);
        if (tok && !/^\s*\+/.test(code.slice(tok.end, to))) {
          const bad = tok.exprs.filter((e) => unsafeExpr(text.slice(e.start, e.end)));
          if (bad.length) out.push(hit(at, firstLineEnd(text, at, tok.end), `${sink} receives ${bad.length} unescaped interpolation${bad.length > 1 ? 's' : ''}`));
          return;
        }
        const parts = statements(code.slice(start, to).replace(/\+/g, '\n'));
        if (parts.some((p) => !/^['"`]/.test(p) && unsafeExpr(p))) out.push(hit(at, firstLineEnd(text, at, to), `${sink} built from unescaped values`));
      };
      for (const m of code.matchAll(/\.(innerHTML|outerHTML)\s*\+?=\s*/g)) {
        const from = m.index + m[0].length;
        checkValue(from, statementEnd(code, from), m[1], m.index + 1);
      }
      for (const m of code.matchAll(/\.insertAdjacentHTML\s*\(|\bdocument\.write(?:ln)?\s*\(/g)) {
        const ca = callArgs(code, m.index + m[0].length - 1);
        const arg = m[0].includes('insert') ? ca?.args[1] : ca?.args[0];
        if (arg) checkValue(arg.start, arg.end, m[0].includes('insert') ? 'insertAdjacentHTML' : 'document.write', m.index);
      }
      for (const m of code.matchAll(/dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html\s*:\s*/g)) {
        const from = m.index + m[0].length;
        const close = matchPair(code, m.index + m[0].indexOf('{'), '{', '}', false);
        const end = close < 0 ? from : code.lastIndexOf('}', close - 1);
        if (end > from) checkValue(from, end, 'dangerouslySetInnerHTML', m.index);
      }
      if (ctx.markup && ctx.lang !== 'jsx') {
        for (const el of ctx.markup.elements) {
          const a = el.attrs['v-html'];
          if (a && unsafeExpr(a.value)) out.push(hit(a.start, a.end, 'v-html renders an unescaped value'));
        }
        for (const m of text.matchAll(/\{@html\s+([^}]+)\}/g)) if (unsafeExpr(m[1])) out.push(hit(m.index, m.index + m[0].length, '{@html} renders an unescaped value'));
      }
      return out;
    },
  },

  // ───────────────────────── Backend & Architecture ─────────────────────────
  {
    id: 'BE-001',
    slug: 'swallowed-error',
    severity: 'warn',
    weight: 5,
    title: 'Error caught, logged and discarded',
    rationale:
      'A catch block that only logs turns a failure into a success for the caller: the request returns 200, the job is marked done, and the data is wrong. Generated code adds these everywhere to make demos stop crashing.',
    fix: 'Handle the error (retry, fallback with a visible state, typed error response) or let it propagate. If you log, rethrow or return an error result.',
    sample: 'ts',
    langs: SCRIPT,
    check(ctx) {
      const out = [];
      const LOG = /^(?:console\.(?:log|error|warn|info|debug)|(?:this\.)?(?:logger|log)\.\w+)\s*\([\s\S]*\)$/;
      if (ctx.lang === 'py') {
        ctx.lines.forEach((line, k) => {
          const m = /^(\s*)except\b[^:\n]*:/.exec(line.text);
          if (!m) return;
          const body = pyBlock(ctx, k);
          const stmts = body.map((b) => b.text.trim()).filter(Boolean);
          if (!stmts.length || !stmts.every((s) => /^(pass|\.\.\.|continue|print\(.*\)|(?:logging|logger|log)\.\w+\(.*\))$/.test(s))) return;
          const raw = body.map((b) => ctx.text.slice(b.start, b.start + b.text.length)).join('\n');
          if (stmts.every((s) => /^(pass|\.\.\.)$/.test(s)) && /#(?!\s*(TODO|FIXME))/.test(raw + ctx.text.slice(line.start, line.start + line.text.length))) return;
          out.push(hit(line.start + m[1].length, line.start + line.text.length, 'Exception caught and discarded'));
        });
        return out;
      }
      const { code, text } = ctx;
      for (const m of code.matchAll(/\bcatch\s*(?:\(\s*([\w$]*)[^)]*\))?\s*\{/g)) {
        const open = m.index + m[0].length - 1;
        const close = matchPair(code, open, '{', '}', false);
        if (close < 0) continue;
        const stmts = statements(code.slice(open + 1, close));
        const raw = text.slice(open + 1, close);
        if (!stmts.length) {
          if (/\/\/|\/\*/.test(raw) && !/TODO|FIXME/i.test(raw)) continue;
          out.push(hit(m.index, open + 1, 'Empty catch block swallows the error'));
        } else if (stmts.every((s) => LOG.test(s))) {
          let fix;
          if (m[1]) {
            let last = close - 1;
            while (last > open && /\s/.test(text[last])) last--;
            const sep = text[last] === ';' ? '' : ';';
            const lineStart = text.lastIndexOf('\n', last) + 1;
            const indent = /^\s*/.exec(text.slice(lineStart, last))[0];
            fix = { start: last + 1, end: last + 1, text: raw.includes('\n') ? `${sep}\n${indent}throw ${m[1]};` : `${sep} throw ${m[1]};` };
          }
          out.push(hit(m.index, open + 1, 'Error is logged and then discarded', fix ? { fix } : {}));
        }
      }
      for (const m of code.matchAll(/\.catch\(\s*(?:console\.\w+|(?:async\s*)?(?:\(\s*[\w$]*\s*\)|[\w$]+)\s*=>\s*(?:\{\s*\}|null|undefined|void 0|console\.\w+\([^()]*\)|\{\s*console\.\w+\([^()]*\);?\s*\}))\s*\)/g)) {
        // Only a bare statement discards the rejection. `const x = await p.catch(() => null)` turns it into a value
        // the caller checks, and a failed rollback or close during cleanup has nothing left to recover.
        const from = statementStart(code, m.index);
        const statement = text.slice(from, m.index);
        if (/(?<![=!<>])=(?![=>])|^\s*return\b/.test(statement)) continue;
        if (/\b(?:rollback|release|close|destroy|unlink|rmdir|rm|abort|disconnect|end|cancel|kill|terminate|unsubscribe)\b/i.test(statement)) continue;
        out.push(hit(m.index + 1, m.index + m[0].length, 'Promise rejection logged and discarded'));
      }
      return out;
    },
  },
  {
    id: 'BE-002',
    slug: 'n-plus-one',
    severity: 'warn',
    weight: 5,
    title: 'Database query inside a loop (N+1)',
    rationale:
      'One query per item is fast with five rows in a demo and a timeout with five thousand in production. Each round trip adds latency and holds a connection.',
    fix: 'Fetch in one query (`where: { id: { in: ids } }`, a JOIN, `select_related`/`prefetch_related`) and map results in memory.',
    sample: 'ts',
    langs: SCRIPT,
    check(ctx) {
      const out = [];
      const seen = new Set();
      const report = (index, length) => {
        if (seen.has(index)) return;
        seen.add(index);
        out.push(hit(index, index + length, 'Query inside a loop runs once per item'));
      };
      if (ctx.lang === 'py') {
        const DB = /\.objects\.(?:get|filter|create|exclude)\(|\bsession\.(?:query|get|execute|scalars?)\(|\.execute\(|\bcursor\.\w+\(|\bdb\.\w+\(/;
        ctx.lines.forEach((line, k) => {
          if (!/^\s*(?:async\s+)?for\s+.+\s+in\s+.+:\s*$/.test(line.text)) return;
          for (const b of pyBlock(ctx, k)) {
            const m = DB.exec(b.text);
            if (m) { report(b.start + m.index, m[0].length); break; }
          }
        });
        return out;
      }
      const { code } = ctx;
      const DB = /\b(?:prisma|db|knex|sequelize|mongoose|supabase|pool|client|sql|repo|repository|em|entityManager|orm|drizzle|tx|trx|conn|connection|models?)\b(?:\.\w+)*?\.(?:find\w*|query|select\w*|insert\w*|update\w*|delete\w*|create\w*|upsert\w*|exec\w*|count\w*|aggregate|get\w*|from|raw)\s*\(|\b[A-Z]\w+\.(?:findById|findOne|findByPk|findAll|find|countDocuments|findUnique|findFirst)\s*\(/g;
      const scan = (a, b) => {
        DB.lastIndex = a;
        const m = DB.exec(code);
        if (m && m.index < b) report(m.index, m[0].length - 1);
      };
      for (const m of code.matchAll(/\b(?:for|while)\s*(?:await\s*)?\(/g)) {
        const close = matchPair(code, m.index + m[0].length - 1, '(', ')', false);
        if (close < 0) continue;
        let j = close + 1;
        while (/\s/.test(code[j] ?? '')) j++;
        const end = code[j] === '{' ? matchPair(code, j, '{', '}', false) : statementEnd(code, j);
        if (end > j) scan(j, end);
      }
      for (const m of code.matchAll(/\.(?:forEach|map|flatMap|filter|some|every|reduce)\(/g)) {
        const open = m.index + m[0].length - 1;
        const close = matchPair(code, open, '(', ')', false);
        if (close > open) scan(open, close);
      }
      return out;
    },
  },
  {
    id: 'BE-003',
    slug: 'unbounded-fetch',
    severity: 'warn',
    weight: 4,
    title: 'Outbound HTTP call without a timeout',
    rationale:
      '`fetch` and `requests` wait forever by default. One slow upstream ties up a request handler or worker until the platform kills it, and under load that cascades into an outage.',
    fix: 'Bound every call: `fetch(url, { signal: AbortSignal.timeout(10_000) })`, axios `{ timeout }`, requests `timeout=10`. Decide what the caller sees on timeout.',
    sample: 'ts',
    langs: SCRIPT,
    check(ctx) {
      const out = [];
      const { code } = ctx;
      if (ctx.lang === 'py') {
        for (const m of code.matchAll(/\b(?:requests\.(?:get|post|put|patch|delete|head|request)|urlopen)\s*\(/g)) {
          const open = m.index + m[0].length - 1;
          const ca = callArgs(code, open);
          if (!ca || /\btimeout\s*=/.test(code.slice(open, ca.close))) continue;
          out.push(hit(m.index, open + 1, `${m[0].slice(0, -1).trim()}() without a timeout`, { fix: { start: ca.close, end: ca.close, text: ca.args.length ? ', timeout=10' : 'timeout=10' } }));
        }
        return out;
      }
      for (const m of code.matchAll(/(?<![\w$.])(?:(?:window|globalThis|self)\.)?fetch\s*\(/g)) {
        const open = m.index + m[0].length - 1;
        const ca = callArgs(code, open);
        if (!ca || !ca.args.length) continue;
        if (ca.args.length === 1) {
          out.push(hit(m.index, open + 1, 'fetch() without a timeout or AbortSignal', { fix: { start: ca.args[0].end, end: ca.args[0].end, text: ', { signal: AbortSignal.timeout(10_000) }' } }));
        } else {
          const a = ca.args[1];
          const src = code.slice(a.start, a.end);
          const brace = src.indexOf('{');
          if (src.trim().startsWith('{') && !/\bsignal\b/.test(src)) {
            out.push(hit(m.index, open + 1, 'fetch() without a timeout or AbortSignal', { fix: { start: a.start + brace + 1, end: a.start + brace + 1, text: ' signal: AbortSignal.timeout(10_000),' } }));
          }
        }
      }
      if (!/axios\.create\(\s*\{[^}]*timeout|axios\.defaults\.timeout/.test(code)) {
        for (const m of code.matchAll(/\baxios(?:\.(?:get|post|put|patch|delete|head|request))?\s*\(/g)) {
          const open = m.index + m[0].length - 1;
          const ca = callArgs(code, open);
          if (ca && !/\btimeout\b/.test(code.slice(open, ca.close))) out.push(hit(m.index, open + 1, 'axios call without a timeout'));
        }
      }
      return out;
    },
  },
  {
    id: 'BE-004',
    slug: 'non-idempotent-mutation',
    severity: 'warn',
    weight: 5,
    title: 'Mutation route that is unsafe to retry',
    rationale:
      'Clients, proxies and users retry. A GET that writes gets replayed by prefetchers and crawlers; a POST that creates an order or charge without an idempotency key double-charges on the first network blip.',
    fix: 'Never mutate in GET. For create/charge endpoints accept an `Idempotency-Key` header, store it with a unique constraint, and return the original result on replay.',
    sample: 'ts',
    langs: SCRIPT,
    check(ctx) {
      const out = [];
      const MUT = /\.(?:create\w*|update\w*|delete\w*|destroy|insert\w*|upsert\w*|remove|save|increment|decrement)\s*\(/;
      const SQLMUT = /\b(?:INSERT\s+INTO|UPDATE\s+[\w."`]+\s+SET|DELETE\s+FROM)\b/i;
      const MONEY = /(order|payment|charge|checkout|subscri|transfer|invoice|payout|refund|purchase|booking)/i;
      const IDEMP = /idempoten|upsert|ON CONFLICT|onConflict|findOrCreate|get_or_create|createOrUpdate|dedupe/i.test(ctx.text);
      const { code, text } = ctx;
      if (ctx.lang === 'py') {
        for (const m of text.matchAll(/^[ \t]*@\w+\.(get|post|route)\(\s*(['"])([^'"]*)\2([^)\n]*)\)/gm)) {
          const method = m[1] === 'route' ? (/['"]POST['"]/i.test(m[4]) ? 'post' : 'get') : m[1];
          const k = ctx.lines.findIndex((l, i) => l.start > m.index && /^\s*(?:async\s+)?def\s/.test(l.text) && i >= 0);
          if (k < 0) continue;
          const body = pyBlock(ctx, k);
          const bodyCode = body.map((b) => b.text).join('\n');
          const bodyRaw = body.map((b) => text.slice(b.start, b.start + b.text.length)).join('\n');
          const start = m.index + m[0].indexOf('@');
          if (method === 'get' && (/\.(?:add|delete|commit|merge|update|insert|create|save)\(/.test(bodyCode) || SQLMUT.test(bodyRaw))) out.push(hit(start, m.index + m[0].length, `GET ${m[3]} changes data`));
          if (method === 'post' && MONEY.test(m[3]) && /\.(?:add|create)\(|INSERT\s+INTO/i.test(bodyRaw) && !IDEMP) out.push(hit(start, m.index + m[0].length, `POST ${m[3]} creates records without an idempotency key`));
        }
        return out;
      }
      for (const m of text.matchAll(/\.(get|post)\(\s*(['"`])(\/[^'"`\n]*)\2/g)) {
        if (!ctx.isCode(m.index)) continue;
        const open = m.index + m[0].indexOf('(');
        const close = matchPair(code, open, '(', ')', false);
        if (close < 0) continue;
        const handlerCode = code.slice(open, close);
        const handlerRaw = text.slice(open, close);
        if (m[1] === 'get' && (MUT.test(handlerCode) || SQLMUT.test(handlerRaw))) out.push(hit(m.index + 1, m.index + m[0].length, `GET ${m[3]} changes data; GET must be safe to repeat`));
        if (m[1] === 'post' && MONEY.test(m[3]) && (/\.create\w*\s*\(/.test(handlerCode) || /INSERT\s+INTO/i.test(handlerRaw)) && !IDEMP) {
          out.push(hit(m.index + 1, m.index + m[0].length, `POST ${m[3]} creates records without an idempotency key`));
        }
      }
      const exportsAt = [...code.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST)\b|export\s+const\s+(GET|POST)\s*=/g)];
      exportsAt.forEach((m, i) => {
        const method = m[1] ?? m[2];
        const body = code.slice(m.index, exportsAt[i + 1]?.index ?? code.length);
        const raw = text.slice(m.index, exportsAt[i + 1]?.index ?? text.length);
        if (method === 'GET' && (MUT.test(body) || SQLMUT.test(raw))) out.push(hit(m.index, m.index + m[0].length, 'GET handler changes data; GET must be safe to repeat'));
        if (method === 'POST' && MONEY.test(ctx.path) && (/\.create\w*\s*\(/.test(body) || /INSERT\s+INTO/i.test(raw)) && !IDEMP) out.push(hit(m.index, m.index + m[0].length, 'POST handler creates records without an idempotency key'));
      });
      return out;
    },
  },
  {
    id: 'BE-005',
    slug: 'placeholder-stub',
    severity: 'warn',
    weight: 4,
    title: 'Stub, mock data or elided code in a production path',
    rationale:
      'Generated code leaves "not implemented" throws, mock arrays and "rest of the code" comments where real logic should be. They compile, pass a glance review, and fail the first real user.',
    fix: 'Implement it, or delete the path and the UI that reaches it. Move sample data to fixtures/ or seed scripts.',
    sample: 'ts',
    langs: ['js', 'jsx', 'html', 'vue', 'py', 'css'],
    when: (ctx) => !ctx.isTest && !ctx.isFixture,
    check(ctx) {
      const out = [];
      const { text } = ctx;
      const ELISION = /^[^\w]*(?:\.{3}|…)\s*(?:rest|existing|remaining|other|more|previous|same|your)\b|^[^\w]*(?:rest of (?:the )?(?:code|implementation|file|component|logic)|existing code)\b/i;
      const IMPL = /^[^\w]*(?:TODO|FIXME|XXX)\b[:\s-]*(?:implement|add (?:the )?(?:real|actual)|replace (?:this|with)|hook (?:this )?up|wire (?:this )?up|connect to)/i;
      const REAL = /\b(?:in a real (?:app|application|implementation|project|world scenario|system)|in production,? you (?:would|should)|for (?:demo|demonstration) purposes|(?:this is a|simple) placeholder|replace with (?:your|a real|actual))\b/i;
      const YOURS = /\b(?:your|add your) (?:code|logic|implementation) (?:goes )?here\b/i;
      for (const c of ctx.comments) {
        const body = c.text.replace(/^(\/\/|\/\*+|#|<!--)\s*/, '');
        if (ELISION.test(body) || IMPL.test(body) || REAL.test(body) || YOURS.test(body)) out.push(hit(c.start, firstLineEnd(text, c.start, c.end), 'Placeholder comment where an implementation belongs'));
      }
      if (ctx.lang === 'py') {
        for (const m of text.matchAll(/\braise\s+NotImplementedError\b/g)) {
          if (!ctx.isCode(m.index)) continue;
          const before = text.slice(Math.max(0, m.index - 300), m.index);
          if (!/@(?:abc\.)?abstractmethod\s*\n[^\n]*\n?[^\n]*$/.test(before)) out.push(hit(m.index, m.index + m[0].length, 'NotImplementedError in a production path'));
        }
        for (const m of ctx.code.matchAll(/^\s*((?:mock|fake|dummy)_\w+|(?:MOCK|FAKE|DUMMY)_\w+)\s*=/gm)) if (!DECOY.test(m[1])) out.push(hit(m.index + m[0].indexOf(m[1]), m.index + m[0].indexOf(m[1]) + m[1].length, `Mock data "${m[1]}" in a production path`));
        return out;
      }
      if (!ctx.code || ctx.lang === 'css') return out;
      for (const m of text.matchAll(/\bthrow\s+new\s+Error\(\s*(['"`])(?:not\s+implemented|todo|method not implemented|implement me)/gi)) {
        if (ctx.isCode(m.index)) out.push(hit(m.index, m.index + m[0].length, '"Not implemented" throw in a production path'));
      }
      for (const m of ctx.code.matchAll(/\b(?:const|let|var)\s+((?:mock|fake|dummy|stub)[A-Z_]\w*|(?:MOCK|FAKE|DUMMY)_\w+)\s*=/g)) {
        if (DECOY.test(m[1])) continue;
        const s = m.index + m[0].indexOf(m[1]);
        out.push(hit(s, s + m[1].length, `Mock data "${m[1]}" in a production path`));
      }
      return out;
    },
  },
  {
    id: 'BE-006',
    slug: 'single-impl-abstraction',
    severity: 'warn',
    weight: 2,
    title: 'Abstraction with exactly one implementation',
    rationale:
      'An interface or abstract base with a single implementer, or a factory that can only build one thing, adds a file and an indirection for every reader and protects against a change nobody has asked for.',
    fix: 'Use the concrete class. Extract the interface when the second implementation actually arrives.',
    sample: 'ts',
    langs: ['js', 'jsx'],
    check(ctx) {
      const out = [];
      const { code } = ctx;
      for (const m of code.matchAll(/\b(?:interface|abstract\s+class)\s+([A-Z][\w$]*)/g)) {
        const name = m[1];
        const impls = [...code.matchAll(new RegExp(`\\bclass\\s+[\\w$]+[^{]*\\b(?:implements|extends)\\b[^{]*\\b${name}\\b`, 'g'))];
        if (impls.length === 1) out.push(hit(m.index, m.index + m[0].length, `${name} has exactly one implementation`));
      }
      for (const m of code.matchAll(/\bclass\s+([\w$]*Factory)\b[^{]*\{/g)) {
        const close = matchPair(code, m.index + m[0].length - 1, '{', '}', false);
        const body = code.slice(m.index, close < 0 ? code.length : close);
        if ([...body.matchAll(/\bnew\s+[A-Z][\w$]*/g)].length <= 1) out.push(hit(m.index, m.index + m[0].length - 1, `${m[1]} only ever builds one type`));
      }
      return out;
    },
  },

  // ──────────────────────────────── UX Writing ───────────────────────────────
  {
    id: 'COPY-001',
    slug: 'llm-buzzwords',
    severity: 'warn',
    weight: 2,
    title: 'LLM marketing filler in user-facing copy',
    rationale:
      'A short list of words became the fingerprint of model-written copy (the over-used vocabulary effect measured in academic abstracts). Readers now discount the whole page when they see them, and none of them says what the product does.',
    fix: 'Replace the adjective with the fact behind it: a number, a named integration, a time saved, a thing the user can now do.',
    sample: 'html',
    langs: COPY,
    check(ctx) {
      const out = [];
      const BUZZ = /\b(seamless(?:ly)?|supercharg(?:e|es|ed|ing)|unleash(?:es|ed|ing)?|next[- ]gen(?:eration)?|delv(?:e|es|ed|ing)|revolutioni[sz](?:e|es|ed|ing)|game[- ]chang(?:er|ing)|cutting[- ]edge|state[- ]of[- ]the[- ]art|effortless(?:ly)?|empower(?:s|ed|ing)?|elevate (?:your|the)|unlock (?:your|the|its|new) (?:full )?(?:potential|power)|harness(?:es|ing)? the power|in today'?s (?:fast[- ]paced|digital|ever[- ]changing)|blazing(?:ly)?[- ]fast|world[- ]class|best[- ]in[- ]class|synerg(?:y|ies|istic)|tapestry|a testament to|embark(?:s|ed|ing)? on|take (?:it|your \w+) to the next level|look no further|a myriad of|plethora|unparalleled)\b/gi;
      for (const seg of ctx.copy) {
        for (const m of seg.text.matchAll(BUZZ)) {
          const start = seg.start + m.index;
          const word = m[0];
          let fix;
          if (/^(seamlessly|effortlessly)$/.test(word) && seg.text[m.index + word.length] === ' ') fix = { start, end: start + word.length + 1, text: '' };
          out.push(hit(start, start + word.length, `Filler "${word}" says nothing concrete`, fix ? { fix } : {}));
        }
      }
      return out;
    },
  },
  {
    id: 'COPY-002',
    slug: 'dead-end-error',
    severity: 'warn',
    weight: 3,
    title: 'Error message with no cause and no next step',
    rationale:
      'Generic failure copy tells users only that they are stuck. They retry the same action, file a vague ticket, or leave. Support cannot diagnose it either.',
    fix: 'Say what failed, why if known, and what to do now: "Card declined by your bank. Try another card or contact the bank." Keep the user\'s input.',
    sample: 'tsx',
    langs: COPY,
    check(ctx) {
      const out = [];
      const DEAD = /\b(an?\s+(?:unexpected|unknown)\s+error\s+(?:has\s+)?occurred|something\s+went\s+wrong|an\s+error\s+(?:has\s+)?occurred|unknown\s+error|oops)\b/gi;
      for (const seg of ctx.copy) {
        for (const m of seg.text.matchAll(DEAD)) out.push(hit(seg.start + m.index, seg.start + m.index + m[0].length, `Dead-end error "${m[0]}"`));
      }
      return out;
    },
  },
  {
    id: 'COPY-003',
    slug: 'vague-label',
    severity: 'warn',
    weight: 2,
    title: 'Button or link label does not name the action',
    rationale:
      '"Submit", "OK" and "Click here" force users to read the surrounding text to learn what a control does, and they are meaningless in a screen reader\'s list of links and buttons.',
    fix: 'Use verb + object: "Create invoice", "Save changes", "Download report (PDF)".',
    sample: 'html',
    langs: MARKUP,
    check(ctx) {
      const out = [];
      const VAGUE = /^(submit|ok|okay|click here|here|go|yes|no|learn more|read more|more)$/i;
      for (const el of ctx.markup.elements) {
        const lower = el.name.toLowerCase();
        if (lower === 'input') {
          const type = el.attrs.type?.value ?? '';
          const v = el.attrs.value;
          if (/^(submit|button)$/i.test(type) && v && VAGUE.test(v.value.trim())) out.push(hit(v.start, v.end, `Vague label "${v.value.trim()}"`));
          continue;
        }
        if (!/^(button|a)$/.test(lower) && !/(Button|Link)$/.test(el.name)) continue;
        if (el.attrs['aria-label'] || el.attrs['aria-labelledby']) continue;
        const label = textContent(ctx, el);
        if (VAGUE.test(label)) out.push(hit(el.start, el.closeStart ?? el.openEnd, `Vague label "${label}"`));
      }
      return out;
    },
  },
  {
    id: 'COPY-004',
    slug: 'placeholder-content',
    severity: 'warn',
    weight: 2,
    title: 'Template placeholder content shipped as real copy',
    rationale:
      'Filler Latin, stock person names, fictional company names and random avatar or photo services are what models fill blanks with. Shipped to users they read as an unfinished product, and in screenshots they hide layout problems that real data would expose.',
    fix: 'Use realistic, specific content from your domain: real names, real product screenshots, no random avatars. Keep sample data in fixtures and stories, not in components.',
    sample: 'html',
    langs: COPY,
    when: (ctx) => !ctx.isTest && !ctx.isFixture,
    check(ctx) {
      const out = [];
      const FILLER = /\b(lorem ipsum|dolor sit amet|john doe|jane doe|acme(?: (?:corp|inc|co)\.?)?|example@example\.com|foo@bar\.com|123 main st(?:reet)?|your company name|company name)\b/gi;
      for (const seg of ctx.copy) {
        if (seg.kind === 'attr:placeholder') continue;
        for (const m of seg.text.matchAll(FILLER)) out.push(hit(seg.start + m.index, seg.start + m.index + m[0].length, `Placeholder content "${m[0]}"`));
      }
      for (const m of ctx.text.matchAll(PLACEHOLDER_IMAGE)) {
        if (ctx.comments.some((c) => m.index >= c.start && m.index < c.end)) continue;
        out.push(hit(m.index, m.index + m[0].length, `Placeholder image from ${m[1]}`));
      }
      return out;
    },
  },

  {
    id: 'COPY-005',
    slug: 'invented-proof',
    severity: 'warn',
    weight: 3,
    title: 'Social proof or performance claim with no source',
    rationale:
      'Models fill marketing pages with numbers nobody measured: thousands of happy teams, three-nines uptime, three times faster, a SOC 2 badge. Readers cannot check them, advertising regulators treat invented claims as deceptive, and one false number taints every true one on the page.',
    fix: 'Use a real figure with its source (a footnote, a link, the date it was measured) or render it from data. If there is no figure yet, cut the claim.',
    sample: 'html',
    langs: ['jsx', 'html', 'vue', 'md'],
    when: (ctx) => !ctx.isTest && !ctx.isFixture,
    check(ctx) {
      const out = [];
      for (const seg of ctx.copy) {
        for (const m of seg.text.matchAll(PROOF)) {
          const start = seg.start + m.index;
          const end = start + m[0].trimEnd().length;
          if (SOURCED.test(ctx.text.slice(Math.max(0, start - 80), end + 80))) continue;
          out.push(hit(start, end, `Unsourced claim "${m[0].trim()}"`));
        }
      }
      return out;
    },
  },
  {
    id: 'COPY-006',
    slug: 'emoji-decoration',
    severity: 'warn',
    weight: 2,
    title: 'Emoji used as decoration in headings, buttons, links and badges',
    rationale:
      'A rocket on the hero headline and a sparkle on the "Generate" button are among the quickest tells of a generated interface. They add no meaning, render differently on every platform, are read aloud by screen readers before the label, and push the words people scan for away from the left edge. (TEST-003 covers the same habit in READMEs.)',
    fix: 'Delete the emoji. If a heading or button needs more than its words, the words are wrong; if an action needs an icon, use a real icon with an accessible label.',
    sample: 'tsx',
    langs: MARKUP,
    when: (ctx) => !ctx.isTest && !ctx.isFixture,
    check(ctx) {
      const out = [];
      const flag = (start, text, what) => {
        const m = EMOJI_LEAD.exec(text);
        if (m) out.push(hit(start, start + m[0].trimEnd().length, `Emoji ${what}`, { fix: { start, end: start + m[0].length, text: '' } }));
      };
      for (const el of ctx.markup.elements) {
        const badge = /(^|[-_\s])(badge|pill|chip|eyebrow|kicker)([-_\s]|$)/i.test(classList(el).join(' '));
        if (!badge && !/^(h[1-6]|button|a|li|label|summary|th|dt|title)$/i.test(el.name) && !/(Button|Link|Heading|Title|Badge)$/.test(el.name)) continue;
        const t = el.text.find((x) => ctx.text.slice(x.start, x.end).trim());
        if (!t || el.children.some((c) => c.start < t.start)) continue;
        const raw = ctx.text.slice(t.start, t.end);
        const lead = raw.length - raw.trimStart().length;
        flag(t.start + lead, raw.slice(lead), `decorating a ${badge ? 'badge' : el.name.toLowerCase()} label`);
      }
      return out;
    },
  },

  // ───────────────────────────── Testing & DX ──────────────────────────────
  {
    id: 'TEST-001',
    slug: 'tautological-test',
    severity: 'warn',
    weight: 4,
    title: 'Test asserts only mocks, constants, or nothing',
    rationale:
      'A test whose only assertion is that a mock was called proves the code calls the mock you wrote, not that it works. Generated suites are full of them: green, high coverage, and unable to fail when behaviour breaks.',
    fix: 'Assert on observable outcomes: return values, persisted state, rendered text, HTTP responses. Keep call assertions for side effects that are the point (an email sent), alongside an outcome check.',
    sample: 'test.ts',
    langs: ['js', 'jsx', 'py'],
    when: (ctx) => ctx.isTest,
    check(ctx) {
      const out = [];
      const { code } = ctx;
      if (ctx.lang === 'py') {
        ctx.lines.forEach((line, k) => {
          const m = /^(\s*)(?:async\s+)?def\s+(test_\w+)/.exec(line.text);
          if (!m) return;
          const body = pyBlock(ctx, k).map((b) => b.text);
          const asserts = body.filter((t) => /^\s*assert\b/.test(t));
          const real = asserts.filter((t) => !/^\s*assert\s+(True|1|not\s+False)\s*$/.test(t));
          const mocks = body.some((t) => /\.assert_(?:called\w*|any_call|has_calls|not_called)\(/.test(t));
          const raises = body.some((t) => /pytest\.raises|assertRaises|self\.assert\w+\(/.test(t));
          if (real.length || raises) return;
          const message = mocks ? 'Test only asserts that mocks were called' : asserts.length ? 'Test asserts a constant' : 'Test makes no assertions';
          out.push(hit(line.start + m[1].length, line.start + line.text.length, message));
        });
        return out;
      }
      const CALLED = /^(toHaveBeenCalled\w*|toBeCalled\w*|toHaveBeenNthCalledWith|toHaveBeenLastCalledWith|toHaveReturned\w*)$/;
      for (const m of code.matchAll(/(?<![\w$.])(?:it|test)(?:\.(?:concurrent|only|skip|each\([^)]*\)))?\s*\(/g)) {
        const open = m.index + m[0].length - 1;
        const ca = callArgs(code, open);
        if (!ca || ca.args.length < 2 || !/^\s*['"`]/.test(code.slice(ca.args[0].start, ca.args[0].end))) continue;
        const body = code.slice(ca.args[1].start, ca.close);
        // Named helpers (expectTotal, assertValid) count, as with eslint-plugin-jest's assertFunctionNames.
        if (/\bassert(?:\.\w+)?\s*\(|\b(?:expect|assert)[A-Z]\w*\s*\(|\bt\.(?:is|deepEqual|true|false|truthy|falsy|throws|assert)\b|\.should\b|expect\.assertions\(/.test(body)) continue;
        const kinds = [...body.matchAll(/\bexpect(?:\.soft|\.poll)?\s*\(/g)].map((e) => {
          const ea = callArgs(body, e.index + e[0].length - 1);
          if (!ea) return 'real';
          const arg = body.slice(e.index + e[0].length, ea.close);
          const matcher = /^\)\s*(?:\.\s*(?:not|resolves|rejects)\s*)*\.\s*(\w+)/.exec(body.slice(ea.close));
          if (matcher && CALLED.test(matcher[1])) return 'mock';
          if (/^\s*(true|false|null|undefined|-?\d+(\.\d+)?|['"`]\s*['"`])\s*$/.test(arg)) return 'constant';
          return 'real';
        });
        if (kinds.includes('real')) continue;
        const message = kinds.includes('mock') ? 'Test only asserts that mocks were called' : kinds.length ? 'Test asserts a constant' : 'Test makes no assertions';
        out.push(hit(m.index, open, message));
      }
      return out;
    },
  },
  {
    id: 'TEST-002',
    slug: 'arbitrary-sleep',
    severity: 'warn',
    weight: 3,
    title: 'Fixed sleep in a test',
    rationale:
      'A hard-coded wait is either too short (flaky on a loaded CI runner) or too long (every run pays for it). It hides the condition the test is actually waiting for.',
    fix: 'Wait for the condition: fake timers (`vi.useFakeTimers`), `await expect.poll(...)`, Testing Library `findBy*`/`waitFor`, Playwright web-first assertions.',
    sample: 'spec.ts',
    langs: ['js', 'jsx', 'py'],
    when: (ctx) => ctx.isTest,
    check(ctx) {
      const out = [];
      const pats = ctx.lang === 'py'
        ? [/\btime\.sleep\s*\(/g, /\bawait\s+asyncio\.sleep\s*\(\s*(?!0\s*\))[\d.]+/g]
        : [/new\s+Promise\s*\(\s*\(?\s*([\w$]+)\s*\)?\s*=>\s*setTimeout\s*\(\s*\1\s*,/g, /\bawait\s+(?:sleep|delay|wait|pause)\s*\(\s*[\d_]+/g, /\.waitForTimeout\s*\(/g, /\bcy\.wait\s*\(\s*\d/g];
      for (const re of pats) for (const m of ctx.code.matchAll(re)) out.push(hit(m.index, m.index + m[0].length, 'Fixed sleep instead of waiting for a condition'));
      return out;
    },
  },
  {
    id: 'TEST-003',
    slug: 'emoji-readme',
    severity: 'warn',
    weight: 1,
    title: 'Emoji-decorated README headings and bullets',
    rationale:
      'A rocket on every heading is the generated-README signature. It breaks heading anchors, adds noise for screen readers, and makes the project look scaffolded rather than maintained.',
    fix: 'Plain headings. Put the effort into the first paragraph: what it does, one install command, one real example.',
    sample: 'readme.md',
    langs: ['md'],
    when: (ctx) => ctx.isReadme,
    check(ctx) {
      const out = [];
      const EMOJI = /(?:(?![©®™])\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*)+\s*/gu;
      const heads = [];
      const bullets = [];
      for (const m of ctx.code.matchAll(/^(#{1,6}[ \t]+|[ \t]*[-*+][ \t]+)(.*)$/gm)) {
        const em = [...m[2].matchAll(EMOJI)].map((e) => ({ start: m.index + m[1].length + e.index, len: e[0].length }));
        if (!em.length) { if (m[1].startsWith('#')) heads.push(null); continue; }
        (m[1].startsWith('#') ? heads : bullets).push(em);
      }
      const emojiHeads = heads.filter(Boolean);
      const flag = (list, message) => {
        for (const em of list) for (const e of em) out.push(hit(e.start, e.start + e.len, message, { fix: { start: e.start, end: e.start + e.len, text: '' } }));
      };
      if (emojiHeads.length >= 3 || (emojiHeads.length >= 2 && emojiHeads.length >= heads.length / 2)) flag(emojiHeads, 'Emoji in heading');
      if (bullets.length >= 5) flag(bullets, 'Emoji-prefixed bullet');
      return out;
    },
  },
  {
    id: 'TEST-004',
    slug: 'focused-or-skipped',
    severity: 'warn',
    weight: 3,
    title: 'Focused or skipped test committed',
    rationale:
      '`.only` silently turns off every other test in the file on CI. `.skip` without a tracked reason is a deleted test that still shows up as coverage.',
    fix: 'Remove `.only` before committing. Fix or delete skipped tests; if a skip is truly needed, give it a reason and an issue link.',
    sample: 'test.ts',
    langs: ['js', 'jsx', 'py'],
    when: (ctx) => ctx.isTest,
    check(ctx) {
      const out = [];
      const { code } = ctx;
      if (ctx.lang === 'py') {
        for (const m of code.matchAll(/@pytest\.mark\.skip\b(?!\s*\(\s*reason)/g)) out.push(hit(m.index, m.index + m[0].length, 'Test skipped without a reason'));
        return out;
      }
      for (const m of code.matchAll(/\b(describe|it|test|context|suite)\.(only|skip)\s*\(/g)) {
        const dot = m.index + m[1].length;
        if (m[2] === 'only') out.push(hit(m.index, dot + 5, `${m[1]}.only disables every other test`, { severity: 'error', fix: { start: dot, end: dot + 5, text: '' } }));
        else out.push(hit(m.index, dot + 5, `${m[1]}.skip hides a test`));
      }
      for (const m of code.matchAll(/(?<![\w$.])(fit|fdescribe|xit|xdescribe|xtest)\s*\(/g)) {
        const focused = m[1].startsWith('f');
        out.push(hit(m.index, m.index + m[1].length, focused ? `${m[1]} disables every other test` : `${m[1]} hides a test`, focused ? { severity: 'error', fix: { start: m.index, end: m.index + 1, text: '' } } : {}));
      }
      return out;
    },
  },
  {
    id: 'MOTION-001',
    slug: 'uniform-entrance',
    severity: 'warn',
    weight: 4,
    title: 'Every element enters with the same fade',
    rationale:
      'Generated videos animate every title, card and logo with one identical fade-and-rise. Nothing leads and nothing follows, so the viewer cannot tell what matters, and the film reads as a template no matter what it is about.',
    fix: 'Give each beat its own entrance: let the hero element move (scale, mask, morph from the previous shape), let supporting elements arrive quietly, and let some things simply be there on the cut.',
    sample: 'tsx',
    langs: ['jsx', 'js', 'html'],
    when: (ctx) => ctx.isVideo,
    check(ctx) {
      const out = [];
      const { code, text } = ctx;
      const groups = new Map();
      const add = (key, start, end) => groups.set(key, [...(groups.get(key) ?? []), [start, end]]);
      for (const m of code.matchAll(/\binterpolate\s*\(/g)) {
        const ca = callArgs(code, m.index + m[0].length - 1);
        if (!ca || ca.args.length < 3) continue;
        const [, input, output] = ca.args.map((a) => text.slice(a.start, a.end).replace(/\s+/g, ''));
        const frames = rangeSpan(input);
        if (frames != null && output === '[0,1]') add(`interpolate:${frames}`, m.index, ca.close + 1);
      }
      for (const m of code.matchAll(/\.from\s*\(/g)) {
        const ca = callArgs(code, m.index + m[0].length - 1);
        const vars = ca && ca.args[1] ? text.slice(ca.args[1].start, ca.args[1].end) : '';
        if (!/\bopacity\s*:\s*0\b/.test(vars)) continue;
        add(`gsap:${/\bduration\s*:\s*([\d.]+)/.exec(vars)?.[1] ?? '0.5'}`, m.index + 1, ca.close + 1);
      }
      for (const el of ctx.markup?.elements ?? []) {
        if (/^(?:Fade\w*|Slide\w*|Reveal\w*|Appear\w*|Rise\w*)$/.test(el.name)) add(`component:${el.name}`, el.start, el.start + el.name.length + 1);
      }
      for (const [key, sites] of groups) {
        if (sites.length < 3) continue;
        const [kind, value] = key.split(':');
        const what = kind === 'component' ? `<${value}>` : kind === 'gsap' ? `${value}s opacity tween` : `${value}-frame fade`;
        out.push(hit(sites[2][0], sites[2][1], `${sites.length} elements enter with the same ${what}`));
      }
      return out;
    },
  },
  {
    id: 'MOTION-002',
    slug: 'fixed-step-stagger',
    severity: 'warn',
    weight: 2,
    title: 'List items staggered by a fixed step',
    rationale:
      'A delay of `i * 5` makes every list, logo wall and bullet stack arrive like a typewriter. The rhythm never changes, long lists drag, and the last item lands well after the viewer has stopped reading.',
    fix: 'Spread items over a fixed window with an easing curve (`Math.round(easeOut(i / (n - 1)) * 18)`), group items that belong together, or land them on the beats of the music.',
    sample: 'tsx',
    langs: ['jsx', 'js'],
    when: (ctx) => ctx.isVideo,
    check(ctx) {
      const out = [];
      // Structural, not name-based: a frame offset or delay that is (anything) times a constant.
      const STEP = /\b(?:frame|f)\s*-\s*\(?\s*(?:[\w$.]+\s*\*\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*\*\s*[\w$.]+)|\b(?:delay|from|startFrom|offset)\s*[:=]\s*\{?\s*(?:[\w$.]+\s*\*\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*\*\s*[\w$.]+)/g;
      for (const m of ctx.code.matchAll(STEP)) {
        const step = m[1] ?? m[2] ?? m[3] ?? m[4];
        out.push(hit(m.index, m.index + m[0].length, `Fixed ${step}${/^\d+$/.test(step) ? '-frame' : 's'} stagger per item`));
      }
      return out;
    },
  },
  {
    id: 'MOTION-003',
    slug: 'bouncy-spring',
    severity: 'warn',
    weight: 3,
    title: 'Springs and eases that overshoot by default',
    rationale:
      "Remotion's default spring (damping 10) overshoots by about 16 percent, and GSAP's `back`, `elastic` and `bounce` eases wobble on arrival. On UI and type, that wobble reads as a toy, and it is the most recognisable motion in agent-made launch videos.",
    fix: 'Use a critically damped spring (`config: { damping: 200 }`) or clamp it (`overshootClamping: true`). Reserve overshoot for one physical object per film, and keep it to a few percent.',
    sample: 'tsx',
    langs: ['jsx', 'js', 'html'],
    when: (ctx) => ctx.isVideo,
    check(ctx) {
      const out = [];
      const { code, text } = ctx;
      for (const m of code.matchAll(/(?<![\w$.])spring\s*\(/g)) {
        const ca = callArgs(code, m.index + m[0].length - 1);
        if (!ca || !ca.args.length) continue;
        const opts = text.slice(ca.args[0].start, ca.args[0].end);
        if (!/^\s*\{/.test(opts) || /overshootClamping\s*:\s*true/.test(opts)) continue;
        const damping = /\bdamping\s*:\s*([\d.]+)/.exec(opts);
        if (!/\bconfig\s*:/.test(opts)) out.push(hit(m.index, ca.close + 1, 'spring() with the default config overshoots (damping 10)'));
        else if (damping && Number(damping[1]) < 15) out.push(hit(m.index, ca.close + 1, `spring() with damping ${damping[1]} overshoots`));
      }
      for (const s of ctx.strings) {
        if (!/\bease\s*:\s*$/.test(code.slice(Math.max(0, s.start - 20), s.start))) continue;
        const m = /^(bounce|elastic|back)(?:\.(?:in|out|inOut))?(?:\(\s*([\d.]+)?[^)]*\))?$/.exec(s.value);
        if (m && !(m[1] === 'back' && m[2] && Number(m[2]) <= 0.5)) out.push(hit(s.start, s.end, `"${s.value}" ease wobbles on arrival`));
      }
      return out;
    },
  },
  {
    id: 'MOTION-004',
    slug: 'equal-length-scenes',
    severity: 'warn',
    weight: 3,
    title: 'Every scene has the same length',
    rationale:
      'Three-second scene after three-second scene is a slideshow, not an edit. Pacing is how a film tells the viewer what matters: the hook is short, the payoff holds, and the logo gets out of the way.',
    fix: 'Time each scene to what it has to show and to the music, and vary lengths on purpose. Keep durations in one array so the rhythm is visible in review.',
    sample: 'tsx',
    langs: ['jsx'],
    when: (ctx) => ctx.isVideo,
    check(ctx) {
      const scenes = (ctx.markup?.elements ?? []).filter((el) => /(?:^|\.)Sequence$/.test(el.name) && el.attrs.durationInFrames);
      const values = new Set(scenes.map((el) => el.attrs.durationInFrames.value.replace(/\s+/g, '')));
      if (scenes.length < 3 || values.size !== 1) return [];
      const a = scenes[0].attrs.durationInFrames;
      return [hit(a.start, a.end, `All ${scenes.length} scenes run ${[...values][0]} frames`)];
    },
  },
  {
    id: 'MOTION-005',
    slug: 'repeated-sfx',
    severity: 'warn',
    weight: 3,
    title: 'The same sound effect on every cut',
    rationale:
      'A stock whoosh on every transition and a click on every cursor move is the audio signature of generated launch videos. Repetition trains the viewer to stop hearing it, and the one sound that should land is lost.',
    fix: 'Score the film, not the cuts: let the music carry most transitions, give the two or three moments that matter their own sound, and vary pitch and level when a sound must repeat.',
    sample: 'tsx',
    langs: ['jsx'],
    when: (ctx) => ctx.isVideo,
    check(ctx) {
      const bySrc = new Map();
      for (const el of ctx.markup?.elements ?? []) {
        if (!/(?:^|\.)(?:Audio|Html5Audio|OffthreadAudio)$/.test(el.name) || !el.attrs.src) continue;
        const key = el.attrs.src.value.replace(/\s+/g, '');
        bySrc.set(key, [...(bySrc.get(key) ?? []), el.attrs.src]);
      }
      const out = [];
      for (const [key, attrs] of bySrc) {
        if (attrs.length < 3) continue;
        const name = /([\w-]+\.(?:mp3|wav|ogg|m4a|aac))/.exec(key)?.[1] ?? key;
        out.push(hit(attrs[2].start, attrs[2].end, `${name} plays at ${attrs.length} points`));
      }
      return out;
    },
  },
  {
    id: 'MOTION-006',
    slug: 'unmixed-audio',
    severity: 'warn',
    weight: 2,
    title: 'Layered audio left at full volume',
    rationale:
      'Every Remotion `<Audio>` plays at volume 1 unless told otherwise. Music, voice and effects stacked at full level fight each other, clip, and bury the voice-over: the mix sounds like nobody listened to it.',
    fix: 'Set a level on every layer (music around 0.2 to 0.35, effects lower than you think) and duck the music under voice with a `volume={(f) => ...}` curve.',
    sample: 'tsx',
    langs: ['jsx'],
    when: (ctx) => ctx.isVideo,
    check(ctx) {
      const tracks = (ctx.markup?.elements ?? []).filter((el) => /(?:^|\.)(?:Audio|Html5Audio|OffthreadAudio)$/.test(el.name));
      if (tracks.length < 2) return [];
      const others = tracks.length - 1;
      return tracks.filter((el) => !el.attrs.volume).map((el) => hit(el.start, el.start + el.name.length + 1, `<${el.name}> layered with ${others} other track${others > 1 ? 's' : ''} at full volume`));
    },
  },
];

for (const r of RULES) r.domain = r.id.split('-')[0];
