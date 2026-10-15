import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import express from 'express';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import Stripe from 'stripe';
import { z } from 'zod';

// Configuration is read once at boot; a missing value crashes the process.
function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: requireEnv('DATABASE_URL'),
  jwtSecret: requireEnv('JWT_SECRET'),
  corsOrigins: requireEnv('CORS_ORIGINS')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  stripeSecretKey: requireEnv('STRIPE_SECRET_KEY'),
  stripeWebhookSecret: requireEnv('STRIPE_WEBHOOK_SECRET'),
  llmBaseUrl: requireEnv('LLM_BASE_URL').replace(/\/+$/, ''),
  llmApiKey: requireEnv('LLM_API_KEY'),
  llmModel: requireEnv('LLM_MODEL'),
};

const LLM_TIMEOUT_MS = 20_000;
const JWT_TTL = '12h';

const pool = new pg.Pool({ connectionString: config.databaseUrl });
const stripe = new Stripe(config.stripeSecretKey);

// Compared against when the email is unknown so response time does not reveal which emails exist.
const decoyHash = bcrypt.hashSync(randomBytes(16).toString('hex'), 10);

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(200),
});

const invoiceSchema = z.object({
  customerName: z.string().trim().min(1).max(200),
  customerEmail: z.string().trim().email().max(254),
  currency: z.string().trim().length(3).transform((c) => c.toUpperCase()),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lineItems: z
    .array(
      z.object({
        description: z.string().trim().min(1).max(300),
        quantity: z.number().int().min(1).max(100_000),
        unitPriceCents: z.number().int().min(0).max(1_000_000_000),
      }),
    )
    .min(1)
    .max(200),
});

const invoiceIdSchema = z.coerce.number().int().positive();

function parse(schema, input) {
  const result = schema.safeParse(input);
  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
      .join('; ');
    throw new HttpError(400, `Invalid request: ${detail}`);
  }
  return result.data;
}

function requireAuth(req, _res, next) {
  const header = req.get('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new HttpError(401, 'Missing bearer token. Sign in at POST /login.');
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    req.userId = payload.sub;
  } catch {
    throw new HttpError(401, 'Token is invalid or expired. Sign in again.');
  }
  next();
}

const app = express();

app.use(cors({ origin: config.corsOrigins, credentials: true }));

// Stripe signs the raw bytes, so this route must be registered before express.json().
app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.get('stripe-signature');
  if (!signature) {
    throw new HttpError(400, 'Missing Stripe-Signature header.');
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, config.stripeWebhookSecret);
  } catch {
    throw new HttpError(400, 'Stripe signature verification failed.');
  }

  const paidTypes = new Set(['payment_intent.succeeded', 'checkout.session.completed']);
  if (paidTypes.has(event.type)) {
    const object = event.data.object;
    const isUnpaidSession =
      event.type === 'checkout.session.completed' && object.payment_status !== 'paid';
    const invoiceId = Number(object.metadata?.invoice_id);
    if (!isUnpaidSession && Number.isInteger(invoiceId) && invoiceId > 0) {
      // Idempotent: Stripe retries deliveries, and a second run changes nothing.
      await pool.query(
        `UPDATE invoices
            SET status = 'paid', paid_at = now()
          WHERE id = $1 AND status <> 'paid'`,
        [invoiceId],
      );
    }
  }

  res.json({ received: true });
});

app.use(express.json({ limit: '100kb' }));

app.post('/login', async (req, res) => {
  const { email, password } = parse(loginSchema, req.body);

  const { rows } = await pool.query(
    'SELECT id, password_hash FROM users WHERE email = $1',
    [email],
  );
  const user = rows[0];
  const matches = await bcrypt.compare(password, user ? user.password_hash : decoyHash);
  if (!user || !matches) {
    throw new HttpError(401, 'Email or password is incorrect.');
  }

  const token = jwt.sign({}, config.jwtSecret, {
    algorithm: 'HS256',
    subject: String(user.id),
    expiresIn: JWT_TTL,
  });
  res.json({ token });
});

