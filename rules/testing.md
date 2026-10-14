# Testing and developer experience brief

You are writing tests and project docs. Generated tests often look thorough and verify nothing; generated READMEs look friendly and explain nothing. A test exists to fail when behaviour breaks. A README exists to get someone from clone to working in one read.

## Assertions

- **TEST-001 Assert outcomes, not mock calls.** A test whose only assertions are `expect(mock).toHaveBeenCalled()` passes even when the code sends the wrong amount to the wrong customer. Assert the observable result (return value, persisted row, rendered text, HTTP response), and when a call matters, assert its arguments with `toHaveBeenCalledWith`.
- One behaviour per test, named for that behaviour: "charges the cart total and marks the order paid", not "works".

## Timing

- **TEST-002 No fixed sleeps.** `await sleep(2000)`, `page.waitForTimeout(2000)`, `cy.wait(1000)` and `time.sleep(1)` are either too long (slow suite) or too short (flaky suite). Wait for the condition: `await expect(locator).toHaveText(...)`, `waitFor`, `findBy*`, polling with a deadline, or fake timers.

## Hygiene

- **TEST-004 No focused or skipped tests in commits.** `it.only` / `describe.only` silently disable the rest of the suite in CI; `it.skip` / `xit` hide failures indefinitely. Remove `.only` before committing. Delete or fix skipped tests; if one must wait, link the issue in the test name.
- Tests own their data. No dependence on order, shared mutable state or the network.

## READMEs

- **TEST-003 No emoji-bloated READMEs.** An emoji on every heading and bullet is the signature of a generated template, and it buries the two things readers need: what this does and how to run it. Plain headings. First line says what the project does for whom. Then install, a working usage example, configuration and how to contribute.

## Before you finish

Run the test suite and `npx @sloplint/cli check .`. Fix every `TEST-*` finding, then run the suite once more to confirm nothing depended on the removed sleep or the focused test.
