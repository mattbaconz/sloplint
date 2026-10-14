import { Router } from 'express';
import { db } from './db';

export const router = Router();

router.post('/api/orders', async (req, res) => {
  const order = await db.order.create({ data: { cartId: req.body.cartId } });
  res.status(201).json(order);
});
