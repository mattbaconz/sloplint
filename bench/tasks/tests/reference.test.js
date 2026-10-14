// Reference suite for the seed. The scorer runs it against every mutant to prove each one is
// detectable, so a low mutation score reflects the agent's tests, not an impossible target.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { subtotal, discount, tax, checkout, PaymentDeclinedError } from './src/cart.js';

const item = (unitPrice, quantity = 1, sku = 'A') => ({ sku, unitPrice, quantity });

function fakes(result = { ok: true, id: 'ch_1' }) {
  const charges = [];
  const mails = [];
  return {
    charges,
    mails,
    deps: { gateway: { charge: async (c) => (charges.push(c), result) }, mailer: { send: async (m) => mails.push(m) } },
  };
}

test('subtotal multiplies price by quantity and validates both', () => {
  assert.equal(subtotal([item(250, 3), item(100)]), 850);
  assert.throws(() => subtotal([item(100, 0)]), RangeError);
  assert.throws(() => subtotal([item(-1)]), RangeError);
});

test('discount codes', () => {
  assert.equal(discount(1000, 'SAVE10'), 100);
  assert.equal(discount(1000, 'save10'), 100);
  assert.equal(discount(2000, 'FLAT500'), 500);
  assert.equal(discount(1999, 'FLAT500'), 0);
  assert.equal(discount(1000, undefined), 0);
  assert.throws(() => discount(1000, 'BOGUS'), RangeError);
});

test('tax rounds to the nearest cent and rejects out-of-range rates', () => {
  assert.equal(tax(999, 0.1), 100);
  assert.throws(() => tax(100, 0.6), RangeError);
  assert.throws(() => tax(100, -0.1), RangeError);
});

test('checkout charges the discounted, taxed total and mails a receipt', async () => {
  const { deps, charges, mails } = fakes();
  const cart = { items: [item(1000, 2)], code: 'SAVE10', taxRate: 0.1, customerId: 'cus_1', email: 'a@example.com', currency: 'eur' };
  const out = await checkout(cart, deps);
  assert.deepEqual(out, { status: 'paid', total: 1980, chargeId: 'ch_1' });
  assert.deepEqual(charges, [{ customerId: 'cus_1', amount: 1980, currency: 'eur' }]);
  assert.deepEqual(mails, [{ to: 'a@example.com', template: 'receipt', data: { total: 1980, chargeId: 'ch_1' } }]);
});

test('free orders are not charged', async () => {
  const { deps, charges } = fakes();
  const out = await checkout({ items: [item(0)], taxRate: 0 }, deps);
  assert.deepEqual(out, { status: 'free', total: 0 });
  assert.equal(charges.length, 0);
});

test('a declined payment throws and sends no receipt', async () => {
  const { deps, mails } = fakes({ ok: false, reason: 'insufficient_funds' });
  await assert.rejects(checkout({ items: [item(500)], taxRate: 0, email: 'a@example.com' }, deps), PaymentDeclinedError);
  assert.equal(mails.length, 0);
});
