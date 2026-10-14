# sloplint brief pack

Five master briefs that tell coding agents what generated code gets wrong and what to do instead. Each brief is self-contained, cites the rule IDs that `sloplint check` enforces, and is short enough to sit in a system prompt.

| Brief | Covers | Rule IDs |
| --- | --- | --- |
| [ui.md](ui.md) | Visual design, motion, UX writing | `UI-*`, `COPY-*` |
| [backend.md](backend.md) | Error handling, data access, network calls, API design | `BE-*` |
| [security.md](security.md) | Secrets, CORS, injection, auth, webhooks, HTML sinks | `SEC-*` |
| [testing.md](testing.md) | Assertions, waits, focused tests, READMEs | `TEST-*` |
| [motion.md](motion.md) | Motion, pacing and sound in videos written as code | `MOTION-*` |

## Using the briefs with agents

**One agent.** Run `npx @sloplint/cli init`. It writes `DESIGN.md` and syncs a compact version of every rule into `CLAUDE.md`, `GEMINI.md`, `AGENTS.md` and `.cursor/rules/sloplint.mdc`. That is usually enough.

**Several specialised agents.** Give each agent the brief for its lane and the shared `DESIGN.md`:

- Frontend agent: `rules/ui.md` + `DESIGN.md`
- API / services agent: `rules/backend.md` + `rules/security.md`
- Test agent: `rules/testing.md`
- Video agent (Remotion, GSAP): `rules/motion.md` + `rules/ui.md` + `DESIGN.md`
- Reviewer agent: every brief, plus the instruction to run `npx @sloplint/cli check . --format json` and treat every finding as a review comment.

**Gate the loop.** Whatever the setup, the last step of every task is `npx @sloplint/cli check . --max-score 0`. The agent is not done until it exits 0.

## Visual verification

`scripts/verify-dom.spec.ts` is a Playwright suite that checks the rendered page, not the source: computed `transition-property`, gradient colors, concentric radii, tabular numbers, layout shift, visible copy, button labels and mobile overflow. It imports nothing but `@playwright/test`, so copy it into your own test folder and point it at any URL:

```bash
cp node_modules/@sloplint/cli/scripts/verify-dom.spec.ts e2e/
SLOPLINT_URL=http://localhost:3000 npx playwright test e2e/verify-dom.spec.ts
```

Every preset exposed through `input[name="preset"]` is audited in turn, and each run attaches desktop and 375px screenshots to the report.
