import 'dotenv/config';
import express from 'express';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import Stripe from 'stripe';

function getRequiredSecret(name) {
  const secret = process.env[name];
  if (!secret) {
    throw new Error(`Environment variable ${name} must be set`);
  }
  return secret;
}

export const pool = new pg.Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.PGHOST,
        port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        database: process.env.PGDATABASE,
      }
);

const app = express();

// Stripe webhook handler requires raw body for cryptographic signature verification
app.post(
  '/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  async (req, res, next) => {
    try {
      const signature = req.headers['stripe-signature'];
      if (!signature) {
        return res.status(400).json({ error: 'Missing stripe-signature header' });
      }

      const webhookSecret = getRequiredSecret('STRIPE_WEBHOOK_SECRET');
      const stripeSecretKey = getRequiredSecret('STRIPE_SECRET_KEY');
      const stripe = new Stripe(stripeSecretKey);

      let event;
      try {
        const rawPayload = Buffer.isBuffer(req.body)
          ? req.body
          : typeof req.body === 'string'
            ? req.body
            : JSON.stringify(req.body);

        event = stripe.webhooks.constructEvent(rawPayload, signature, webhookSecret);
      } catch (err) {
        return res.status(400).json({
          error: 'Webhook signature verification failed',
          details: err.message,
        });
      }

      const paymentSuccessEvents = new Set([
        'invoice.payment_succeeded',
        'checkout.session.completed',
        'payment_intent.succeeded',
        'charge.succeeded',
      ]);

      if (paymentSuccessEvents.has(event.type)) {
        const dataObject = event.data.object;
        const targetInvoiceId =
          dataObject.metadata?.invoice_id ||
          dataObject.metadata?.invoiceId ||
          dataObject.client_reference_id ||
          dataObject.id;

        if (targetInvoiceId) {
          await pool.query(
            "UPDATE invoices SET status = 'paid' WHERE id::text = $1",
            [String(targetInvoiceId)]
          );
        }
      }

      return res.status(200).json({ received: true });
    } catch (err) {
      return next(err);
    }
  }
);

// Body parsing middleware for JSON requests
app.use(express.json());

// Authentication middleware to verify JWT
function authenticateToken(req, res, next) {
  if (req.user) {
    return next();
  }

  const authHeader = req.headers['authorization'] || req.headers['x-access-token'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  try {
    const jwtSecret = getRequiredSecret('JWT_SECRET');
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({
      error: 'Invalid or expired authentication token',
      details: err.message,
    });
  }
}

// POST /login: authenticates user credentials against the users table and issues a JWT
app.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const result = await pool.query(
      'SELECT id, email, password_hash, password FROM users WHERE LOWER(email) = $1 LIMIT 1',
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];
    const storedHash = user.password_hash || user.password;
    if (!storedHash) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isBcrypt = typeof storedHash === 'string' && /^\$2[aby]\$\d{2}\$/.test(storedHash);
    const passwordMatches = isBcrypt
      ? await bcrypt.compare(password, storedHash)
      : password === storedHash;

    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const jwtSecret = getRequiredSecret('JWT_SECRET');
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
      },
      jwtSecret,
      { expiresIn: '24h' }
    );

    return res.status(200).json({
      token,
      jwt: token,
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (err) {
    return next(err);
  }
});

// GET /invoices: lists the signed-in user's invoices including line items
app.get('/invoices', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id || req.user.sub;

    const invoicesResult = await pool.query(
      'SELECT * FROM invoices WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    const invoices = invoicesResult.rows;
    if (invoices.length === 0) {
      return res.status(200).json([]);
    }

    const invoiceIds = invoices.map((inv) => inv.id);
    const lineItemsResult = await pool.query(
      'SELECT * FROM line_items WHERE invoice_id = ANY($1) ORDER BY id ASC',
      [invoiceIds]
    );

    const itemsByInvoiceId = new Map();
    for (const item of lineItemsResult.rows) {
      const list = itemsByInvoiceId.get(item.invoice_id);
      if (list) {
        list.push(item);
      } else {
        itemsByInvoiceId.set(item.invoice_id, [item]);
      }
    }

    const invoicesWithLineItems = invoices.map((invoice) => ({
      ...invoice,
      line_items: itemsByInvoiceId.get(invoice.id) || [],
    }));

    return res.status(200).json(invoicesWithLineItems);
  } catch (err) {
    return next(err);
  }
});

// Idempotency cache to safely handle retried mutation requests
const idempotencyRecords = new Map();

