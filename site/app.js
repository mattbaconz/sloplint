// Docs site: preset switcher, live grader, style generator and rule catalog.
// The grader and the generator import the exact code the CLI runs, straight from ../src.

import { RULES, DOMAINS, lint, score, fixSource, diffLines, pairRows } from '../src/engine.mjs';
import { generateStyle, specimenHtml, parseDesign, MOODS } from '../src/design.mjs';
import { h } from './page-score.mjs';

const PRESET_KEY = 'sloplint:preset';

const PRESETS = [
  {
    id: 'obsidian-telemetry',
    name: 'Obsidian Telemetry',
    mood: 'Dark instrument panel for monitoring, trading and developer tools. Quiet surfaces, one amber signal color, numbers that never jitter.',
    figureLabel: 'Settled today',
    figure: '$48,210.40',
  },
  {
    id: 'editorial-serif',
    name: 'Editorial Serif',
    mood: 'Print-inspired reading interface for publications, documentation and reports. Warm paper, a confident serif, oxblood as the only accent.',
    figureLabel: 'Reading time',
    figure: '12 min',
  },
  {
    id: 'swiss-brutalist',
    name: 'Swiss Brutalist',
    mood: 'A strict grid, heavy grotesque type, black hairlines and one signal red. Zero radius, zero decoration, every element decided.',
    figureLabel: 'Index',
    figure: '04 / 12',
  },
  {
    id: 'tactile-hardware',
    name: 'Tactile Hardware',
    mood: 'Modeled on field recorders and test gear. Warm gray housings, keys that look pressable, safety orange on the one control that matters.',
    figureLabel: 'Input level',
    figure: '−12.0 dB',
  },
];

