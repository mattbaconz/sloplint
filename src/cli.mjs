// Command-line front end: argument parsing, file walking, terminal rendering.

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { RULES, DOMAINS, EXTENSIONS, findRule, lint, fixSource, score, diffLines, pairRows } from './engine.mjs';
import { init, PRESETS } from './init.mjs';

const ROOT = new URL('../', import.meta.url);
const VERSION = JSON.parse(readFileSync(new URL('package.json', ROOT), 'utf8')).version;
const MAX_BYTES = 1_000_000;
const DEFAULT_IGNORES = ['node_modules/', '.git/', 'dist/', 'build/', 'out/', 'coverage/', '.next/', '.nuxt/', '.svelte-kit/', '.turbo/', 'vendor/', '*.min.js', '*.min.css', '*.bundle.js'];

const HELP = `sloplint ${VERSION} - find and fix AI slop across UI, security, backend, copy and tests

Usage
  sloplint check [paths...]       Lint files and print a Slop Score (default: .)
      --fix                     Apply safe autofixes in place
      --format pretty|json      Output format (default: pretty)
      --max-score <n>           Exit 1 when the score is above n
      --no-color                Plain output (also honours NO_COLOR)
  sloplint init [--preset <name>] Write DESIGN.md and sync agent rule files
      --force                   Overwrite a DESIGN.md that sloplint did not write
  sloplint explain [RULE]         Rationale and slop/craft diff for one rule, or list all

Presets: ${Object.keys(PRESETS).join(', ')}
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

const lintable = (name) => EXTENSIONS.includes(name.slice(name.lastIndexOf('.') + 1).toLowerCase());

// Returns [{ abs, rel }] where rel is relative to the scan root and uses forward slashes.
function collect(target) {
  const abs = resolve(target);
  const stat = statSync(abs, { throwIfNoEntry: false });
  if (!stat) throw new UsageError(`No such file or directory: ${target}`);
  if (stat.isFile()) return [{ abs, rel: abs.split(sep).pop() }];
  const ignored = readIgnores(abs);
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = join(dir, entry.name);
      const rel = relative(abs, full).split(sep).join('/');
      const isDir = entry.isDirectory();
      if (ignored.some((test) => test(rel, isDir))) continue;
      if (isDir) walk(full);
      else if (entry.isFile() && lintable(entry.name) && statSync(full).size <= MAX_BYTES) files.push({ abs: full, rel });
    }
  };
  walk(abs);
  return files;
}

class UsageError extends Error {}

// ─── check ───────────────────────────────────────────────────────────────────

function lintFiles(targets, { fix }) {
  const results = [];
  let fixed = 0;
  let fixedFiles = 0;
  for (const target of targets) {
    for (const file of collect(target)) {
      let text = readFileSync(file.abs, 'utf8');
      if (fix) {
        const out = fixSource(text, file.rel);
        if (out.applied) {
          writeFileSync(file.abs, out.text);
          text = out.text;
          fixed += out.applied;
          fixedFiles++;
        }
      }
      const result = lint(text, file.rel);
      result.path = relative(process.cwd(), file.abs).split(sep).join('/') || file.rel;
      result.text = text;
      results.push(result);
    }
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
  const counts = [
    `${s.files} file${s.files === 1 ? '' : 's'}`,
    `${s.lines.toLocaleString('en-US')} lines`,
    `${s.errors} error${s.errors === 1 ? '' : 's'}`,
    `${s.warnings} warning${s.warnings === 1 ? '' : 's'}`,
  ];
  if (s.fixable) counts.push(`${s.fixable} autofixable`);
  const domains = Object.keys(DOMAINS).map((d) => (s.byDomain[d] ? `${d} ${c.bold(s.byDomain[d])}` : c.gray(`${d} 0`))).join('  ');
  return [
    `${c.bold('Slop Score')}  ${bar}  ${paint(c.bold(`${s.score}/100`))} ${paint(s.grade)}`,
    c.dim(`            ${counts.join(' · ')}`),
    `            ${domains}`,
    ...extra,
  ].join('\n');
}

function check(argv, io) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      fix: { type: 'boolean' },
      format: { type: 'string', default: 'pretty' },
      'max-score': { type: 'string' },
      'no-color': { type: 'boolean' },
    },
  });
  if (!['pretty', 'json'].includes(values.format)) throw new UsageError(`--format must be pretty or json, got "${values.format}"`);
  const max = values['max-score'] == null ? null : Number(values['max-score']);
  if (max != null && !(Number.isInteger(max) && max >= 0 && max <= 100)) throw new UsageError('--max-score takes a whole number from 0 to 100');

  const { results, fixed, fixedFiles } = lintFiles(positionals.length ? positionals : ['.'], { fix: values.fix });
  const s = score(results);
  const failed = s.errors > 0 || (max != null && s.score > max);

  if (values.format === 'json') {
    const files = results.filter((r) => r.diagnostics.length).map(({ path, diagnostics }) => ({ path, diagnostics }));
    io.out(`${JSON.stringify({ version: VERSION, ...s, fixed, files }, null, 2)}\n`);
    return failed ? 1 : 0;
  }

  const c = painter(io.color && !values['no-color']);
  for (const r of results) for (const d of r.diagnostics) io.out(`${frame(d, r, c, io.columns)}\n\n`);
  const extra = [];
  if (fixed) extra.push(c.green(`            Applied ${fixed} autofix${fixed === 1 ? '' : 'es'} in ${fixedFiles} file${fixedFiles === 1 ? '' : 's'}.`));
  if (max != null && s.score > max) extra.push(c.red(`            Score ${s.score} is above --max-score ${max}.`));
  if (!s.files) extra.push(c.yellow(`            No lintable files (${EXTENSIONS.join(', ')}).`));
  io.out(`${summary(s, c, extra)}\n`);
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

// ─── init ────────────────────────────────────────────────────────────────────

function runInit(argv, io) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: { preset: { type: 'string', short: 'p' }, force: { type: 'boolean' }, 'no-color': { type: 'boolean' } },
  });
  const c = painter(io.color && !values['no-color']);
  const report = init(resolve(positionals[0] ?? '.'), { preset: values.preset, force: values.force });
  io.out(`${c.bold('sloplint init')}  preset ${c.cyan(report.preset)}\n`);
  for (const f of report.files) io.out(`  ${f.status === 'unchanged' ? c.dim(f.status.padEnd(9)) : c.green(f.status.padEnd(9))} ${f.path}\n`);
  for (const note of report.notes) io.out(`  ${c.yellow(note)}\n`);
  return 0;
}

// ─── entry ───────────────────────────────────────────────────────────────────

export function main(argv, io = {}) {
  const env = globalThis.process?.env ?? {};
  const config = {
    out: (s) => process.stdout.write(s),
    err: (s) => process.stderr.write(s),
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
    if (command === 'explain') return explain(rest, config);
    if (command === 'check') return check(rest, config);
    if (command == null || command.startsWith('-') || existsSync(command)) return check(argv, config);
    throw new UsageError(`Unknown command "${command}". Commands: check, init, explain.`);
  } catch (error) {
    if (!(error instanceof UsageError || error.usage || error.code?.startsWith('ERR_PARSE_ARGS_'))) throw error;
    config.err(`sloplint: ${error.message}\n\n${HELP}\n`);
    return 2;
  }
}
