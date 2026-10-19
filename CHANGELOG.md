# Changelog

## Unreleased

- [added] "Score a page" on the docs site (`site/score.html`): paste a URL and get its Slop Score, findings with source excerpts, a share link and a 1200x630 score card. A Cloudflare Worker in `worker/` fetches the page HTML and up to 8 same-origin stylesheets (2 MB cap, 15-second deadline, http and https only, no cookies forwarded, robots.txt honored, 10 pages a minute per IP); the engine lints them in the browser.
- [added] A bookmarklet on the same page scores the live DOM of the current tab, including script-rendered and signed-in pages, and shows the findings in an overlay. Sites with a strict Content-Security-Policy can block it.
- [added] `UI-015` flags tables that push a 375px page sideways: more than four columns with no scroll wrapper and no narrow-screen layout, or absolutely positioned content (usually a visually hidden label) inside a scroll wrapper that is not positioned, which escapes the wrapper. That second case caused every page in the 2026-10-17 benchmark that overflowed with sloplint's hooks.
- [added] The Claude Code plugin now checks the files Claude wrote before it stops, blocking once, as `init --hooks` already did.
- [changed] The Stop hook checks only the files the session wrote, read from the session transcript, so the user's own uncommitted work never blocks the agent. Without a transcript it checks the files changed since the last commit, as before.
- [changed] `DESIGN.md` no longer names one first-screen device per layout, which agents copied word for word. Each layout states a rule and offers three forms picked by seed, and the device must be built from the brief's own material.
- [changed] `DESIGN.md` has a Layout line for tables at narrow widths: stack rows into cards below 600px, or scroll inside a `position: relative; overflow-x: auto` wrapper with a visible edge.
- [changed] When another design skill is in use, the sloplint skill, the agent rule block and `DESIGN.md` let it lead the visual direction, fill in only what it leaves open, and still run the check. In the 2026-10-17 benchmark the agent had stopped loading other skills next to sloplint.

## 0.2.0 (2026-10-17)

- [changed] Generated design systems ask for a memorable first screen instead of a plain document: a fluid `--step-display` headline step per mood (4.5rem institutional to 8rem brutalist) with `--tracking-display`, one named first-screen device per layout, at least one full-bleed `--accent` or inverted `--ink` field with its contrast stated, an imagery and ornament direction per mood, and one first-screen entrance (`--duration-entrance`, 400 to 700ms, reduced motion respected). When `DESIGN.md` is silent, agents now pick the option that sets the page apart, not the plainer one.
- [changed] Institutional systems pair a distinct display face with the text face (Familjen Grotesk, Gloock, Archivo) instead of one family for both.
- [changed] The specimen page opens with the display step on an `--accent` field.
- [added] Benchmark tasks `landing-uptime`, `landing-bakery` and `landing-print` exercise the technical, warm and brutalist moods; landing screenshots wait for webfonts and the entrance.
- [added] `PRIVACY.md` and support, documentation and privacy links in the plugin manifest, for the Claude Code plugin directory.
- [fixed] The npm README runs `npx @sloplint/cli`; 0.1.0 said `npx sloplint`, which is not this package.

## 0.1.0 (2026-10-15)

- [added] Claude Code plugin: `/plugin install sloplint --marketplace mattbaconz/sloplint` lints every file Claude writes and adds a sloplint skill. `npx skills add mattbaconz/sloplint` installs the same skill in other agents.
- [added] GitHub Action (`uses: mattbaconz/sloplint@v0`) that annotates findings on pull requests and can upload them to code scanning, backed by `check --format github` and `--format sarif` (SARIF 2.1.0).
- [added] `sloplint check` with 43 rules across UI, security, backend, copy, tests and motion video, compiler-style diagnostics, JSON output, `--fix` autofixes and a weighted Slop Score.
- [added] `sloplint init` generates a design system per project from a seed and a one-line brief: seven moods, curated Google Fonts trios, OKLCH palettes solved for WCAG contrast and kept out of the indigo-to-fuchsia band, layout archetypes, signature moves and a voice for the copy. `--preset` still offers the four curated presets (Obsidian Telemetry, Editorial Serif, Swiss Brutalist, Tactile Hardware).
- [added] `sloplint init` syncs a one-line-per-rule block into `CLAUDE.md`, `GEMINI.md`, `AGENTS.md` and `.cursor/rules/sloplint.mdc`, scoped to the domains the project uses.
- [added] `sloplint style` previews a generated system as text, JSON or a specimen page.
- [added] `sloplint hook` and `init --hooks`: Claude Code lints every file it writes, hears when a write is clean, and checks changed files before it stops.
- [added] `check --changed` lints only files changed since the last commit; `--format compact`, the default when output is piped, prints one line per finding and each fix once.
- [added] `UI-011` and `UI-012` hold colors and typefaces to the project's `DESIGN.md`; `UI-010` flags forms that show success without sending anything; `COPY-005` flags unsourced social proof and performance claims; `COPY-006` flags emoji and sparkle dingbats used as decoration in headings, buttons, links and badges; `UI-013` flags links to `#` and `javascript:`; `UI-014` flags grids that cannot fit a 375px screen; `COPY-004` also flags random avatar and photo services.
- [added] `sloplint explain` with rationale and a side-by-side slop/craft diff for every rule.
- [added] `MOTION-*` rules for videos written as code (Remotion, GSAP): uniform entrances, fixed-step staggers, overshooting springs, equal-length scenes, repeated sound effects and unmixed audio.
- [added] Brief pack in `rules/` and a Playwright rendered-page audit in `scripts/verify-dom.spec.ts`.
- [added] Docs site with the rule catalog, preset switcher, style generator and an in-browser grader built on the same engine.
- [added] Benchmark harness in `bench/`: six slop-prone tasks run by Claude Code and the Antigravity CLI with and without sloplint (and with hooks for Claude Code), scored by sloplint plus checks that do not use it (a 16-mutant test-suite score, README flag accuracy, syntax, rendered screenshots, the landing page's typefaces and call-to-action color), with turns, cost and the full Claude transcript for every run.
- [changed] UI-002 also catches icon and emoji badges in rounded squares, and only when the badge opens the card, so testimonial avatars are no longer flagged.
- [changed] Briefs, agent rule blocks and the table-heavy presets require pages that do not scroll sideways at 375px, with wide tables in their own `overflow-x: auto` wrapper.
- [fixed] UI-012 accepts DESIGN.md tokens in Tailwind arbitrary values (`font-[family-name:var(--font-mono)]`) and weights (`font-[550]`); agents had swapped the token class for inline styles to silence it.
- [fixed] SEC-003 no longer flags SQL that interpolates a name bound once to a literal, such as a constant column list or page size.
- [fixed] UI-001 reads colors through the file's custom properties, so a glow or gradient built from `var(--brand)` with `--brand: #4f46e5` is caught.
- [fixed] Style resolution follows descendant and child selectors such as `.plan .price`, so UI-005 no longer asks for tabular figures a nested rule already sets, and UI-002, UI-004 and UI-006 see those styles too.
- [fixed] UI-006 no longer flags pills or inner radii when the gap is wider than the outer radius, where corners do not interact.
- [fixed] BE-001 no longer flags `.catch(() => null)` whose value is used, including when the call spans several lines, or best-effort cleanup such as a failed `ROLLBACK`.
- [fixed] BE-005 no longer treats a decoy password hash, kept to make login timing constant, as mock data.
- [fixed] Piping `sloplint check` into a command that closes early, such as `head`, no longer crashes with `EPIPE`.
