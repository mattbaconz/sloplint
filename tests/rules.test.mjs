import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RULES, DOMAINS, lint, findRule } from '../src/engine.mjs';
import { parseDesign } from '../src/design.mjs';
import { gridMin, holdsAt } from '../src/style.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const EXAMPLES = join(ROOT, 'examples');
const VARIANTS = join(ROOT, 'tests', 'fixtures', 'variants');

const ruleIds = (text, path, options) => [...new Set(lint(text, path, options).diagnostics.map((d) => d.rule))].sort();
// The design system the showcase samples ignore; rules marked `design` only run against one.
const SAMPLE_DESIGN = parseDesign(readFileSync(join(EXAMPLES, 'samples', 'DESIGN.md'), 'utf8'));

test('catalog: every rule is complete and uniquely identified', () => {
  const ids = new Set();
  const slugs = new Set();
  for (const r of RULES) {
    assert.match(r.id, /^(UI|SEC|BE|COPY|TEST|MOTION)-\d{3}$/, r.id);
    assert.ok(DOMAINS[r.domain], `${r.id} domain`);
    assert.match(r.slug, /^[a-z0-9-]+$/, `${r.id} slug`);
    assert.ok(['error', 'warn'].includes(r.severity), `${r.id} severity`);
    assert.ok(Number.isInteger(r.weight) && r.weight > 0, `${r.id} weight`);
    for (const field of ['title', 'rationale', 'fix', 'sample']) assert.ok(r[field]?.length > 1, `${r.id} ${field}`);
    assert.ok(Array.isArray(r.langs) && r.langs.length, `${r.id} langs`);
    assert.equal(typeof r.check, 'function');
    assert.ok(!ids.has(r.id) && !slugs.has(r.slug), `${r.id} duplicated`);
    ids.add(r.id);
    slugs.add(r.slug);
    assert.equal(findRule(r.slug), r);
    assert.equal(findRule(r.id.toLowerCase()), r);
  }
  for (const domain of Object.keys(DOMAINS)) assert.ok(RULES.some((r) => r.domain === domain), `${domain} has rules`);
  assert.ok(RULES.filter((r) => r.domain === 'SEC').every((r) => r.severity === 'error'), 'security rules are errors');
});

for (const rule of RULES) {
  test(`${rule.id} ${rule.slug}: slop example triggers it, craft example is clean`, () => {
    const slop = `${rule.id}.slop.${rule.sample}`;
    const craft = `${rule.id}.craft.${rule.sample}`;
    const options = rule.design ? { design: SAMPLE_DESIGN } : {};
    const slopIds = ruleIds(readFileSync(join(EXAMPLES, slop), 'utf8'), `examples/${slop}`, options);
    assert.deepEqual(slopIds, [rule.id], `${slop} should trigger only ${rule.id}`);
    assert.deepEqual(ruleIds(readFileSync(join(EXAMPLES, craft), 'utf8'), `examples/${craft}`, options), [], `${craft} should be clean`);
    if (rule.design) assert.deepEqual(ruleIds(readFileSync(join(EXAMPLES, slop), 'utf8'), `examples/${slop}`), [], `${rule.id} needs a DESIGN.md`);
  });
}

test('showcase samples cover every rule', () => {
  const dir = join(EXAMPLES, 'samples');
  const seen = new Set();
  for (const name of readdirSync(dir).filter((n) => n !== 'DESIGN.md')) {
    const virtual = { 'readme.slop.md': 'README.md', 'api.slop.ts': 'src/server/api.ts' }[name] ?? name;
    for (const id of ruleIds(readFileSync(join(dir, name), 'utf8'), virtual, { design: SAMPLE_DESIGN })) seen.add(id);
  }
  assert.deepEqual(RULES.map((r) => r.id).filter((id) => !seen.has(id)), []);
});

// Each fixture starts with "expect: RULE-IDS" (or "expect: none") in a comment and is linted
// with its path relative to tests/fixtures/variants, so directory names act as a virtual project.
const walk = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
for (const file of walk(VARIANTS)) {
  const rel = relative(VARIANTS, file).split(sep).join('/');
  test(`fixture ${rel}`, () => {
    const text = readFileSync(file, 'utf8');
    const header = /expect:\s*((?:[A-Z]+-\d{3}\s*)+|none)/.exec(text);
    assert.ok(header, `${rel} needs an "expect:" header`);
    const want = header[1].trim() === 'none' ? [] : header[1].trim().split(/\s+/).sort();
    assert.deepEqual(ruleIds(text, rel), want);
  });
}

test('UI-011 and UI-012 accept DESIGN.md tokens in Tailwind arbitrary values', () => {
  const tsx = `export function Stat({ value }: { value: string }) {
  return (
    <div className="bg-[var(--surface)] text-[color:var(--ink)] border-[var(--line)] font-[family-name:var(--font-text)]">
      <p className="font-[family-name:var(--font-mono)] font-[550] text-(--accent) bg-(--surface-2) font-(family-name:--font-display)">{value}</p>
    </div>
  );
}
`;
  const ids = ruleIds(tsx, 'src/Stat.tsx', { design: SAMPLE_DESIGN }).filter((id) => id === 'UI-011' || id === 'UI-012');
  assert.deepEqual(ids, []);
});

test('grid widths and media conditions resolve for a 375px screen', () => {
  assert.deepEqual(gridMin('repeat(auto-fit, minmax(min(16rem, 100%), 1fr))', 24), { n: 1, width: 0 });
  assert.deepEqual(gridMin('repeat(12, 1fr)', 32), { n: 12, width: 352 });
  assert.deepEqual(gridMin('[full] minmax(1rem, 1fr) [content] minmax(0, 60rem) [end] minmax(1rem, 1fr)', 0), { n: 3, width: 32 });
  assert.deepEqual(gridMin('repeat(2, 120px 1fr)', 16), { n: 4, width: 288 });
  assert.equal(gridMin('repeat(var(--cols), 1fr)', 16), null);
  for (const [prelude, holds] of [
    ['@media (max-width: 767px)', true], ['@media (min-width:768px)', false], ['@media (width < 48em)', true],
    ['@media screen and (40em <= width)', false], ['@media (1024px > width)', true], ['@media print', false], ['@supports (display: grid)', true],
  ]) assert.equal(holdsAt(prelude, 375), holds, prelude);
});

test('rules never throw on malformed input', () => {
  const inputs = ['', '{', '`${', '<div className={', '/* unterminated', '"""', "'", '<style>.a{', '```', 'def f(:\n  pass'];
  for (const ext of ['ts', 'tsx', 'html', 'vue', 'css', 'py', 'md']) {
    for (const text of inputs) assert.doesNotThrow(() => lint(text, `file.${ext}`), `${ext}: ${JSON.stringify(text)}`);
  }
});

test('diagnostic positions point at the offending text', () => {
  const text = "const a = 1;\nconst KEY = process.env.API_SECRET || 'dev-secret';\n";
  const [d] = lint(text, 'src/config.ts').diagnostics;
  assert.equal(d.rule, 'SEC-001');
  assert.equal(d.line, 2);
  assert.equal(text.slice(d.start, d.end).includes('process.env.API_SECRET'), true);
  assert.equal(d.col, text.split('\n')[1].indexOf('process') + 1);
});
