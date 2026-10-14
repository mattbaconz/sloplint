// sloplint init: writes DESIGN.md from a studio preset and syncs a managed rule block
// into the files coding agents read (CLAUDE.md, GEMINI.md, AGENTS.md, Cursor rules).

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { RULES, DOMAINS } from './engine.mjs';

export const PRESETS = {
  'obsidian-telemetry': 'Obsidian Telemetry',
  'editorial-serif': 'Editorial Serif',
  'swiss-brutalist': 'Swiss Brutalist',
  'tactile-hardware': 'Tactile Hardware',
};

const ALIASES = { obsidian: 'obsidian-telemetry', editorial: 'editorial-serif', swiss: 'swiss-brutalist', tactile: 'tactile-hardware' };
const PRESET_MARK = /<!-- sloplint:preset ([a-z-]+) -->/;
const START = '<!-- sloplint:start -->';
const END = '<!-- sloplint:end -->';
const AGENT_FILES = ['CLAUDE.md', 'GEMINI.md', 'AGENTS.md'];
const CURSOR_FILE = '.cursor/rules/sloplint.mdc';

export function resolvePreset(name) {
  const key = String(name).trim().toLowerCase().replace(/\s+/g, '-');
  const preset = PRESETS[key] ? key : ALIASES[key];
  if (!preset) throw Object.assign(new Error(`Unknown preset "${name}". Choose one of: ${Object.keys(PRESETS).join(', ')}`), { usage: true });
  return preset;
}

export function presetSource(preset) {
  return readFileSync(new URL(`../presets/${preset}.md`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
}

// The compact brief synced into every agent file. Generated from the catalog so it never drifts.
export function ruleBlock(preset) {
  const lines = [
    START,
    '## sloplint: anti-slop rules',
    '',
    `Follow DESIGN.md (preset: ${PRESETS[preset]}) for every visual decision. Before you call a change done, run \`npx @sloplint/cli check .\` and fix every finding; the target is 0/100 (Studio Grade). Run \`npx @sloplint/cli explain <RULE>\` for the reasoning and a worked example.`,
    '',
    'Pages must not scroll sideways at 375px: navs wrap or collapse, stat rows stack, and wide tables scroll inside their own `overflow-x: auto` wrapper. The source rules cannot see rendered width, so check it.',
  ];
  for (const [prefix, name] of Object.entries(DOMAINS)) {
    lines.push('', `### ${name}`, '');
    for (const r of RULES.filter((x) => x.domain === prefix)) lines.push(`- **${r.id}** ${r.title}. ${r.fix}`);
  }
  lines.push(END);
  return lines.join('\n');
}

function upsertBlock(existing, block) {
  if (existing == null) return `${block}\n`;
  const from = existing.indexOf(START);
  const to = existing.indexOf(END, from);
  if (from >= 0 && to > from) return existing.slice(0, from) + block + existing.slice(to + END.length);
  return `${existing.replace(/\s*$/, '')}\n\n${block}\n`;
}

export function init(dir, { preset, force = false } = {}) {
  const read = (rel) => (existsSync(join(dir, rel)) ? readFileSync(join(dir, rel), 'utf8') : null);
  const files = [];
  const notes = [];
  const write = (rel, next) => {
    const before = read(rel);
    if (before === next) {
      files.push({ path: rel, status: 'unchanged' });
      return;
    }
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), next);
    files.push({ path: rel, status: before == null ? 'created' : 'updated' });
  };

  const design = read('DESIGN.md');
  const current = design && PRESET_MARK.exec(design)?.[1];
  const chosen = preset ? resolvePreset(preset) : current && PRESETS[current] ? current : 'obsidian-telemetry';

  if (design == null || current || force) write('DESIGN.md', `<!-- sloplint:preset ${chosen} -->\n${presetSource(chosen)}`);
  else notes.push('DESIGN.md exists and was not written by sloplint, so it was left alone. Rerun with --force to replace it.');

  const block = ruleBlock(chosen);
  for (const name of AGENT_FILES) write(name, upsertBlock(read(name), block));
  write(CURSOR_FILE, `---\ndescription: sloplint anti-slop rules and design system\nalwaysApply: true\n---\n\n${block}\n`);
  return { preset: chosen, files, notes };
}