// POST /invoices: creates a new invoice and associated line items
app.post('/invoices', authenticateToken, async (req, res, next) => {
  const idempotencyKey = req.headers['idempotency-key'];
  if (idempotencyKey && typeof idempotencyKey === 'string') {
    const cachedResponse = idempotencyRecords.get(idempotencyKey);
    if (cachedResponse) {
      return res.status(200).json(cachedResponse);
    }
  }

  const client = await pool.connect();
  try {
    const userId = req.user.userId || req.user.id || req.user.sub;
    const {
      customer_name,
      client_name,
      amount,
      currency,
      status,
      due_date,
      line_items,
    } = req.body || {};

    const customer = (customer_name || client_name || '').trim();
    const invoiceCurrency = (currency || 'USD').toUpperCase();
    const invoiceStatus = (status || 'pending').toLowerCase();
    const rawItems = Array.isArray(line_items) ? line_items : [];

    let totalAmount = 0;
    if (amount != null && !isNaN(Number(amount))) {
      totalAmount = Number(amount);
    } else {
      for (const item of rawItems) {
        const itemQty = Number(item.quantity) || 1;
        const itemPrice = Number(item.unit_price || item.price) || 0;
        const itemAmt = item.amount != null ? Number(item.amount) : itemQty * itemPrice;
        totalAmount += itemAmt;
      }
    }

    await client.query('BEGIN');

    const insertInvoiceQuery =
      'INSERT INTO invoices (user_id, customer_name, amount, currency, status, due_date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *';
    const invoiceResult = await client.query(insertInvoiceQuery, [
      userId,
      customer,
      totalAmount,
      invoiceCurrency,
      invoiceStatus,
      due_date || null,
    ]);

    const createdInvoice = invoiceResult.rows[0];
    let createdLineItems = [];

    if (rawItems.length > 0) {
      const descriptions = rawItems.map((li) => String(li.description || ''));
      const quantities = rawItems.map((li) => Number(li.quantity) || 1);
      const unitPrices = rawItems.map((li) => Number(li.unit_price || li.price) || 0);
      const amounts = rawItems.map((li) => {
        if (li.amount != null) return Number(li.amount);
        const q = Number(li.quantity) || 1;
        const p = Number(li.unit_price || li.price) || 0;
        return q * p;
      });

      const insertItemsQuery =
        'INSERT INTO line_items (invoice_id, description, quantity, unit_price, amount) SELECT $1, d, q, u, a FROM UNNEST($2::text[], $3::int[], $4::numeric[], $5::numeric[]) AS t(d, q, u, a) RETURNING *';

      const itemsResult = await client.query(insertItemsQuery, [
        createdInvoice.id,
        descriptions,
        quantities,
        unitPrices,
        amounts,
      ]);
      createdLineItems = itemsResult.rows;
    }

    await client.query('COMMIT');

    const responseData = {
      ...createdInvoice,
      line_items: createdLineItems,
    };

    if (idempotencyKey && typeof idempotencyKey === 'string') {
      idempotencyRecords.set(idempotencyKey, responseData);
    }

    return res.status(201).json(responseData);
  } catch (err) {
    await client.query('ROLLBACK');
    return next(err);
  } finally {
    client.release();
  }
});

// POST /invoices/:id/summary: generates a two-sentence summary via OpenAI-compatible HTTP API
app.post('/invoices/:id/summary', authenticateToken, async (req, res, next) => {
  try {
    const invoiceId = req.params.id;
    const userId = req.user.userId || req.user.id || req.user.sub;

    const invoiceResult = await pool.query(
      'SELECT * FROM invoices WHERE id = $1',
      [invoiceId]
    );

    if (invoiceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const invoice = invoiceResult.rows[0];
    if (userId && invoice.user_id && String(invoice.user_id) !== String(userId)) {
      return res.status(403).json({ error: 'Forbidden: You do not have access to this invoice' });
    }

    const lineItemsResult = await pool.query(
      'SELECT * FROM line_items WHERE invoice_id = $1 ORDER BY id ASC',
      [invoiceId]
    );

    const lineItems = lineItemsResult.rows;
    const itemsDescription = lineItems
      .map((item) => `- ${item.description || 'Item'}: quantity ${item.quantity || 1}, unit price ${item.unit_price || 0}, amount ${item.amount || 0}`)
      .join('\n');

    const invoiceDetails = [
      `Invoice ID: ${invoice.id}`,
      `Customer: ${invoice.customer_name || 'Unspecified'}`,
      `Total Amount: ${invoice.amount} ${invoice.currency || 'USD'}`,
      `Status: ${invoice.status}`,
      `Due Date: ${invoice.due_date || 'Unspecified'}`,
      'Line Items:',
      itemsDescription || 'No line items recorded',
    ].join('\n');

    const openAiApiKey = getRequiredSecret('OPENAI_API_KEY');
    const openAiBaseUrl = process.env.OPENAI_BASE_URL ? process.env.OPENAI_BASE_URL : 'https://api.openai.com/v1';

    const llmResponse = await fetch(`${openAiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openAiApiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ? process.env.OPENAI_MODEL : 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an accounting assistant. Summarize the provided invoice in exactly two sentences.',
          },
          {
            role: 'user',
            content: `Please provide a two-sentence summary of the following invoice:\n\n${invoiceDetails}`,
          },
        ],
        temperature: 0.2,
        max_tokens: 200,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!llmResponse.ok) {
      const errorPayload = await llmResponse.text();
      return res.status(502).json({
        error: 'Upstream AI service error',
        status: llmResponse.status,
        details: errorPayload,
      });
    }

    const llmData = await llmResponse.json();
    const summary = llmData.choices?.[0]?.message?.content?.trim();

    if (!summary) {
      return res.status(502).json({ error: 'AI service returned an empty summary' });
    }

    return res.status(200).json({ summary });
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return res.status(504).json({ error: 'Upstream AI service request timed out' });
    }
    return next(err);
  }
});

// Centralized error handling middleware
app.use((err, _req, res, _next) => {
  const statusCode = err.status || err.statusCode || 500;
  return res.status(statusCode).json({
    error: err.message || 'Internal server error while processing request',
  });
});

const isMain = process.argv[1] && process.argv[1].endsWith('server.js');
if (isMain && process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
  app.listen(PORT, () => {
    process.stdout.write(`Ledgerly API listening on port ${PORT}\n`);
  });
}

export { app };
export default app;
