# sloplint

A zero-dependency linter for the patterns AI coding assistants leave behind: purple gradients and icon-circle grids, swallowed errors and N+1 queries, fallback secrets and wildcard CORS, filler copy, tests that cannot fail, and launch videos where everything fades in to the same whoosh.

sloplint ships four things:

- **A CLI** that reports 42 deterministic rules with compiler-style diagnostics, a fix for every finding, autofixes where the fix is mechanical, and a weighted Slop Score from `0/100 Studio Grade` to `100/100 Critical Slop`.
- **A design-system generator** that gives every project its own `DESIGN.md`: a typeface trio, a contrast-checked palette, shape, motion and a layout archetype picked from a seed and a one-line brief, so agents stop converging on the same look. Two rules then hold the code to it.
- **A brief pack** for coding agents: master briefs per discipline, rule blocks synced into `CLAUDE.md`, `GEMINI.md`, `AGENTS.md` and Cursor rules, Claude Code hooks that lint every file as it is written, and a Playwright suite that audits the rendered page.
- **A docs site** with the rule catalog, worked examples, a style generator and an in-browser grader that runs the same engine as the CLI.

```text
$ npx @sloplint/cli check examples/samples

error[SEC-001]: JWT_SECRET silently falls back to a hard-coded value
 --> examples/samples/api.slop.ts:9:20
  |
9 | const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';
  |                    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  = fix: Read secrets once at boot and crash if they are missing. Never ship a default for anything that signs, encrypts or authenticates.
  = autofix available (--fix)

Slop Score  ████████████████████████  100/100 Critical Slop
            8 files · 419 lines · 11 errors · 96 warnings · 18 autofixable
            UI 38  SEC 9  BE 14  COPY 28  TEST 9  MOTION 9
```

## Quick start

Node 20 or newer. Nothing else is installed at runtime. Installed as a dev dependency (`npm i -D @sloplint/cli`), the command is plain `sloplint`.

```bash
npx @sloplint/cli check .
```

```bash
npx @sloplint/cli init --brief "Invoicing for freelance studios" --hooks
```

```bash
npx @sloplint/cli explain SEC-001
```

## Benchmark

Six tasks (landing page, REST API, dashboard, test suite, CLI README, launch video), run headless by two agents, twice per cell, each in a fresh directory. The `sloplint` arm gets `sloplint init` and a local install; the baseline gets the prompt alone.

| Agent and model | Arm | Mean Slop Score | Findings | Mean time | Mean input tokens |
| --- | --- | --- | --- | --- | --- |
| Claude Code, `claude-sonnet-5-5`, medium effort | baseline | 15.3 | 19 | 47s | 176k |
| Claude Code, `claude-sonnet-5-5`, medium effort | sloplint | 1.0 | 1 | 65s | 263k |
| Antigravity, `gemini-3.8-flash-high` | baseline | 13.7 | 60 | 352s | 149k |
| Antigravity, `gemini-3.8-flash-high` | sloplint | 0.0 | 0 | 473s | 197k |

With sloplint, Claude scored lower on 4 of 6 tasks and Gemini on 2 of 6; neither scored higher on any task, and neither suppressed a rule. The cost was about a third more wall time and a third to a half more input tokens.

What the numbers do not show:

- **The metric is ours.** The sloplint arm is graded on the check it was told to pass. Checks that do not use sloplint barely moved: generated tests killed 16 of 16 seeded mutants in 7 of 8 runs (one Claude sloplint run killed 15), and the only invented CLI flag in a README came from a Gemini baseline run.
- **New layout bugs.** Both Gemini sloplint-arm landing pages scroll sideways at 375px, through a nav that does not wrap and wide data tables (Gemini baseline: 1 of 2; Claude: none). The briefs now cover this; the runs have not been repeated.
- **Invented proof.** Both arms of both agents wrote made-up metrics and certifications into marketing copy. No rule catches that yet.
- **One look.** Every sloplint-arm landing page took the default preset's look.
- **Small samples.** Two runs per cell; treat small differences as noise. The first scoring pass found four false positives in sloplint's own rules (BE-001, BE-005, UI-002, UI-006); they were fixed before the final scoring, which uses the same rules for both arms.

