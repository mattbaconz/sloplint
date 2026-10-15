// Command-line front end: argument parsing, file walking, terminal rendering.

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, realpathSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { RULES, DOMAINS, EXTENSIONS, findRule, lint, fixSource, score, diffLines, pairRows } from './engine.mjs';
import { init, defaultSeed, PRESETS } from './init.mjs';
import { generateStyle, specimenHtml, parseDesign, contrast, MOODS } from './design.mjs';

const ROOT = new URL('../', import.meta.url);
const VERSION = JSON.parse(readFileSync(new URL('package.json', ROOT), 'utf8')).version;
const MAX_BYTES = 1_000_000;
const DEFAULT_IGNORES = ['node_modules/', '.git/', 'dist/', 'build/', 'out/', 'coverage/', '.next/', '.nuxt/', '.svelte-kit/', '.turbo/', 'vendor/', '*.min.js', '*.min.css', '*.bundle.js'];

const HELP = `sloplint ${VERSION} - find and fix AI slop across UI, security, backend, copy, tests and video

Usage
  sloplint check [paths...]       Lint files and print a Slop Score (default: .)
      --fix                     Apply safe autofixes in place
      --changed                 Only files changed since the last commit (git)
      --format <f>              pretty, compact, json, github (pull request annotations) or sarif
                                (default: pretty in a terminal, compact when piped)
      --max-score <n>           Exit 1 when the score is above n
      --no-color                Plain output (also honours NO_COLOR)
  sloplint init [dir]             Write DESIGN.md and sync the agent rule files
      --seed <text>             Generate the design system from this seed (default: package name + random suffix)
      --brief <text>            One line about the product; its words steer the mood
      --mood <name>             Force a mood: ${MOODS.join(', ')}
      --mode light|dark         Force light or dark
      --preset <name>           Use a curated preset instead: ${Object.keys(PRESETS).join(', ')}
      --hooks                   Also lint every file Claude Code writes (.claude/settings.json)
      --force                   Overwrite a DESIGN.md that sloplint did not write
  sloplint style                  Preview the design system init would generate; writes nothing
      --seed, --brief, --mood, --mode as for init
      --html <file>             Also write a specimen page
      --json                    Print the system as JSON
  sloplint explain [RULE]         Rationale and slop/craft diff for one rule, or list all
  sloplint hook                   Claude Code hook entry point; reads the hook payload on stdin

Exit codes: 0 clean or warnings only, 1 errors or score above --max-score, 2 bad usage`;

// ─── Terminal styling ────────────────────────────────────────────────────────

function painter(enabled) {
  const wrap = (open, close) => (s) => (enabled ? `\x1b[${open}m${s}\x1b[${close}m` : String(s));
  return {
    bold: wrap(1, 22), dim: wrap(2, 22), red: wrap(31, 39), green: wrap(32, 39),
    yellow: wrap(33, 39), blue: wrap(34, 39), cyan: wrap(36, 39), gray: wrap(90, 39),
  };
}

