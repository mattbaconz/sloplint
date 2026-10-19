#!/usr/bin/env node
// Runs coding agents on the benchmark tasks, each in a fresh directory, with and without sloplint.
//
//   node bench/run.mjs --out ../bench-runs/2026-10-14
//   node bench/run.mjs --out ../bench-runs/pilot --tasks readme --agents claude
//
// "baseline" gets the task seed only. "sloplint" also gets `sloplint init --brief <the prompt's
// first sentence>` (a generated DESIGN.md plus the rule block in CLAUDE.md, GEMINI.md and AGENTS.md)
// and a local install so `npx @sloplint/cli` works. "hooks" is "sloplint" plus `--hooks` (Claude Code
// only). "<skill>" installs one of the third-party design skills below as a project skill, pinned to a
// commit, and "<skill>+hooks" adds sloplint's hooks to it (both Claude Code only). Prompts are identical
// in every arm. Successful runs are skipped and failed ones redone, so a rerun resumes.

import { spawn, execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { init } from '../src/init.mjs';
import { generateStyle } from '../src/design.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TASKS = join(ROOT, 'bench', 'tasks');

// User-level memory would add the runner's personal instructions to every Claude run.
const userMemory = [join(homedir(), '.claude', 'CLAUDE.md'), join(homedir(), '.codex', 'AGENTS.md')].map((p) => p.replace(/\\/g, '/'));

// The design skills of the head-to-head, each pinned to a commit and installed the way their READMEs
// describe a copy install: the skill folder at .claude/skills/<name>/. They are untrusted prompts.
export const SKILLS = {
  'frontend-design': { repo: 'anthropics/skills', commit: 'dbd4588f9e1033efb41dad4bef2f7947c8993d44', path: 'skills/frontend-design', name: 'frontend-design' },
  impeccable: { repo: 'pbakaus/impeccable', commit: '6af45ac9a5eb8792f033d3242f52e99812fd91fa', path: '.claude/skills/impeccable', name: 'impeccable' },
  'taste-skill': { repo: 'Leonxlnx/taste-skill', commit: 'f624f37a8c650b9cc550253104925efe4c8de246', path: 'skills/taste-skill', name: 'design-taste-frontend' },
  hallmark: { repo: 'Nutlope/hallmark', commit: '13ac0ec7e148655948100b6396439e481361d690', path: 'skills/hallmark', name: 'hallmark' },
};

// "baseline", "sloplint", "hooks", "<skill>" or "<skill>+hooks".
export function armSpec(arm) {
  const [head, tail] = arm.split('+');
  const skill = SKILLS[head] ? head : null;
  const sloplint = skill ? (tail ?? null) : head === 'baseline' ? null : head;
  if (![null, 'sloplint', 'hooks'].includes(sloplint) || (!skill && tail)) throw new Error(`Unknown arm ${arm}`);
  return { skill, sloplint };
}

// Skills must stay on for a skill arm, so it turns off Claude Code's bundled skills instead, leaving the
// installed skill as the only one. Other arms disable skills and slash commands altogether.
const ONLY_PROJECT_SKILLS = { disableBundledSkills: true, skillOverrides: { design: 'off', doctor: 'off', 'plugin-authoring': 'off' } };

// Agents run with permissions bypassed, some on third-party prompts: keep the runner's secrets out of
// reach. When the runner is itself a Claude Code session, its CLAUDE* variables (bare mode, session ids,
// messaging socket) would leak into every agent and turn off its own login, so they go too.
const AGENT_ENV = Object.fromEntries(
  Object.entries(process.env).filter(([k]) => !/token|secret|api_?key|password|credential|oauth/i.test(k) && !(/^CLAUDE/.test(k) && k !== 'CLAUDE_CONFIG_DIR')),
);

export const AGENTS = {
  claude: {
    model: 'claude-sonnet-5-5',
    concurrency: 3,
    args: (prompt, model, { skill } = {}) => [
      '-p', prompt, '--model', model, '--effort', 'medium', '--output-format', 'stream-json', '--verbose', '--no-session-persistence',
      '--dangerously-skip-permissions', '--setting-sources', 'project,local',
      '--settings', JSON.stringify({ claudeMdExcludes: userMemory, ...(skill && ONLY_PROJECT_SKILLS) }),
      ...(skill ? [] : ['--disable-slash-commands']),
    ],
    // stream-json keeps the whole transcript (tool calls, hook feedback) in stdout.txt; the last event is the result.
    parse(stdout) {
      const events = stdout.trim().split('\n').map((l) => { try { return JSON.parse(l); } catch { return null; } });
      const j = events.findLast((e) => e?.type === 'result');
      if (!j) throw new Error('no result event');
      const tools = events.filter((e) => e?.type === 'assistant').flatMap((e) => e.message?.content ?? []).filter((c) => c.type === 'tool_use');
      const u = j.usage ?? {};
      return {
        ok: !j.is_error,
        turns: j.num_turns,
        costUsd: j.total_cost_usd,
        inputTokens: (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0),
        cacheWriteTokens: u.cache_creation_input_tokens,
        outputTokens: u.output_tokens,
        // Whether a skill arm's agent loaded its skill, and how often it ran the skill's own scripts.
        skillCalls: tools.filter((t) => t.name === 'Skill').map((t) => t.input?.skill),
        skillScripts: tools.filter((t) => t.name === 'Bash' && /\.claude[\\/]skills[\\/]/.test(t.input?.command) && /scripts[\\/]/.test(t.input?.command)).length,
        final: j.result,
      };
    },
  },
  agy: {
    model: 'gemini-3.8-flash-high',
    concurrency: 2,
    args: (prompt, model) => ['-p', prompt, '--model', model, '--output-format', 'json', '--dangerously-skip-permissions'],
    parse(stdout) {
      const j = JSON.parse(stdout.slice(stdout.indexOf('{')));
      return { ok: j.status === 'SUCCESS', turns: j.num_turns, inputTokens: j.usage?.input_tokens, outputTokens: j.usage?.output_tokens, final: j.response };
    },
  },
};

function exec(command, args, { cwd, timeoutMs, env }) {
  return new Promise((done) => {
    const child = spawn(command, args, { cwd, env: { ...AGENT_ENV, ...env, NO_COLOR: '1' }, windowsHide: true });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', (error) => {
      clearTimeout(timer);
      done({ code: null, stdout, stderr: `${stderr}\n${error.message}`, timedOut });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      done({ code, stdout, stderr, timedOut });
    });
  });
}

