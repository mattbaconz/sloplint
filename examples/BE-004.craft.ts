import { Router } from 'express';
import { db } from './db';

export const router = Router();

router.post('/api/orders', async (req, res) => {
  const key = req.header('Idempotency-Key');
  if (!key) return res.status(400).json({ error: 'Send an Idempotency-Key header so a retry cannot create a second order.' });
  const order = await db.order.upsert({
    where: { idempotencyKey: key },
    create: { idempotencyKey: key, cartId: req.body.cartId },
    update: {},
  });
  res.status(201).json(order);
});
