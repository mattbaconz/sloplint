---
name: sloplint
description: Find and fix the tells of AI-generated code with the sloplint CLI, and give a project a design system of its own. Use when building or reviewing UI, landing pages, dashboards, APIs, tests or product copy; when a page looks generic or AI-made; when the user mentions slop, sloplint, a Slop Score or DESIGN.md; and before finishing frontend work.
---

# sloplint

sloplint is a zero-dependency linter for the defaults that generated code converges on: purple gradients, icon-card grids, invented proof, fake success states, fallback secrets, swallowed errors and mock-only tests. It also generates a design system per project, so pages stop looking like every other generated page.

## Before writing UI

If the project has no `DESIGN.md`, generate one first:

```bash
npx -y @sloplint/cli init --brief "<one line about the product and who uses it>"
```

It writes `DESIGN.md` (palette, typefaces, layout, signature moves and voice, generated for this project) and adds one line per rule to `CLAUDE.md`, `AGENTS.md`, `GEMINI.md` and `.cursor/rules/sloplint.mdc`. Then:

- Take every color and typeface from the `DESIGN.md` tokens. A new color goes into `DESIGN.md` before it goes into code.
- Follow its layout, signature and voice sections; they are what makes this project look like itself.
- `npx -y @sloplint/cli style --brief "..."` previews a system without writing anything.

## With another design skill

sloplint checks the work; it does not need to direct it. When another design skill is available or already in use (one for frontend, visual or interface design), load it and let it lead:

- It sets the visual direction: layout, composition, type pairing, imagery and motion. Do not override it with `DESIGN.md`.
- `DESIGN.md` fills in only what that skill leaves open, such as the exact tokens.
- When it picks a color or typeface that is not in `DESIGN.md`, add it to the `DESIGN.md` tokens first, so the token rules accept it.
- Still run the check below before you finish. Fix what it reports in the other skill's direction, not by swapping in `DESIGN.md` defaults.

## Before you finish

```bash
npx -y @sloplint/cli check --changed
```

Use `check <paths>` outside a git repository. Fix every finding: `--fix` applies the safe autofixes, and `npx -y @sloplint/cli explain <RULE>` gives the reasoning with a slop and a craft example. Run the check again until it reports no findings.

## Fixing findings

- Fix the cause. Moving a value where the linter cannot see it, such as an inline style or a concatenated string, is not a fix.
- A number on a marketing page needs a source next to it, or it goes.
- If a finding is wrong, keep the code and add `sloplint-disable-next-line <RULE>` in a comment with the reason, then tell the user so it can be reported at https://github.com/mattbaconz/sloplint/issues.
