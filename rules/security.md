# Security brief

You are writing code that handles credentials, user input and other people's data. These are the vulnerabilities generated code introduces most often, all of them caught by a reviewer in seconds and all of them shipped anyway. Every `SEC-*` finding is an error: fix it before anything else.

## Secrets

- **SEC-001 No fallback secrets.** `process.env.JWT_SECRET || 'secret'` and `os.getenv("KEY", "dev-key")` mean a missing variable silently signs tokens with a string that is now public on GitHub. Read the variable and fail at boot if it is absent: `if (!JWT_SECRET) throw new Error('JWT_SECRET is not set')`. Python: `os.environ["KEY"]`.

## Cross-origin

- **SEC-002 No wildcard CORS.** `origin: '*'`, `Access-Control-Allow-Origin: *`, or reflecting the request origin lets any site call your API from a victim's browser; combined with credentials it leaks sessions. Allow-list origins from configuration: `(process.env.CORS_ORIGINS ?? '').split(',')`.

## Injection

- **SEC-003 Parameterised SQL only.** Never build SQL with template literals, `+` or f-strings. Use placeholders (`$1`, `?`, `%s`) with a values array, or the query builder's bindings. Identifiers that must be dynamic come from an allow-list.
- **SEC-004 User text is data, not instructions.** Never interpolate user input into a system prompt. Put it in a `user` role message, validate length and type first, and treat model output as untrusted: never pass it to `eval`, a shell, SQL or `innerHTML`.
- **SEC-007 No unescaped HTML sinks.** `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `dangerouslySetInnerHTML` and `v-html` with interpolated values are XSS. Build nodes with `textContent` / `createElement`, or sanitise with DOMPurify when HTML is genuinely required.

## Authorization

- **SEC-005 Authorization happens on the server.** A `useEffect` that reads a token from `localStorage` and redirects is a UX hint, not a guard: the protected data and API are still reachable. Check the session in middleware, a server component, or the route handler, and verify permissions on every API call.

## Webhooks

- **SEC-006 Verify webhook signatures.** A handler that trusts `req.body` lets anyone forge "payment succeeded". Verify with the provider SDK against the raw body: Stripe `stripe.webhooks.constructEvent(rawBody, signature, secret)`, Svix / GitHub HMAC with a timing-safe compare. Reject before parsing.

## Before you finish

Run `npx @sloplint/cli check .`. Zero `SEC-*` findings is the minimum bar, not the goal: also review authorization on every new route by hand.
