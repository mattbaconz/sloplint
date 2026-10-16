import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RULES, DOMAINS } from '../src/engine.mjs';
import { init, PRESETS, ruleBlock, resolvePreset, projectDomains } from '../src/init.mjs';
import { designDoc, MOODS } from '../src/design.mjs';
import { parseCss, maskCss } from '../src/lex.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const AGENT_FILES = ['CLAUDE.md', 'GEMINI.md', 'AGENTS.md', '.cursor/rules/sloplint.mdc'];
const PACKAGE = { 'package.json': JSON.stringify({ name: 'harbor-invoices', description: 'Invoicing for freelance studios' }) };

function tempDir(t, files = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'sloplint-init-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(join(dir, name, '..'), { recursive: true });
    writeFileSync(join(dir, name), text);
  }
  return dir;
}

const read = (dir, name) => readFileSync(join(dir, name), 'utf8');

test('init generates DESIGN.md from the package and syncs every agent file', (t) => {
  const dir = tempDir(t, PACKAGE);
  const report = init(dir);
  assert.equal(report.preset, null);
  assert.match(report.style.seed, /^harbor-invoices-[a-z0-9]+$/);
  assert.equal(report.style.brief, 'Invoicing for freelance studios');
  assert.notEqual(init(tempDir(t, PACKAGE)).style.seed, report.style.seed, 'two projects with the same name get different seeds');
  assert.deepEqual(report.files.map((f) => f.status), Array(5).fill('created'));
  assert.equal(read(dir, 'DESIGN.md'), designDoc(report.style));
  const block = ruleBlock(`${report.style.name}: ${report.style.mood}, ${report.style.mode}`);
  for (const name of AGENT_FILES) {
    const text = read(dir, name);
    assert.ok(text.includes(block), name);
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

test('a generated style survives reruns until a new seed replaces it', (t) => {
  const dir = tempDir(t, PACKAGE);
  const first = init(dir, { seed: 'orchard', mood: 'warm', mode: 'dark' });
  assert.equal(first.style.mood, 'warm');
  assert.equal(first.style.mode, 'dark');
  const again = init(dir);
  assert.deepEqual(again.files.map((f) => f.status), Array(5).fill('unchanged'));
  assert.deepEqual(again.style, first.style);
  const other = init(dir, { seed: 'quarry' });
  assert.equal(other.files.find((f) => f.path === 'DESIGN.md').status, 'updated');
  assert.notEqual(other.style.colors.accent, first.style.colors.accent);
});

test('init keeps user content in agent files and replaces only its own block', (t) => {
  const dir = tempDir(t);
  writeFileSync(join(dir, 'CLAUDE.md'), '# House rules\n\nUse pnpm.\n');
  init(dir);
  init(dir, { preset: 'swiss' });
  const text = read(dir, 'CLAUDE.md');
  assert.ok(text.startsWith('# House rules\n\nUse pnpm.\n\n<!-- sloplint:start -->'));
  assert.equal(text.split('<!-- sloplint:start -->').length, 2, 'exactly one managed block');
  assert.match(text, /Swiss Brutalist preset/);
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
  const runs = [
    ...Object.keys(PRESETS).map((preset) => ({ preset })),
    ...MOODS.flatMap((mood) => ['light', 'dark'].map((mode) => ({ seed: `check-${mood}`, mood, mode }))),
  ];
  for (const options of runs) {
    init(dir, { ...options, force: true });
    const r = spawnSync(process.execPath, [join(ROOT, 'bin', 'sloplint.mjs'), 'check', '.', '--format', 'json'], { cwd: dir, encoding: 'utf8' });
    const report = JSON.parse(r.stdout);
    assert.equal(report.score, 0, `${JSON.stringify(options)}: ${JSON.stringify(report.files)}`);
    assert.ok(existsSync(join(dir, '.cursor/rules/sloplint.mdc')));
  }
});

test('the rule block covers only the parts of the catalog a project uses', (t) => {
  const domains = (deps, files = {}) => projectDomains(tempDir(t, { 'package.json': JSON.stringify({ dependencies: deps }), ...files }));
  const all = Object.keys(DOMAINS);
  assert.deepEqual(domains({}), all);
  assert.deepEqual(domains({ express: '^5.0.0' }, { 'src/server.ts': '' }), all.filter((d) => d !== 'UI' && d !== 'MOTION'));
  assert.deepEqual(domains({ react: '^19.0.0' }), all.filter((d) => d !== 'MOTION'));
  assert.deepEqual(domains({ remotion: '^4.0.0' }), all);
  const dir = tempDir(t, { 'package.json': JSON.stringify({ dependencies: { express: '^5.0.0' } }) });
  init(dir);
  assert.doesNotMatch(read(dir, 'CLAUDE.md'), /\*\*UI-001\*\*/);
  assert.match(read(dir, 'CLAUDE.md'), /\*\*BE-001\*\*/);
});

test('init --hooks wires the Claude Code hooks and keeps existing settings', (t) => {
  const settings = { permissions: { allow: ['Bash(npm test)'] }, hooks: { PostToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo ran' }] }] } };
  const dir = tempDir(t, { '.claude/settings.json': JSON.stringify(settings) });
  init(dir, { hooks: true });
  const after = JSON.parse(read(dir, '.claude/settings.json'));
  assert.deepEqual(after.permissions, settings.permissions);
  assert.deepEqual(after.hooks.PostToolUse.map((e) => e.matcher), ['Bash', 'Write|Edit|MultiEdit']);
  assert.equal(after.hooks.Stop[0].hooks[0].command, 'npx -y @sloplint/cli hook');
  assert.match(read(dir, 'CLAUDE.md'), /hooks lint every file you write and check the project when you stop/);
  assert.equal(init(dir, { hooks: true }).files.find((f) => f.path === '.claude/settings.json').status, 'unchanged');
  writeFileSync(join(dir, '.claude/settings.json'), '{ not json');
  assert.match(init(dir, { hooks: true }).notes.join(' '), /not valid JSON/);
});

test('preset names and aliases resolve; unknown names are rejected', () => {
  assert.equal(resolvePreset('Swiss Brutalist'), 'swiss-brutalist');
  assert.equal(resolvePreset('obsidian'), 'obsidian-telemetry');
  assert.throws(() => resolvePreset('vaporwave'), /Unknown preset "vaporwave"/);
});

// ─── Presets and site stay in sync ──────────────────────────────────────────

function presetTokens(id) {
  const md = readFileSync(join(ROOT, 'presets', `${id}.md`), 'utf8');
  const css = /```css\r?\n([\s\S]*?)```/.exec(md)[1];
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
  const lines = ruleBlock('Swiss Brutalist preset').split('\n');
  for (const r of RULES) {
    const head = `- **${r.id}** ${r.title}. `;
    const line = lines.find((l) => l.startsWith(head));
    assert.ok(line, r.id);
    const fix = line.slice(head.length);
    assert.ok(r.fix.startsWith(fix) && /[.!?]$/.test(fix), `${r.id}: ${fix}`);
  }
});
