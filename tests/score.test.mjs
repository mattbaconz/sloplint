import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lint, score, gradeOf, applyFixes, fixSource, diffLines, pairRows } from '../src/engine.mjs';

const diag = (rule, weight, severity = 'warn') => ({ rule, weight, severity, fix: null });
const result = (lines, diagnostics) => ({ path: 'x.ts', lines, diagnostics });

test('no findings is exactly 0/100 Studio Grade', () => {
  assert.deepEqual([score([]).score, score([]).grade], [0, 'Studio Grade']);
  const s = score([result(500, [])]);
  assert.equal(s.score, 0);
  assert.equal(s.grade, 'Studio Grade');
});

test('any finding scores at least 1, so only clean code is Studio Grade', () => {
  const s = score([result(100_000, [diag('TEST-003', 1)])]);
  assert.equal(s.score, 1);
  assert.equal(s.grade, 'Minor Slop');
});

test('grade bands', () => {
  const cases = [[0, 'Studio Grade'], [1, 'Minor Slop'], [19, 'Minor Slop'], [20, 'Noticeable Slop'], [39, 'Noticeable Slop'], [40, 'Sloppy'], [59, 'Sloppy'], [60, 'Heavy Slop'], [79, 'Heavy Slop'], [80, 'Critical Slop'], [100, 'Critical Slop']];
  for (const [value, grade] of cases) assert.equal(gradeOf(value), grade, String(value));
});

test('score rises monotonically with findings and saturates at 100', () => {
  const rules = ['SEC-001', 'SEC-003', 'BE-001', 'UI-001', 'COPY-001', 'TEST-001', 'BE-002', 'SEC-006', 'UI-007', 'BE-005'];
  let previous = 0;
  for (let n = 1; n <= rules.length; n++) {
    const s = score([result(200, rules.slice(0, n).map((r) => diag(r, 6)))]).score;
    assert.ok(s >= previous, `${n} findings: ${s} < ${previous}`);
    previous = s;
  }
  assert.ok(previous >= 90, String(previous));
  const flood = Array.from({ length: 30 }, (_, i) => diag(`SEC-${100 + i}`, 10, 'error'));
  assert.equal(score([result(200, flood)]).score, 100);
});

test('a rule counts at most three times per file', () => {
  const three = score([result(200, Array(3).fill(diag('UI-007', 3)))]);
  const ten = score([result(200, Array(10).fill(diag('UI-007', 3)))]);
  assert.equal(three.penalty, 9);
  assert.equal(ten.penalty, 9);
  assert.equal(ten.warnings, 10);
});

test('the same findings weigh less in a larger codebase', () => {
  const findings = [diag('SEC-001', 10, 'error'), diag('BE-001', 5)];
  const small = score([result(200, findings)]).score;
  const large = score([result(40_000, findings)]).score;
  assert.ok(large < small, `${large} !< ${small}`);
  assert.ok(large > 0);
});

test('summary counts errors, warnings, fixable and domains', () => {
  const s = score([result(50, [diag('SEC-001', 10, 'error'), { ...diag('UI-007', 3), fix: { start: 0, end: 1, text: '' } }, diag('COPY-001', 2)])]);
  assert.deepEqual([s.errors, s.warnings, s.fixable], [1, 2, 1]);
  assert.deepEqual(s.byDomain, { UI: 1, SEC: 1, BE: 0, COPY: 1, TEST: 0, MOTION: 0 });
});

test('applyFixes skips overlapping edits and applies right to left', () => {
  const text = 'abcdef';
  const out = applyFixes(text, [
    { fix: { start: 0, end: 2, text: 'X' } },
    { fix: { start: 1, end: 3, text: 'Y' } },
    { fix: { start: 4, end: 6, text: 'Z' } },
  ]);
  assert.equal(out.applied, 2);
  assert.equal(out.text, 'aYdZ');
});

test('fixSource reaches a fixed point', () => {
  const text = ".a { transition: all 0.2s; }\n.b { transition: all 0.2s; }\n";
  const once = fixSource(text, 'x.css');
  assert.equal(once.applied, 2);
  assert.equal(fixSource(once.text, 'x.css').applied, 0);
  assert.deepEqual(lint(once.text, 'x.css').diagnostics, []);
});

test('suppression directives work only inside comments', () => {
  const secret = "const T = process.env.TOKEN_SECRET || 'dev';";
  assert.equal(lint(`// sloplint-disable-next-line SEC-001\n${secret}`, 'a.ts').diagnostics.length, 0);
  assert.equal(lint(`${secret} // sloplint-disable-line`, 'a.ts').diagnostics.length, 0);
  assert.equal(lint(`/* sloplint-disable-file SEC-001 */\n${secret}`, 'a.ts').diagnostics.length, 0);
  assert.equal(lint(`// sloplint-disable-next-line UI-007\n${secret}`, 'a.ts').diagnostics.length, 1, 'other rule IDs do not suppress');
  assert.equal(lint(`const s = 'sloplint-disable-file';\n${secret}`, 'a.ts').diagnostics.length, 1, 'a string is not a directive');
});

test('diffLines and pairRows produce aligned side-by-side rows', () => {
  const ops = diffLines(['a', 'b', 'c'], ['a', 'B', 'c', 'd']);
  assert.deepEqual(ops.map((o) => o.kind), ['same', 'del', 'add', 'same', 'add']);
  assert.deepEqual(pairRows(ops).map((r) => [r.kind, r.left ?? null, r.right ?? null]), [
    ['same', 'a', 'a'],
    ['change', 'b', 'B'],
    ['same', 'c', 'c'],
    ['change', null, 'd'],
  ]);
});
