// "Score a page": fetches a URL through the Worker in ../worker, then lints the HTML and
// stylesheets here in the browser. Also builds the bookmarklet link.

import { DOMAINS } from '../src/engine.mjs';
import { scorePage, findingItems, band, h } from './page-score.mjs';

// ponytail: set to the deployed Worker's URL after `npx wrangler deploy` in ../worker.
const FETCHER = ['localhost', '127.0.0.1'].includes(location.hostname) ? 'http://localhost:8787/' : 'https://sloplint-score.mattbaconz.workers.dev/';

const $ = (selector) => document.querySelector(selector);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const ruleHref = (id) => new URL(`./#rule/${id}`, location.href).href;
let current = null;

// Accepts "example.com" as well as full URLs.
function normalize(raw) {
  const text = raw.trim();
  return /^[a-z][a-z\d+.-]*:/i.test(text) ? text : `https://${text}`;
}

async function fetchPage(url) {
  let res;
  try {
    res = await fetch(`${FETCHER}?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(25_000) });
  } catch (error) {
    throw new Error(`Could not reach the page fetcher (${error.message}).`, { cause: error });
  }
  const body = await res.json().catch(() => ({ error: `The page fetcher answered HTTP ${res.status}.` }));
  if (!res.ok) throw Object.assign(new Error(body.error), { status: res.status });
  return body;
}

async function run(raw) {
  const status = $('#url-status');
  if (!raw.trim()) {
    status.textContent = 'Enter the address of a public page, like example.com.';
    return;
  }
  const url = normalize(raw);
  const submit = $('#url-submit');
  $('#url').value = url;
  status.textContent = `Fetching ${url}…`;
  submit.disabled = true;
  history.replaceState(null, '', `?url=${encodeURIComponent(url)}`);
  try {
    const page = await fetchPage(url);
    const { results, score: s } = scorePage(page.html, page.stylesheets);
    current = { url: page.url, host: new URL(page.url).host, s };
    render(page, results, s);
    status.textContent = '';
  } catch (error) {
    const hint = error.status === 400 ? '' : ' If the page needs JavaScript or a sign-in, use the bookmarklet below.';
    status.textContent = error.message + hint;
  } finally {
    submit.disabled = false;
  }
}

function render(page, results, s) {
  $('#result').hidden = false;
  $('#card').dataset.band = band(s.score);
  $('#result-title').textContent = current.host;
  $('#score-number').textContent = String(s.score);
  $('#score-grade').textContent = s.grade;
  $('#score-fill').style.width = `${s.score}%`;
  $('#score-meta').textContent = `${plural(s.errors, 'error')} · ${plural(s.warnings, 'warning')} · the page and ${plural(page.stylesheets.length, 'stylesheet')}`;
  $('#domain-counts').replaceChildren(
    ...Object.keys(DOMAINS).map((d) => h('div', { title: DOMAINS[d] }, h('dt', {}, d), h('dd', { class: s.byDomain[d] ? null : 'is-zero' }, String(s.byDomain[d])))),
  );

  const notes = page.skipped.map((x) => h('li', {}, `Not graded: ${x.url} (${x.reason})`));
  if (page.truncated) notes.unshift(h('li', {}, 'The page is over 2 MB; only the first 2 MB were graded.'));
  $('#skipped').replaceChildren(...notes);

  const items = findingItems(results, ruleHref);
  $('#findings').replaceChildren(...(items.length ? items : [h('li', { class: 'empty' }, 'No findings. If the page looks empty here, it probably renders with JavaScript: try the bookmarklet.')]));
  $('#result').scrollIntoView({ block: 'start' });
}

// A 1200x630 PNG of the score, sized for link previews, drawn in the active preset.
async function downloadCard() {
  const css = getComputedStyle(document.documentElement);
  const v = (name) => css.getPropertyValue(name).trim();
  const { s, host } = current;
  await Promise.all([`600 200px ${v('--font-mono')}`, `600 44px ${v('--font-body')}`].map((f) => document.fonts.load(f)));
  const canvas = h('canvas', { width: 1200, height: 630 });
  const g = canvas.getContext('2d');
  g.fillStyle = v('--bg');
  g.fillRect(0, 0, 1200, 630);
  g.fillStyle = v('--ink-2');
  g.font = `500 26px ${v('--font-mono')}`;
  g.fillText('SLOP SCORE', 80, 110);
  g.fillStyle = v('--ink');
  g.font = `600 44px ${v('--font-body')}`;
  g.fillText(host, 80, 175, 1040);
  g.font = `600 200px ${v('--font-mono')}`;
  g.fillText(String(s.score), 72, 400);
  const width = g.measureText(String(s.score)).width;
  g.fillStyle = v('--ink-2');
  g.font = `500 48px ${v('--font-mono')}`;
  g.fillText('/100', 88 + width, 400);
  const tone = { clean: '--good', minor: '--warn', heavy: '--bad' }[band(s.score)];
  g.fillStyle = v(tone);
  g.font = `600 44px ${v('--font-body')}`;
  g.fillText(s.grade, 80, 470);
  g.fillStyle = v('--raised');
  g.fillRect(80, 500, 1040, 12);
  g.fillStyle = v(tone);
  g.fillRect(80, 500, Math.max(0, 10.4 * s.score), 12);
  g.fillStyle = v('--ink-2');
  g.font = `500 24px ${v('--font-mono')}`;
  g.fillText(`${plural(s.errors, 'error')} · ${plural(s.warnings, 'warning')}`, 80, 570);
  g.textAlign = 'right';
  g.fillText('sloplint · mattbaconz.github.io/sloplint', 1120, 570);
  canvas.toBlob((blob) => {
    const link = h('a', { href: URL.createObjectURL(blob), download: `slop-score-${host}.png` });
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  });
}

function flash(button, text) {
  const label = button.textContent;
  button.textContent = text;
  setTimeout(() => { button.textContent = label; }, 1800);
}

function copy(button, text) {
  navigator.clipboard.writeText(text).then(() => flash(button, 'Copied'), () => flash(button, 'Copy blocked: select and copy by hand'));
}

// The bookmark only imports bookmarklet.mjs from wherever this page is served, so the
// overlay always runs the current engine. `void` keeps the tab from navigating to the result.
function initBookmarklet() {
  const src = new URL('bookmarklet.mjs', import.meta.url).href;
  const home = new URL('score.html', import.meta.url).href;
  const blocked = `sloplint could not load on this page: its Content-Security-Policy blocks outside scripts. Score it by URL at ${home} instead.`;
  const code = `javascript:void import(${JSON.stringify(src)}).then(m=>m.run(),()=>alert(${JSON.stringify(blocked)}))`;
  $('#bookmarklet-link').href = code;
  $('#bookmarklet-code').textContent = code;
  $('#bookmarklet-link').addEventListener('click', (event) => {
    event.preventDefault();
    flash(event.currentTarget, 'Drag me to your bookmarks bar');
  });
  $('#copy-bookmarklet').addEventListener('click', (event) => copy(event.currentTarget, code));
}

$('#url-form').addEventListener('submit', (event) => {
  event.preventDefault();
  run($('#url').value);
});
$('#copy-link').addEventListener('click', (event) => copy(event.currentTarget, `${location.origin}${location.pathname}?url=${encodeURIComponent(current.url)}`));
$('#download-card').addEventListener('click', downloadCard);
initBookmarklet();

const shared = new URLSearchParams(location.search).get('url');
if (shared) run(shared);
