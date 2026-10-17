// Bookmarklet: scores the live DOM of the page you are on and shows the findings in an
// overlay. The bookmark itself only imports this module (see score.js), and the page's
// content never leaves the tab.
//
// The overlay lives in a shadow root styled through a constructed stylesheet, so the page's
// CSS cannot restyle it and a style-src policy that forbids inline styles does not unstyle it.

import { scorePage, findingItems, band, h } from './page-score.mjs';

const HOST_ID = 'sloplint-overlay';
const HOME = new URL('score.html', import.meta.url).href;
const ruleHref = (id) => new URL(`./#rule/${id}`, import.meta.url).href;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const CSS = `
:host { all: initial; position: fixed; z-index: 2147483647; right: 16px; bottom: 16px; }
.panel { box-sizing: border-box; display: grid; grid-template-rows: auto auto minmax(0, 1fr) auto; gap: 12px; width: min(420px, calc(100vw - 32px)); max-height: min(640px, calc(100vh - 32px)); padding: 16px; background: #15171a; color: #e8e6e1; border: 1px solid #2a2e34; border-radius: 8px; box-shadow: 0 12px 32px rgb(0 0 0 / 0.4); font: 14px/1.45 system-ui, sans-serif; }
.top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.label { font: 500 12px/1 ui-monospace, monospace; letter-spacing: 0.06em; text-transform: uppercase; color: #9a9ea6; }
.close { width: 32px; height: 32px; border: 1px solid #2a2e34; border-radius: 6px; background: transparent; color: #e8e6e1; font: 18px/1 system-ui, sans-serif; cursor: pointer; }
.close:hover { border-color: #9a9ea6; }
.close:focus-visible, a:focus-visible { outline: 2px solid #f2a33a; outline-offset: 2px; }
.score { display: grid; gap: 4px; }
.value { margin: 0; font: 600 44px/1 ui-monospace, monospace; }
.value span { font-size: 18px; color: #9a9ea6; }
.grade { margin: 0; font-weight: 600; font-size: 16px; }
.meter { height: 6px; background: #2a2e34; border-radius: 2px; overflow: hidden; }
.meter span { display: block; height: 100%; }
.meta { margin: 0; color: #9a9ea6; font-size: 13px; }
[data-band="clean"] .grade { color: #5fbf8f; } [data-band="clean"] .meter span { background: #5fbf8f; }
[data-band="minor"] .grade { color: #e6c15a; } [data-band="minor"] .meter span { background: #e6c15a; }
[data-band="heavy"] .grade { color: #ef6b5b; } [data-band="heavy"] .meter span { background: #ef6b5b; }
ol { margin: 0; padding: 0; list-style: none; overflow: auto; overscroll-behavior: contain; border-top: 1px solid #2a2e34; }
.finding { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 2px 10px; padding: 10px 0; border-bottom: 1px solid #2a2e34; }
.finding > :not(.sev) { grid-column: 2; margin: 0; }
.sev { grid-row: span 3; width: 8px; height: 8px; margin-top: 6px; border-radius: 50%; }
.sev-error { background: #ef6b5b; } .sev-warn { background: #e6c15a; }
.finding-msg { font-weight: 500; }
.finding-meta { font: 12px/1.4 ui-monospace, monospace; color: #9a9ea6; }
.finding-code { display: block; overflow-wrap: anywhere; font: 12px/1.5 ui-monospace, monospace; color: #9a9ea6; }
mark { background: rgb(242 163 58 / 0.18); color: #e8e6e1; }
a { color: #f2a33a; }
.empty { padding: 12px 0; color: #9a9ea6; }
.foot { margin: 0; color: #9a9ea6; font-size: 12px; }
`;

// The page as it is now: the serialized DOM (inline styles and scripts included) plus every
// stylesheet the browser lets a script read. Inline <style> text is already in the HTML.
function collect() {
  const html = (document.doctype ? '<!doctype html>\n' : '') + document.documentElement.outerHTML;
  const sheets = [];
  let unreadable = 0;
  for (const sheet of [...document.styleSheets, ...document.adoptedStyleSheets]) {
    const node = sheet.ownerNode;
    if (node?.localName === 'style' && node.textContent.trim()) continue;
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      unreadable++; // Another origin's stylesheet served without CORS: browsers hide its rules from scripts.
      continue;
    }
    sheets.push({ url: sheet.href ?? location.href, css: Array.from(rules, (r) => r.cssText).join('\n') });
  }
  return { html, sheets, unreadable };
}

export function run() {
  document.getElementById(HOST_ID)?.remove();
  const { html, sheets, unreadable } = collect();
  const { results, score: s } = scorePage(html, sheets);

  const host = h('div', { id: HOST_ID });
  const root = host.attachShadow({ mode: 'open' });
  const style = new CSSStyleSheet();
  style.replaceSync(CSS);
  root.adoptedStyleSheets = [style];

  const onKey = (event) => {
    if (event.key === 'Escape') close();
  };
  const close = () => {
    host.remove();
    document.removeEventListener('keydown', onKey);
  };
  const fill = h('span');
  fill.style.width = `${s.score}%`;
  const items = findingItems(results, ruleHref);
  const closeButton = h('button', { type: 'button', class: 'close', 'aria-label': 'Close sloplint', onclick: close }, '×');

  root.append(
    h('section', { class: 'panel', role: 'dialog', 'aria-label': `Slop Score for ${location.host}`, 'data-band': band(s.score) },
      h('div', { class: 'top' }, h('span', { class: 'label' }, `sloplint · ${location.host}`), closeButton),
      h('div', { class: 'score' },
        h('p', { class: 'value' }, String(s.score), h('span', {}, '/100')),
        h('p', { class: 'grade' }, s.grade),
        h('div', { class: 'meter', 'aria-hidden': 'true' }, fill),
        h('p', { class: 'meta' }, `${plural(s.errors, 'error')} · ${plural(s.warnings, 'warning')} · the page and ${plural(sheets.length, 'stylesheet')}${unreadable ? ` · ${unreadable} cross-origin ${unreadable === 1 ? 'sheet' : 'sheets'} unreadable` : ''}`),
      ),
      h('ol', {}, items.length ? items : h('li', { class: 'empty' }, 'No findings on this page.')),
      h('p', { class: 'foot' }, 'Rule details open on the sloplint site. ', h('a', { href: HOME, target: '_blank', rel: 'noopener' }, 'Score by URL')),
    ),
  );
  document.documentElement.append(host);
  document.addEventListener('keydown', onKey);
  closeButton.focus({ preventScroll: true });
}