// One local install of this checkout, copied into every sloplint workdir.
function sloplintModules(out) {
  const dir = join(out, '_sloplint');
  const modules = join(dir, 'node_modules');
  if (existsSync(join(modules, '@sloplint', 'cli'))) return modules;
  mkdirSync(dir, { recursive: true });
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const tgz = execFileSync(npm, ['pack', ROOT, '--pack-destination', dir, '--silent'], { cwd: dir, encoding: 'utf8', shell: true }).trim().split('\n').pop();
  execFileSync(npm, ['install', '--no-save', '--no-package-lock', '--no-audit', '--no-fund', '--offline', join(dir, tgz)], { cwd: dir, stdio: 'ignore', shell: true });
  return modules;
}

// One checkout of a skill at its pinned commit, shared by every run. git checks the commit hash.
function skillSource(out, name) {
  const s = SKILLS[name];
  const dir = join(out, '_skills', `${name}-${s.commit.slice(0, 7)}`);
  if (!existsSync(join(dir, s.path, 'SKILL.md'))) {
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const git = (...a) => execFileSync('git', ['-C', dir, ...a], { stdio: 'ignore' });
    git('init', '-q');
    git('fetch', '-q', '--depth', '1', `https://github.com/${s.repo}.git`, s.commit);
    git('checkout', '-q', s.commit);
  }
  return join(dir, s.path);
}

