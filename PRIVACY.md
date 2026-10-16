# Privacy

sloplint runs on your machine and collects nothing.

- **No network access.** The CLI, the Claude Code hook, the skill and the GitHub Action make no network requests and send no telemetry.
- **What the hook reads.** After Claude writes a file, the hook reads that file from disk, lints it in the same process and returns the findings to Claude Code. With `init --hooks`, a second hook also lints the files changed since the last commit when Claude stops. Nothing is uploaded or logged elsewhere.
- **What it writes.** `sloplint init` writes `DESIGN.md`, the instruction files (`CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, Cursor rules) and, with `--hooks`, `.claude/settings.json` in your project. `check --fix` edits the files you point it at. Nothing else is stored.
- **Fonts.** A generated `DESIGN.md` and the specimen page reference typefaces on Google Fonts. Opening a page that loads them sends a request to Google, as any page using Google Fonts does. The docs site at https://mattbaconz.github.io/sloplint/ does the same and runs its grader in your browser.

Questions: open an issue at https://github.com/mattbaconz/sloplint/issues.