| Gemini baseline | Gemini with sloplint |
| --- | --- |
| ![Gemini baseline landing page](bench/results/2026-10-14/shots/agy-baseline-r1.jpg) | ![Gemini sloplint landing page](bench/results/2026-10-14/shots/agy-sloplint-r1.jpg) |

Full results, every screenshot pair and the agent outputs: [bench/results/2026-10-14](bench/results/2026-10-14/README.md). Method and how to rerun it: [bench/README.md](bench/README.md).

## Commands

### `sloplint check [paths...]`

Lints files and directories (default `.`) and prints one diagnostic per finding, then the score.

| Flag | Effect |
| --- | --- |
| `--fix` | Apply safe autofixes in place, then report what remains |
| `--changed` | Only files changed since the last commit: staged, unstaged and untracked (needs git) |
| `--format <f>` | `pretty` (default in a terminal), `compact` (default when piped: one line per finding, each fix once, then the score) or `json` |
| `--max-score <n>` | Exit 1 when the score is above `n`; use `0` as a CI gate |
| `--no-color` | Plain output; `NO_COLOR` is honoured too |

Exit codes: `0` clean or warnings only, `1` errors or score above `--max-score`, `2` bad usage.

Scanned extensions: `.js .mjs .cjs .ts .mts .cts .jsx .tsx .html .htm .vue .svelte .astro .css .scss .less .py .md .mdx`. `node_modules`, build output, minified files, `.gitignore` entries and `.sloplintignore` entries are skipped.

### `sloplint init [dir]`

Writes `DESIGN.md` and syncs a compact rule block into the files agents read:

