#!/usr/bin/env node
// Scores benchmark runs and writes results.json and README.md.
//
//   node bench/score.mjs --runs ../bench-runs/2026-10-14 --out bench/results/2026-10-14
//
// Every run is scored on what the agent wrote: seed files it left alone, sloplint's own files
// (DESIGN.md, CLAUDE.md, GEMINI.md, AGENTS.md, .cursor/, .claude/) and node_modules are excluded,
// so the arms are measured on the same footing. As with `sloplint check`, a run that has a
// DESIGN.md is also held to its tokens (UI-011, UI-012), which only makes the sloplint arms
// stricter. Task checks do not use sloplint: syntax, a test-suite mutation score, README accuracy
// against the real CLI flags, and a rendered landing page (overflow, typefaces, CTA color).
//
//   --runs takes several directories, comma-separated, when arms were run separately.

import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { EXTENSIONS, RULE_BY_ID, lint, score } from '../src/engine.mjs';
import { parseDesign, rgbaOf } from '../src/design.mjs';
import { colorsIn, isNeonPurple } from '../src/style.mjs';
import { MUTANTS } from './tasks/tests/mutants.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TASKS = join(ROOT, 'bench', 'tasks');
const SLOPLINT_FILES = /^(DESIGN\.md|CLAUDE\.md|GEMINI\.md|AGENTS\.md|\.cursor\/.*|\.claude\/.*)$/;
const ARMS = ['baseline', 'sloplint', 'hooks'];
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage']);
const TEXT = /\.(m?[jt]sx?|cjs|json|html?|css|scss|md|mdx|vue|svelte|py|txt|ya?ml)$/i;

const walk = (dir, base = dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? (SKIP_DIRS.has(e.name) ? [] : walk(join(dir, e.name), base)) : [relative(base, join(dir, e.name)).split(sep).join('/')],
  );

function authored(work, task) {
  const seed = join(TASKS, task, 'seed');
  const files = [];
  const seedModified = [];
  for (const rel of walk(work)) {
    if (SLOPLINT_FILES.test(rel) || /(^|\/)package-lock\.json$/.test(rel) || !TEXT.test(rel)) continue;
    const text = readFileSync(join(work, rel), 'utf8');
    const original = existsSync(join(seed, rel)) ? readFileSync(join(seed, rel), 'utf8') : null;
    if (original === text) continue;
    if (original != null) seedModified.push(rel);
    files.push({ rel, text });
  }
  return { files, seedModified };
}

// A clean environment: inside `node --test`, NODE_TEST_CONTEXT would turn the child runner into a subtest reporter.
const { NODE_TEST_CONTEXT, NODE_OPTIONS, ...ENV } = process.env;
const node = (args, cwd, timeout = 60_000) => spawnSync(process.execPath, args, { cwd, encoding: 'utf8', timeout, env: ENV });
// Node 22 reports TAP when piped and 23+ reports spec; pin spec so the test count parses on both.
const nodeTest = (cwd) => node(['--test', '--test-reporter=spec'], cwd);

