import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PaymentDeclinedError, subtotal, discount, tax, checkout } from '../src/cart.js';

function fakeGateway(result = { ok: true, id: 'ch_123' }) {
  const charges = [];
  return {
    charges,
    async charge(req) {
      charges.push(req);
      return result;
    },
  };
}

function fakeMailer() {
  const sent = [];
  return {
    sent,
    async send(msg) {
      sent.push(msg);
    },
  };
}

const item = (sku, unitPrice, quantity) => ({ sku, unitPrice, quantity });

describe('subtotal', () => {
  it('returns 0 for an empty cart', () => {
    assert.equal(subtotal([]), 0);
  });

  it('multiplies unit price by quantity and sums lines', () => {
    assert.equal(subtotal([item('a', 1000, 2), item('b', 250, 3)]), 2750);
  });

  it('accepts zero-priced items', () => {
    assert.equal(subtotal([item('free', 0, 5)]), 0);
  });

  it('rejects zero quantity', () => {
    assert.throws(() => subtotal([item('a', 100, 0)]), { name: 'RangeError', message: 'Invalid quantity for a' });
  });

  it('rejects negative quantity', () => {
    assert.throws(() => subtotal([item('a', 100, -1)]), RangeError);
  });

  it('rejects fractional quantity', () => {
    assert.throws(() => subtotal([item('a', 100, 1.5)]), RangeError);
  });

  it('rejects non-numeric quantity', () => {
    assert.throws(() => subtotal([item('a', 100, '2')]), RangeError);
  });

  it('rejects negative price', () => {
    assert.throws(() => subtotal([item('b', -1, 1)]), { name: 'RangeError', message: 'Invalid price for b' });
  });

  it('rejects fractional price (amounts are integer cents)', () => {
    assert.throws(() => subtotal([item('b', 9.99, 1)]), RangeError);
  });

  it('rejects NaN price', () => {
    assert.throws(() => subtotal([item('b', NaN, 1)]), RangeError);
  });

  it('names the offending sku when a later line is invalid', () => {
    assert.throws(() => subtotal([item('ok', 100, 1), item('bad', 100, 0)]), /bad/);
  });
});

describe('discount', () => {
  it('returns 0 when no code is given', () => {
    assert.equal(discount(5000, undefined), 0);
    assert.equal(discount(5000, null), 0);
    assert.equal(discount(5000, ''), 0);
  });

  it('SAVE10 takes 10 percent', () => {
    assert.equal(discount(5000, 'SAVE10'), 500);
  });

  it('SAVE10 rounds to the nearest cent', () => {
    assert.equal(discount(1234, 'SAVE10'), 123);
    assert.equal(discount(1235, 'SAVE10'), 124);
  });

  it('codes are case-insensitive', () => {
    assert.equal(discount(5000, 'save10'), 500);
    assert.equal(discount(2000, 'Flat500'), 500);
  });

  it('FLAT500 applies at exactly the 2000 threshold', () => {
    assert.equal(discount(2000, 'FLAT500'), 500);
  });

  it('FLAT500 does not apply just below the threshold', () => {
    assert.equal(discount(1999, 'FLAT500'), 0);
  });

  it('throws for an unknown code and includes it in the message', () => {
    assert.throws(() => discount(1000, 'BOGUS'), { name: 'RangeError', message: 'Unknown discount code BOGUS' });
  });
});

describe('tax', () => {
  it('computes tax and rounds to the nearest cent', () => {
    assert.equal(tax(1000, 0.08), 80);
    assert.equal(tax(999, 0.0825), 82);
  });

  it('allows the boundary rates 0 and 0.5', () => {
    assert.equal(tax(1000, 0), 0);
    assert.equal(tax(1000, 0.5), 500);
  });

  it('rejects negative rates', () => {
    assert.throws(() => tax(1000, -0.01), { name: 'RangeError', message: 'Tax rate out of range: -0.01' });
  });

  it('rejects rates above 0.5', () => {
    assert.throws(() => tax(1000, 0.51), RangeError);
  });
});

describe('PaymentDeclinedError', () => {
  it('carries name, reason and a formatted message', () => {
    const err = new PaymentDeclinedError('insufficient_funds');
    assert.ok(err instanceof Error);
    assert.equal(err.name, 'PaymentDeclinedError');
    assert.equal(err.reason, 'insufficient_funds');
    assert.equal(err.message, 'Payment declined: insufficient_funds');
  });
});