const fit = (s, width) => (s.length > width ? `${s.slice(0, Math.max(0, width - 1))}…` : s.padEnd(width));
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function wrapText(text, width, indent = '') {
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if (line && line.length + word.length + 1 > width) {
      lines.push(indent + line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(indent + line);
  return lines.join('\n');
}

// ─── File discovery ──────────────────────────────────────────────────────────

// gitignore-style pattern to RegExp. Supports *, **, ?, leading / and trailing /.
// ponytail: no "!" negation and no nested ignore files; add both if a real project needs them.
function compileIgnore(pattern) {
  let p = pattern.trim();
  const dirOnly = p.endsWith('/');
  if (dirOnly) p = p.slice(0, -1);
  const anchored = p.includes('/');
  p = p.replace(/^\//, '');
  let re = '';
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === '*' && p[i + 1] === '*') {
      re += '.*';
      i += p[i + 2] === '/' ? 2 : 1;
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  const regex = new RegExp(`${anchored ? '^' : '(^|/)'}${re}(/|$)`);
  return (path, isDir) => (!dirOnly || isDir) && regex.test(path);
}

function readIgnores(dir) {
  const patterns = [...DEFAULT_IGNORES];
  for (const name of ['.gitignore', '.sloplintignore']) {
    const file = join(dir, name);
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      if (line.trim() && !line.startsWith('#') && !line.startsWith('!')) patterns.push(line);
    }
  }
  return patterns.map(compileIgnore);
}

// True when a file path (relative, forward slashes) or any directory above it is ignored.
function ignoredPath(tests, rel) {
  const parts = rel.split('/');
  return parts.some((_, k) => tests.some((test) => test(parts.slice(0, k + 1).join('/'), k < parts.length - 1)));
}

const lintable = (name) => EXTENSIONS.includes(name.slice(name.lastIndexOf('.') + 1).toLowerCase());
const toPosix = (p) => p.split(sep).join('/');

// Returns [{ abs, rel }]. rel is relative to the scan root, or for a single file to the
// working directory, so path-based heuristics (tests/, server/, README) still apply.
function collect(target) {
  const abs = resolve(target);
  const stat = statSync(abs, { throwIfNoEntry: false });
  if (!stat) throw new UsageError(`No such file or directory: ${target}`);
  if (stat.isFile()) {
    const rel = toPosix(relative(process.cwd(), abs));
    return [{ abs, rel: rel && !rel.startsWith('..') ? rel : basename(abs) }];
  }
  const ignored = readIgnores(abs);
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = join(dir, entry.name);
      const rel = toPosix(relative(abs, full));
      const isDir = entry.isDirectory();
      if (ignored.some((test) => test(rel, isDir))) continue;
      if (isDir) walk(full);
      else if (entry.isFile() && lintable(entry.name) && statSync(full).size <= MAX_BYTES) files.push({ abs: full, rel });
    }
  };
  walk(abs);
  return files;
}

// Files changed since HEAD (staged, unstaged and untracked) under `cwd`, minus ignored paths.
// git prints resolved long paths, so they are compared with the real path of `cwd` (Windows
// temp directories are often 8.3 short names such as RUNNER~1).
function changedFiles(cwd) {
  const top = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' });
  if (top.status !== 0) return null;
  const root = top.stdout.trim();
  const real = realpathSync.native(cwd);
  const status = spawnSync('git', ['status', '--porcelain', '-uall', '-z'], { cwd: root, encoding: 'utf8' });
  const entries = status.stdout.split('\0');
  const ignored = readIgnores(cwd);
  const files = [];
  for (let k = 0; k < entries.length; k++) {
    const entry = entries[k];
    if (!entry) continue;
    if (/^[RC]/.test(entry)) k++; // renames and copies carry the old path as the next entry
    if (entry[0] === 'D' || entry[1] === 'D') continue;
    const rel = toPosix(relative(real, resolve(root, entry.slice(3))));
    const abs = join(cwd, rel);
    if (rel.startsWith('..') || !lintable(abs) || ignoredPath(ignored, rel)) continue;
    if (existsSync(abs) && statSync(abs).size <= MAX_BYTES) files.push({ abs, rel });
  }
  return files;
}

// The nearest DESIGN.md at or above `dir`, up to the repository root, parsed for the token rules.
const designs = new Map();
function designFor(dir) {
  if (designs.has(dir)) return designs.get(dir);
  const file = join(dir, 'DESIGN.md');
  const parent = dirname(dir);
  let found = null;
  if (existsSync(file)) found = parseDesign(readFileSync(file, 'utf8'));
  else if (!existsSync(join(dir, '.git')) && parent !== dir) found = designFor(parent);
  designs.set(dir, found);
  return found;
}

class UsageError extends Error {}

// ─── check ───────────────────────────────────────────────────────────────────

