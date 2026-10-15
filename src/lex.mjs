// Tolerant scanners shared by every rule. Nothing here builds an AST: each scanner
// returns offsets into the original text, and "masked" copies keep length and
// newlines so a regex index on masked text maps straight back to the source.

const WORD = /[\w$]/;
const REGEX_AFTER = new Set('(,=:[!&|?{};+-*%~^'.split(''));
const KEYWORDS = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void', 'throw', 'yield', 'await', 'default']);

function blankRange(out, a, b) {
  for (let k = a; k < b; k++) if (out[k] !== '\n') out[k] = ' ';
}

function closeQuote(text, i, q, to) {
  for (let j = i + 1; j < to; j++) {
    const c = text[j];
    if (c === '\\') j++;
    else if (c === q) return j;
    else if (c === '\n') return -1;
  }
  return -1;
}

function closeRegex(text, i, to) {
  let inClass = false;
  for (let j = i + 1; j < to; j++) {
    const c = text[j];
    if (c === '\\') { j++; continue; }
    if (c === '\n') return -1;
    if (inClass) { if (c === ']') inClass = false; }
    else if (c === '[') inClass = true;
    else if (c === '/') return j > i + 1 ? j : -1;
  }
  return -1;
}

// JS/TS/JSX. Writes masked chars into `out` (shared across script blocks of one file).
// Strings: { start, end, value, quote, tagged, exprs: [{ start, end }] } — offsets absolute.
export function scanJs(text, from = 0, to = text.length, out = text.split('')) {
  const strings = [];
  const comments = [];
  const tpl = [];
  let prev = '';
  let i = from;

  const readTemplate = (tok) => {
    const seg = i;
    while (i < to) {
      const c = text[i];
      if (c === '\\') { i += 2; continue; }
      if (c === '`') {
        blankRange(out, seg, i);
        tok.end = ++i;
        prev = 'str';
        return;
      }
      if (c === '$' && text[i + 1] === '{') {
        blankRange(out, seg, i);
        tok.exprs.push({ start: i + 2, end: to });
        tpl.push({ tok, depth: 0 });
        i += 2;
        prev = '{';
        return;
      }
      i++;
    }
    blankRange(out, seg, to);
    tok.end = to;
  };

  while (i < to) {
    const c = text[i];
    const d = text[i + 1];
    if (c === '/' && d === '/' && text[i - 1] !== ':') {
      let e = text.indexOf('\n', i);
      if (e < 0 || e > to) e = to;
      comments.push({ start: i, end: e, text: text.slice(i, e) });
      blankRange(out, i, e);
      i = e;
      continue;
    }
    if (c === '/' && d === '*') {
      let e = text.indexOf('*/', i + 2);
      e = e < 0 || e >= to ? to : e + 2;
      comments.push({ start: i, end: e, text: text.slice(i, e) });
      blankRange(out, i, e);
      i = e;
      continue;
    }
    if (c === '"' || c === "'") {
      const e = closeQuote(text, i, c, to);
      if (e < 0) { prev = c; i++; continue; }
      strings.push({ start: i, end: e + 1, value: text.slice(i + 1, e), quote: c, tagged: false, exprs: [] });
      blankRange(out, i + 1, e);
      prev = 'str';
      i = e + 1;
      continue;
    }
    if (c === '`') {
      const tagged = prev === ')' || prev === ']' || (WORD.test(prev[0] ?? '') && !KEYWORDS.has(prev));
      const tok = { start: i, end: to, value: '', quote: '`', tagged, exprs: [] };
      strings.push(tok);
      i++;
      readTemplate(tok);
      continue;
    }
    if (c === '/' && (prev === '' || REGEX_AFTER.has(prev) || KEYWORDS.has(prev))) {
      const e = closeRegex(text, i, to);
      if (e > 0) {
        blankRange(out, i + 1, e);
        i = e + 1;
        while (/[a-z]/i.test(text[i] ?? '')) i++;
        prev = 'str';
        continue;
      }
    }
    if (tpl.length) {
      const top = tpl[tpl.length - 1];
      if (c === '{') top.depth++;
      else if (c === '}') {
        if (top.depth === 0) {
          tpl.pop();
          top.tok.exprs[top.tok.exprs.length - 1].end = i;
          i++;
          readTemplate(top.tok);
          continue;
        }
        top.depth--;
      }
    }
    if (WORD.test(c)) {
      let e = i;
      while (e < to && WORD.test(text[e])) e++;
      prev = text.slice(i, e);
      i = e;
      continue;
    }
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  for (const s of strings) if (s.quote === '`') s.value = text.slice(s.start + 1, Math.max(s.start + 1, s.end - 1));
  return { strings, comments, out };
}

// Python: strings (incl. prefixes and triple quotes) and # comments.
export function scanPy(text) {
  const out = text.split('');
  const strings = [];
  const comments = [];
  const n = text.length;
  let i = 0;
  while (i < n) {
    const c = text[i];
    if (c === '#') {
      let e = text.indexOf('\n', i);
      if (e < 0) e = n;
      comments.push({ start: i, end: e, text: text.slice(i, e) });
      blankRange(out, i, e);
      i = e;
      continue;
    }
    let prefix = '';
    let q = i;
    if (WORD.test(c)) {
      let e = i;
      while (e < n && WORD.test(text[e])) e++;
      if (/^[rbuf]{1,2}$/i.test(text.slice(i, e)) && (text[e] === '"' || text[e] === "'")) {
        prefix = text.slice(i, e);
        q = e;
      } else { i = e; continue; }
    }
    const qc = text[q];
    if (qc !== '"' && qc !== "'") { i++; continue; }
    const triple = text.startsWith(qc.repeat(3), q);
    let e;
    if (triple) {
      e = q + 3;
      while (e < n && !text.startsWith(qc.repeat(3), e)) e += text[e] === '\\' ? 2 : 1;
      const valueStart = q + 3;
      const end = Math.min(n, e + 3);
      strings.push({ start: i, end, value: text.slice(valueStart, Math.min(e, n)), quote: qc.repeat(3), prefix });
      blankRange(out, valueStart, Math.min(e, n));
      i = end;
      continue;
    }
    e = closeQuote(text, q, qc, n);
    if (e < 0) { i = q + 1; continue; }
    strings.push({ start: i, end: e + 1, value: text.slice(q + 1, e), quote: qc, prefix });
    blankRange(out, q + 1, e);
    i = e + 1;
  }
  return { strings, comments, out };
}

// CSS: comments blanked; rules flattened with nesting resolved.
export function maskCss(text, from = 0, to = text.length, out = text.split('')) {
  const comments = [];
  let i = from;
  while (i < to) {
    const s = text.indexOf('/*', i);
    if (s < 0 || s >= to) break;
    let e = text.indexOf('*/', s + 2);
    e = e < 0 || e >= to ? to : e + 2;
    comments.push({ start: s, end: e, text: text.slice(s, e) });
    blankRange(out, s, e);
    i = e;
  }
  return { comments, out };
}

function combineSelector(parent, child) {
  if (!parent) return child;
  if (child.includes('&')) return child.replaceAll('&', parent);
  if (parent.includes(',')) return child;
  return `${parent} ${child}`;
}

export function parseDecl(text, a, b) {
  const seg = text.slice(a, b);
  const colon = seg.indexOf(':');
  if (colon < 0) return null;
  const prop = seg.slice(0, colon).trim().toLowerCase();
  if (!/^(--[\w-]+|-?[a-z][a-z-]*)$/.test(prop)) return null;
  const rawVal = seg.slice(colon + 1);
  const lead = rawVal.length - rawVal.trimStart().length;
  const value = rawVal.trim();
  if (!value) return null;
  const valueStart = a + colon + 1 + lead;
  return { prop, value, start: a + (seg.length - seg.trimStart().length), valueStart, end: valueStart + value.length };
}

export function parseDecls(text, from, to) {
  const decls = [];
  let pend = from;
  for (let i = from; i <= to; i++) {
    if (i === to || text[i] === ';') {
      const d = parseDecl(text, pend, i);
      if (d) decls.push(d);
      pend = i + 1;
    }
  }
  return decls;
}

export function parseCss(masked, from = 0, to = masked.length) {
  const rules = [];
  const stack = [];
  let pend = from;
  for (let i = from; i < to; i++) {
    const c = masked[i];
    if (c === '"' || c === "'") {
      const e = closeQuote(masked, i, c, to);
      if (e > 0) i = e;
      continue;
    }
    if (c === '(') {
      const e = matchPair(masked, i, '(', ')', false);
      if (e > 0 && e < to) i = e;
      continue;
    }
    if (c === '{') {
      const raw = masked.slice(pend, i);
      const sel = raw.trim();
      const parent = stack[stack.length - 1];
      const at = sel.startsWith('@');
      stack.push({
        selector: at ? (parent?.selector ?? '') : combineSelector(parent?.selector, sel),
        at,
        media: at ? [...(parent?.media ?? []), sel] : parent?.media,
        start: pend + (raw.length - raw.trimStart().length),
        selEnd: i - (raw.length - raw.trimEnd().length),
        decls: [],
      });
      pend = i + 1;
    } else if (c === ';' || c === '}') {
      const top = stack[stack.length - 1];
      if (top && !top.at) {
        const d = parseDecl(masked, pend, i);
        if (d) top.decls.push(d);
      }
      if (c === '}' && stack.length) {
        stack.pop();
        if (!top.at && top.decls.length) rules.push({ selector: top.selector, start: top.start, selEnd: top.selEnd, end: i + 1, decls: top.decls, media: top.media ?? [] });
      }
      pend = i + 1;
    }
  }
  return rules;
}

// Balanced-pair matcher. With quotes=true, skips quoted runs (use on raw text);
// on masked text strings are already blank so quotes=false is enough.
export function matchPair(text, i, open = '{', close = '}', quotes = true) {
  let depth = 0;
  for (let j = i; j < text.length; j++) {
    const c = text[j];
    if (quotes && (c === '"' || c === "'" || c === '`')) {
      const e = c === '`' ? text.indexOf('`', j + 1) : closeQuote(text, j, c, text.length);
      if (e > 0) j = e;
      continue;
    }
    if (c === open) depth++;
    else if (c === close && --depth === 0) return j;
  }
  return -1;
}

// Splits a call's argument list (masked text, `open` = index of '(') at top-level commas.
export function callArgs(masked, open) {
  const close = matchPair(masked, open, '(', ')', false);
  if (close < 0) return null;
  const args = [];
  let depth = 0;
  let start = open + 1;
  for (let j = open + 1; j < close; j++) {
    const c = masked[j];
    if (c === '(' || c === '{' || c === '[') depth++;
    else if (c === ')' || c === '}' || c === ']') depth--;
    else if (c === ',' && depth === 0) { args.push({ start, end: j }); start = j + 1; }
  }
  if (masked.slice(start, close).trim()) args.push({ start, end: close });
  return { args, close };
}

// Markdown: blank fenced code, inline code, link targets, front matter.
// HTML comments stay visible (they carry suppression directives) but are reported separately.
export function maskMarkdown(text) {
  const out = text.split('');
  const comments = [];
  const fence = /^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^ {0,3}\1[`~]*[ \t]*$|(?![\s\S]))/gm;
  for (const m of text.matchAll(fence)) blankRange(out, m.index, m.index + m[0].length);
  const front = /^---\n[\s\S]*?\n---\n/.exec(text);
  if (front) blankRange(out, 0, front[0].length);
  const masked1 = out.join('');
  for (const m of masked1.matchAll(/<!--[\s\S]*?-->/g)) {
    comments.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
    blankRange(out, m.index, m.index + m[0].length);
  }
  const masked2 = out.join('');
  for (const m of masked2.matchAll(/(`+)[^`\n]+?\1/g)) blankRange(out, m.index, m.index + m[0].length);
  const masked3 = out.join('');
  for (const m of masked3.matchAll(/\]\([^)\n]*\)|<https?:[^>\s]+>|https?:\/\/\S+/g)) blankRange(out, m.index, m.index + m[0].length);
  return { out: out.join(''), comments };
}

const VOID = new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
const TAG_NAME = /[A-Za-z][\w.:-]*/y;
const ATTR_NAME = /[^\s=>/{]+/y;
const UNQUOTED = /[^\s>]+/y;
const CLOSER = /<\/\s*([\w.:-]*)\s*>/y;

function sticky(re, text, i) {
  re.lastIndex = i;
  const m = re.exec(text);
  return m ? m[0] : null;
}

function readTag(text, lt, jsx) {
  let i = lt + 1;
  if (text[i] === '>') return { name: '#fragment', attrs: {}, end: i + 1, selfClosing: false };
  const name = sticky(TAG_NAME, text, i);
  if (!name) return null;
  i += name.length;
  if (jsx && /^\s*(,|extends\b)/.test(text.slice(i, i + 12))) return null;
  const attrs = {};
  while (i < text.length) {
    while (/\s/.test(text[i] ?? '')) i++;
    const c = text[i];
    if (c === undefined) return null;
    if (c === '>') return { name, attrs, end: i + 1, selfClosing: false };
    if (c === '/' && text[i + 1] === '>') return { name, attrs, end: i + 2, selfClosing: true };
    if (c === '<') return null;
    if (c === '{') {
      const e = matchPair(text, i);
      if (e < 0) return null;
      i = e + 1;
      continue;
    }
    const an = sticky(ATTR_NAME, text, i);
    if (!an) { i++; continue; }
    i += an.length;
    let j = i;
    while (/\s/.test(text[j] ?? '')) j++;
    if (text[j] !== '=') { attrs[an] = { value: '', start: i, end: i, expr: false }; continue; }
    j++;
    while (/\s/.test(text[j] ?? '')) j++;
    const q = text[j];
    if (q === '"' || q === "'") {
      const e = text.indexOf(q, j + 1);
      if (e < 0) return null;
      attrs[an] = { value: text.slice(j + 1, e), start: j + 1, end: e, expr: false };
      i = e + 1;
    } else if (q === '{') {
      const e = matchPair(text, j);
      if (e < 0) return null;
      attrs[an] = { value: text.slice(j + 1, e), start: j + 1, end: e, expr: true };
      i = e + 1;
    } else {
      const u = sticky(UNQUOTED, text, j) ?? '';
      attrs[an] = { value: u, start: j, end: j + u.length, expr: false };
      i = j + Math.max(1, u.length);
    }
  }
  return null;
}

function jsxTagStart(code, lt) {
  let k = lt - 1;
  while (k >= 0 && /\s/.test(code[k])) k--;
  if (k < 0) return true;
  const ch = code[k];
  if ('(,=?:&|{}>[;'.includes(ch)) return true;
  if (!WORD.test(ch)) return false;
  let s = k;
  while (s > 0 && WORD.test(code[s - 1])) s--;
  return KEYWORDS.has(code.slice(s, k + 1));
}

// Markup tree for HTML/Vue/Svelte and for JSX inside scripts. For JSX pass the masked
// script text as `code` so tags inside strings/comments are ignored.
export function parseMarkup(text, { jsx = false, code = null, from = 0, to = text.length } = {}) {
  const root = { name: '#root', attrs: {}, children: [], text: [], parent: null, depth: -1, start: from, end: to };
  const elements = [];
  let cur = root;
  let i = from;
  let textStart = from;
  const pushText = (a, b) => {
    if (b > a && !(jsx && cur === root)) cur.text.push({ start: a, end: b });
  };
  while (i < to) {
    const lt = text.indexOf('<', i);
    if (lt < 0 || lt >= to) break;
    if (code && code[lt] !== '<') { i = lt + 1; continue; }
    if (!jsx && text.startsWith('<!--', lt)) {
      pushText(textStart, lt);
      const e = text.indexOf('-->', lt);
      i = textStart = e < 0 ? to : e + 3;
      continue;
    }
    const next = text[lt + 1] ?? '';
    if (next === '/') {
      CLOSER.lastIndex = lt;
      const m = CLOSER.exec(text);
      if (!m || (jsx && cur === root)) { i = lt + 1; continue; }
      pushText(textStart, lt);
      const name = m[1] || '#fragment';
      let el = cur;
      while (el !== root && el.name !== name && el.name.toLowerCase() !== name.toLowerCase()) el = el.parent;
      if (el !== root) {
        el.end = lt + m[0].length;
        el.closeStart = lt;
        cur = el.parent;
      }
      i = textStart = lt + m[0].length;
      continue;
    }
    if (!(next === '>' || /[A-Za-z]/.test(next))) { i = lt + 1; continue; }
    if (jsx && !jsxTagStart(code, lt)) { i = lt + 1; continue; }
    const tag = readTag(text, lt, jsx);
    if (!tag) { i = lt + 1; continue; }
    pushText(textStart, lt);
    const el = {
      name: tag.name, attrs: tag.attrs, start: lt, openEnd: tag.end, end: tag.end,
      parent: cur, children: [], text: [], depth: cur.depth + 1,
    };
    cur.children.push(el);
    elements.push(el);
    const lower = el.name.toLowerCase();
    if (!jsx && (lower === 'script' || lower === 'style')) {
      let close = text.toLowerCase().indexOf(`</${lower}`, tag.end);
      if (close < 0 || close > to) close = to;
      el.contentStart = tag.end;
      el.contentEnd = close;
      const gt = text.indexOf('>', close);
      el.end = gt < 0 ? to : gt + 1;
      i = textStart = el.end;
      continue;
    }
    if (!tag.selfClosing && !(!jsx && VOID.has(lower))) cur = el;
    i = textStart = tag.end;
  }
  pushText(textStart, to);
  return { root, elements };
}

export function lineStarts(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1);
  return starts;
}

export function position(starts, index) {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= index) lo = mid;
    else hi = mid - 1;
  }
  return { line: lo + 1, col: index - starts[lo] + 1 };
}
