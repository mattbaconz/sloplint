#!/usr/bin/env node
// Runs coding agents on the benchmark tasks, each in a fresh directory, with and without sloplint.
//
//   node bench/run.mjs --out ../bench-runs/2026-10-14
//   node bench/run.mjs --out ../bench-runs/pilot --tasks readme --agents claude
//
// "baseline" gets the task seed only. "sloplint" also gets `sloplint init --brief <the prompt's
// first sentence>` (a generated DESIGN.md plus the rule block in CLAUDE.md, GEMINI.md and AGENTS.md)
// and a local install so `npx @sloplint/cli` works. "hooks" is "sloplint" plus `--hooks` (Claude Code
// only). Prompts are identical in every arm. Successful runs are skipped and failed ones redone, so a
// rerun resumes.

import { spawn, execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { init } from '../src/init.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TASKS = join(ROOT, 'bench', 'tasks');

// User-level memory would add the runner's personal instructions to every Claude run.
const userMemory = [join(homedir(), '.claude', 'CLAUDE.md'), join(homedir(), '.codex', 'AGENTS.md')].map((p) => p.replace(/\\/g, '/'));

export const AGENTS = {
  claude: {
    model: 'claude-sonnet-5-5',
    concurrency: 3,
    args: (prompt, model) => [
      '-p', prompt, '--model', model, '--effort', 'medium', '--output-format', 'stream-json', '--verbose', '--no-session-persistence',
      '--dangerously-skip-permissions', '--setting-sources', 'project,local', '--settings', JSON.stringify({ claudeMdExcludes: userMemory }),
    ],
    // stream-json keeps the whole transcript (tool calls, hook feedback) in stdout.txt; the last event is the result.
    parse(stdout) {
      const j = stdout.trim().split('\n').map((l) => { try { return JSON.parse(l); } catch { return null; } }).findLast((e) => e?.type === 'result');
      if (!j) throw new Error('no result event');
      const u = j.usage ?? {};
      return {
        ok: !j.is_error,
        turns: j.num_turns,
        costUsd: j.total_cost_usd,
        inputTokens: (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0),
        cacheWriteTokens: u.cache_creation_input_tokens,
        outputTokens: u.output_tokens,
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

function exec(command, args, { cwd, timeoutMs }) {
  return new Promise((done) => {
    const child = spawn(command, args, { cwd, env: { ...process.env, NO_COLOR: '1' }, windowsHide: true });
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
  if (arm !== 'baseline') {
    init(work, { brief: /^.*?[.!?](?=\s|$)/.exec(prompt)?.[0], hooks: arm === 'hooks' });
    cpSync(modules, join(work, 'node_modules'), { recursive: true });
  }
  const started = Date.now();
  const r = await exec(agent, def.args(prompt, def.model), { cwd: work, timeoutMs });
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
  const meta = { agent, model: def.model, arm, task, rep, exitCode: r.code, timedOut: r.timedOut, durationMs: Date.now() - started, ...stats };
  writeFileSync(join(dir, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`);
  return `${meta.ok ? 'ok' : 'FAILED'} in ${Math.round(meta.durationMs / 1000)}s`;
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
    },
  });
  if (!values.out) throw new Error('--out <dir> is required');
  const out = resolve(values.out);
  const agents = values.agents.split(',');
  for (const a of agents) if (!AGENTS[a]) throw new Error(`Unknown agent ${a}`);
  const jobs = [];
  for (let rep = 1; rep <= Number(values.reps); rep++) {
    for (const task of values.tasks.split(',')) for (const arm of values.arms.split(',')) for (const agent of agents) jobs.push({ agent, arm, task, rep });
  }
  const modules = values.arms.split(',').some((arm) => arm !== 'baseline') ? sloplintModules(out) : null;
  const options = { out, modules, timeoutMs: Number(values['timeout-min']) * 60_000 };
  console.log(`${jobs.length} runs -> ${out}`);
  await Promise.all(agents.map((agent) => pool(jobs.filter((j) => j.agent === agent), AGENTS[agent].concurrency, async (job) => {
    const label = `${job.agent}/${job.arm}/${job.task}-r${job.rep}`;
    console.log(`start ${label}`);
    console.log(`done  ${label}: ${await runOne(job, options)}`);
  })));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
