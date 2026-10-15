import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import Stripe from 'stripe';
import { z } from 'zod';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY environment variable is required');
}

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
if (!STRIPE_WEBHOOK_SECRET) {
  throw new Error('STRIPE_WEBHOOK_SECRET environment variable is required');
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is required');
}

const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL
  ? process.env.OPENAI_BASE_URL.replace(/\/+$/, '')
  : 'https://api.openai.com/v1';

const OPENAI_MODEL = process.env.OPENAI_MODEL ? process.env.OPENAI_MODEL : 'gpt-4o-mini';
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
});

const stripe = new Stripe(STRIPE_SECRET_KEY);

const app = express();

const allowedOrigins = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({ origin: allowedOrigins.length > 0 ? allowedOrigins : false, credentials: true }));

// In-memory idempotency cache for mutation requests
const idempotencyStore = new Map();

// Helper to inspect existing table columns safely
let invoiceColumnsCache = null;
async function getInvoiceColumns() {
  if (!invoiceColumnsCache) {
    try {
      const res = await pool.query(
        'SELECT column_name FROM information_schema.columns WHERE table_name = $1',
        ['invoices']
      );
      invoiceColumnsCache = new Set(res.rows.map((r) => r.column_name.toLowerCase()));
    } catch (err) {
      invoiceColumnsCache = new Set();
    }
  }
  return invoiceColumnsCache;
}

let lineItemColumnsCache = null;
async function getLineItemColumns() {
  if (!lineItemColumnsCache) {
    try {
      const res = await pool.query(
        'SELECT column_name FROM information_schema.columns WHERE table_name = $1',
        ['line_items']
      );
      lineItemColumnsCache = new Set(res.rows.map((r) => r.column_name.toLowerCase()));
    } catch (err) {
      lineItemColumnsCache = new Set();
    }
  }
  return lineItemColumnsCache;
}

// Authentication middleware verifying JWT on the server
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Authentication required. Please include a valid Bearer token in the Authorization header.',
    });
  }

  const token = authHeader.slice(7).trim();
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({
      error: 'Invalid or expired authentication token. Please sign in again to receive a fresh token.',
    });
  }
}

// Stripe webhook route: must use raw body buffer before global express.json() parses body
app.post(
  '/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  async (req, res, next) => {
    const signature = req.headers['stripe-signature'];
    if (!signature) {
      return res.status(400).json({
        error: 'Missing stripe-signature header. Webhooks require a valid signature for verification.',
      });
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, signature, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      return res.status(400).json({
        error: `Stripe webhook signature verification failed: ${err.message}. Verify that STRIPE_WEBHOOK_SECRET matches the signing endpoint.`,
      });
    }

    try {
      if (
        event.type === 'invoice.payment_succeeded' ||
        event.type === 'checkout.session.completed' ||
        event.type === 'payment_intent.succeeded'
      ) {
        const paymentObject = event.data.object;
        const invoiceId =
          paymentObject.metadata?.invoice_id ||
          paymentObject.metadata?.invoiceId ||
          paymentObject.client_reference_id ||
          (event.type === 'invoice.payment_succeeded' ? paymentObject.id : null);

        if (invoiceId) {
          await pool.query(
            "UPDATE invoices SET status = 'paid' WHERE id::text = $1",
            [String(invoiceId)]
          );
        }
      }

      return res.status(200).json({ received: true });
    } catch (err) {
      next(err);
    }
  }
);

app.use(express.json());

// POST /login: authenticates against users table and returns JWT
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

app.post('/login', async (req, res, next) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Validation failed. Please provide a valid email address and password.',
    });
  }

  try {
    const userRes = await pool.query(
      'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
      [parsed.data.email]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({
        error: 'Invalid email or password. Please verify your credentials and try again.',
      });
    }

    const user = userRes.rows[0];
    const storedPassword = user.password_hash || user.password;
    if (!storedPassword) {
      return res.status(401).json({
        error: 'Invalid email or password. Please verify your credentials and try again.',
      });
    }

    let passwordMatch = false;
    if (typeof storedPassword === 'string' && /^\$2[aby]\$\d{2}\$/.test(storedPassword)) {
      passwordMatch = await bcrypt.compare(parsed.data.password, storedPassword);
    } else {
      passwordMatch = storedPassword === parsed.data.password;
    }

    if (!passwordMatch) {
      return res.status(401).json({
        error: 'Invalid email or password. Please verify your credentials and try again.',
      });
    }

    const userIdStr = String(user.id);
    const token = jwt.sign(
      { sub: userIdStr, id: userIdStr, email: user.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.status(200).json({ token });
  } catch (err) {
    next(err);
  }
});

