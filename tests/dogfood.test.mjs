// The definition of done: sloplint finds nothing in its own repository, site included.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function check(target) {
  const r = spawnSync(process.execPath, [join(ROOT, 'bin', 'sloplint.mjs'), 'check', target, '--format', 'json', '--max-score', '0'], { cwd: ROOT, encoding: 'utf8' });
  return { code: r.status, report: JSON.parse(r.stdout) };
}

test('the repository scores 0/100 Studio Grade', () => {
  const { code, report } = check('.');
  const findings = report.files.flatMap((f) => f.diagnostics.map((d) => `${f.path}:${d.line} ${d.rule} ${d.message}`));
  assert.deepEqual(findings, []);
  assert.equal(report.score, 0);
  assert.equal(code, 0);
  assert.ok(report.files.length === 0 && report.lines > 5000, `scanned ${report.lines} lines`);
});

test('the docs site scores 0/100 on its own', () => {
  const { code, report } = check('site');
  assert.equal(code, 0);
  assert.equal(report.score, 0);
  assert.equal(report.files.length, 0);
  assert.ok(report.lines > 1000);
});