const SAMPLES = {
  dashboard: { file: 'dashboard.slop.tsx', path: 'app/dashboard/page.tsx' },
  api: { file: 'api.slop.ts', path: 'src/server/api.ts' },
  service: { file: 'service.slop.py', path: 'services/billing.py' },
  landing: { file: 'landing.slop.html', path: 'public/index.html' },
  checkout: { file: 'checkout.slop.test.ts', path: 'tests/checkout.test.ts' },
  readme: { file: 'readme.slop.md', path: 'README.md' },
  launch: { file: 'launch.slop.tsx', path: 'video/Launch.tsx' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const $ = (selector) => document.querySelector(selector);

// Renders `code spans` inside rule prose as <code> elements.
function withCode(text) {
  return text.split(/(`[^`]+`)/).map((part) => (/^`[^`]+`$/.test(part) ? h('code', {}, part.slice(1, -1)) : part));
}

const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

const texts = new Map();
async function load(path) {
  if (texts.has(path)) return texts.get(path);
  const res = await fetch(new URL(path, import.meta.url), { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`${path} returned HTTP ${res.status}`);
  const text = (await res.text()).replace(/\r\n/g, '\n');
  texts.set(path, text);
  return text;
}

function loadFailure(path, error) {
  return h('p', { class: 'empty', role: 'alert' }, `Could not load ${path} (${error.message}). Serve the repository root with "npm run site" so the page can read ../src and ../examples.`);
}

// ─── Preset switcher ─────────────────────────────────────────────────────────

function applyPreset(id, remember) {
  document.documentElement.dataset.preset = id;
  for (const input of document.querySelectorAll('input[name="preset"]')) input.checked = input.value === id;
  if (!remember) return;
  try {
    localStorage.setItem(PRESET_KEY, id);
  } catch {
    // Storage can be blocked (private mode); the preset still applies for this visit.
  }
}

function initPresets() {
  let saved = null;
  try {
    saved = localStorage.getItem(PRESET_KEY);
  } catch {
    // Storage blocked: fall back to the default preset.
  }
  if (PRESETS.some((p) => p.id === saved)) applyPreset(saved, false);
  for (const input of document.querySelectorAll('input[name="preset"]')) {
    input.addEventListener('change', () => applyPreset(input.value, true));
  }

  const swatches = ['--surface', '--raised', '--line', '--ink-2', '--ink', '--accent', '--good', '--warn', '--bad'];
  $('#preset-grid').replaceChildren(
    ...PRESETS.map((p) =>
      h('article', { class: 'preset-card', 'data-preset': p.id, 'aria-labelledby': `preset-${p.id}` },
        h('h3', { id: `preset-${p.id}` }, p.name),
        h('p', {}, p.mood),
        h('div', { class: 'preset-sample' },
          h('div', { class: 'preset-figure' }, h('span', { class: 'label' }, p.figureLabel), h('strong', {}, p.figure)),
          h('button', { type: 'button', class: 'btn btn-primary', onclick: () => applyPreset(p.id, true) }, `Use ${p.name}`),
        ),
        h('div', { class: 'swatches', 'aria-hidden': 'true' }, swatches.map((v) => h('span', { style: `background-color: var(${v})` }))),
        h('div', { class: 'preset-foot' }, h('code', {}, `npx @sloplint/cli init --preset ${p.id}`)),
      ),
    ),
  );
}

// ─── Copy buttons ────────────────────────────────────────────────────────────

function initCopy() {
  for (const button of document.querySelectorAll('[data-copy]')) {
    const label = button.textContent;
    button.addEventListener('click', () => {
      const text = document.getElementById(button.dataset.copy).textContent;
      navigator.clipboard.writeText(text).then(
        () => { button.textContent = 'Copied'; },
        () => {
          getSelection().selectAllChildren(document.getElementById(button.dataset.copy));
          button.textContent = 'Selected: press Ctrl+C';
        },
      ).finally(() => setTimeout(() => { button.textContent = label; }, 1800));
    });
  }
}

// ─── Hero terminal and facts ─────────────────────────────────────────────────

function frameNodes(d, lines, path) {
  const rule = RULES.find((r) => r.id === d.rule);
  const line = (lines[d.line - 1] ?? '').replace(/\t/g, ' ');
  const max = 56;
  const shown = line.length > max ? `${line.slice(0, max - 1)}…` : line;
  const pad = ' '.repeat(String(d.line).length);
  const width = Math.max(1, Math.min(d.endLine === d.line ? d.endCol - d.col : shown.length, shown.length - d.col + 1));
  const fix = rule.fix.length > 54 ? `${rule.fix.slice(0, 53)}…` : rule.fix;
  const kind = d.severity === 'error' ? 't-err' : 't-warn';
  return [
    h('span', { class: kind }, `${d.severity === 'error' ? 'error' : 'warning'}[${d.rule}]`), `: ${d.message}\n`,
    h('span', { class: 't-gutter' }, `${pad}--> `), `${path}:${d.line}:${d.col}\n`,
    h('span', { class: 't-gutter' }, `${pad} |\n${d.line} | `), `${shown}\n`,
    h('span', { class: 't-gutter' }, `${pad} | `), h('span', { class: kind }, `${' '.repeat(Math.max(0, d.col - 1))}${'^'.repeat(width)}`), '\n',
    h('span', { class: 't-gutter' }, `${pad} = `), h('span', { class: 't-dim' }, `fix: ${fix}`), '\n\n',
  ];
}

async function initHero() {
  const target = $('#hero-terminal');
  const path = `../examples/samples/${SAMPLES.api.file}`;
  try {
    const text = await load(path);
    const result = lint(text, SAMPLES.api.path);
    const s = score([result]);
    const shown = result.diagnostics.filter((d) => d.severity === 'error').slice(0, 3);
    const lines = text.split('\n');
    target.replaceChildren(
      ...shown.flatMap((d) => frameNodes(d, lines, SAMPLES.api.path)),
      h('span', { class: 't-dim' }, `… ${plural(result.diagnostics.length - shown.length, 'more finding')}\n\n`),
      h('span', { class: 't-err' }, `Slop Score ${s.score}/100 ${s.grade}`), '\n',
      h('span', { class: 't-dim' }, `${plural(s.errors, 'error')} · ${plural(s.warnings, 'warning')} · ${s.fixable} autofixable`),
    );
  } catch (error) {
    target.replaceChildren(loadFailure(path, error));
  }
}

function initFacts() {
  const facts = [
    [String(RULES.length), 'deterministic rules'],
    [String(Object.keys(DOMAINS).length), 'domains, from CSS to SQL'],
    ['0', 'runtime dependencies'],
    ['0/100', 'Slop Score on its own source'],
  ];
  $('#facts').replaceChildren(...facts.map(([value, label]) => h('div', {}, h('dt', {}, label), h('dd', {}, value))));
}

// ─── Grader ──────────────────────────────────────────────────────────────────

const source = $('#source');
const gutter = $('#gutter');
const fileName = $('#file-name');
const applyButton = $('#apply-fixes');
const undoButton = $('#undo-fixes');
let autoPath = true;
let undoText = null;
let timer = 0;
// The samples sit next to examples/samples/DESIGN.md, so they are graded against it as the
// CLI grades them. Pasted code has no design system and skips the token rules.
let design = null;

// Picks a virtual file name so the right language and path rules apply to pasted code.
function guessPath(text) {
  const t = text.trimStart();
  if (/^(<!doctype html|<html|<head|<body)/i.test(t)) return 'index.html';
  if (/^(def |class \w+(\(.*\))?:|from [\w.]+ import |import \w+$)/m.test(t) && !/;\s*$/m.test(t)) return 'app/service.py';
  if (/\b(describe|it|test)\s*\(/.test(t) && /\bexpect\s*\(/.test(t)) return 'tests/app.test.ts';
  if (/<[A-Za-z][^>]*>/.test(t) && /(\/>|<\/[A-Za-z])/.test(t) && /\breturn\b|=>/.test(t)) return 'app/page.tsx';
  if (/\b(app|router)\.(get|post|put|patch|delete|use)\(|export async function (GET|POST|PUT|PATCH|DELETE)\b/.test(t)) return 'src/server/routes.ts';
  if (/^[^{}()=;]+\{[^{}]*:[^{}]*\}/m.test(t) && !/\b(function|const|let|var|import|return)\b/.test(t)) return 'styles.css';
  if (/^#{1,6} \S/m.test(t)) return 'README.md';
  return 'src/index.ts';
}

function renderGutter(text, diagnostics) {
  const worst = new Map();
  for (const d of diagnostics) if (worst.get(d.line) !== 'error') worst.set(d.line, d.severity);
  const count = text.split('\n').length;
  const nodes = [];
  for (let n = 1; n <= count; n++) {
    const sev = worst.get(n);
    nodes.push(sev ? h('span', { class: sev === 'error' ? 'g-error' : 'g-warn' }, String(n)) : String(n), '\n');
  }
  gutter.replaceChildren(...nodes);
  gutter.scrollTop = source.scrollTop;
}

function reveal(d) {
  source.focus();
  source.setSelectionRange(d.start, d.end);
  source.scrollTop = Math.max(0, (d.line - 5) * 20);
  gutter.scrollTop = source.scrollTop;
}

function renderReport(text, result, s) {
  const empty = !text.trim();
  const report = $('.report');
  report.dataset.band = empty ? '' : s.score === 0 ? 'clean' : s.score < 40 ? 'minor' : 'heavy';
  $('#score-number').textContent = String(s.score);
  $('#score-grade').textContent = empty ? 'Waiting for code' : s.grade;
  $('#score-fill').style.width = `${s.score}%`;
  $('#score-meta').textContent = empty
    ? 'Paste code to get a score.'
    : `${plural(s.errors, 'error')} · ${plural(s.warnings, 'warning')} · ${plural(s.lines, 'line')} as ${fileName.value.trim()}${design ? ', against examples/samples/DESIGN.md' : ''}`;

  $('#domain-counts').replaceChildren(
    ...Object.keys(DOMAINS).map((d) => h('div', { title: DOMAINS[d] }, h('dt', {}, d), h('dd', { class: s.byDomain[d] ? null : 'is-zero' }, String(s.byDomain[d])))),
  );

  applyButton.disabled = !s.fixable;
  applyButton.textContent = s.fixable ? `Apply ${plural(s.fixable, 'autofix', 'autofixes')}` : 'No autofixes available';

  const list = $('#diagnostics');
  if (!result.diagnostics.length) {
    list.replaceChildren(h('li', { class: 'empty' }, empty ? 'Findings appear here as you type.' : 'No findings. This file is Studio Grade.'));
    return;
  }
  list.replaceChildren(
    ...result.diagnostics.map((d) =>
      h('li', {},
        h('button', { type: 'button', class: 'diag', onclick: () => reveal(d) },
          h('span', { class: `sev sev-${d.severity}`, 'aria-hidden': 'true' }),
          h('span', { class: 'diag-msg' }, d.message),
          h('span', { class: 'diag-meta' }, `${d.rule} · line ${d.line}:${d.col}${d.fix ? ' · autofix' : ''}`),
        ),
      ),
    ),
  );
}

function grade() {
  const text = source.value;
  if (autoPath) fileName.value = guessPath(text);
  const path = fileName.value.trim() || 'src/index.ts';
  let result;
  try {
    result = lint(text, path, { design });
  } catch (error) {
    $('#diagnostics').replaceChildren(h('li', { class: 'empty', role: 'alert' }, `${error.message}. The rest of the page still works; please open an issue with this snippet.`));
    return;
  }
  const s = score([result]);
  renderGutter(text, result.diagnostics);
  renderReport(text, result, s);
}

function showChanges(before, after) {
  const ops = diffLines(before.split('\n'), after.split('\n'));
  const keep = new Set();
  ops.forEach((o, i) => {
    if (o.kind !== 'same') for (let k = i - 2; k <= i + 2; k++) keep.add(k);
  });
  const lines = [];
  let gap = false;
  ops.forEach((o, i) => {
    if (!keep.has(i)) {
      gap = true;
      return;
    }
    if (gap && lines.length) lines.push(h('span', { class: 'ln ln-same' }, '…'));
    gap = false;
    const mark = o.kind === 'del' ? '- ' : o.kind === 'add' ? '+ ' : '  ';
    lines.push(h('span', { class: `ln ln-${o.kind}` }, mark + (o.kind === 'add' ? o.right : o.left)));
  });
  $('#changes-diff').replaceChildren(h('div', { class: 'diff-col' }, h('pre', {}, lines)));
  $('#changes').hidden = false;
}

async function loadSample(key) {
  const sample = SAMPLES[key];
  const path = `../examples/samples/${sample.file}`;
  for (const chip of document.querySelectorAll('[data-sample]')) chip.setAttribute('aria-pressed', String(chip.dataset.sample === key));
  try {
    source.value = await load(path);
    design = parseDesign(await load('../examples/samples/DESIGN.md'));
  } catch (error) {
    $('#diagnostics').replaceChildren(h('li', {}, loadFailure(path, error)));
    return;
  }
  autoPath = false;
  fileName.value = sample.path;
  undoText = null;
  undoButton.hidden = true;
  $('#changes').hidden = true;
  source.scrollTop = 0;
  grade();
}

function initGrader() {
  source.addEventListener('input', () => {
    undoText = null;
    undoButton.hidden = true;
    $('#changes').hidden = true;
    clearTimeout(timer);
    timer = setTimeout(grade, 120);
  });
  source.addEventListener('scroll', () => {
    gutter.scrollTop = source.scrollTop;
  });
  source.addEventListener('paste', () => {
    autoPath = true;
    design = null;
  });
  fileName.addEventListener('input', () => {
    autoPath = !fileName.value.trim();
    clearTimeout(timer);
    timer = setTimeout(grade, 120);
  });
  for (const chip of document.querySelectorAll('[data-sample]')) chip.addEventListener('click', () => loadSample(chip.dataset.sample));

  applyButton.addEventListener('click', () => {
    const before = source.value;
    const { text, applied } = fixSource(before, fileName.value.trim() || 'src/index.ts');
    if (!applied) return;
    source.value = text;
    undoText = before;
    undoButton.hidden = false;
    showChanges(before, text);
    grade();
  });
  undoButton.addEventListener('click', () => {
    if (undoText == null) return;
    source.value = undoText;
    undoText = null;
    undoButton.hidden = true;
    $('#changes').hidden = true;
    grade();
  });

  grade();
  loadSample('dashboard');
}

// ─── Style generator ─────────────────────────────────────────────────────────

const SEED_WORDS = ['harbor', 'quarry', 'meridian', 'lantern', 'atlas', 'juniper', 'cobalt', 'tundra', 'saffron', 'pylon', 'ember', 'basalt', 'willow', 'heron', 'garnet', 'fjord'];

function renderStyle() {
  const style = generateStyle({
    seed: $('#style-seed').value.trim() || 'sloplint',
    brief: $('#style-brief').value.trim(),
    mood: $('#style-mood').value || undefined,
    mode: $('#style-mode').value || undefined,
  });
  const { display, text, mono } = style.fonts;
  $('#style-summary').replaceChildren(
    h('strong', {}, style.name),
    ` · ${style.mood}, ${style.mode} · ${display.family}, ${text.family} and ${mono.family} · ${style.layout.name} layout`,
  );
  $('#style-specimen').srcdoc = specimenHtml(style);
  $('#style-command').textContent = `npx @sloplint/cli init --seed "${style.seed}" --mood ${style.mood} --mode ${style.mode}`;
}

function initStyles() {
  $('#style-mood').append(...MOODS.map((m) => h('option', { value: m }, m[0].toUpperCase() + m.slice(1))));
  let wait = 0;
  for (const input of ['#style-brief', '#style-seed']) {
    $(input).addEventListener('input', () => {
      clearTimeout(wait);
      wait = setTimeout(renderStyle, 150);
    });
  }
  for (const select of ['#style-mood', '#style-mode']) $(select).addEventListener('change', renderStyle);
  $('#style-shuffle').addEventListener('click', () => {
    const word = () => SEED_WORDS[Math.floor(Math.random() * SEED_WORDS.length)];
    $('#style-seed').value = `${word()}-${word()}`;
    renderStyle();
  });
  renderStyle();
}

// ─── Rule catalog ────────────────────────────────────────────────────────────

let domainFilter = 'ALL';
let selectedRule = RULES[0].id;

function visibleRules() {
  const q = $('#rule-search').value.trim().toLowerCase();
  return RULES.filter((r) => (domainFilter === 'ALL' || r.domain === domainFilter) && (!q || `${r.id} ${r.slug} ${r.title} ${r.rationale}`.toLowerCase().includes(q)));
}

function renderFilters() {
  const options = [['ALL', `All ${RULES.length}`], ...Object.keys(DOMAINS).map((d) => [d, `${d} ${RULES.filter((r) => r.domain === d).length}`])];
  $('#domain-filters').replaceChildren(
    ...options.map(([key, label]) =>
      h('button', {
        type: 'button',
        class: 'chip',
        'aria-pressed': String(domainFilter === key),
        title: key === 'ALL' ? 'All domains' : DOMAINS[key],
        onclick: () => {
          domainFilter = key;
          renderFilters();
          renderRuleList();
        },
      }, label),
    ),
  );
}

function renderRuleList() {
  const rules = visibleRules();
  const list = $('#rule-list');
  if (!rules.length) {
    list.replaceChildren(h('li', { class: 'empty' }, 'No rule matches that search. Try a rule ID such as SEC-001 or a word like "gradient".'));
    return;
  }
  list.replaceChildren(
    ...rules.map((r) =>
      h('li', {},
        h('button', { type: 'button', class: 'rule-item', 'aria-current': String(r.id === selectedRule), onclick: () => selectRule(r.id, true) },
          h('span', { class: 'rule-id' }, r.id),
          h('span', { class: 'rule-title' }, r.title),
        ),
      ),
    ),
  );
}

function codeColumn(kind, name, lines) {
  return h('div', { class: 'diff-col' },
    h('div', { class: `diff-head is-${kind}` }, `${kind === 'slop' ? '✖ SLOP' : '✔ CRAFT'}  ${name}`),
    h('pre', {}, lines),
  );
}

async function renderRuleDetail(rule) {
  const detail = $('#rule-detail');
  const base = `../examples/${rule.id}`;
  const ext = rule.sample;
  detail.replaceChildren(
    h('p', { class: 'rule-meta' },
      h('span', {}, rule.id),
      h('span', {}, rule.slug),
      h('span', {}, DOMAINS[rule.domain]),
      h('span', { class: rule.severity === 'error' ? 'is-error' : 'is-warn' }, rule.severity === 'error' ? 'error' : 'warning'),
      h('span', {}, `weight ${rule.weight}`),
    ),
    h('h3', {}, rule.title),
    h('div', { class: 'prose' },
      h('p', {}, withCode(rule.rationale)),
      h('h4', {}, 'Fix'),
      h('p', {}, withCode(rule.fix)),
      h('p', {}, h('code', {}, `npx @sloplint/cli explain ${rule.id}`)),
    ),
  );
  let slop;
  let craft;
  try {
    [slop, craft] = await Promise.all([load(`${base}.slop.${ext}`), load(`${base}.craft.${ext}`)]);
  } catch (error) {
    detail.append(loadFailure(`${base}.*.${ext}`, error));
    return;
  }
  if (selectedRule !== rule.id) return;

  if (rule.sample === 'html') {
    detail.append(
      h('div', { class: 'previews' },
        h('figure', { class: 'preview' }, h('figcaption', { class: 'is-slop' }, '✖ SLOP, rendered'), h('iframe', { title: `${rule.id} slop example`, sandbox: '', loading: 'lazy', srcdoc: slop })),
        h('figure', { class: 'preview' }, h('figcaption', { class: 'is-craft' }, '✔ CRAFT, rendered'), h('iframe', { title: `${rule.id} craft example`, sandbox: '', loading: 'lazy', srcdoc: craft })),
      ),
    );
  }

  const rows = pairRows(diffLines(slop.trimEnd().split('\n'), craft.trimEnd().split('\n')));
  const left = [];
  const right = [];
  for (const row of rows) {
    const changed = row.kind !== 'same';
    left.push(h('span', { class: `ln ${changed && row.left != null ? 'ln-del' : 'ln-same'}` }, row.left ?? ''));
    right.push(h('span', { class: `ln ${changed && row.right != null ? 'ln-add' : 'ln-same'}` }, row.right ?? ''));
  }
  detail.append(
    h('div', { class: 'diff is-split' },
      codeColumn('slop', `${rule.id}.slop.${ext}`, left),
      codeColumn('craft', `${rule.id}.craft.${ext}`, right),
    ),
  );
}

function selectRule(id, fromClick) {
  const rule = RULES.find((r) => r.id === id);
  if (!rule) return;
  selectedRule = id;
  renderRuleList();
  renderRuleDetail(rule);
  if (!fromClick) return;
  history.replaceState(null, '', `#rule/${id}`);
  if (matchMedia('(max-width: 959px)').matches) $('#rule-detail').scrollIntoView({ block: 'start' });
}

function ruleFromHash() {
  const m = /^#rule\/([A-Z]+-\d{3})$/.exec(location.hash);
  if (!m) return false;
  selectRule(m[1], false);
  $('#rules').scrollIntoView();
  return true;
}

function initCatalog() {
  renderFilters();
  $('#rule-search').addEventListener('input', renderRuleList);
  window.addEventListener('hashchange', ruleFromHash);
  if (!ruleFromHash()) selectRule(selectedRule, false);
}

// ─── Boot ────────────────────────────────────────────────────────────────────

initPresets();
initCopy();
initFacts();
initHero();
initGrader();
initStyles();
initCatalog();