- `DESIGN.md`: a design system generated for this project, with tokens (`:root` custom properties and a Google Fonts import), type, color, layout, components, motion and an avoid list
- `CLAUDE.md`, `GEMINI.md`, `AGENTS.md`: a `sloplint` block between markers, one line per rule; your own content is preserved
- `.cursor/rules/sloplint.mdc`: the same block as an always-applied Cursor rule
- `.claude/settings.json`, with `--hooks`: the Claude Code hooks described under [`sloplint hook`](#sloplint-hook); other settings are kept

The design system comes from a seed and a one-line brief. The seed defaults to the package name plus a random suffix, so two projects called `my-app` still differ, and `DESIGN.md` records it; the brief defaults to the package description. Words in the brief pick one of seven moods: editorial, technical, warm, brutalist, luxe, playful or institutional. The seed then picks a typeface trio from that mood's curated Google Fonts pairings, an OKLCH palette solved for WCAG contrast (body text at least 12:1, secondary text, accent text and status colors at least 4.5:1) that stays out of the indigo-to-fuchsia band, a radius and shadow language, a layout archetype, two signature moves and a voice for the copy. The same seed and brief always give the same system.

| Flag | Effect |
| --- | --- |
| `--seed <text>` | Generate from this seed instead of the package name |
| `--brief <text>` | One line about the product; its words steer the mood |
| `--mood <name>` | Force a mood |
| `--mode light\|dark` | Force light or dark |
| `--preset <name>` | Use a curated preset instead of generating a system |
| `--hooks` | Add the Claude Code hooks |
| `--force` | Replace a `DESIGN.md` that sloplint did not write |

Re-running keeps the system recorded in `DESIGN.md`, so it is idempotent. A hand-written `DESIGN.md` is left alone unless you pass `--force`; the agent files then point at it. The rule block lists only what the project uses: motion-video rules appear when `remotion`, `@remotion/*` or `gsap` is a dependency, and UI rules are dropped for a project with dependencies but no front end.

The four curated presets:

| Preset | Alias | Character |
| --- | --- | --- |
| Obsidian Telemetry | `obsidian` | Dark instrument panel, amber signal color, IBM Plex |
| Editorial Serif | `editorial` | Paper and ink, oxblood accent, Newsreader headlines |
| Swiss Brutalist | `swiss` | White grid, signal red, square corners, Archivo |
| Tactile Hardware | `tactile` | Warm device shell, orange keys, soft inset depth |

All four define the same 17 tokens, so components written against one preset work under the others.

### `sloplint style`

Previews the system `init` would generate and writes nothing else. It takes `--seed`, `--brief`, `--mood` and `--mode` as `init` does, plus `--json` for the whole system as data and `--html <file>` for a specimen page with swatches, contrast ratios, the type scale and components.

```bash
npx @sloplint/cli style --brief "Recipes from a family bakery" --html design.html
```

### `sloplint explain [RULE]`

Without an argument, lists every rule. With one, prints the rationale, the fix and a side-by-side `✖ SLOP` / `✔ CRAFT` diff from the worked examples in `examples/`.

### `sloplint hook`

The command behind the Claude Code hooks that `init --hooks` installs. After every `Write`, `Edit` or `MultiEdit` it lints the file just written; when the agent stops, it checks the files changed since the last commit. Findings reach the agent on stderr with exit code 2, in the compact format, so they are fixed in the same turn. Unreadable input never blocks, and the second stop in a row always succeeds.

## Rules

| ID | Rule | Severity |
| --- | --- | --- |
| UI-001 | Purple/indigo gradient or glow used as the default accent | warn |
| UI-002 | Symmetrical 3-column grid of icon-badge feature cards | warn |
| UI-003 | Muted gray subtitle under nearly every heading | warn |
| UI-004 | Box-in-box border soup | warn |
| UI-005 | Numbers in tables or stats render with proportional digits | warn |
| UI-006 | Nested border radius is not concentric | warn |
| UI-007 | Transition on every property | warn |
| UI-008 | Spinner swaps out content and shifts layout | warn |
| UI-009 | Gradient-filled headline text | warn |
| UI-010 | Form shows success without sending anything | error |
| UI-011 | Color outside the DESIGN.md palette | warn |
| UI-012 | Typeface outside the DESIGN.md type system | warn |
| UI-013 | Link that goes nowhere | warn |
| SEC-001 | Secret falls back to a hard-coded value | error |
| SEC-002 | CORS allows every origin | error |
| SEC-003 | SQL assembled from interpolated strings | error |
| SEC-004 | Raw request input interpolated into an LLM prompt | error |
| SEC-005 | Authentication decided in the browser | error |
| SEC-006 | Webhook handler never verifies the signature | error |
| SEC-007 | Interpolated values written as raw HTML | error |
| BE-001 | Error caught, logged and discarded | warn |
| BE-002 | Database query inside a loop (N+1) | warn |
| BE-003 | Outbound HTTP call without a timeout | warn |
| BE-004 | Mutation route that is unsafe to retry | warn |
| BE-005 | Stub, mock data or elided code in a production path | warn |
| BE-006 | Abstraction with exactly one implementation | warn |
| COPY-001 | LLM marketing filler in user-facing copy | warn |
| COPY-002 | Error message with no cause and no next step | warn |
| COPY-003 | Button or link label does not name the action | warn |
| COPY-004 | Template placeholder content shipped as real copy | warn |
| COPY-005 | Social proof or performance claim with no source | warn |
| COPY-006 | Emoji used as decoration in headings, buttons and links | warn |
| TEST-001 | Test asserts only mocks, constants, or nothing | warn |
| TEST-002 | Fixed sleep in a test | warn |
| TEST-003 | Emoji-decorated README headings and bullets | warn |
| TEST-004 | Focused or skipped test committed | warn |
| MOTION-001 | Every element enters with the same fade | warn |
| MOTION-002 | List items staggered by a fixed step | warn |
| MOTION-003 | Springs and eases that overshoot by default | warn |
| MOTION-004 | Every scene has the same length | warn |
| MOTION-005 | The same sound effect on every cut | warn |
| MOTION-006 | Layered audio left at full volume | warn |

`UI-011` and `UI-012` run only when a `DESIGN.md` with a `:root` token block sits in the file's directory or above it, up to the repository root. They flag color literals, Tailwind palette classes and typefaces the design system does not define, and name the nearest token.

`MOTION-*` rules apply to videos written as code: files that import `remotion`, `@remotion/*` or `gsap`. They read the composition source; they do not analyse rendered video or audio.

Every rule has a slop and a craft example in `examples/`, and the test suite checks that each slop example triggers exactly its own rule and each craft example is clean.

### What the rules do not do

Detection is lexical, not type-aware. sloplint masks strings, comments and regex literals before matching, so it does not flag code that merely mentions a pattern, but it does not resolve imports or follow data flow across files. Each rule is tuned for a low false-positive rate over recall: when a finding is wrong, suppress it and open an issue with the snippet.

## Suppressions

Suppressions only count inside comments, and they name the rule:

```ts
// sloplint-disable-next-line SEC-002 -- public read-only API, no cookies
app.use(cors({ origin: '*' }));
```

`sloplint-disable-line` covers its own line, `sloplint-disable-next-line` the next one, and `sloplint-disable-file` the whole file. Omitting the rule ID suppresses every rule on that line.

## Slop Score

Each finding adds its rule's weight (errors 6 to 10, warnings 1 to 5) to a penalty. A rule counts at most three times per file, so one repeated pattern cannot dominate. The penalty is normalised for codebase size and mapped onto 0 to 100:

```text
k     = 24 × √max(1, lines / 800)
score = 0 if penalty is 0, else clamp(round(100 × (1 − e^(−penalty / k))), 1, 100)
```

Only a codebase with no findings scores 0.

| Score | Grade |
| --- | --- |
| 0 | Studio Grade |
| 1 to 19 | Minor Slop |
| 20 to 39 | Noticeable Slop |
| 40 to 59 | Sloppy |
| 60 to 79 | Heavy Slop |
| 80 to 100 | Critical Slop |

## In CI

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 22
- run: npx @sloplint/cli check . --max-score 0
```

## Rendered-page audit

Some slop only exists after the browser computes styles. `scripts/verify-dom.spec.ts` is a Playwright suite that checks a live page for `transition: all`, purple gradients and glows, gradient text, non-concentric radii, proportional digits, layout shift, filler copy, vague labels and overflow at 375px. It imports only `@playwright/test`:

```bash
SLOPLINT_URL=http://localhost:3000 npx playwright test e2e/verify-dom.spec.ts
```

See [rules/README.md](rules/README.md) for setup and for using the briefs with several agents.

## As a library

The engine has no Node imports and runs in the browser; the docs site imports it directly.

```js
import { lint, score, fixSource } from '@sloplint/cli';

const result = lint(source, 'src/app/page.tsx');
const { score: value, grade } = score([result]);
const { text, applied } = fixSource(source, 'src/app/page.tsx');
```

The path matters: it decides the language, and whether the file is a test, a server module or a README. Pass `{ design: parseDesign(designMarkdown) }` as the third argument to run the design-token rules; `generateStyle`, `designDoc`, `specimenHtml` and `parseDesign` come from `@sloplint/cli/design`.

## Docs site

```bash
npm run site
```

Then open `http://localhost:4173`. The site is static: `site/` plus the engine in `src/`, served from the repository root. It has no build step, so any static host that serves the repository works.

## Development

```bash
npm test
```

```bash
npm run check
```

```bash
npm run verify:dom
```

`npm test` runs the rule, CLI, init, design, scoring and dogfood suites with `node:test`. `npm run check` lints this repository and fails above 0. `npm run verify:dom` serves the site and audits it in every preset with Playwright. `npm run check:fonts` asks Google Fonts for every curated family and weight; it needs the network, so it is not part of `npm test`.

The repository is held to its own standard: `sloplint check .` scores `0/100 Studio Grade`, and a test fails if it does not.

## License

[MIT](LICENSE)
