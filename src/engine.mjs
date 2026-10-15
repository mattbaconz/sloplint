// Browser-safe core: build a per-file context, run rules, apply fixes, score.
// No node: imports here; the docs site runs this exact module.

import { scanJs, scanPy, maskCss, parseCss, parseDecls, parseMarkup, maskMarkdown, lineStarts, position } from './lex.mjs';
import { twBox, cssBox, classList, cssMatcher } from './style.mjs';
import { RULES, DOMAINS } from './rules.mjs';

export { RULES, DOMAINS };

const EXT = {
  js: 'js', mjs: 'js', cjs: 'js', ts: 'js', mts: 'js', cts: 'js',
  jsx: 'jsx', tsx: 'jsx',
  html: 'html', htm: 'html',
  vue: 'vue', svelte: 'vue', astro: 'vue',
  css: 'css', scss: 'css', less: 'css',
  py: 'py',
  md: 'md', mdx: 'md',
};

export const EXTENSIONS = Object.keys(EXT);

export function langOf(path, text = '') {
  const ext = /\.([a-z0-9]+)$/i.exec(path)?.[1]?.toLowerCase();
  const lang = EXT[ext];
  if (lang === 'js' && /\.m?jsx?$/i.test(path) && /\bfrom\s+['"]react['"]/.test(text) && /<\/[A-Za-z]|\/>/.test(text)) return 'jsx';
  return lang ?? null;
}

export const RULE_BY_ID = new Map(RULES.map((r) => [r.id, r]));

export function findRule(query) {
  const q = String(query).trim().toUpperCase();
  return RULE_BY_ID.get(q) ?? RULES.find((r) => r.slug.toUpperCase() === q) ?? null;
}

export const GRADES = [
  [0, 'Studio Grade'],
  [19, 'Minor Slop'],
  [39, 'Noticeable Slop'],
  [59, 'Sloppy'],
  [79, 'Heavy Slop'],
  [100, 'Critical Slop'],
];

export const gradeOf = (score) => GRADES.find(([max]) => score <= max)[1];

function lazy(obj, name, fn) {
  Object.defineProperty(obj, name, {
    configurable: true,
    enumerable: true,
    get() {
      const value = fn();
      Object.defineProperty(obj, name, { value, enumerable: true });
      return value;
    },
  });
}

function staticText(text, tok) {
  const chars = text.slice(tok.start + 1, Math.max(tok.start + 1, tok.end - 1)).split('');
  for (const e of tok.exprs) {
    for (let k = e.start - 2; k <= e.end; k++) {
      const rel = k - tok.start - 1;
      if (rel >= 0 && rel < chars.length && chars[rel] !== '\n') chars[rel] = ' ';
    }
  }
  return chars.join('');
}

// A JS string is treated as a class list when it sits in a class-ish slot (className=, cn(...),
// a *Class/*styles/*variants key) or when it is shaped like one ("px-4 rounded-md").
const CLASS_CONTEXT = /(?:\b(?:class|className|[\w$]*(?:[cC]lass(?:es|Name|List)?|[sS]tyles?|[vV]ariants?))\s*[=:]\s*\{?\s*|\b(?:cn|clsx|classnames|cx|cva|tv|twMerge|twJoin|add|remove|toggle)\s*\([^()]*|\btw\s*)$/;
const CLASS_TOKEN = /^!?(?:[\w-]+:)*-?[a-z][\w.-]*(?:\/[\w.]+)?(?:-?\[[^\]\s]+\])?$/;
function looksLikeClasses(value) {
  const tokens = value.trim().split(/\s+/);
  return tokens.length >= 2 && tokens.every((t) => CLASS_TOKEN.test(t)) && tokens.some((t) => t.includes('-'));
}

const NON_PROSE = /^(code|pre|kbd|samp|script|style|svg|math)$/i;
const COPY_ATTRS = ['alt', 'title', 'placeholder', 'aria-label', 'label'];

export function createContext(text, path, { design = null } = {}) {
  const lang = langOf(path, text);
  const p = path.replace(/\\/g, '/').toLowerCase();
  const ctx = {
    path,
    text,
    lang,
    isTest: /(^|\/)(__tests__|tests?|specs?|e2e|cypress)\/|\.(test|spec|e2e|cy)\.[^/]+$|(^|\/)test_[^/]*\.py$|_test\.py$|(^|\/)conftest\.py$/.test(p),
    isFixture: /(^|\/)(__mocks__|mocks?|fixtures?|stories|storybook|seeds?)\/|\.(stories|story|mock|fixture)\.[^/]+$/.test(p),
    isReadme: /(^|\/)[^/]*readme[^/]*\.mdx?$/.test(p),
    isServerPath: /(^|\/)(api|server|middleware|routes)(\/|\.)|\.server\.|(^|\/)route\.[jt]s$/.test(p),
    code: '',
    strings: [],
    comments: [],
    markup: null,
    cssRules: [],
    design,
  };

  if (lang === 'js' || lang === 'jsx') {
    const r = scanJs(text);
    ctx.code = r.out.join('');
    ctx.strings = r.strings;
    ctx.comments = r.comments;
  } else if (lang === 'py') {
    const r = scanPy(text);
    ctx.code = r.out.join('');
    ctx.strings = r.strings;
    ctx.comments = r.comments;
  } else if (lang === 'css') {
    const r = maskCss(text);
    ctx.code = r.out.join('');
    ctx.comments = r.comments;
    ctx.cssRules = parseCss(ctx.code);
  } else if (lang === 'md') {
    const r = maskMarkdown(text);
    ctx.code = r.out;
    ctx.comments = r.comments;
  } else if (lang === 'html' || lang === 'vue') {
    ctx.markup = parseMarkup(text);
    const out = text.replace(/[^\n]/g, ' ').split('');
    const cssOut = text.split('');
    const scan = (a, b) => {
      for (let k = a; k < b; k++) out[k] = text[k];
      const r = scanJs(text, a, b, out);
      ctx.strings.push(...r.strings);
      ctx.comments.push(...r.comments);
    };
    const front = lang === 'vue' ? /^---\r?\n([\s\S]*?)\r?\n---/.exec(text) : null;
    if (front) scan(4, 4 + front[1].length);
    for (const el of ctx.markup.elements) {
      const name = el.name.toLowerCase();
      if (name === 'script' && el.contentStart != null) scan(el.contentStart, el.contentEnd);
      if (name === 'style' && el.contentStart != null) {
        const r = maskCss(text, el.contentStart, el.contentEnd, cssOut);
        ctx.comments.push(...r.comments);
        ctx.cssRules.push(...parseCss(cssOut.join(''), el.contentStart, el.contentEnd));
      }
    }
    for (const m of text.matchAll(/<!--[\s\S]*?-->/g)) ctx.comments.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
    ctx.code = out.join('');
  }

  const stringIndex = new Map(ctx.strings.map((s) => [s.start, s]));
  ctx.stringAt = (i) => stringIndex.get(i) ?? null;
  ctx.isCode = (i) => ctx.code[i] === text[i] && !/\s/.test(text[i] ?? ' ');
  const serverMarker = /^\s*['"]use server['"]|export\s+default\s+async\s+function|['"]server-only['"]|from\s+['"]next\/headers['"]|\bgetServerSession\s*\(/m;
  ctx.isClient = /^\s*['"]use client['"]/m.test(text) || ((lang === 'jsx' || lang === 'vue') && !serverMarker.test(text));

  ctx.isVideo = /\bfrom\s+['"](?:remotion|@remotion\/[\w-]+|gsap)['"]|\bgsap\.(?:to|from|timeline)\s*\(/.test(text);
  if (lang === 'jsx') lazy(ctx, 'markup', () => parseMarkup(text, { jsx: true, code: ctx.code }));

  lazy(ctx, 'lines', () => {
    const starts = lineStarts(ctx.code);
    return starts.map((s, k) => ({ start: s, text: ctx.code.slice(s, (starts[k + 1] ?? ctx.code.length + 1) - 1) }));
  });

  lazy(ctx, 'cssDecls', () => {
    const decls = ctx.cssRules.flatMap((r) => r.decls);
    if (ctx.markup && lang !== 'jsx') {
      for (const el of ctx.markup.elements) {
        const s = el.attrs.style;
        if (s && !s.expr) decls.push(...parseDecls(text, s.start, s.end));
      }
    }
    return decls;
  });

  const markupAttrStarts = () => {
    const starts = new Set();
    for (const el of ctx.markup?.elements ?? []) for (const a of Object.values(el.attrs)) if (!a.expr) starts.add(a.start);
    return starts;
  };

  lazy(ctx, 'classStrings', () => {
    const list = [];
    const seen = new Set();
    const add = (start, s) => {
      if (!seen.has(start) && s.trim()) { seen.add(start); list.push({ start, text: s }); }
    };
    if (lang !== 'py' && lang !== 'md' && lang !== 'css') {
      for (const s of ctx.strings) {
        const value = s.quote === '`' ? staticText(text, s) : s.value;
        if (CLASS_CONTEXT.test(ctx.code.slice(Math.max(0, s.start - 300), s.start)) || looksLikeClasses(value)) add(s.start + 1, value);
      }
    }
    for (const el of lang === 'jsx' ? [] : ctx.markup?.elements ?? []) {
      for (const name of ['class', 'className', ':class']) {
        const a = el.attrs[name];
        if (!a) continue;
        if (!a.expr) add(a.start, a.value);
        else for (const m of a.value.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)) add(a.start + m.index + 1, m[2]);
      }
    }
    return list;
  });

  lazy(ctx, 'copy', () => {
    const segs = [];
    if (lang === 'md') {
      for (const line of ctx.lines) if (line.text.trim()) segs.push({ start: line.start, text: line.text, kind: 'md' });
      return segs;
    }
    if (lang === 'css') return segs;
    if (ctx.markup) {
      const braces = lang === 'jsx' || lang === 'vue';
      const prose = (el) => {
        for (let e = el; e; e = e.parent) if (NON_PROSE.test(e.name)) return false;
        return true;
      };
      for (const el of [ctx.markup.root, ...ctx.markup.elements]) {
        if (!prose(el)) continue;
        let depth = 0;
        for (const t of el.text) {
          let buf = '';
          for (let i = t.start; i < t.end; i++) {
            const c = text[i];
            if (braces && c === '{') { depth++; buf += ' '; continue; }
            if (braces && c === '}') { depth = Math.max(0, depth - 1); buf += ' '; continue; }
            buf += depth > 0 && c !== '\n' ? ' ' : c;
          }
          if (buf.trim()) segs.push({ start: t.start, text: buf, kind: 'text' });
        }
        const lower = el.name.toLowerCase();
        const attrs = [...COPY_ATTRS];
        if (/^(input|button|option)$/.test(lower)) attrs.push('value');
        if (lower === 'meta') attrs.push('content');
        for (const name of attrs) {
          const a = el.attrs[name];
          if (a && !a.expr && a.value.trim()) segs.push({ start: a.start, text: a.value, kind: `attr:${name}` });
        }
      }
    }
    const skip = markupAttrStarts();
    for (const s of ctx.strings) {
      if (lang === 'py') {
        const open = s.start + (s.prefix?.length ?? 0) + s.quote.length;
        segs.push({ start: open, text: s.value, kind: 'string' });
        continue;
      }
      if (skip.has(s.start + 1)) continue;
      const before = ctx.code.slice(Math.max(0, s.start - 30), s.start);
      if (/\b(?:from|import|require\s*\(|import\s*\()\s*$/.test(before) || /^use (client|server|strict)$/.test(s.value)) continue;
      segs.push({ start: s.start + 1, text: s.quote === '`' ? staticText(text, s) : s.value, kind: 'string' });
    }
    return segs;
  });

  const boxes = new WeakMap();
  let cssFor = null;
  ctx.box = (el) => {
    if (boxes.has(el)) return boxes.get(el);
    cssFor ??= cssMatcher(ctx.cssRules);
    const decls = cssFor(el);
    const s = el.attrs?.style;
    if (s && !s.expr) decls.push(...parseDecls(text, s.start, s.end));
    const box = { ...cssBox(decls), ...twBox(classList(el)) };
    boxes.set(el, box);
    return box;
  };

  return ctx;
}

const DIRECTIVE = /sloplint-disable(-next-line|-line|-file)?(?:[ \t]+((?:[A-Z]+-\d{3})(?:\s*,\s*[A-Z]+-\d{3})*))?/g;

function suppressions(ctx, starts) {
  const file = new Set();
  const lines = new Map();
  for (const c of ctx.comments) {
    for (const m of c.text.matchAll(DIRECTIVE)) {
      const ids = m[2] ? m[2].split(/\s*,\s*/) : ['*'];
      const kind = m[1] ?? '-file';
      if (kind === '-file') { for (const id of ids) file.add(id); continue; }
      const line = position(starts, c.start + m.index).line + (kind === '-next-line' ? 1 : 0);
      const set = lines.get(line) ?? new Set();
      for (const id of ids) set.add(id);
      lines.set(line, set);
    }
  }
  return (rule, line) => file.has('*') || file.has(rule) || lines.get(line)?.has('*') || lines.get(line)?.has(rule);
}

// options.design: palette and typefaces from the project's DESIGN.md (see parseDesign).
export function lint(text, path, options = {}) {
  const ctx = createContext(text, path, options);
  const starts = lineStarts(text);
  const result = { path, lines: text ? starts.length : 0, diagnostics: [] };
  if (!ctx.lang) return result;
  const suppressed = suppressions(ctx, starts);
  const seen = new Set();
  for (const rule of RULES) {
    if (!rule.langs.includes(ctx.lang) || (rule.when && !rule.when(ctx))) continue;
    let found;
    try {
      found = rule.check(ctx);
    } catch (error) {
      throw new Error(`${rule.id} failed on ${path}: ${error.message}`, { cause: error });
    }
    for (const f of found) {
      const key = `${rule.id}:${f.start}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const from = position(starts, f.start);
      const to = position(starts, Math.max(f.start, f.end - 1));
      if (suppressed(rule.id, from.line)) continue;
      result.diagnostics.push({
        rule: rule.id,
        severity: f.severity ?? rule.severity,
        weight: rule.weight,
        message: f.message ?? rule.title,
        line: from.line,
        col: from.col,
        endLine: to.line,
        endCol: to.col + 1,
        start: f.start,
        end: Math.max(f.end, f.start + 1),
        fix: f.fix ?? null,
      });
    }
  }
  result.diagnostics.sort((a, b) => a.start - b.start || a.rule.localeCompare(b.rule));
  return result;
}

// Applies non-overlapping fixes right-to-left. Returns the new text and how many applied.
export function applyFixes(text, diagnostics) {
  const fixes = diagnostics.filter((d) => d.fix).map((d) => d.fix).sort((a, b) => b.start - a.start || b.end - a.end);
  let out = text;
  let floor = Infinity;
  let applied = 0;
  for (const f of fixes) {
    if (f.end > floor) continue;
    out = out.slice(0, f.start) + f.text + out.slice(f.end);
    floor = f.start;
    applied++;
  }
  return { text: out, applied };
}

export function fixSource(text, path, passes = 5, options = {}) {
  let current = text;
  let total = 0;
  for (let i = 0; i < passes; i++) {
    const { text: next, applied } = applyFixes(current, lint(current, path, options).diagnostics);
    if (!applied) break;
    total += applied;
    current = next;
  }
  return { text: current, applied: total };
}

// Line diff via LCS. Returns rows of { kind: 'same' | 'del' | 'add', left?, right? }.
export function diffLines(a, b) {
  const n = a.length;
  const m = b.length;
  const lcs = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) ops.push({ kind: 'same', left: a[i++], right: b[j++] });
    else if (i < n && (j === m || lcs[i + 1][j] >= lcs[i][j + 1])) ops.push({ kind: 'del', left: a[i++] });
    else ops.push({ kind: 'add', right: b[j++] });
  }
  return ops;
}

// Pairs each run of deletions with the following run of additions so they sit side by side.
export function pairRows(ops) {
  const rows = [];
  for (let k = 0; k < ops.length; ) {
    if (ops[k].kind === 'same') {
      rows.push(ops[k++]);
      continue;
    }
    const dels = [];
    const adds = [];
    while (k < ops.length && ops[k].kind === 'del') dels.push(ops[k++].left);
    while (k < ops.length && ops[k].kind === 'add') adds.push(ops[k++].right);
    for (let r = 0; r < Math.max(dels.length, adds.length); r++) rows.push({ kind: 'change', left: dels[r], right: adds[r] });
  }
  return rows;
}

// Weighted score: each rule counts at most 3 times per file, normalised by size so a
// large codebase is not punished for being large. 0 only when nothing was found.
export function score(results) {
  const byDomain = Object.fromEntries(Object.keys(DOMAINS).map((d) => [d, 0]));
  let penalty = 0;
  let lines = 0;
  let errors = 0;
  let warnings = 0;
  let fixable = 0;
  for (const r of results) {
    lines += r.lines;
    const perRule = new Map();
    for (const d of r.diagnostics) {
      if (d.severity === 'error') errors++;
      else warnings++;
      if (d.fix) fixable++;
      byDomain[d.rule.split('-')[0]]++;
      const n = (perRule.get(d.rule) ?? 0) + 1;
      perRule.set(d.rule, n);
      if (n <= 3) penalty += d.weight;
    }
  }
  const k = 24 * Math.sqrt(Math.max(1, lines / 800));
  const value = penalty === 0 ? 0 : Math.min(100, Math.max(1, Math.round(100 * (1 - Math.exp(-penalty / k)))));
  return { score: value, grade: gradeOf(value), penalty, errors, warnings, fixable, files: results.length, lines, byDomain };
}