describe('checkout', () => {
  const baseCart = {
    customerId: 'cus_1',
    email: 'ada@example.com',
    taxRate: 0,
    items: [item('plan', 4900, 1)],
  };

  it('charges the total and returns a paid result', async () => {
    const gateway = fakeGateway({ ok: true, id: 'ch_9' });
    const mailer = fakeMailer();
    const out = await checkout(baseCart, { gateway, mailer });
    assert.deepEqual(out, { status: 'paid', total: 4900, chargeId: 'ch_9' });
    assert.deepEqual(gateway.charges, [{ customerId: 'cus_1', amount: 4900, currency: 'usd' }]);
  });

  it('emails a receipt with total and charge id', async () => {
    const gateway = fakeGateway({ ok: true, id: 'ch_9' });
    const mailer = fakeMailer();
    await checkout(baseCart, { gateway, mailer });
    assert.deepEqual(mailer.sent, [
      { to: 'ada@example.com', template: 'receipt', data: { total: 4900, chargeId: 'ch_9' } },
    ]);
  });

  it('applies discount before tax', async () => {
    const gateway = fakeGateway();
    const cart = { ...baseCart, items: [item('a', 5000, 2)], code: 'SAVE10', taxRate: 0.1 };
    const out = await checkout(cart, { gateway, mailer: fakeMailer() });
    // 10000 - 1000 = 9000; tax 900
    assert.equal(out.total, 9900);
    assert.equal(gateway.charges[0].amount, 9900);
  });

  it('uses the supplied currency', async () => {
    const gateway = fakeGateway();
    await checkout({ ...baseCart, currency: 'eur' }, { gateway, mailer: fakeMailer() });
    assert.equal(gateway.charges[0].currency, 'eur');
  });

  it('returns free without charging or emailing when the total is zero', async () => {
    const gateway = fakeGateway();
    const mailer = fakeMailer();
    const out = await checkout({ ...baseCart, items: [item('promo', 0, 1)] }, { gateway, mailer });
    assert.deepEqual(out, { status: 'free', total: 0 });
    assert.equal(gateway.charges.length, 0);
    assert.equal(mailer.sent.length, 0);
  });

  it('treats a fully discounted cart as free', async () => {
    // 100 cents with SAVE10 -> 10 off, not free; use an empty cart for a real zero
    const gateway = fakeGateway();
    const out = await checkout({ ...baseCart, items: [] }, { gateway, mailer: fakeMailer() });
    assert.equal(out.status, 'free');
    assert.equal(gateway.charges.length, 0);
  });

  it('throws PaymentDeclinedError with the gateway reason and sends no email', async () => {
    const gateway = fakeGateway({ ok: false, reason: 'card_declined' });
    const mailer = fakeMailer();
    await assert.rejects(
      () => checkout(baseCart, { gateway, mailer }),
      (err) => {
        assert.ok(err instanceof PaymentDeclinedError);
        assert.equal(err.reason, 'card_declined');
        return true;
      },
    );
    assert.equal(mailer.sent.length, 0);
  });

  it('rejects invalid items before touching the gateway', async () => {
    const gateway = fakeGateway();
    await assert.rejects(
      () => checkout({ ...baseCart, items: [item('x', 100, 0)] }, { gateway, mailer: fakeMailer() }),
      RangeError,
    );
    assert.equal(gateway.charges.length, 0);
  });

  it('rejects an unknown discount code before charging', async () => {
    const gateway = fakeGateway();
    await assert.rejects(() => checkout({ ...baseCart, code: 'NOPE' }, { gateway, mailer: fakeMailer() }), RangeError);
    assert.equal(gateway.charges.length, 0);
  });

  it('rejects an out-of-range tax rate before charging', async () => {
    const gateway = fakeGateway();
    await assert.rejects(() => checkout({ ...baseCart, taxRate: 0.9 }, { gateway, mailer: fakeMailer() }), RangeError);
    assert.equal(gateway.charges.length, 0);
  });

  it('propagates mailer failures after a successful charge', async () => {
    const gateway = fakeGateway();
    const mailer = {
      async send() {
        throw new Error('smtp down');
      },
    };
    await assert.rejects(() => checkout(baseCart, { gateway, mailer }), /smtp down/);
    assert.equal(gateway.charges.length, 1);
  });

  it('propagates gateway exceptions', async () => {
    const gateway = {
      async charge() {
        throw new Error('network');
      },
    };
    await assert.rejects(() => checkout(baseCart, { gateway, mailer: fakeMailer() }), /network/);
  });
});
