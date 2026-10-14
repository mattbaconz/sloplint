import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RULES } from '../src/engine.mjs';
import { init, PRESETS, ruleBlock, resolvePreset } from '../src/init.mjs';
import { parseCss, maskCss } from '../src/lex.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const AGENT_FILES = ['CLAUDE.md', 'GEMINI.md', 'AGENTS.md', '.cursor/rules/sloplint.mdc'];

function tempDir(t) {
  const dir = mkdtempSync(join(tmpdir(), 'sloplint-init-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

const read = (dir, name) => readFileSync(join(dir, name), 'utf8');

test('init writes DESIGN.md and syncs every agent file', (t) => {
  const dir = tempDir(t);
  const report = init(dir);
  assert.equal(report.preset, 'obsidian-telemetry');
  assert.deepEqual(report.files.map((f) => f.status), Array(5).fill('created'));
  assert.match(read(dir, 'DESIGN.md'), /^<!-- sloplint:preset obsidian-telemetry -->\n# DESIGN\.md: Obsidian Telemetry/);
  for (const name of AGENT_FILES) {
    const text = read(dir, name);
    assert.ok(text.includes(ruleBlock('obsidian-telemetry')), name);
    for (const r of RULES) assert.ok(text.includes(`**${r.id}**`), `${name} lists ${r.id}`);
  }
  assert.match(read(dir, '.cursor/rules/sloplint.mdc'), /^---\ndescription: .+\nalwaysApply: true\n---\n/);
});

test('init is idempotent', (t) => {
  const dir = tempDir(t);
  init(dir);
  const again = init(dir);
  assert.deepEqual(again.files.map((f) => f.status), Array(5).fill('unchanged'));
});

test('init keeps user content in agent files and replaces only its own block', (t) => {
  const dir = tempDir(t);
  writeFileSync(join(dir, 'CLAUDE.md'), '# House rules\n\nUse pnpm.\n');
  init(dir);
  init(dir, { preset: 'swiss' });
  const text = read(dir, 'CLAUDE.md');
  assert.ok(text.startsWith('# House rules\n\nUse pnpm.\n\n<!-- sloplint:start -->'));
  assert.equal(text.split('<!-- sloplint:start -->').length, 2, 'exactly one managed block');
  assert.match(text, /preset: Swiss Brutalist/);
});

test('init --preset switches DESIGN.md, and a later run keeps the chosen preset', (t) => {
  const dir = tempDir(t);
  init(dir);
  const switched = init(dir, { preset: 'editorial' });
  assert.equal(switched.preset, 'editorial-serif');
  assert.equal(switched.files.find((f) => f.path === 'DESIGN.md').status, 'updated');
  assert.match(read(dir, 'DESIGN.md'), /# DESIGN\.md: Editorial Serif/);
  assert.equal(init(dir).preset, 'editorial-serif');
});

test('init leaves a hand-written DESIGN.md alone unless forced', (t) => {
  const dir = tempDir(t);
  writeFileSync(join(dir, 'DESIGN.md'), '# Our design system\n');
  const report = init(dir, { preset: 'tactile' });
  assert.equal(read(dir, 'DESIGN.md'), '# Our design system\n');
  assert.match(report.notes[0], /--force/);
  init(dir, { preset: 'tactile', force: true });
  assert.match(read(dir, 'DESIGN.md'), /Tactile Hardware/);
});

test('files written by init pass sloplint check', (t) => {
  const dir = tempDir(t);
  for (const preset of Object.keys(PRESETS)) {
    init(dir, { preset, force: true });
    const r = spawnSync(process.execPath, [join(ROOT, 'bin', 'sloplint.mjs'), 'check', '.', '--format', 'json'], { cwd: dir, encoding: 'utf8' });
    const report = JSON.parse(r.stdout);
    assert.equal(report.score, 0, `${preset}: ${JSON.stringify(report.files)}`);
    assert.ok(existsSync(join(dir, '.cursor/rules/sloplint.mdc')));
  }
});

test('preset names and aliases resolve; unknown names are rejected', () => {
  assert.equal(resolvePreset('Swiss Brutalist'), 'swiss-brutalist');
  assert.equal(resolvePreset('obsidian'), 'obsidian-telemetry');
  assert.throws(() => resolvePreset('vaporwave'), /Unknown preset "vaporwave"/);
});

// ─── Presets and site stay in sync ──────────────────────────────────────────

function presetTokens(id) {
  const md = readFileSync(join(ROOT, 'presets', `${id}.md`), 'utf8');
  const css = /```css\n([\s\S]*?)```/.exec(md)[1];
  const [rule] = parseCss(maskCss(css).out.join(''), 0, css.length);
  assert.equal(rule.selector.trim(), ':root', `${id} token block`);
  return Object.fromEntries(rule.decls.map((d) => [d.prop, css.slice(d.valueStart, d.end).replace(/;$/, '').trim()]));
}

test('every preset file defines the same token set', () => {
  assert.deepEqual(readdirSync(join(ROOT, 'presets')).sort(), Object.keys(PRESETS).map((id) => `${id}.md`).sort());
  const keys = Object.keys(presetTokens('obsidian-telemetry')).sort();
  for (const id of Object.keys(PRESETS)) assert.deepEqual(Object.keys(presetTokens(id)).sort(), keys, id);
});

test('site preset blocks match presets/*.md token for token', () => {
  const css = readFileSync(join(ROOT, 'site', 'styles.css'), 'utf8');
  const rules = parseCss(maskCss(css).out.join(''), 0, css.length);
  const html = readFileSync(join(ROOT, 'site', 'index.html'), 'utf8');
  for (const id of Object.keys(PRESETS)) {
    const site = {};
    for (const r of rules.filter((x) => x.selector.includes(`[data-preset="${id}"]`))) {
      for (const d of r.decls) site[d.prop] = css.slice(d.valueStart, d.end).replace(/;$/, '').trim();
    }
    for (const [prop, value] of Object.entries(presetTokens(id))) assert.equal(site[prop], value, `${id} ${prop}`);
    assert.ok(html.includes(`value="${id}"`), `switcher offers ${id}`);
  }
});

test('every rule ID is covered by its brief', () => {
  const brief = { UI: 'ui.md', COPY: 'ui.md', BE: 'backend.md', SEC: 'security.md', TEST: 'testing.md', MOTION: 'motion.md' };
  for (const r of RULES) {
    const text = readFileSync(join(ROOT, 'rules', brief[r.domain]), 'utf8');
    assert.ok(text.includes(`**${r.id} `), `${brief[r.domain]} covers ${r.id}`);
  }
});

test('init block keeps rule prose in sync with the catalog', () => {
  for (const r of RULES) assert.ok(ruleBlock('swiss-brutalist').includes(`- **${r.id}** ${r.title}. ${r.fix}`), r.id);
});
