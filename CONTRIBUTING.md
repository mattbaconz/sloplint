# Contributing

The most useful contributions are false-positive reports and new tells.

## False positives come first

A linter that cries wolf gets uninstalled, and an agent that obeys a wrong finding makes the code worse: the benchmark transcripts showed agents moving correct styles inline to silence one. A false positive is a bug and takes priority over new rules.

Report one with the [false positive template](https://github.com/mattbaconz/sloplint/issues/new?template=false-positive.yml): the rule ID, the file path (it decides the language and whether a file counts as a test, a server module or a README) and the smallest snippet that still triggers it. Until it is fixed, keep the code and suppress the line:

```ts
// sloplint-disable-next-line UI-005 -- prices are set in a nested rule
```

## Add a tell

A tell is a pattern that generated code converges on and that a careful person would not write. Precision beats recall: a rule that catches most cases and never misfires is worth more than one that catches everything and sometimes does.

1. Open a [new tell](https://github.com/mattbaconz/sloplint/issues/new?template=new-tell.yml) issue first, so the ID, scope and severity are agreed before you write code. `error` is for code that is wrong, not just generic.
2. Add the rule to `src/rules.mjs` in its domain: `id`, `slug`, `severity`, `weight`, `title`, `rationale`, `fix`, `sample` (the example's file extension), `langs` and `check(ctx)`. Start from a neighbouring rule; `ctx` gives the masked source, CSS declarations, class names and resolved styles.
3. Add `examples/<ID>.slop.<ext>` and `examples/<ID>.craft.<ext>`. The tests require the slop file to trigger this rule and nothing else and the craft file to be clean, so the pair is the rule's spec.
4. Make the rule fire somewhere in `examples/samples/`; a test checks that the samples cover every rule.
5. Add a fixture under `tests/fixtures/variants/` for each near miss you can think of, especially code that must stay clean. A fixture starts with an `expect: <RULE-IDS>` or `expect: none` comment.
6. Add one line to the brief in `rules/<domain>.md`, a row to the rules table in `README.md` and an entry to `CHANGELOG.md` (`[added]`, `[changed]` or `[fixed]`).
7. Run `npm test` and `npm run check`. Both must pass; `npm run check` holds this repository to a Slop Score of 0.

## Development

Node 20 or newer. The CLI has no runtime dependencies; `npm ci` only installs Playwright for `npm run verify:dom`, which also needs `npx playwright install chromium`.

```bash
npm test
```

```bash
npm run check
```

The benchmark harness and how to rerun it are described in [bench/README.md](bench/README.md).

## Pull requests

Keep one rule or one fix per pull request and link its issue. Security reports go through [SECURITY.md](SECURITY.md), not public issues.