function lintFiles(files, { fix }) {
  const results = [];
  let fixed = 0;
  let fixedFiles = 0;
  for (const file of files) {
    let text = readFileSync(file.abs, 'utf8');
    const options = { design: designFor(dirname(file.abs)) };
    if (fix) {
      const out = fixSource(text, file.rel, 5, options);
      if (out.applied) {
        writeFileSync(file.abs, out.text);
        text = out.text;
        fixed += out.applied;
        fixedFiles++;
      }
    }
    const result = lint(text, file.rel, options);
    result.path = toPosix(relative(process.cwd(), file.abs)) || file.rel;
    result.text = text;
    results.push(result);
  }
  return { results, fixed, fixedFiles };
}

function frame(d, result, c, columns) {
  const label = d.severity === 'error' ? c.red(c.bold(`error[${d.rule}]`)) : c.yellow(c.bold(`warning[${d.rule}]`));
  const rule = findRule(d.rule);
  const lineText = result.text.split('\n')[d.line - 1]?.replace(/\t/g, ' ').replace(/\r$/, '') ?? '';
  const gutter = String(d.line).length;
  const pad = ' '.repeat(gutter);
  const width = Math.max(20, columns - gutter - 4);
  let from = 0;
  if (lineText.length > width && d.col > width - 20) from = d.col - 20;
  const tail = lineText.length > from + width - 1 ? '…' : '';
  const shown = (from ? '…' : '') + lineText.slice(from, from + width - 1 - (from ? 1 : 0) - tail.length) + tail;
  const caretStart = d.col - 1 - from + (from ? 1 : 0);
  const caretEnd = d.endLine === d.line ? d.endCol - 1 - from + (from ? 1 : 0) : shown.length;
  const caret = ' '.repeat(Math.max(0, caretStart)) + '^'.repeat(Math.max(1, Math.min(caretEnd, shown.length) - caretStart));
  const paint = d.severity === 'error' ? c.red : c.yellow;
  const lines = [
    `${label}${c.bold(`: ${d.message}`)}`,
    `${pad}${c.blue('-->')} ${result.path}:${d.line}:${d.col}`,
    `${pad} ${c.blue('|')}`,
    `${c.blue(String(d.line))} ${c.blue('|')} ${shown}`,
    `${pad} ${c.blue('|')} ${paint(caret)}`,
    `${pad} ${c.blue('=')} ${c.bold('fix:')} ${rule.fix}`,
  ];
  if (d.fix) lines.push(`${pad} ${c.blue('=')} ${c.green('autofix available (--fix)')}`);
  return lines.join('\n');
}

function summary(s, c, extra) {
  const cells = 24;
  const filled = Math.round((s.score / 100) * cells);
  const paint = s.score === 0 ? c.green : s.score < 40 ? c.yellow : c.red;
  const bar = paint('█'.repeat(filled)) + c.gray('░'.repeat(cells - filled));
  const counts = [plural(s.files, 'file'), `${s.lines.toLocaleString('en-US')} lines`, plural(s.errors, 'error'), plural(s.warnings, 'warning')];
  if (s.fixable) counts.push(`${s.fixable} autofixable`);
  const domains = Object.keys(DOMAINS).map((d) => (s.byDomain[d] ? `${d} ${c.bold(s.byDomain[d])}` : c.gray(`${d} 0`))).join('  ');
  return [
    `${c.bold('Slop Score')}  ${bar}  ${paint(c.bold(`${s.score}/100`))} ${paint(s.grade)}`,
    c.dim(`            ${counts.join(' · ')}`),
    `            ${domains}`,
    ...extra.map((e) => `            ${e}`),
  ].join('\n');
}

// One line per finding, each rule's fix once, then the score: cheap for agents and logs to read.
export function compactReport(results, s, extra = []) {
  const lines = [];
  const fixes = new Map();
  for (const r of results) {
    for (const d of r.diagnostics) {
      lines.push(`${r.path}:${d.line}:${d.col} ${d.severity === 'error' ? 'error' : 'warn'} ${d.rule} ${d.message}${d.fix ? ' [autofix]' : ''}`);
      fixes.set(d.rule, findRule(d.rule).fix);
    }
  }
  if (fixes.size) lines.push('', 'How to fix:', ...[...fixes].map(([id, fix]) => `  ${id} ${fix}`), '');
  const counts = [plural(s.files, 'file'), plural(s.errors, 'error'), plural(s.warnings, 'warning')];
  if (s.fixable) counts.push(`${s.fixable} autofixable with --fix`);
  lines.push(`Slop Score ${s.score}/100 ${s.grade} · ${counts.join(' · ')}`, ...extra);
  return lines.join('\n');
}

