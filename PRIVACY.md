# Privacy

sloplint runs on your machine and collects nothing.

- **No network access.** The CLI, the Claude Code hook, the skill and the GitHub Action make no network requests and send no telemetry.
- **What the hook reads.** After Claude writes a file, the hook reads that file from disk, lints it in the same process and returns the findings to Claude Code. With `init --hooks`, a second hook also lints the files changed since the last commit when Claude stops. Nothing is uploaded or logged elsewhere.
- **What it writes.** `sloplint init` writes `DESIGN.md`, the instruction files (`CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, Cursor rules) and, with `--hooks`, `.claude/settings.json` in your project. `check --fix` edits the files you point it at. Nothing else is stored.
- **Fonts.** A generated `DESIGN.md` and the specimen page reference typefaces on Google Fonts. Opening a page that loads them sends a request to Google, as any page using Google Fonts does. The docs site at https://mattbaconz.github.io/sloplint/ does the same and runs its grader in your browser.

## Score a page

The "Score a page" box on the docs site (`site/score.html`) is the one part of sloplint that uses a server.

- **What is sent.** When you score a URL, your browser sends that URL to a Cloudflare Worker run by the sloplint maintainer (`worker/fetch-page.mjs`). As with any website, Cloudflare sees your IP address. The Worker uses it only as the key for its rate limit of 10 pages a minute, a counter Cloudflare keeps for that minute.
- **What the Worker fetches.** It downloads the page and up to 8 of its same-origin stylesheets under its own user agent (`sloplint/0.2`). It forwards none of your headers, cookies or sign-ins, so the site you score sees a request from Cloudflare, not from you. The Worker reads robots.txt first and does not fetch a page that robots.txt disallows for `sloplint` or `*`.
- **What is kept.** Nothing. The Worker has Workers Logs turned off, stores no URLs, pages or IP addresses, and returns the page to your browser, where the score is computed. Cloudflare keeps aggregate request counts and error rates for the Worker, without URLs.
- **Share links.** The page puts the scored URL in its own address (`?url=`) so you can share it. Anyone who opens that link sends the URL to GitHub Pages and to the Worker.
- **The bookmarklet** grades the page you are on inside your tab and sends none of its content anywhere. Clicking it downloads its script from GitHub Pages, so GitHub sees that request, and, depending on the page's referrer policy, which site you were on.

Questions: open an issue at https://github.com/mattbaconz/sloplint/issues.
