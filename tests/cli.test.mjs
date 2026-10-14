import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RULES } from '../src/engine.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BIN = join(ROOT, 'bin', 'sloplint.mjs');
const VERSION = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;

function run(args, cwd = ROOT) {
  const r = spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

function tempDir(t, files = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'sloplint-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(join(dir, name, '..'), { recursive: true });
    writeFileSync(join(dir, name), text);
  }
  return dir;
}

test('check on the full-stack samples fails with compiler-style frames', () => {
  const { code, out } = run(['check', 'examples/samples']);
  assert.equal(code, 1);
  assert.match(out, /^error\[SEC-001\]: /m);
  assert.match(out, /^ *--> examples\/samples\/api\.slop\.ts:\d+:\d+$/m);
  assert.match(out, /^\d+ \| .*process\.env\.JWT_SECRET \|\| 'supersecretkey'/m);
  assert.match(out, /^ +\| +\^+$/m);
  assert.match(out, /= fix: /);
  assert.match(out, /= autofix available \(--fix\)/);
  assert.match(out, /Slop Score .* \d+\/100 (Heavy Slop|Critical Slop)/);
});

test('check --format json reports score, grade and per-file diagnostics', () => {
  const { code, out } = run(['check', 'examples/samples', '--format', 'json']);
  assert.equal(code, 1);
  const report = JSON.parse(out);
  assert.equal(report.version, VERSION);
  assert.ok(report.score >= 80, `score ${report.score}`);
  assert.equal(report.grade, 'Critical Slop');
  assert.ok(report.errors > 0 && report.warnings > 0);
  assert.equal(report.files.length, 7);
  const seen = new Set(report.files.flatMap((f) => f.diagnostics.map((d) => d.rule)));
  assert.deepEqual(RULES.map((r) => r.id).filter((id) => !seen.has(id)), []);
  for (const d of report.files[0].diagnostics) {
    assert.ok(d.line >= 1 && d.col >= 1 && d.message && d.rule);
  }
});

test('clean project scores 0/100 Studio Grade and exits 0', (t) => {
  const dir = tempDir(t, {
    'src/config.ts': "const KEY = process.env.API_KEY;\nif (!KEY) throw new Error('API_KEY is not set');\nexport { KEY };\n",
    'styles.css': '.button { transition: background-color 120ms ease-out; }\n',
  });
  const { code, out } = run(['check', '.'], dir);
  assert.equal(code, 0);
  assert.match(out, /0\/100 Studio Grade/);
  assert.match(out, /2 files/);
});

test('warnings alone exit 0; --max-score turns them into a failure', (t) => {
  const dir = tempDir(t, { 'app.css': '.card { transition: all 200ms; }\n' });
  assert.equal(run(['check', '.'], dir).code, 0);
  const strict = run(['check', '.', '--max-score', '0'], dir);
  assert.equal(strict.code, 1);
  assert.match(strict.out, /is above --max-score 0/);
});

test('--fix rewrites files in place and the result is clean', (t) => {
  const dir = tempDir(t);
  for (const name of ['BE-003.slop.ts', 'UI-007.slop.css', 'SEC-001.slop.ts', 'TEST-004.slop.test.ts']) {
    copyFileSync(join(ROOT, 'examples', name), join(dir, name.replace('.slop', '')));
  }
  const fixed = run(['check', '.', '--fix'], dir);
  assert.match(fixed.out, /Applied \d+ autofix(es)? in 4 files/);
  assert.match(readFileSync(join(dir, 'BE-003.ts'), 'utf8'), /signal: AbortSignal\.timeout\(10_000\)/);
  assert.doesNotMatch(readFileSync(join(dir, 'UI-007.css'), 'utf8'), /transition:\s*all/);
  assert.match(readFileSync(join(dir, 'SEC-001.ts'), 'utf8'), /throw new Error\('JWT_SECRET is not set'\)/);
  assert.doesNotMatch(readFileSync(join(dir, 'TEST-004.test.ts'), 'utf8'), /describe\.only/);
  const after = run(['check', '.', '--format', 'json'], dir);
  const report = JSON.parse(after.out);
  assert.equal(report.errors, 0);
  assert.deepEqual(report.files.flatMap((f) => f.diagnostics.filter((d) => d.fix).map((d) => d.rule)), []);
});

test('default, .gitignore and .sloplintignore paths are skipped', (t) => {
  const slop = "const S = process.env.SECRET || 'x';\n";
  const dir = tempDir(t, {
    'node_modules/pkg/index.js': slop,
    'dist/bundle.js': slop,
    'legacy/old.ts': slop,
    'src/gen/client.gen.ts': slop,
    'src/ok.ts': 'export const ok = true;\n',
    '.gitignore': '*.gen.ts\n',
    '.sloplintignore': '# vendored code we do not own\nlegacy/\n',
  });
  const { code, out } = run(['check', '.', '--format', 'json'], dir);
  assert.equal(code, 0, out);
  const report = JSON.parse(out);
  assert.equal(report.files.length, 0);
  assert.equal(report.score, 0);
});

test('explain shows rationale and a side-by-side slop/craft diff', () => {
  const { code, out } = run(['explain', 'UI-006']);
  assert.equal(code, 0);
  assert.match(out, /UI-006 {2}nonconcentric-radius/);
  assert.match(out, /✖ SLOP/);
  assert.match(out, /✔ CRAFT/);
  assert.match(out, /border-radius: 16px;.*│.*border-radius: 8px;/);
  assert.match(run(['explain', 'transition-all']).out, /UI-007/);
});

test('explain without an argument lists every rule', () => {
  const { code, out } = run(['explain']);
  assert.equal(code, 0);
  for (const r of RULES) assert.ok(out.includes(r.id), r.id);
});

test('usage errors exit 2 with help', () => {
  for (const args of [['explain', 'NOPE-999'], ['check', '--format', 'xml'], ['check', '--wat'], ['frobnicate'], ['check', '--max-score', 'high'], ['init', '--preset', 'vaporwave']]) {
    const r = run(args);
    assert.equal(r.code, 2, args.join(' '));
    assert.match(r.err, /^sloplint: /);
    assert.match(r.err, /Usage/);
  }
});

test('--version and --help', () => {
  assert.equal(run(['--version']).out.trim(), VERSION);
  assert.match(run(['--help']).out, /sloplint check \[paths\.\.\.\]/);
});
