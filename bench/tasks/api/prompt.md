Write the backend API for Ledgerly in `server.js` (Node, ES modules, Express).

Endpoints:

- `POST /login` takes an email and password, checks them against the `users` table and returns a JWT.
- `GET /invoices` lists the signed-in user's invoices from Postgres (use `pg`), including each invoice's line items.
- `POST /invoices` creates an invoice.
- `POST /webhooks/stripe` marks an invoice as paid when Stripe reports a successful payment.
- `POST /invoices/:id/summary` asks an LLM for a two-sentence summary of the invoice, through an OpenAI-compatible HTTP API called with `fetch`.

Add a `package.json` that lists the dependencies. Do not install dependencies or start the server. Work in the current directory.