// Mutation score: copy the workdir, apply each seeded bug to src/cart.js, and count suites that fail.
function mutation(work, testFiles = null) {
  const tmp = mkdtempSync(join(tmpdir(), 'sloplint-mut-'));
  try {
    for (const rel of walk(work)) {
      mkdirSync(join(tmp, rel, '..'), { recursive: true });
      cpSync(join(work, rel), join(tmp, rel));
    }
    if (testFiles) for (const [rel, src] of testFiles) cpSync(src, join(tmp, rel));
    const cart = join(tmp, 'src', 'cart.js');
    const original = readFileSync(cart, 'utf8');
    const clean = nodeTest(tmp);
    const tests = Number(/^ℹ tests (\d+)/m.exec(clean.stdout)?.[1] ?? 0);
    if (clean.status !== 0 || tests === 0) return { passes: false, tests, killed: 0, total: MUTANTS.length, survivors: [] };
    const survivors = [];
    for (const [name, from, to] of MUTANTS) {
      writeFileSync(cart, original.replace(from, to));
      if (nodeTest(tmp).status === 0) survivors.push(name);
    }
    writeFileSync(cart, original);
    return { passes: true, tests, killed: MUTANTS.length - survivors.length, total: MUTANTS.length, survivors };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

const REAL_FLAGS = new Set(['--top', '--min-length', '--ignore', '--json', '--help']);
function readmeAccuracy(work) {
  const path = join(work, 'README.md');
  if (!existsSync(path)) return { exists: false };
  const lines = readFileSync(path, 'utf8').split('\n').filter((l) => !/\b(npm|npx|node|git|pnpm|yarn)\s/.test(l));
  const mentioned = new Set(lines.flatMap((l) => [...l.matchAll(/(?<![\w-])--[a-z][a-z-]*/g)].map((m) => m[0])));
  return {
    exists: true,
    documented: [...REAL_FLAGS].filter((f) => mentioned.has(f)).length,
    of: REAL_FLAGS.size,
    invented: [...mentioned].filter((f) => !REAL_FLAGS.has(f)),
  };
}

const isLanding = (task) => task.startsWith('landing');
const shotName = (r) => `${r.agent}-${r.arm}-${r.task}-r${r.rep}`;

async function landing(work, shots, name) {
  const page = join(work, 'index.html');
  if (!existsSync(page)) return { exists: false };
  const { chromium } = await import(pathToFileURL(join(ROOT, 'node_modules', '@playwright', 'test', 'index.mjs')).href);
  const browser = await chromium.launch({ channel: 'chromium' });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const tab = await ctx.newPage();
    const errors = [];
    tab.on('pageerror', (e) => errors.push(e.message));
    await tab.route(/^https?:\/\/(?!fonts\.(googleapis|gstatic)\.com)/, (route) => route.abort());
    await tab.goto(pathToFileURL(page).href, { waitUntil: 'load', timeout: 20_000 }).catch((e) => errors.push(e.message));
    // Let webfonts load and a first-screen entrance (at most 700ms) finish before the screenshot.
    await tab.evaluate(() => document.fonts.ready);
    await tab.waitForTimeout(1200);
    mkdirSync(shots, { recursive: true });
    await tab.screenshot({ path: join(shots, `${name}.jpg`), type: 'jpeg', quality: 72 });
    // The look: declared typefaces of the headline and body text, and the first colored fill on a
    // link or button, which is the primary call to action on nearly every landing page.
    const { fills, ...info } = await tab.evaluate(() => {
      const face = (el) => (el ? getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g, '').trim() : null);
      const clear = /^(transparent|rgba\(0, 0, 0, 0\))$/;
      return {
        forms: document.forms.length,
        height: document.documentElement.scrollHeight,
        display: face(document.querySelector('h1')),
        text: face(document.querySelector('p') ?? document.body),
        fills: [...document.querySelectorAll('a, button')]
          .filter((el) => el.getBoundingClientRect().width > 0 && !clear.test(getComputedStyle(el).backgroundColor))
          .map((el) => getComputedStyle(el).backgroundColor),
      };
    });
    const hexes = fills.map(rgbaOf).filter(Boolean).map((c) => `#${c.slice(0, 3).map((v) => v.toString(16).padStart(2, '0')).join('')}`);
    const colored = (hex) => {
      const c = colorsIn(hex)[0];
      return c && c.s >= 0.25 && c.l >= 0.15 && c.l <= 0.88;
    };
    info.cta = hexes.find(colored) ?? hexes[0] ?? null;
    await tab.setViewportSize({ width: 375, height: 812 });
    await tab.waitForTimeout(300);
    const overflow = await tab.evaluate(() => document.documentElement.scrollWidth > 375);
    await tab.screenshot({ path: join(shots, `${name}-375.jpg`), type: 'jpeg', quality: 72 });
    return { exists: true, ...info, overflowAt375: overflow, pageErrors: errors.length };
  } finally {
    await browser.close();
  }
}

function syntax(work, files) {
  const js = files.filter((f) => /\.(m?js|cjs)$/.test(f.rel)).map((f) => f.rel);
  const failed = js.filter((rel) => node(['--check', rel], work).status !== 0);
  return { checked: js.length, failed };
}

