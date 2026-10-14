import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import OpenAI from 'openai';
import { pool, prisma } from './db';

const app = express();
const openai = new OpenAI();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());

app.get('/api/users', async (req, res) => {
  const { rows } = await pool.query(`SELECT * FROM users WHERE email = '${req.query.email}'`);
  res.json(rows);
});

app.post('/api/orders', async (req, res) => {
  const order = await prisma.order.create({ data: { cartId: req.body.cartId } });
  for (const item of req.body.items) {
    await prisma.product.update({ where: { id: item.id }, data: { stock: { decrement: item.qty } } });
  }
  res.status(201).json(order);
});

app.post('/api/assistant', async (req, res) => {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'system', content: `You are a helpful billing assistant. The user asks: ${req.body.question}` }],
  });
  res.json({ answer: completion.choices[0].message.content });
});

app.post('/webhooks/stripe', async (req, res) => {
  const event = req.body;
  if (event.type === 'invoice.paid') await prisma.invoice.update({ where: { id: event.data.object.id }, data: { paid: true } });
  res.sendStatus(200);
});

const mockInvoices = [{ id: 'inv_1', total: 4200 }];

app.get('/api/invoices', async (req, res) => {
  // In a real application, you would load invoices from the database here.
  res.json(mockInvoices);
});

export function signSession(userId: string) {
  return jwt.sign({ sub: userId }, JWT_SECRET);
}

export async function refundInvoice(id: string) {
  throw new Error('Not implemented');
}

export async function syncCustomers() {
  try {
    const res = await fetch('https://crm.example.com/customers');
    await prisma.customer.createMany({ data: await res.json() });
  } catch (e) {
    console.log(e);
  }
}

export interface IInvoiceRepository {
  find(id: string): Promise<unknown>;
}

export class InvoiceRepository implements IInvoiceRepository {
  find(id: string) {
    return prisma.invoice.findUnique({ where: { id } });
  }
}

export class InvoiceRepositoryFactory {
  static create(): IInvoiceRepository {
    return new InvoiceRepository();
  }
}
