# Changelog

## 0.1.0 (unreleased)

- [added] `sloplint check` with 36 rules across UI, security, backend, copy, tests and motion video, compiler-style diagnostics, JSON output, `--fix` autofixes and a weighted Slop Score.
- [added] `sloplint init` with four design presets (Obsidian Telemetry, Editorial Serif, Swiss Brutalist, Tactile Hardware) and rule blocks synced into `CLAUDE.md`, `GEMINI.md`, `AGENTS.md` and `.cursor/rules/sloplint.mdc`.
- [added] `sloplint explain` with rationale and a side-by-side slop/craft diff for every rule.
- [added] `MOTION-*` rules for videos written as code (Remotion, GSAP): uniform entrances, fixed-step staggers, overshooting springs, equal-length scenes, repeated sound effects and unmixed audio.
- [added] Brief pack in `rules/` and a Playwright rendered-page audit in `scripts/verify-dom.spec.ts`.
- [added] Docs site with the rule catalog, preset switcher and an in-browser grader built on the same engine.
- [added] Benchmark harness in `bench/`: six slop-prone tasks run by Claude Code and the Antigravity CLI with and without sloplint, scored by sloplint plus checks that do not use it (a 16-mutant test-suite score, README flag accuracy, syntax, rendered screenshots).
- [changed] UI-002 also catches icon and emoji badges in rounded squares, and only when the badge opens the card, so testimonial avatars are no longer flagged.
- [fixed] UI-006 no longer flags pills or inner radii when the gap is wider than the outer radius, where corners do not interact.
- [fixed] BE-001 no longer flags `.catch(() => null)` whose value is used, or best-effort cleanup such as a failed `ROLLBACK`.
- [fixed] BE-005 no longer treats a decoy password hash, kept to make login timing constant, as mock data.
- [changed] Briefs, agent rule blocks and the table-heavy presets require pages that do not scroll sideways at 375px, with wide tables in their own `overflow-x: auto` wrapper.