async function runOne(job, { out, modules, timeoutMs }) {
  const { agent, arm, task, rep } = job;
  const def = AGENTS[agent];
  const dir = join(out, agent, arm, `${task}-r${rep}`);
  const metaPath = join(dir, 'meta.json');
  if (existsSync(metaPath)) {
    if (JSON.parse(readFileSync(metaPath, 'utf8')).ok) return 'skipped';
    rmSync(dir, { recursive: true, force: true }); // a failed run (agent crash, CLI error) starts over
  }
  const work = join(dir, 'work');
  mkdirSync(work, { recursive: true });
  const seed = join(TASKS, task, 'seed');
  if (existsSync(seed)) cpSync(seed, work, { recursive: true });
  const prompt = readFileSync(join(TASKS, task, 'prompt.md'), 'utf8').trim();
  const { skill, sloplint } = armSpec(arm);
  if (sloplint) {
    init(work, { brief: briefOf(prompt), hooks: sloplint === 'hooks', seed: job.seed });
    cpSync(modules, join(work, 'node_modules'), { recursive: true });
  }
  const s = skill && SKILLS[skill];
  if (s) cpSync(skillSource(out, skill), join(work, '.claude', 'skills', s.name), { recursive: true });
  const started = Date.now();
  // Skill state stays with the benchmark, not the runner's home: impeccable's engine download is shared,
  // and taste-skill's history of dealt directions is per run, so no run steers another. Forward slashes:
  // impeccable's launcher verifies its download with shasum, which escapes a path with backslashes and
  // prefixes the digest with "\", so the check fails.
  const posix = (p) => p.split(sep).join('/');
  const env = { IMPECCABLE_HOME: posix(join(out, '_impeccable')), TASTE_SKILL_HISTORY: posix(join(dir, 'taste-skill-history.json')) };
  const r = await exec(agent, def.args(prompt, def.model, { skill }), { cwd: work, timeoutMs, env });
  writeFileSync(join(dir, 'stdout.txt'), r.stdout);
  writeFileSync(join(dir, 'stderr.txt'), r.stderr);
  let parsed;
  try {
    parsed = def.parse(r.stdout);
  } catch (error) {
    parsed = { ok: false, parseError: error.message };
  }
  const { final, ...stats } = parsed;
  if (final) writeFileSync(join(dir, 'final.md'), final);
  const source = s && { name: s.name, repo: s.repo, commit: s.commit, url: `https://github.com/${s.repo}/tree/${s.commit}/${s.path}` };
  const meta = { agent, model: def.model, arm, task, rep, ...(source && { skill: source }), exitCode: r.code, timedOut: r.timedOut, durationMs: Date.now() - started, ...stats };
  writeFileSync(join(dir, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`);
  return `${meta.ok ? 'ok' : 'FAILED'} in ${Math.round(meta.durationMs / 1000)}s`;
}

const briefOf = (prompt) => /^.*?[.!?](?=\s|$)/.exec(prompt)?.[0];

// --spread-layouts: each task's sloplint runs cycle through its mood's layouts in turn, so a handful
// of runs measures every layout instead of whichever ones random seeds happen to draw.
function spreadLayouts(jobs) {
  for (const task of new Set(jobs.map((j) => j.task))) {
    const brief = briefOf(readFileSync(join(TASKS, task, 'prompt.md'), 'utf8').trim());
    const layoutOf = (seed) => generateStyle({ seed, brief }).layout.key;
    const layouts = [...new Set(Array.from({ length: 200 }, (_, i) => layoutOf(`${task}-probe-${i}`)))].sort();
    jobs.filter((j) => j.task === task && armSpec(j.arm).sloplint).forEach((job, k) => {
      const prefix = `${task}-${job.arm.replace('+', '-')}-r${job.rep}`;
      let i = 0;
      while (layoutOf(`${prefix}-${i}`) !== layouts[k % layouts.length]) i++;
      job.seed = `${prefix}-${i}`;
    });
  }
}

async function pool(jobs, size, work) {
  const queue = [...jobs];
  const lanes = Array.from({ length: Math.min(size, queue.length) }, async () => {
    for (let job = queue.shift(); job; job = queue.shift()) await work(job);
  });
  await Promise.all(lanes);
}

async function main() {
  const { values } = parseArgs({
    options: {
      out: { type: 'string' },
      agents: { type: 'string', default: Object.keys(AGENTS).join(',') },
      arms: { type: 'string', default: 'baseline,sloplint' },
      tasks: { type: 'string', default: readdirSync(TASKS).join(',') },
      reps: { type: 'string', default: '1' },
      'timeout-min': { type: 'string', default: '20' },
      'spread-layouts': { type: 'boolean', default: false },
    },
  });
  if (!values.out) throw new Error('--out <dir> is required');
  const out = resolve(values.out);
  const agents = values.agents.split(',');
  for (const a of agents) if (!AGENTS[a]) throw new Error(`Unknown agent ${a}`);
  const arms = values.arms.split(',');
  const claudeOnly = arms.filter((arm) => armSpec(arm).skill || armSpec(arm).sloplint === 'hooks');
  if (claudeOnly.length && agents.some((a) => a !== 'claude')) throw new Error(`${claudeOnly.join(', ')} run on Claude Code only; pass --agents claude`);
  const jobs = [];
  for (let rep = 1; rep <= Number(values.reps); rep++) {
    for (const task of values.tasks.split(',')) for (const arm of arms) for (const agent of agents) jobs.push({ agent, arm, task, rep });
  }
  if (values['spread-layouts']) spreadLayouts(jobs);
  const modules = arms.some((arm) => armSpec(arm).sloplint) ? sloplintModules(out) : null;
  const options = { out, modules, timeoutMs: Number(values['timeout-min']) * 60_000 };
  console.log(`${jobs.length} runs -> ${out}`);
  await Promise.all(agents.map((agent) => pool(jobs.filter((j) => j.agent === agent), AGENTS[agent].concurrency, async (job) => {
    const label = `${job.agent}/${job.arm}/${job.task}-r${job.rep}`;
    console.log(`start ${label}`);
    console.log(`done  ${label}: ${await runOne(job, options)}`);
  })));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