// GitHub workflow commands: in Actions, each line becomes an annotation on the pull request diff.
const ghData = (s) => s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
const ghProp = (s) => ghData(s).replace(/:/g, '%3A').replace(/,/g, '%2C');
export function githubAnnotations(results) {
  const lines = [];
  for (const r of results) {
    for (const d of r.diagnostics) {
      const rule = findRule(d.rule);
      lines.push(`::${d.severity === 'error' ? 'error' : 'warning'} file=${ghProp(toPosix(r.path))},line=${d.line},col=${d.col},title=${ghProp(`${rule.id} ${rule.slug}`)}::${ghData(`${d.message}\n${rule.fix}`)}`);
    }
  }
  return lines.join('\n');
}

// SARIF 2.1.0, the format GitHub code scanning and most CI dashboards import.
export function sarif(results) {
  const level = (severity) => (severity === 'error' ? 'error' : 'warning');
  const driver = {
    name: 'sloplint',
    version: VERSION,
    informationUri: 'https://github.com/mattbaconz/sloplint',
    rules: RULES.map((r) => ({
      id: r.id,
      name: r.slug,
      shortDescription: { text: r.title },
      fullDescription: { text: r.rationale },
      help: { text: r.fix },
      helpUri: `https://mattbaconz.github.io/sloplint/#rule/${r.id}`,
      defaultConfiguration: { level: level(r.severity) },
    })),
  };
  const found = results.flatMap((r) =>
    r.diagnostics.map((d) => ({
      ruleId: d.rule,
      level: level(d.severity),
      message: { text: d.message },
      locations: [{ physicalLocation: { artifactLocation: { uri: toPosix(r.path) }, region: { startLine: d.line, startColumn: d.col } } }],
    })),
  );
  return { $schema: 'https://json.schemastore.org/sarif-2.1.0.json', version: '2.1.0', runs: [{ tool: { driver }, results: found }] };
}

function check(argv, io) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      fix: { type: 'boolean' },
      changed: { type: 'boolean' },
      format: { type: 'string' },
      'max-score': { type: 'string' },
      'no-color': { type: 'boolean' },
    },
  });
  const format = values.format ?? (io.tty ? 'pretty' : 'compact');
  if (!['pretty', 'compact', 'json', 'github', 'sarif'].includes(format)) throw new UsageError(`--format must be pretty, compact, json, github or sarif, got "${format}"`);
  const max = values['max-score'] == null ? null : Number(values['max-score']);
  if (max != null && !(Number.isInteger(max) && max >= 0 && max <= 100)) throw new UsageError('--max-score takes a whole number from 0 to 100');

  let files;
  if (values.changed) {
    files = changedFiles(process.cwd());
    if (!files) throw new UsageError('--changed needs a git repository');
  } else files = (positionals.length ? positionals : ['.']).flatMap(collect);
  const { results, fixed, fixedFiles } = lintFiles(files, { fix: values.fix });
  const s = score(results);
  const failed = s.errors > 0 || (max != null && s.score > max);

  if (format === 'json') {
    const report = results.filter((r) => r.diagnostics.length).map(({ path, diagnostics }) => ({ path, diagnostics }));
    io.out(`${JSON.stringify({ version: VERSION, ...s, fixed, files: report }, null, 2)}\n`);
    return failed ? 1 : 0;
  }
  if (format === 'sarif') {
    io.out(`${JSON.stringify(sarif(results), null, 2)}\n`);
    return failed ? 1 : 0;
  }

  const extra = [];
  if (fixed) extra.push(`Applied ${fixed} autofix${fixed === 1 ? '' : 'es'} in ${plural(fixedFiles, 'file')}.`);
  if (max != null && s.score > max) extra.push(`Score ${s.score} is above --max-score ${max}.`);
  if (!s.files) extra.push(values.changed ? 'No changed lintable files.' : `No lintable files (${EXTENSIONS.join(', ')}).`);
  // Annotations are consumed by the runner, so the readable report follows them in the log.
  if (format === 'github' && s.errors + s.warnings) io.out(`${githubAnnotations(results)}\n`);
  if (format === 'compact' || format === 'github') {
    io.out(`${compactReport(results, s, extra)}\n`);
    return failed ? 1 : 0;
  }
  const c = painter(io.color && !values['no-color']);
  for (const r of results) for (const d of r.diagnostics) io.out(`${frame(d, r, c, io.columns)}\n\n`);
  io.out(`${summary(s, c, extra.map((e) => (e.startsWith('Applied') ? c.green(e) : e.startsWith('Score') ? c.red(e) : c.yellow(e))))}\n`);
  return failed ? 1 : 0;
}