// GET /invoices: lists the signed-in user's invoices with line items in batch
app.get('/invoices', authenticateToken, async (req, res, next) => {
  const userId = req.user.sub || req.user.id;

  try {
    const invoicesRes = await pool.query(
      'SELECT * FROM invoices WHERE user_id::text = $1 ORDER BY id DESC',
      [String(userId)]
    );

    const invoices = invoicesRes.rows;
    if (invoices.length === 0) {
      return res.status(200).json([]);
    }

    const invoiceIds = invoices.map((inv) => String(inv.id));
    const lineItemsRes = await pool.query(
      'SELECT * FROM line_items WHERE invoice_id::text = ANY($1::text[]) ORDER BY id ASC',
      [invoiceIds]
    );

    const itemsByInvoiceId = new Map();
    for (const item of lineItemsRes.rows) {
      const key = String(item.invoice_id);
      const list = itemsByInvoiceId.get(key) || [];
      list.push(item);
      itemsByInvoiceId.set(key, list);
    }

    const result = invoices.map((inv) => ({
      ...inv,
      line_items: itemsByInvoiceId.get(String(inv.id)) || [],
    }));

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// POST /invoices: creates an invoice with line items atomically and idempotently
const lineItemInputSchema = z.object({
  description: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  quantity: z.coerce.number().default(1),
  unit_price: z.coerce.number().optional(),
  amount: z.coerce.number().optional(),
});

const createInvoiceSchema = z.object({
  customer_name: z.string().optional(),
  customer_email: z.string().optional(),
  amount: z.coerce.number().optional(),
  currency: z.string().default('USD'),
  status: z.string().default('pending'),
  due_date: z.string().optional(),
  line_items: z.array(lineItemInputSchema).default([]),
});

app.post('/invoices', authenticateToken, async (req, res, next) => {
  const idempotencyKey = req.header('Idempotency-Key');
  if (idempotencyKey && idempotencyStore.has(idempotencyKey)) {
    return res.status(200).json(idempotencyStore.get(idempotencyKey));
  }

  const parsed = createInvoiceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid invoice data. Please provide valid invoice fields and line items, then retry.',
    });
  }

  const userId = req.user.sub || req.user.id;
  const items = parsed.data.line_items;

  let computedSum = 0;
  for (const item of items) {
    const qty = item.quantity || 1;
    const itemAmt = item.amount != null ? item.amount : (item.unit_price != null ? item.unit_price * qty : 0);
    computedSum += itemAmt;
  }

  const totalAmount = parsed.data.amount != null ? parsed.data.amount : computedSum;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const invCols = await getInvoiceColumns();

    let invoiceRow;
    if (invCols.has('customer_name') && invCols.has('currency') && invCols.has('due_date')) {
      const invRes = await client.query(
        'INSERT INTO invoices (user_id, customer_name, customer_email, amount, currency, status, due_date) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [
          userId,
          parsed.data.customer_name || null,
          parsed.data.customer_email || null,
          totalAmount,
          parsed.data.currency,
          parsed.data.status,
          parsed.data.due_date || null,
        ]
      );
      invoiceRow = invRes.rows[0];
    } else if (invCols.has('customer_name') && invCols.has('status')) {
      const invRes = await client.query(
        'INSERT INTO invoices (user_id, customer_name, amount, status) VALUES ($1, $2, $3, $4) RETURNING *',
        [userId, parsed.data.customer_name || null, totalAmount, parsed.data.status]
      );
      invoiceRow = invRes.rows[0];
    } else if (invCols.has('status')) {
      const invRes = await client.query(
        'INSERT INTO invoices (user_id, amount, status) VALUES ($1, $2, $3) RETURNING *',
        [userId, totalAmount, parsed.data.status]
      );
      invoiceRow = invRes.rows[0];
    } else {
      const invRes = await client.query(
        'INSERT INTO invoices (user_id, amount) VALUES ($1, $2) RETURNING *',
        [userId, totalAmount]
      );
      invoiceRow = invRes.rows[0];
    }

    let createdLineItems = [];
    if (items.length > 0) {
      const itemCols = await getLineItemColumns();
      const descriptions = items.map((i) => i.description || i.name || 'Item');
      const quantities = items.map((i) => Math.round(i.quantity || 1));
      const unitPrices = items.map((i) => i.unit_price != null ? i.unit_price : 0);
      const amounts = items.map((i) => {
        const qty = i.quantity || 1;
        return i.amount != null ? i.amount : (i.unit_price != null ? i.unit_price * qty : 0);
      });

      if (itemCols.has('unit_price') && itemCols.has('quantity')) {
        const itemsRes = await client.query(
          'INSERT INTO line_items (invoice_id, description, quantity, unit_price, amount) SELECT $1, * FROM UNNEST($2::text[], $3::int[], $4::numeric[], $5::numeric[]) RETURNING *',
          [invoiceRow.id, descriptions, quantities, unitPrices, amounts]
        );
        createdLineItems = itemsRes.rows;
      } else if (itemCols.has('quantity')) {
        const itemsRes = await client.query(
          'INSERT INTO line_items (invoice_id, description, quantity, amount) SELECT $1, * FROM UNNEST($2::text[], $3::int[], $4::numeric[]) RETURNING *',
          [invoiceRow.id, descriptions, quantities, amounts]
        );
        createdLineItems = itemsRes.rows;
      } else {
        const itemsRes = await client.query(
          'INSERT INTO line_items (invoice_id, description, amount) SELECT $1, * FROM UNNEST($2::text[], $3::numeric[]) RETURNING *',
          [invoiceRow.id, descriptions, amounts]
        );
        createdLineItems = itemsRes.rows;
      }
    }

    await client.query('COMMIT');

    const responsePayload = {
      ...invoiceRow,
      line_items: createdLineItems,
    };

    if (idempotencyKey) {
      idempotencyStore.set(idempotencyKey, responsePayload);
    }

    return res.status(201).json(responsePayload);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// POST /invoices/:id/summary: generates a two-sentence summary via OpenAI-compatible API
const invoiceSummaryParamSchema = z.object({
  id: z.string().min(1),
});

app.post('/invoices/:id/summary', authenticateToken, async (req, res, next) => {
  const parsedParams = invoiceSummaryParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({
      error: 'Invalid invoice ID provided. Please verify the ID parameter in the URL.',
    });
  }

  const userId = req.user.sub || req.user.id;

  try {
    const invoiceRes = await pool.query(
      'SELECT * FROM invoices WHERE id::text = $1 AND user_id::text = $2',
      [parsedParams.data.id, String(userId)]
    );

    if (invoiceRes.rows.length === 0) {
      return res.status(404).json({
        error: 'Invoice not found. Ensure the invoice ID is correct and belongs to your account.',
      });
    }

    const invoice = invoiceRes.rows[0];

    const lineItemsRes = await pool.query(
      'SELECT * FROM line_items WHERE invoice_id::text = $1 ORDER BY id ASC',
      [parsedParams.data.id]
    );

    const items = lineItemsRes.rows;
    const itemsDescription = items
      .map((item) => {
        const desc = item.description || item.name || 'Item';
        const qty = item.quantity != null ? item.quantity : 1;
        const amt = item.amount != null ? item.amount : (item.unit_price != null ? item.unit_price * qty : 0);
        return `${desc} (quantity: ${qty}, amount: ${amt})`;
      })
      .join('; ');

    const invoicePromptData = [
      `Invoice ID: ${invoice.id}`,
      `Customer: ${invoice.customer_name || invoice.customer_email || 'Customer'}`,
      `Total: ${invoice.amount} ${invoice.currency || 'USD'}`,
      `Status: ${invoice.status || 'pending'}`,
      `Line Items: ${itemsDescription || 'None'}`,
    ].join('\n');

    const llmResponse = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are an accounting assistant. Provide a concise summary of the invoice in exactly two sentences.',
          },
          {
            role: 'user',
            content: invoicePromptData,
          },
        ],
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!llmResponse.ok) {
      return res.status(502).json({
        error: 'Upstream LLM provider returned an error response. Please try again later.',
      });
    }

    const completion = await llmResponse.json();
    const summary = completion.choices?.[0]?.message?.content?.trim() || '';

    return res.status(200).json({ summary });
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return res.status(504).json({
        error: 'Upstream LLM request timed out after 10 seconds. Please try again later.',
      });
    }
    next(err);
  }
});

// Fallback 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found. Please verify the URL path and HTTP method.',
  });
});

// Centralized error handling middleware
app.use((err, req, res, next) => {
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal server error. Please try again later.',
  });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

export { app, pool };
export default app;