app.get('/invoices', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT i.id,
            i.customer_name AS "customerName",
            i.customer_email AS "customerEmail",
            i.currency,
            i.status,
            i.due_date AS "dueDate",
            i.created_at AS "createdAt",
            i.paid_at AS "paidAt",
            COALESCE(
              json_agg(
                json_build_object(
                  'id', li.id,
                  'description', li.description,
                  'quantity', li.quantity,
                  'unitPriceCents', li.unit_price_cents
                ) ORDER BY li.id
              ) FILTER (WHERE li.id IS NOT NULL),
              '[]'::json
            ) AS "lineItems"
       FROM invoices i
       LEFT JOIN line_items li ON li.invoice_id = i.id
      WHERE i.user_id = $1
      GROUP BY i.id
      ORDER BY i.created_at DESC`,
    [req.userId],
  );
  res.json({ invoices: rows });
});

app.post('/invoices', requireAuth, async (req, res) => {
  const input = parse(invoiceSchema, req.body);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO invoices (user_id, customer_name, customer_email, currency, due_date, status)
       VALUES ($1, $2, $3, $4, $5, 'open')
       RETURNING id, status, created_at AS "createdAt"`,
      [req.userId, input.customerName, input.customerEmail, input.currency, input.dueDate],
    );
    const invoice = rows[0];

    await client.query(
      `INSERT INTO line_items (invoice_id, description, quantity, unit_price_cents)
       SELECT $1, d, q, p FROM unnest($2::text[], $3::int[], $4::int[]) AS t(d, q, p)`,
      [
        invoice.id,
        input.lineItems.map((item) => item.description),
        input.lineItems.map((item) => item.quantity),
        input.lineItems.map((item) => item.unitPriceCents),
      ],
    );
    await client.query('COMMIT');

    res.status(201).json({ invoice: { ...invoice, ...input } });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});

app.post('/invoices/:id/summary', requireAuth, async (req, res) => {
  const invoiceId = parse(invoiceIdSchema, req.params.id);

  const { rows } = await pool.query(
    `SELECT i.customer_name, i.currency, i.status, i.due_date,
            li.description, li.quantity, li.unit_price_cents
       FROM invoices i
       LEFT JOIN line_items li ON li.invoice_id = i.id
      WHERE i.id = $1 AND i.user_id = $2
      ORDER BY li.id`,
    [invoiceId, req.userId],
  );
  if (rows.length === 0) {
    throw new HttpError(404, 'Invoice not found.');
  }

  const head = rows[0];
  const items = rows
    .filter((row) => row.description !== null)
    .map(
      (row) =>
        `- ${row.description}: ${row.quantity} x ${(row.unit_price_cents / 100).toFixed(2)} ${head.currency}`,
    );
  const total =
    rows.reduce((sum, row) => sum + (row.quantity ?? 0) * (row.unit_price_cents ?? 0), 0) / 100;
  const dueDate =
    head.due_date instanceof Date ? head.due_date.toISOString().slice(0, 10) : head.due_date;

  const prompt = [
    'Summarize this invoice in exactly two sentences for the person who issued it.',
    `Customer: ${head.customer_name}`,
    `Status: ${head.status}`,
    `Due: ${dueDate}`,
    `Total: ${total.toFixed(2)} ${head.currency}`,
    'Line items:',
    ...items,
  ].join('\n');

  let response;
  try {
    response = await fetch(`${config.llmBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.llmApiKey}`,
      },
      body: JSON.stringify({
        model: config.llmModel,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 150,
      }),
      signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
    });
  } catch (error) {
    if (error.name === 'TimeoutError') {
      throw new HttpError(504, 'The summary service did not respond in time. Try again shortly.');
    }
    throw new HttpError(502, 'The summary service could not be reached. Try again shortly.');
  }

  if (!response.ok) {
    throw new HttpError(502, `The summary service returned status ${response.status}. Try again shortly.`);
  }

  const body = await response.json();
  const summary = body?.choices?.[0]?.message?.content?.trim();
  if (!summary) {
    throw new HttpError(502, 'The summary service returned an empty answer. Try again.');
  }
  res.json({ summary });
});

app.use((error, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  if (error?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Request body is not valid JSON.' });
    return;
  }
  console.error(error);
  res.status(500).json({ error: 'The server hit an unexpected error and the request was not completed. Retry in a minute; if it persists, contact Ledgerly support.' });
});

app.listen(config.port, () => {
  console.log(`Ledgerly API listening on port ${config.port}`);
});
