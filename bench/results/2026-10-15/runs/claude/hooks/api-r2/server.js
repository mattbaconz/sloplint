import express from 'express';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import Stripe from 'stripe';

// Required configuration: read once at boot, crash if missing.
function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

const DATABASE_URL = requireEnv('DATABASE_URL');
const JWT_SECRET = requireEnv('JWT_SECRET');
const STRIPE_WEBHOOK_SECRET = requireEnv('STRIPE_WEBHOOK_SECRET');
const LLM_BASE_URL = requireEnv('LLM_BASE_URL').replace(/\/+$/, '');
const LLM_API_KEY = requireEnv('LLM_API_KEY');
const LLM_MODEL = requireEnv('LLM_MODEL');
const PORT = Number(process.env.PORT ?? 3000);

const TOKEN_TTL = '8h';
const LLM_TIMEOUT_MS = 20_000;
const MAX_ITEMS = 200;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const pool = new pg.Pool({ connectionString: DATABASE_URL });

// Compared against when the email is unknown so response time does not reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('ledgerly-dummy-password', 10);

const app = express();

// Stripe needs the exact bytes that were signed, so this route gets a raw body parser
// and must be registered before express.json().
app.post(
  '/webhooks/stripe',
  express.raw({ type: 'application/json', limit: '1mb' }),
  async (req, res) => {
    const signature = req.get('stripe-signature');
    if (!signature || !Buffer.isBuffer(req.body)) {
      return res.status(400).json({ error: 'Missing Stripe signature or body.' });
    }

    let event;
    try {
      event = Stripe.webhooks.constructEvent(req.body, signature, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      return res.status(400).json({ error: `Signature verification failed: ${err.message}` });
    }

    let invoiceId = null;
    if (event.type === 'payment_intent.succeeded') {
      invoiceId = event.data.object.metadata?.invoice_id ?? null;
    } else if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      if (session.payment_status === 'paid') {
        invoiceId = session.client_reference_id ?? session.metadata?.invoice_id ?? null;
      }
    }

    if (invoiceId !== null && isId(invoiceId)) {
      // Idempotent: a redelivered event matches no row the second time.
      await pool.query(
        `UPDATE invoices SET status = 'paid', paid_at = now()
         WHERE id = $1 AND status <> 'paid'`,
        [invoiceId],
      );
    }

    // Unrelated event types are acknowledged so Stripe stops retrying them.
    return res.json({ received: true });
  },
);

app.use(express.json({ limit: '100kb' }));

function isId(value) {
  return /^\d{1,18}$/.test(String(value));
}

function requireAuth(req, res, next) {
  const header = req.get('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Send an Authorization: Bearer <token> header.' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    req.userId = payload.sub;
    return next();
  } catch {
    return res.status(401).json({ error: 'Token is invalid or expired. Log in again.' });
  }
}

app.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (
    typeof email !== 'string' || !EMAIL_RE.test(email) || email.length > 254 ||
    typeof password !== 'string' || password.length === 0 || password.length > 200
  ) {
    return res.status(400).json({ error: 'Provide a valid email and a password.' });
  }

  const { rows } = await pool.query(
    'SELECT id, password_hash FROM users WHERE lower(email) = lower($1)',
    [email],
  );
  const user = rows[0];
  const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !ok) {
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  }

  const token = jwt.sign({}, JWT_SECRET, {
    algorithm: 'HS256',
    subject: String(user.id),
    expiresIn: TOKEN_TTL,
  });
  return res.json({ token });
});

app.get('/invoices', requireAuth, async (req, res) => {
  // One query: line items are aggregated per invoice, so there is no per-invoice lookup.
  const { rows } = await pool.query(
    `SELECT i.id, i.customer_name, i.currency, i.status, i.created_at, i.paid_at,
            COALESCE(
              json_agg(
                json_build_object(
                  'id', li.id,
                  'description', li.description,
                  'quantity', li.quantity,
                  'unit_price_cents', li.unit_price_cents
                ) ORDER BY li.id
              ) FILTER (WHERE li.id IS NOT NULL),
              '[]'::json
            ) AS items
     FROM invoices i
     LEFT JOIN invoice_items li ON li.invoice_id = i.id
     WHERE i.user_id = $1
     GROUP BY i.id
     ORDER BY i.created_at DESC`,
    [req.userId],
  );
  return res.json({ invoices: rows });
});

