// sloplint init: writes DESIGN.md (a generated design system, or one of the curated presets)
// and syncs a managed rule block into the files coding agents read (CLAUDE.md, GEMINI.md,
// AGENTS.md, Cursor rules). With hooks, Claude Code also lints every file it writes.

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { RULES, DOMAINS } from './engine.mjs';
import { generateStyle, designDoc } from './design.mjs';

export const PRESETS = {
  'obsidian-telemetry': 'Obsidian Telemetry',
  'editorial-serif': 'Editorial Serif',
  'swiss-brutalist': 'Swiss Brutalist',
  'tactile-hardware': 'Tactile Hardware',
};

const ALIASES = { obsidian: 'obsidian-telemetry', editorial: 'editorial-serif', swiss: 'swiss-brutalist', tactile: 'tactile-hardware' };
const PRESET_MARK = /<!-- sloplint:preset ([a-z-]+) -->/;
const STYLE_MARK = /<!-- sloplint:style (\{.*?\}) -->/;
const START = '<!-- sloplint:start -->';
const END = '<!-- sloplint:end -->';
const AGENT_FILES = ['CLAUDE.md', 'GEMINI.md', 'AGENTS.md'];
const CURSOR_FILE = '.cursor/rules/sloplint.mdc';
const HOOK_COMMAND = 'npx -y @sloplint/cli hook';

export function resolvePreset(name) {
  const key = String(name).trim().toLowerCase().replace(/\s+/g, '-');
  const preset = PRESETS[key] ? key : ALIASES[key];
  if (!preset) throw Object.assign(new Error(`Unknown preset "${name}". Choose one of: ${Object.keys(PRESETS).join(', ')}`), { usage: true });
  return preset;
}

export function presetSource(preset) {
  return readFileSync(new URL(`../presets/${preset}.md`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
}

const firstSentence = (s) => /^.*?[.!?](?=\s|$)/.exec(s)?.[0] ?? s;

// The compact brief synced into every agent file, generated from the catalog so it never
// drifts. One line per rule (title and the first sentence of its fix) keeps the per-turn cost
// low; `explain` has the rest. `domains` limits it to the parts of the catalog a project uses.
export function ruleBlock(design, { domains = Object.keys(DOMAINS), hooks = false } = {}) {
  const lines = [
    START,
    '## sloplint',
    '',
    `- Design: follow DESIGN.md (${design}) for every color, typeface, radius and duration.`,
    hooks
      ? '- Check: a hook lints every file you write; fix what it reports. Before you finish, `npx @sloplint/cli check .` must report 0/100.'
      : '- Check: before you finish, `npx @sloplint/cli check .` must report 0/100. Fix every finding.',
    '- `npx @sloplint/cli explain <RULE>` gives the reasoning and a worked example.',
    '- Pages never scroll sideways at 375px: wrap navigation, stack rows, and put wide tables in an `overflow-x: auto` wrapper.',
  ];
  for (const [prefix, name] of Object.entries(DOMAINS)) {
    if (!domains.includes(prefix)) continue;
    lines.push('', `### ${name}`, '');
    for (const r of RULES.filter((x) => x.domain === prefix)) lines.push(`- **${r.id}** ${r.title}. ${firstSentence(r.fix)}`);
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

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

// Which parts of the catalog to brief: everything for an empty project, minus motion video
// when nothing renders video, minus UI when a project with dependencies has no front end.
export function projectDomains(dir) {
  const pkg = readJson(join(dir, 'package.json'));
  const deps = Object.keys({ ...pkg?.dependencies, ...pkg?.devDependencies, ...pkg?.peerDependencies });
  const files = [];
  const walk = (d, depth) => {
    let entries = [];
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue;
      if (e.isDirectory() && depth < 3) walk(join(d, e.name), depth + 1);
      else if (e.isFile()) files.push(e.name);
    }
  };
  walk(dir, 0);
  const all = Object.keys(DOMAINS);
  if (!deps.length && !files.some((f) => /\.(m?[jt]sx?|py|html|vue|svelte|astro|css)$/.test(f))) return all;
  const has = (re) => deps.some((d) => re.test(d));
  const video = has(/^(remotion|@remotion\/|gsap$)/);
  const frontEnd = has(/^(react|react-dom|next|vue|nuxt|svelte|@sveltejs\/|astro|solid-js|preact|lit|@angular\/|tailwindcss|vite)$/) || files.some((f) => /\.(html|jsx|tsx|vue|svelte|astro|css)$/.test(f));
  return all.filter((d) => (d !== 'MOTION' || video) && (d !== 'UI' || frontEnd || video));
}

// Adds the sloplint PostToolUse and Stop hooks to .claude/settings.json, keeping everything else.
function withHooks(existing) {
  const settings = existing ? JSON.parse(existing) : {};
  settings.hooks ??= {};
  const add = (event, entry) => {
    const list = (settings.hooks[event] ??= []);
    if (!list.some((e) => e.hooks?.some((h) => String(h.command).includes('@sloplint/cli hook')))) list.push(entry);
  };
  add('PostToolUse', { matcher: 'Write|Edit|MultiEdit', hooks: [{ type: 'command', command: HOOK_COMMAND }] });
  add('Stop', { hooks: [{ type: 'command', command: HOOK_COMMAND }] });
  return `${JSON.stringify(settings, null, 2)}\n`;
}

// seed, brief, mood and mode pick a generated design system; preset picks a curated one. With
// neither, init keeps whatever an earlier run chose, or generates one from the package name.
export function init(dir, { preset, seed, brief, mood, mode, force = false, hooks = false } = {}) {
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
  const markedPreset = design && PRESET_MARK.exec(design)?.[1];
  const markedStyle = design && STYLE_MARK.exec(design)?.[1];
  const owned = design == null || Boolean(markedPreset || markedStyle) || force;
  const pkg = readJson(join(dir, 'package.json'));
  const styled = seed != null || brief != null || mood != null || mode != null;

  let doc;
  let label;
  let chosen;
  if (preset || (!styled && markedPreset && PRESETS[markedPreset])) {
    chosen = preset ? resolvePreset(preset) : markedPreset;
    doc = `<!-- sloplint:preset ${chosen} -->\n${presetSource(chosen)}`;
    label = `${PRESETS[chosen]} preset`;
  } else {
    const previous = !styled && markedStyle ? JSON.parse(markedStyle) : {};
    const style = generateStyle({
      seed: seed ?? previous.seed ?? pkg?.name ?? basename(resolve(dir)),
      brief: brief ?? previous.brief ?? pkg?.description ?? '',
      mood: mood ?? previous.mood,
      mode: mode ?? previous.mode,
    });
    doc = designDoc(style);
    label = `${style.name}: ${style.mood}, ${style.mode}`;
    chosen = style;
  }

  if (owned) write('DESIGN.md', doc);
  else notes.push('DESIGN.md exists and was not written by sloplint, so it was left alone. Rerun with --force to replace it.');

  const block = ruleBlock(owned ? label : 'the project design system', { domains: projectDomains(dir), hooks });
  for (const name of AGENT_FILES) write(name, upsertBlock(read(name), block));
  write(CURSOR_FILE, `---\ndescription: sloplint anti-slop rules and design system\nalwaysApply: true\n---\n\n${block}\n`);
  if (hooks) {
    try {
      write('.claude/settings.json', withHooks(read('.claude/settings.json')));
    } catch {
      notes.push('.claude/settings.json is not valid JSON, so the hooks were not added.');
    }
  }
  return { preset: typeof chosen === 'string' ? chosen : null, style: typeof chosen === 'string' ? null : chosen, files, notes };
}
