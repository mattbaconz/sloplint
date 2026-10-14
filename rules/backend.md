# Backend and architecture brief

You are writing server code that will run unattended. Generated backends fail in predictable ways: errors vanish, queries multiply, calls hang, retries duplicate data, and stubs ship. Each rule below names the failure and the fix.

## Errors

- **BE-001 Never swallow errors.** `catch (e) { console.log(e) }`, empty `catch {}`, `.catch(() => {})` and Python `except: pass` turn failures into silent data loss. Either handle the error (retry with backoff, fall back to a state the user can see, return a typed error response) or let it propagate. If you log, rethrow with context: `throw new Error('Invoice sync failed for account 42', { cause: error })`.
- Errors carry context: which operation, which entity ID, which upstream. Never log secrets or full request bodies.

## Data access

- **BE-002 No queries inside loops.** `for (const id of ids) await db.find(id)` is N+1 round trips. Fetch the set in one query (`where: { id: { in: ids } }`, a JOIN, `select_related` / `prefetch_related`, a DataLoader) and map in memory. If per-item calls are truly required, bound concurrency explicitly.
- Paginate every list endpoint. Unbounded `findMany()` is a latent outage.

## Network

- **BE-003 Every outbound call has a timeout.** `fetch(url)` with no `signal` can hang a worker indefinitely. Use `AbortSignal.timeout(ms)`, axios `timeout`, or requests `timeout=`. Decide what the caller sees when the timeout fires.
- Retries only for idempotent operations, with jittered backoff and a cap.

## API design

- **BE-004 Mutations are idempotent.** POST routes that create orders, charges or messages accept an `Idempotency-Key` header, store it under a unique constraint, and return the original result on replay. Never mutate state in a GET handler.
- Validate input at the boundary with a schema (zod, valibot, pydantic) and return 400 with a message that names the field.

## Honesty in code

- **BE-005 No stubs in production paths.** No `throw new Error('Not implemented')`, no `mockUsers` arrays, no comments like "in a real application you would...". Implement it, or delete the code path and the UI that reaches it. Sample data lives in `fixtures/` or seed scripts.
- **BE-006 No speculative abstraction.** An `IUserRepository` with one implementation and a `UserRepositoryFactory` that builds one class is indirection with no payoff. Call the concrete function; extract an interface when the second implementation exists.

## Before you finish

Run `npx @sloplint/cli check .` and resolve every `BE-*` finding. Also read [security.md](security.md): most backend tasks touch its rules.