// ─── explain ─────────────────────────────────────────────────────────────────

function examplePair(rule) {
  const dir = new URL('examples/', ROOT);
  const read = (kind) => {
    const url = new URL(`${rule.id}.${kind}.${rule.sample}`, dir);
    return existsSync(url) ? readFileSync(url, 'utf8').replace(/\r\n/g, '\n').trimEnd() : null;
  };
  return { slop: read('slop'), craft: read('craft') };
}

function explain(argv, io) {
  const { values, positionals } = parseArgs({ args: argv, allowPositionals: true, options: { 'no-color': { type: 'boolean' } } });
  const c = painter(io.color && !values['no-color']);
  if (!positionals.length) {
    for (const [prefix, name] of Object.entries(DOMAINS)) {
      io.out(`\n${c.bold(name)}\n`);
      for (const r of RULES.filter((x) => x.domain === prefix)) {
        const sev = r.severity === 'error' ? c.red('error') : c.yellow('warn ');
        io.out(`  ${c.bold(r.id.padEnd(9))}${sev}  ${c.cyan(r.slug.padEnd(26))}${r.title}\n`);
      }
    }
    io.out(`\n${c.dim('sloplint explain <RULE> shows the rationale and a slop/craft diff.')}\n`);
    return 0;
  }
  const rule = findRule(positionals[0]);
  if (!rule) throw new UsageError(`No rule matches "${positionals[0]}". Run sloplint explain to list them.`);
  const width = Math.min(io.columns, 120);
  const out = [
    '',
    `${c.bold(rule.id)}  ${c.cyan(rule.slug)}  ${c.dim(`${DOMAINS[rule.domain]} · ${rule.severity} · weight ${rule.weight}`)}`,
    c.bold(rule.title),
    '',
    wrapText(rule.rationale, width - 2, '  '),
    '',
    `${c.green(c.bold('Fix'))}`,
    wrapText(rule.fix, width - 2, '  '),
    '',
  ];
  if (rule.design) out.push(c.dim('  Runs only in projects with a DESIGN.md token block (sloplint init writes one).'), '');
  const { slop, craft } = examplePair(rule);
  if (slop != null && craft != null) {
    const ops = diffLines(slop.split('\n'), craft.split('\n'));
    if (io.columns < 80) {
      out.push(c.red(c.bold('✖ SLOP')));
      for (const o of ops) if (o.kind !== 'add') out.push(o.kind === 'del' ? c.red(`- ${o.left}`) : c.dim(`  ${o.left}`));
      out.push('', c.green(c.bold('✔ CRAFT')));
      for (const o of ops) if (o.kind !== 'del') out.push(o.kind === 'add' ? c.green(`+ ${o.right}`) : c.dim(`  ${o.right}`));
    } else {
      const col = Math.floor((width - 3) / 2);
      out.push(`${c.red(c.bold(fit(`✖ SLOP  ${rule.id}.slop.${rule.sample}`, col)))} ${c.gray('│')} ${c.green(c.bold(`✔ CRAFT  ${rule.id}.craft.${rule.sample}`))}`);
      out.push(c.gray(`${'─'.repeat(col)}─┼─${'─'.repeat(col)}`));
      for (const row of pairRows(ops)) {
        const left = fit(row.left ?? '', col);
        const right = fit(row.right ?? '', col);
        if (row.kind === 'same') out.push(`${c.dim(left)} ${c.gray('│')} ${c.dim(right)}`);
        else out.push(`${row.left == null ? left : c.red(left)} ${c.gray('│')} ${row.right == null ? right : c.green(right)}`);
      }
    }
    out.push('');
  }
  io.out(`${out.join('\n')}\n`);
  return 0;
}

