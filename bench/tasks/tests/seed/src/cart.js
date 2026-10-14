// Checkout logic for the billing page. All amounts are integers in cents.

export class PaymentDeclinedError extends Error {
  constructor(reason) {
    super(`Payment declined: ${reason}`);
    this.name = 'PaymentDeclinedError';
    this.reason = reason;
  }
}

export function subtotal(items) {
  let total = 0;
  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity < 1) throw new RangeError(`Invalid quantity for ${item.sku}`);
    if (!Number.isInteger(item.unitPrice) || item.unitPrice < 0) throw new RangeError(`Invalid price for ${item.sku}`);
    total += item.unitPrice * item.quantity;
  }
  return total;
}

const CODES = {
  SAVE10: (amount) => Math.round(amount * 0.1),
  FLAT500: (amount) => (amount >= 2000 ? 500 : 0),
};

export function discount(amount, code) {
  if (!code) return 0;
  const rule = CODES[code.toUpperCase()];
  if (!rule) throw new RangeError(`Unknown discount code ${code}`);
  return rule(amount);
}

export function tax(amount, rate) {
  if (rate < 0 || rate > 0.5) throw new RangeError(`Tax rate out of range: ${rate}`);
  return Math.round(amount * rate);
}

export async function checkout(cart, { gateway, mailer }) {
  const sub = subtotal(cart.items);
  const net = sub - discount(sub, cart.code);
  const total = net + tax(net, cart.taxRate);
  if (total === 0) return { status: 'free', total };
  const result = await gateway.charge({ customerId: cart.customerId, amount: total, currency: cart.currency ?? 'usd' });
  if (!result.ok) throw new PaymentDeclinedError(result.reason);
  await mailer.send({ to: cart.email, template: 'receipt', data: { total, chargeId: result.id } });
  return { status: 'paid', total, chargeId: result.id };
}