async function scoreRun(dir, ctx) {
  const meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8'));
  const work = join(dir, 'work');
  const { files, seedModified } = authored(work, meta.task);
  const designText = existsSync(join(work, 'DESIGN.md')) ? readFileSync(join(work, 'DESIGN.md'), 'utf8') : null;
  const design = parseDesign(designText);
  const results = files.filter((f) => EXTENSIONS.includes(extname(f.rel).slice(1).toLowerCase())).map((f) => lint(f.text, f.rel, { design }));
  const s = score(results);
  const findings = results.flatMap((r) => r.diagnostics.map((d) => ({ file: r.path, line: d.line, rule: d.rule, message: d.message })));
  const check = {};
  if (meta.task === 'tests') Object.assign(check, mutation(work));
  if (meta.task === 'readme') Object.assign(check, readmeAccuracy(work));
  if (meta.task === 'api') Object.assign(check, syntax(work, files));
  if (isLanding(meta.task)) Object.assign(check, await landing(work, ctx.shots, shotName(meta)));
  if (meta.task === 'dashboard') check.exists = existsSync(join(work, 'src', 'Dashboard.tsx'));
  if (meta.task === 'video') check.exists = existsSync(join(work, 'src', 'Launch.tsx')) && existsSync(join(work, 'src', 'Root.tsx'));
  const outputs = join(ctx.out, 'runs', meta.agent, meta.arm, `${meta.task}-r${meta.rep}`);
  for (const f of files) {
    mkdirSync(join(outputs, f.rel, '..'), { recursive: true });
    writeFileSync(join(outputs, f.rel), f.text);
  }
  return {
    ...meta,
    system: designText && /^# DESIGN\.md: (.+)$/m.exec(designText)?.[1],
    files: files.length,
    lines: s.lines,
    score: s.score,
    grade: s.grade,
    errors: s.errors,
    warnings: s.warnings,
    byDomain: s.byDomain,
    suppressions: files.reduce((n, f) => n + (f.text.match(/sloplint-disable/g)?.length ?? 0), 0),
    seedModified,
    check,
    findings,
  };
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const fmt = (x, digits = 0) => (x == null ? 'n/a' : x.toFixed(digits));
const hueOf = (hex) => colorsIn(hex)[0];

function report(runs, meta) {
  const agents = [...new Set(runs.map((r) => r.agent))];
  const tasks = [...new Set(runs.map((r) => r.task))];
  const pick = (agent, arm, task) => runs.filter((r) => r.agent === agent && r.arm === arm && (!task || r.task === task));
  const armsOf = (agent) => ARMS.filter((arm) => pick(agent, arm).length);
  const cols = agents.flatMap((a) => armsOf(a).map((arm) => [a, arm]));
  const head = (first) => [`| ${first} | ${cols.map(([a, arm]) => `${a} ${arm}`).join(' | ')} |`, `| ${first.split(' | ').map(() => '---').join(' | ')} | ${cols.map(() => '---').join(' | ')} |`];
  const out = [];
  out.push(`# Benchmark: ${meta.date}`, '');
  out.push(`Same prompt, same model, fresh directory per run. \`baseline\` gets the task only; \`sloplint\` also gets \`sloplint init --brief <the prompt's first sentence>\` and a local install; \`hooks\` is \`sloplint\` plus \`--hooks\` (Claude Code only). ${runs.length} scored runs, up to ${meta.reps} per cell. Method and caveats: [bench/README.md](../../README.md).`, '');
  if (meta.failed.length) out.push(`Not scored (agent CLI error or timeout): ${meta.failed.map((f) => `${f.agent}/${f.arm}/${f.task} run ${f.rep}`).join(', ')}.`, '');
  out.push('## Summary', '');
  out.push('| Agent | Model | Arm | Mean Slop Score | Findings | Errors | Suppressions | Mean time | Mean turns | Mean tokens in/out | Mean cost |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const [agent, arm] of cols) {
    const rs = pick(agent, arm);
    const cost = mean(rs.filter((r) => r.costUsd != null).map((r) => r.costUsd));
    out.push(`| ${agent} | \`${rs[0].model}\` | ${arm} | ${fmt(mean(rs.map((r) => r.score)), 1)} | ${rs.reduce((n, r) => n + r.findings.length, 0)} | ${rs.reduce((n, r) => n + r.errors, 0)} | ${rs.reduce((n, r) => n + r.suppressions, 0)} | ${fmt(mean(rs.map((r) => r.durationMs / 1000)))}s | ${fmt(mean(rs.filter((r) => r.turns != null).map((r) => r.turns)), 1)} | ${fmt(mean(rs.map((r) => r.inputTokens ?? 0)) / 1000)}k / ${fmt(mean(rs.map((r) => r.outputTokens ?? 0)) / 1000, 1)}k | ${cost == null ? 'n/a' : `$${cost.toFixed(3)}`} |`);
  }
  out.push('');
  for (const [agent, arm] of cols.filter(([, arm]) => arm !== 'baseline')) {
    const verdicts = tasks.map((task) => {
      const b = mean(pick(agent, 'baseline', task).map((r) => r.score));
      const s = mean(pick(agent, arm, task).map((r) => r.score));
      return b == null || s == null ? null : Math.sign(s - b);
    }).filter((v) => v != null);
    out.push(`- **${agent} ${arm}** against baseline: the mean score was lower on ${verdicts.filter((v) => v < 0).length} of ${verdicts.length} tasks, equal on ${verdicts.filter((v) => v === 0).length} and higher on ${verdicts.filter((v) => v > 0).length}.`);
  }
  out.push('', '## Slop Score by task', '', 'Mean score per cell, lower is better; individual runs in brackets.', '');
  out.push(...head('Task'));
  for (const task of tasks) {
    const cells = cols.map(([a, arm]) => {
      const rs = pick(a, arm, task);
      return rs.length ? `${fmt(mean(rs.map((r) => r.score)))} [${rs.map((r) => r.score).join(', ')}]` : 'n/a';
    });
    out.push(`| ${task} | ${cells.join(' | ')} |`);
  }
  out.push('', '## Checks that do not use sloplint', '');
  out.push(...head('Task | Check'));
  const row = (task, label, f) => out.push(`| ${task} | ${label} | ${cols.map(([a, arm]) => pick(a, arm, task).map(f).join(', ') || 'n/a').join(' | ')} |`);
  row('tests', 'Suite passes', (r) => (r.check.passes ? 'yes' : 'no'));
  row('tests', 'Mutants killed', (r) => `${r.check.killed}/${r.check.total}`);
  row('readme', 'Real flags documented', (r) => (r.check.exists ? `${r.check.documented}/${r.check.of}` : 'missing'));
  row('readme', 'Invented flags', (r) => String(r.check.invented?.length ?? 'n/a'));
  row('api', 'Syntax errors', (r) => String(r.check.failed?.length ?? 'n/a'));
  for (const task of tasks.filter(isLanding)) {
    row(task, 'Overflows at 375px', (r) => (r.check.exists ? (r.check.overflowAt375 ? 'yes' : 'no') : 'missing'));
    row(task, 'Page errors', (r) => String(r.check.pageErrors ?? 'n/a'));
  }
  row('video', 'Files present', (r) => (r.check.exists ? 'yes' : 'no'));
  row('dashboard', 'File present', (r) => (r.check.exists ? 'yes' : 'no'));

  const pages = runs.filter((r) => isLanding(r.task) && r.check.exists);
  if (pages.length) {
    out.push('', '## Landing page look', '', 'Declared headline and body typefaces, and the fill of the first filled link or button (the primary call to action), read from the rendered page. "AI purple" is the saturated indigo-to-violet band of UI-001.', '');
    out.push('| Task | Agent | Arm | Run | Design system | Headline face | Body face | CTA fill |', '| --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const r of pages) {
      const c = r.check.cta && hueOf(r.check.cta);
      const fill = r.check.cta ? `\`${r.check.cta}\` hue ${Math.round(c.h)}${isNeonPurple(c) ? ', AI purple' : ''}` : 'none';
      out.push(`| ${r.task} | ${r.agent} | ${r.arm} | ${r.rep} | ${r.system ?? 'none'} | ${r.check.display ?? 'n/a'} | ${r.check.text ?? 'n/a'} | ${fill} |`);
    }
    out.push('');
    for (const [agent, arm] of cols) {
      const ps = pick(agent, arm).filter((r) => isLanding(r.task) && r.check.exists);
      if (!ps.length) continue;
      const faces = new Set(ps.map((r) => r.check.display ?? 'no h1'));
      const purple = ps.filter((r) => r.check.cta && isNeonPurple(hueOf(r.check.cta))).length;
      out.push(`- **${agent} ${arm}**: ${faces.size} distinct headline face${faces.size === 1 ? '' : 's'} in ${ps.length} page${ps.length === 1 ? '' : 's'} (${[...faces].join(', ')}); ${purple} AI-purple call${purple === 1 ? '' : 's'} to action.`);
    }
  }

  out.push('', '## Rules hit', '', 'Findings per rule across all runs of each arm.', '');
  out.push(...head('Rule'));
  for (const id of [...new Set(runs.flatMap((r) => r.findings.map((f) => f.rule)))].sort()) {
    out.push(`| ${id} ${RULE_BY_ID.get(id)?.slug ?? ''} | ${cols.map(([a, arm]) => String(pick(a, arm).reduce((n, r) => n + r.findings.filter((f) => f.rule === id).length, 0))).join(' | ')} |`);
  }
  if (existsSync(join(meta.outDir, 'shots'))) {
    out.push('', '## Landing pages', '', 'First viewport at 1280px. Full outputs are under `runs/`.', '');
    for (const task of tasks.filter(isLanding)) for (const agent of agents) {
      for (const rep of [...new Set(runs.map((r) => r.rep))]) {
        const shots = armsOf(agent).map((arm) => [arm, `shots/${shotName({ agent, arm, task, rep })}.jpg`]).filter(([, s]) => existsSync(join(meta.outDir, s)));
        if (shots.length < 2) continue;
        out.push(`**${task}, ${agent}, run ${rep}**`, '', `| ${shots.map(([arm]) => arm).join(' | ')} |`, `| ${shots.map(() => '---').join(' | ')} |`, `| ${shots.map(([arm, s]) => `![${arm}](${s})`).join(' | ')} |`, '');
      }
    }
  }
  return `${out.join('\n')}\n`;
}

async function main() {
  const { values } = parseArgs({ options: { runs: { type: 'string' }, out: { type: 'string' }, 'self-test': { type: 'boolean', default: false } } });
  if (values['self-test']) {
    const tmp = mkdtempSync(join(tmpdir(), 'sloplint-ref-'));
    cpSync(join(TASKS, 'tests', 'seed'), tmp, { recursive: true });
    const r = mutation(tmp, [['reference.test.js', join(TASKS, 'tests', 'reference.test.js')]]);
    rmSync(tmp, { recursive: true, force: true });
    console.log(`reference suite: ${r.passes ? 'passes' : 'FAILS'}, ${r.killed}/${r.total} mutants killed${r.survivors.length ? `; survivors: ${r.survivors.join(', ')}` : ''}`);
    process.exitCode = r.passes && r.killed === r.total ? 0 : 1;
    return;
  }
  if (!values.runs || !values.out) throw new Error('--runs <dir[,dir...]> and --out <dir> are required');
  const out = resolve(values.out);
  mkdirSync(out, { recursive: true });
  const dirs = [];
  for (const runsDir of values.runs.split(',').map((d) => resolve(d))) {
    for (const agent of readdirSync(runsDir).filter((n) => !n.startsWith('_') && statSync(join(runsDir, n)).isDirectory())) {
      for (const arm of readdirSync(join(runsDir, agent))) for (const run of readdirSync(join(runsDir, agent, arm))) dirs.push(join(runsDir, agent, arm, run));
    }
  }
  const runs = [];
  const failed = [];
  for (const dir of dirs.filter((d) => existsSync(join(d, 'meta.json')))) {
    const meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8'));
    // A crashed or timed-out agent wrote nothing, which would score a perfect 0. Report it instead.
    if (!meta.ok || meta.timedOut) failed.push(meta);
    else runs.push(await scoreRun(dir, { out, shots: join(out, 'shots') }));
    process.stdout.write('.');
  }
  runs.sort((a, b) => a.agent.localeCompare(b.agent) || a.task.localeCompare(b.task) || ARMS.indexOf(a.arm) - ARMS.indexOf(b.arm) || a.rep - b.rep);
  const date = new Date().toISOString().slice(0, 10);
  writeFileSync(join(out, 'results.json'), `${JSON.stringify({ date, runs, failed }, null, 2)}\n`);
  writeFileSync(join(out, 'README.md'), report(runs, { date, failed, reps: Math.max(...runs.map((r) => r.rep)), outDir: out }));
  console.log(`\n${runs.length} runs scored -> ${out}`);
}

await main();