// ─── init and style ──────────────────────────────────────────────────────────

const STYLE_OPTIONS = { seed: { type: 'string' }, brief: { type: 'string' }, mood: { type: 'string' }, mode: { type: 'string' } };

function packageInfo(dir) {
  try {
    return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  } catch {
    return null;
  }
}

function runInit(argv, io) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: { ...STYLE_OPTIONS, preset: { type: 'string', short: 'p' }, hooks: { type: 'boolean' }, force: { type: 'boolean' }, 'no-color': { type: 'boolean' } },
  });
  if (values.preset && (values.seed ?? values.brief ?? values.mood ?? values.mode) != null) throw new UsageError('--preset and --seed/--brief/--mood/--mode are alternatives; pass one or the other');
  const c = painter(io.color && !values['no-color']);
  const report = init(resolve(positionals[0] ?? '.'), values);
  const what = report.style ? `style ${c.cyan(report.style.name)} ${c.dim(`(${report.style.mood}, ${report.style.mode})`)}` : `preset ${c.cyan(report.preset)}`;
  io.out(`${c.bold('sloplint init')}  ${what}\n`);
  for (const f of report.files) io.out(`  ${f.status === 'unchanged' ? c.dim(f.status.padEnd(9)) : c.green(f.status.padEnd(9))} ${f.path}\n`);
  for (const note of report.notes) io.out(`  ${c.yellow(note)}\n`);
  if (report.style) io.out(c.dim(`  Preview: npx @sloplint/cli style --seed "${report.style.seed}" --mood ${report.style.mood} --mode ${report.style.mode} --html design.html\n`));
  return 0;
}

function swatch(hex, on) {
  if (!on) return '';
  const n = parseInt(hex.slice(1), 16);
  return `\x1b[48;2;${n >> 16};${(n >> 8) & 255};${n & 255}m    \x1b[49m `;
}

