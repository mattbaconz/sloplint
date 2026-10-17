// Scores a whole web page: its HTML (inline <style> and <script> included) plus its
// stylesheets, on the same engine the CLI runs. Shared by score.js and the bookmarklet.

import { lint, score } from '../src/engine.mjs';

// sheets: [{ url, css }]. Each sheet is linted under a neutral .css name, so the path rules
// (tests, fixtures, server routes) never fire on a stylesheet because of where it is hosted.
export function scorePage(html, sheets = []) {
  const files = [{ name: 'page.html', url: null, text: html }, ...sheets.map((s, i) => ({ name: `stylesheet-${i + 1}.css`, url: s.url, text: s.css }))];
  const results = files.map((f) => ({ ...lint(f.text, f.name), file: f }));
  return { results, score: score(results) };
}

export const band = (s) => (s === 0 ? 'clean' : s < 40 ? 'minor' : 'heavy');

// Builds DOM nodes. Strings become text nodes, so nothing here is ever parsed as HTML.
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else el.setAttribute(key, value === true ? '' : String(value));
  }
  el.append(...children.flat().filter((c) => c != null && c !== false));
  return el;
}

// A one-line view of the flagged source, trimmed around the finding: live pages are often
// minified onto a few very long lines.
function excerpt(text, d, room = 48) {
  const from = Math.max(0, d.start - room);
  const to = Math.min(text.length, d.end + room);
  const flat = (s) => s.replace(/\s+/g, ' ');
  return [
    (from > 0 ? '…' : '') + flat(text.slice(from, d.start)).trimStart(),
    h('mark', {}, flat(text.slice(d.start, Math.min(d.end, d.start + 120)))),
    flat(text.slice(d.end, to)).trimEnd() + (to < text.length ? '…' : ''),
  ];
}

// <li> per finding, errors first, each with its source excerpt and a link to the rule.
export function findingItems(results, ruleHref) {
  const all = results.flatMap((r) => r.diagnostics.map((d) => ({ d, file: r.file })));
  all.sort((a, b) => (a.d.severity === b.d.severity ? 0 : a.d.severity === 'error' ? -1 : 1));
  return all.map(({ d, file }) =>
    h('li', { class: 'finding' },
      h('span', { class: `sev sev-${d.severity}`, 'aria-hidden': 'true' }),
      h('p', { class: 'finding-msg' }, d.message),
      h('p', { class: 'finding-meta' },
        h('a', { href: ruleHref(d.rule), target: '_blank', rel: 'noopener' }, d.rule),
        ` · ${d.severity === 'error' ? 'error' : 'warning'} · `,
        /^https?:/.test(file.url ?? '') ? h('a', { href: file.url, target: '_blank', rel: 'noopener', title: file.url }, file.name) : file.name,
        `:${d.line}`,
      ),
      h('code', { class: 'finding-code' }, excerpt(file.text, d)),
    ),
  );
}
