import express from 'express';
import { fulfilOrder } from './orders';

const app = express();

app.post('/webhooks/stripe', express.json(), async (req, res) => {
  const event = req.body;
  if (event.type === 'checkout.session.completed') {
    await fulfilOrder(event.data.object.id);
  }
  res.sendStatus(200);
});
