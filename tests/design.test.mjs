import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateStyle, designDoc, specimenHtml, parseDesign, contrast, MOODS } from '../src/design.mjs';
import { colorsIn, isNeonPurple } from '../src/style.mjs';
import { lint } from '../src/engine.mjs';

test('a seed always gives the same system, and different seeds give different ones', () => {
  assert.deepEqual(generateStyle({ seed: 'harbor-invoices' }), generateStyle({ seed: 'harbor-invoices' }));
  const styles = Array.from({ length: 210 }, (_, i) => generateStyle({ seed: `s${i}` }));
  assert.equal(new Set(styles.map((s) => s.colors.accent)).size, styles.length, 'accents repeat');
  assert.deepEqual(new Set(styles.map((s) => s.mood)), new Set(MOODS), 'every mood is reachable');
  assert.ok(new Set(styles.map((s) => s.fonts.display.family)).size >= 25, 'display faces converge');
  assert.ok(new Set(styles.map((s) => s.layout.key)).size >= 6, 'layouts converge');
});

test('the first screen is a rule plus three forms picked by seed, not one named device', () => {
  const styles = Array.from({ length: 210 }, (_, i) => generateStyle({ seed: `first-${i}` }));
  for (const s of styles) {
    assert.equal(new Set(s.layout.first.options).size, 3, s.seed);
    assert.match(designDoc(s), /^- First screen: .+ \(1\) .+; \(2\) .+; \(3\) .+ fill it from this brief's own material/m, s.seed);
  }
  for (const key of new Set(styles.map((s) => s.layout.key))) {
    const sets = new Set(styles.filter((s) => s.layout.key === key).map((s) => s.layout.first.options.join('|')));
    assert.ok(sets.size >= 3, `${key}: first-screen forms converge`);
  }
});

test('every palette meets its contrast floors and stays out of the AI purple band', () => {
  for (let i = 0; i < 400; i++) {
    const { colors: c, seed } = generateStyle({ seed: `contrast-${i}`, mode: i % 2 ? 'dark' : 'light' });
    const floor = (a, b, min) => assert.ok(contrast(c[a], c[b]) >= min, `${seed}: ${a} on ${b} is ${contrast(c[a], c[b]).toFixed(2)}`);
    floor('ink', 'bg', 12);
    floor('ink-2', 'surface-2', 4.5);
    floor('accent', 'bg', 3);
    floor('on-accent', 'accent', 4.5);
    floor('accent-ink', 'bg', 4.5);
    for (const status of ['ok', 'warn', 'danger']) floor(status, 'bg', 4.5);
    for (const [name, hex] of Object.entries(c)) assert.ok(!isNeonPurple(colorsIn(hex)[0]), `${seed}: --${name} ${hex} is AI purple`);
  }
});

test('the brief steers the mood; --mood and --mode override it', () => {
  assert.equal(generateStyle({ seed: 's1', brief: 'Uptime monitoring for Kubernetes clusters' }).mood, 'technical');
  assert.equal(generateStyle({ seed: 's1', brief: 'A recipe blog for home bakers' }).mood, 'warm');
  assert.equal(generateStyle({ seed: 's1', brief: 'Boutique hotel bookings' }).mood, 'luxe');
  assert.equal(generateStyle({ seed: 's1', brief: 'Quiz games for kids' }).mood, 'playful');
  const forced = generateStyle({ seed: 's1', brief: 'Quiz games for kids', mood: 'lux', mode: 'dark' });
  assert.equal(forced.mood, 'luxe');
  assert.equal(forced.mode, 'dark');
  assert.throws(() => generateStyle({ mood: 'vaporwave' }), /Unknown mood/);
  assert.throws(() => generateStyle({ mode: 'dim' }), /--mode must be light or dark/);
});

test('parseDesign reads the palette and typefaces back from DESIGN.md', () => {
  const s = generateStyle({ seed: 'roundtrip' });
  const design = parseDesign(designDoc(s));
  assert.deepEqual(new Set(design.colors.map((c) => c.hex)), new Set(Object.values(s.colors)));
  const families = [...new Set([s.fonts.display.family, s.fonts.text.family, s.fonts.mono.family])];
  assert.deepEqual(design.fonts.slice(0, families.length), families);
  assert.ok(design.fonts.includes('Menlo'), 'named fallbacks in the stacks are allowed too');
  assert.equal(parseDesign('# Notes without tokens\n'), null);
});

test('generated specimen pages pass sloplint against their own DESIGN.md', () => {
  for (const mood of MOODS) {
    for (const mode of ['light', 'dark']) {
      const s = generateStyle({ seed: `specimen-${mood}`, mood, mode });
      const { diagnostics } = lint(specimenHtml(s), 'specimen.html', { design: parseDesign(designDoc(s)) });
      assert.deepEqual(diagnostics.map((d) => `${d.rule} ${d.line}:${d.col} ${d.message}`), [], `${mood} ${mode}`);
    }
  }
});

test('examples/samples/DESIGN.md is current generator output', () => {
  const sample = readFileSync(new URL('../examples/samples/DESIGN.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  assert.equal(sample, designDoc(generateStyle({ seed: 'harbor-invoices', brief: 'Invoicing for freelance studios' })));
});
