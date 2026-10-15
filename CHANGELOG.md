# Changelog

## 0.1.0 (unreleased)

- [added] `sloplint check` with 42 rules across UI, security, backend, copy, tests and motion video, compiler-style diagnostics, JSON output, `--fix` autofixes and a weighted Slop Score.
- [added] `sloplint init` generates a design system per project from a seed and a one-line brief: seven moods, curated Google Fonts trios, OKLCH palettes solved for WCAG contrast and kept out of the indigo-to-fuchsia band, layout archetypes, signature moves and a voice for the copy. `--preset` still offers the four curated presets (Obsidian Telemetry, Editorial Serif, Swiss Brutalist, Tactile Hardware).
- [added] `sloplint init` syncs a one-line-per-rule block into `CLAUDE.md`, `GEMINI.md`, `AGENTS.md` and `.cursor/rules/sloplint.mdc`, scoped to the domains the project uses.
- [added] `sloplint style` previews a generated system as text, JSON or a specimen page.
- [added] `sloplint hook` and `init --hooks`: Claude Code lints every file it writes and checks changed files before it stops.
- [added] `check --changed` lints only files changed since the last commit; `--format compact`, the default when output is piped, prints one line per finding and each fix once.
- [added] `UI-011` and `UI-012` hold colors and typefaces to the project's `DESIGN.md`; `UI-010` flags forms that show success without sending anything; `COPY-005` flags unsourced social proof and performance claims; `COPY-006` flags emoji used as decoration; `UI-013` flags links to `#` and `javascript:`; `COPY-004` also flags random avatar and photo services.
- [added] `sloplint explain` with rationale and a side-by-side slop/craft diff for every rule.
- [added] `MOTION-*` rules for videos written as code (Remotion, GSAP): uniform entrances, fixed-step staggers, overshooting springs, equal-length scenes, repeated sound effects and unmixed audio.
- [added] Brief pack in `rules/` and a Playwright rendered-page audit in `scripts/verify-dom.spec.ts`.
- [added] Docs site with the rule catalog, preset switcher, style generator and an in-browser grader built on the same engine.
- [added] Benchmark harness in `bench/`: six slop-prone tasks run by Claude Code and the Antigravity CLI with and without sloplint, scored by sloplint plus checks that do not use it (a 16-mutant test-suite score, README flag accuracy, syntax, rendered screenshots).
- [changed] UI-002 also catches icon and emoji badges in rounded squares, and only when the badge opens the card, so testimonial avatars are no longer flagged.
- [changed] Briefs, agent rule blocks and the table-heavy presets require pages that do not scroll sideways at 375px, with wide tables in their own `overflow-x: auto` wrapper.
- [fixed] Style resolution follows descendant and child selectors such as `.plan .price`, so UI-005 no longer asks for tabular figures a nested rule already sets, and UI-002, UI-004 and UI-006 see those styles too.
- [fixed] UI-006 no longer flags pills or inner radii when the gap is wider than the outer radius, where corners do not interact.
- [fixed] BE-001 no longer flags `.catch(() => null)` whose value is used, including when the call spans several lines, or best-effort cleanup such as a failed `ROLLBACK`.
- [fixed] BE-005 no longer treats a decoy password hash, kept to make login timing constant, as mock data.
- [fixed] Piping `sloplint check` into a command that closes early, such as `head`, no longer crashes with `EPIPE`.
