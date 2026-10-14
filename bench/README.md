# Benchmark: agents with and without sloplint

Does dropping sloplint into a project change what coding agents write? This benchmark gives the same prompt to the same agent twice, in fresh directories:

- **baseline**: the task and its seed files, nothing else.
- **sloplint**: the same, plus `sloplint init --brief <the prompt's first sentence>` (a generated DESIGN.md and the rule block in `CLAUDE.md`, `GEMINI.md` and `AGENTS.md`) and a local install so `npx @sloplint/cli` works. The prompt does not mention sloplint; the agent sees it only through the instruction files it already reads.
- **hooks** (Claude Code only): `sloplint` plus `--hooks`, so every file the agent writes is linted on the spot and the project is checked when it stops.

## Tasks

| Task | Prompt | Independent check |
| --- | --- | --- |
| `landing` | Marketing page for an invoicing product, one HTML file | Renders without page errors, no horizontal overflow at 375px, screenshot |
| `api` | Express API: login, invoices with line items, Stripe webhook, LLM summary | `node --check` on every JS file |
| `dashboard` | React admin dashboard with stat cards and an invoice table | File present |
| `tests` | Test suite for a seeded checkout module | Suite passes, then mutation score against 16 seeded bugs |
| `readme` | README for a small seeded CLI | Real flags documented, invented flags |
| `video` | 15-second Remotion launch video with music and sound effects | Files present |

Prompts are in `tasks/<task>/prompt.md` and seeds in `tasks/<task>/seed/`. They are written the way people ask, including "it should look polished and modern", and none of them mention quality rules.

The mutation check is the strongest signal that does not come from sloplint itself: `tasks/tests/mutants.mjs` holds 16 single-line bugs, and a suite that only asserts that mocks were called lets most of them through. `node bench/score.mjs --self-test` proves a reference suite catches all 16.

## Running it

```bash
node bench/run.mjs --out ../bench-runs/my-run --reps 2
```

```bash
node bench/score.mjs --runs ../bench-runs/my-run --out bench/results/my-run
```

`run.mjs` drives Claude Code (`claude -p`) and the Antigravity CLI (`agy -p`) headless with permissions bypassed, so run it on a machine where that is acceptable. Workdirs live outside the repository. Successful runs are skipped and failed ones are redone, so rerunning the same command resumes an interrupted benchmark and retries agent crashes. `--agents`, `--arms`, `--tasks` and `--reps` narrow a run.

Claude runs load project settings only, and user-level memory (`~/.claude/CLAUDE.md`) is excluded through `claudeMdExcludes`, so the runner's personal instructions do not leak in. The Antigravity CLI has no equivalent switch; its user-level `GEMINI.md` is loaded in both arms.

## What the numbers mean, and what they do not

- The Slop Score is sloplint's own metric, and the sloplint arm is told to drive it to zero. A lower score there shows the agent followed the instructions; it does not prove the code is better. The task checks exist to catch the ways that can go wrong: suppressions, deleted features, broken syntax, weaker tests.
- Only files the agent wrote are scored. sloplint's own files, unchanged seeds and `node_modules` are excluded from every arm. As with `sloplint check`, a run with a DESIGN.md is also held to its tokens (UI-011, UI-012), which only makes the sloplint arms stricter.
- Score a run with the rules it was given: `git worktree add` the commit the run used and run that checkout's `bench/score.mjs`.
- Agents are not deterministic. Each cell is run more than once and every individual result is reported next to the mean. Small differences are noise.
- Model availability changes. Results name the exact model and CLI versions they used; rerun before quoting them.