function style(argv, io) {
  const { values } = parseArgs({ args: argv, options: { ...STYLE_OPTIONS, html: { type: 'string' }, json: { type: 'boolean' }, 'no-color': { type: 'boolean' } } });
  const pkg = packageInfo(process.cwd());
  const s = generateStyle({
    seed: values.seed ?? defaultSeed(process.cwd()),
    brief: values.brief ?? pkg?.description ?? '',
    mood: values.mood,
    mode: values.mode,
  });
  if (values.html) writeFileSync(resolve(values.html), specimenHtml(s));
  if (values.json) {
    io.out(`${JSON.stringify(s, null, 2)}\n`);
    return 0;
  }
  const on = io.color && !values['no-color'];
  const c = painter(on);
  const pad = '         ';
  const out = [
    `${c.bold(s.name)}  ${c.dim(`${s.mood}, ${s.mode} · seed "${s.seed}"`)}`,
    '',
    `${c.bold('Type')}     ${s.fonts.display.family} ${s.fonts.display.weight} / ${s.fonts.text.family} / ${s.fonts.mono.family}`,
    `${c.bold('Color')}    ${Object.entries(s.colors).slice(0, 6).map(([k, v]) => `${swatch(v, on)}${k} ${c.dim(v)}`).join('  ')}`,
    `${pad}${Object.entries(s.colors).slice(6).map(([k, v]) => `${swatch(v, on)}${k} ${c.dim(v)}`).join('  ')}`,
    `${pad}${c.dim(`ink on bg ${contrast(s.colors.ink, s.colors.bg).toFixed(1)}:1 · on-accent on accent ${contrast(s.colors['on-accent'], s.colors.accent).toFixed(1)}:1`)}`,
    `${c.bold('Layout')}   ${s.layout.name}: ${s.layout.lines[0]}`,
    ...s.signatures.map((sig) => `${pad}${sig.replace(/`/g, '')}`),
    `${c.bold('Motion')}   ${s.motion.ms}ms ${s.motion.ease}. ${s.motion.note}`,
    '',
    c.dim(`Apply it: npx @sloplint/cli init --seed "${s.seed}" --mood ${s.mood} --mode ${s.mode}`),
  ];
  if (values.html) out.push(c.dim(`Specimen written to ${values.html}`));
  io.out(`${out.join('\n')}\n`);
  return 0;
}

// ─── hook ────────────────────────────────────────────────────────────────────

// Claude Code hook. PostToolUse lints the file just written; Stop lints every changed file once
// before the agent may finish. Findings go to stderr with exit code 2, which Claude reads.
function hook(io) {
  let input;
  try {
    input = JSON.parse(io.stdin());
  } catch {
    return 0;
  }
  const cwd = input.cwd || process.cwd();
  let files;
  let intro;
  if (input.hook_event_name === 'Stop' || input.hook_event_name === 'SubagentStop') {
    if (input.stop_hook_active) return 0;
    files = changedFiles(cwd) ?? collect(cwd);
    intro = 'before you finish';
  } else {
    const file = input.tool_input?.file_path ?? input.tool_input?.path;
    if (!file) return 0;
    const abs = resolve(cwd, file);
    const rel = toPosix(relative(cwd, abs));
    if (!existsSync(abs) || !lintable(abs) || rel.startsWith('..') || ignoredPath(readIgnores(cwd), rel)) return 0;
    files = [{ abs, rel }];
    intro = 'in the file you just wrote';
  }
  const here = process.cwd();
  process.chdir(cwd);
  try {
    const { results } = lintFiles(files, { fix: false });
    const s = score(results);
    if (!s.errors && !s.warnings) {
      // Confirm a clean write; otherwise an agent that just fixed a finding re-runs the check to find out.
      if (intro !== 'before you finish') io.out(`${JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: `sloplint: ${files[0].rel} is clean.` } })}\n`);
      return 0;
    }
    const n = s.errors + s.warnings;
    io.err(`sloplint: fix ${n === 1 ? 'this finding' : `these ${n} findings`} ${intro} (reasoning: npx @sloplint/cli explain <RULE>)\n${compactReport(results, s)}\n`);
    return 2;
  } finally {
    process.chdir(here);
  }
}

// ─── entry ───────────────────────────────────────────────────────────────────

export function main(argv, io = {}) {
  const env = globalThis.process?.env ?? {};
  const config = {
    out: (s) => process.stdout.write(s),
    err: (s) => process.stderr.write(s),
    stdin: () => readFileSync(0, 'utf8'),
    tty: Boolean(process.stdout.isTTY),
    color: Boolean(process.stdout.isTTY) && !env.NO_COLOR && env.TERM !== 'dumb',
    columns: process.stdout.columns || 100,
    ...io,
  };
  const [command, ...rest] = argv;
  try {
    if (command === '--version' || command === '-v') {
      config.out(`${VERSION}\n`);
      return 0;
    }
    if (command === 'help' || command === '--help' || command === '-h') {
      config.out(`${HELP}\n`);
      return 0;
    }
    if (command === 'init') return runInit(rest, config);
    if (command === 'style') return style(rest, config);
    if (command === 'explain') return explain(rest, config);
    if (command === 'hook') return hook(config);
    if (command === 'check') return check(rest, config);
    if (command == null || command.startsWith('-') || existsSync(command)) return check(argv, config);
    throw new UsageError(`Unknown command "${command}". Commands: check, init, style, explain, hook.`);
  } catch (error) {
    if (!(error instanceof UsageError || error.usage || error.code?.startsWith('ERR_PARSE_ARGS_'))) throw error;
    config.err(`sloplint: ${error.message}\n\n${HELP}\n`);
    return 2;
  }
}