function parseNewInvoice(body) {
  const { customer_name: customerName, currency, items } = body ?? {};
  if (typeof customerName !== 'string' || customerName.trim() === '' || customerName.length > 200) {
    return { error: 'customer_name must be a non-empty string up to 200 characters.' };
  }
  if (typeof currency !== 'string' || !/^[A-Za-z]{3}$/.test(currency)) {
    return { error: 'currency must be a 3-letter ISO code such as "USD".' };
  }
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_ITEMS) {
    return { error: `items must be an array of 1 to ${MAX_ITEMS} line items.` };
  }
  for (const [n, item] of items.entries()) {
    const label = `items[${n}]`;
    if (typeof item?.description !== 'string' || item.description.trim() === '' || item.description.length > 500) {
      return { error: `${label}.description must be a non-empty string up to 500 characters.` };
    }
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 1_000_000) {
      return { error: `${label}.quantity must be an integer from 1 to 1000000.` };
    }
    if (!Number.isInteger(item.unit_price_cents) || item.unit_price_cents < 0 || item.unit_price_cents > 1_000_000_000) {
      return { error: `${label}.unit_price_cents must be a non-negative integer (cents).` };
    }
  }
  return {
    value: {
      customerName: customerName.trim(),
      currency: currency.toUpperCase(),
      items: items.map((it) => ({
        description: it.description.trim(),
        quantity: it.quantity,
        unitPriceCents: it.unit_price_cents,
      })),
    },
  };
}

app.post('/invoices', requireAuth, async (req, res) => {
  const parsed = parseNewInvoice(req.body);
  if (parsed.error) {
    return res.status(400).json({ error: parsed.error });
  }
  const { customerName, currency, items } = parsed.value;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const created = await client.query(
      `INSERT INTO invoices (user_id, customer_name, currency, status)
       VALUES ($1, $2, $3, 'open')
       RETURNING id, customer_name, currency, status, created_at`,
      [req.userId, customerName, currency],
    );
    const invoice = created.rows[0];

    const inserted = await client.query(
      `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price_cents)
       SELECT $1, d, q, p
       FROM unnest($2::text[], $3::int[], $4::bigint[]) AS t(d, q, p)
       RETURNING id, description, quantity, unit_price_cents`,
      [
        invoice.id,
        items.map((i) => i.description),
        items.map((i) => i.quantity),
        items.map((i) => i.unitPriceCents),
      ],
    );
    await client.query('COMMIT');
    return res.status(201).json({ ...invoice, items: inserted.rows });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

app.post('/invoices/:id/summary', requireAuth, async (req, res) => {
  const { id } = req.params;
  if (!isId(id)) {
    return res.status(400).json({ error: 'Invoice id must be a positive integer.' });
  }

  const { rows } = await pool.query(
    `SELECT i.customer_name, i.currency, i.status,
            li.description, li.quantity, li.unit_price_cents
     FROM invoices i
     LEFT JOIN invoice_items li ON li.invoice_id = i.id
     WHERE i.id = $1 AND i.user_id = $2
     ORDER BY li.id`,
    [id, req.userId],
  );
  if (rows.length === 0) {
    return res.status(404).json({ error: 'Invoice not found.' });
  }

  const head = rows[0];
  const lines = rows
    .filter((r) => r.description !== null)
    .map((r) => `- ${r.description}: ${r.quantity} x ${(r.unit_price_cents / 100).toFixed(2)} ${head.currency}`);
  const total = rows.reduce(
    (sum, r) => sum + (r.description === null ? 0 : r.quantity * Number(r.unit_price_cents)),
    0,
  );
  const prompt = [
    'Summarize this invoice in exactly two sentences for the account owner.',
    `Customer: ${head.customer_name}`,
    `Status: ${head.status}`,
    `Total: ${(total / 100).toFixed(2)} ${head.currency}`,
    'Line items:',
    ...lines,
  ].join('\n');

  let upstream;
  try {
    upstream = await fetch(`${LLM_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          { role: 'system', content: 'You write concise, factual invoice summaries.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 150,
      }),
      signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
    });
  } catch (err) {
    console.error('LLM request failed', err);
    return res.status(504).json({ error: 'The summary service did not respond in time. Try again shortly.' });
  }

  if (!upstream.ok) {
    console.error('LLM request returned', upstream.status);
    return res.status(502).json({ error: `The summary service returned HTTP ${upstream.status}. Try again shortly.` });
  }

  const data = await upstream.json();
  const summary = data?.choices?.[0]?.message?.content?.trim();
  if (!summary) {
    return res.status(502).json({ error: 'The summary service returned an empty answer. Try again.' });
  }
  return res.json({ summary });
});

// Express 5 forwards rejected async handlers here.
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) {
    return next(err);
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body is not valid JSON.' });
  }
  return res.status(500).json({ error: 'The server hit an unexpected error and did not complete your request. Retry in a minute; if it keeps failing, contact support with the time of the request.' });
});

app.listen(PORT, () => {
  console.log(`Ledgerly API listening on port ${PORT}`);
});
