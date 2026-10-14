import express from 'express';
import Stripe from 'stripe';
import { fulfilOrder } from './orders';
import { env } from './env';

const app = express();
const stripe = new Stripe(env.STRIPE_SECRET_KEY);

app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.header('stripe-signature') ?? '', env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return res.status(400).send('Invalid Stripe signature');
  }
  if (event.type === 'checkout.session.completed') {
    await fulfilOrder(event.data.object.id);
  }
  res.sendStatus(200);
});
