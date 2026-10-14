# UI, motion and UX writing brief

You are building interface code. Generated UI converges on the same handful of defaults; every one below is a tell. Follow `DESIGN.md` for tokens. When it is silent, choose the plainer option.

## Visual

- **UI-001 No purple/indigo gradients or glows.** One brand hue from `DESIGN.md`, used flat. Depth comes from surface steps and a 1px border, not from `from-indigo-500 to-purple-600` or a violet `box-shadow` glow.
- **UI-002 No symmetrical icon-badge grids.** Three equal cards that each open with an icon or emoji in a tinted circle or tile say "I could not rank these". Lead with the most important feature in depth (real screenshot, real number), list the rest compactly.
- **UI-003 No echo subtitles.** A muted gray line under every heading that restates the heading ("Manage your billing settings" under "Billing") is noise. Keep a subtitle only when it adds a fact the heading cannot.
- **UI-004 No border soup.** One bordered container per region. Inside it, separate with spacing or a single `border-top`, never another full box.
- **UI-005 Tabular numbers.** Any number that sits in a column or changes over time gets `font-variant-numeric: tabular-nums` (Tailwind `tabular-nums`), or digits jitter and columns misalign.
- **UI-006 Concentric radii.** A rounded child inside a rounded, padded parent uses `inner = outer − padding − border`. Equal radii pinch the corners.
- **UI-009 No gradient text.** Headlines in solid ink. Emphasis via weight, size, or one accent-colored word.
- **UI-011 Colors come from DESIGN.md.** Write `var(--accent)` or a theme class mapped to the token, never `#2563eb`, `bg-blue-600` or `text-gray-500`. A new color goes into DESIGN.md first. Runs only when the project has a DESIGN.md token block.
- **UI-012 Typefaces come from DESIGN.md.** `font-family: var(--font-text)`, not Inter, Roboto or a font imported by reflex. Same condition as UI-011.
- **UI-013 Every link goes somewhere.** No `href="#"` or `javascript:void(0)` in navigation, footers or pricing cards. Link the real page or leave the link out; an action is a `<button>`.
- **No sideways scroll at 375px.** Navs wrap or collapse, stat rows stack, and wide tables scroll inside their own `overflow-x: auto` wrapper. The source rules cannot see rendered width; `verify-dom.spec.ts` can.

## Motion

- **UI-007 Never `transition: all` / `transition-all`.** Name the properties: color, background-color, border-color, opacity, transform. `all` animates width, padding and height, causing jank and layout thrash.
- **UI-008 Loading keeps geometry.** A button that swaps its label for a spinner changes width and shifts the page. Keep the label in the layout (`visibility: hidden` / `invisible`), overlay the spinner absolutely, and set `aria-busy`. Skeletons render at final height.
- Durations 100–200ms, `ease-out` for entering, nothing over 300ms for UI state. Wrap decorative motion in `prefers-reduced-motion: no-preference`.

## UX writing

- **COPY-001 No model vocabulary.** Words like `seamless`, `supercharge`, `unleash`, `next-gen`, `delve`, `elevate`, `empower`, `cutting-edge`, `world-class` and `game-changer` make readers discount the whole page. Replace each with the fact behind it: a number, an integration, a time saved.
- **COPY-002 Errors have a cause and a next step.** Never `Something went wrong`, `An unexpected error occurred` or `Oops`. Say what failed, why if known, what the user can do now, and that their input is safe.
- **COPY-003 Labels name the action.** Buttons and links are verb + object: "Save profile", "Export CSV", "Read the pricing guide". Never `Submit`, `OK`, `Click here`, `Learn more`.
- **COPY-004 No template filler.** No `Lorem ipsum`, `John Doe`, `Acme Inc`, `example@example.com` or random avatars and photos (pravatar, picsum, placehold.co) in shipped components. Write realistic domain content; keep sample data in fixtures and stories.
- **COPY-005 No invented proof.** Customer counts, uptime, ratings, `3x faster` and compliance badges need a source next to them (a footnote, a link, a date) or must come from data. No real figure yet: cut the claim.
- **COPY-006 No emoji decoration.** Headings, buttons and links start with words. Use a real icon with an accessible label when an action needs one.

## Honest behavior

- **UI-010 Success only after the request succeeds.** A form that calls `preventDefault`, waits on a timer and shows "Thanks!" has dropped the submission. Send the data, show success on a successful response, and keep the input with a clear error on failure.

## Before you finish

Run `npx @sloplint/cli check .` and fix every `UI-*` and `COPY-*` finding. If the project serves pages, run `scripts/verify-dom.spec.ts` against the running app.
