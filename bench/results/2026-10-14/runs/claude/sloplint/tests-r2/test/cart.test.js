import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PaymentDeclinedError, subtotal, discount, tax, checkout } from '../src/cart.js';

function fakeGateway(response = { ok: true, id: 'ch_123' }) {
  const charges = [];
  return {
    charges,
    async charge(req) {
      charges.push(req);
      return typeof response === 'function' ? response(req) : response;
    },
  };
}

function fakeMailer({ fail = false } = {}) {
  const sent = [];
  return {
    sent,
    async send(msg) {
      if (fail) throw new Error('smtp down');
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
    assert.equal(subtotal([item('A', 1500, 2), item('B', 250, 4)]), 4000);
  });

  it('accepts a free item (price 0)', () => {
    assert.equal(subtotal([item('FREE', 0, 3)]), 0);
  });

  for (const quantity of [0, -1, 1.5, NaN, '2', undefined]) {
    it(`rejects quantity ${String(quantity)} and names the sku`, () => {
      assert.throws(
        () => subtotal([item('SKU-9', 100, quantity)]),
        (err) => err instanceof RangeError && /Invalid quantity for SKU-9/.test(err.message),
      );
    });
  }

  for (const unitPrice of [-1, 9.99, NaN, '100', undefined]) {
    it(`rejects unit price ${String(unitPrice)} and names the sku`, () => {
      assert.throws(
        () => subtotal([item('SKU-7', unitPrice, 1)]),
        (err) => err instanceof RangeError && /Invalid price for SKU-7/.test(err.message),
      );
    });
  }

  it('rejects the whole cart when any line is invalid', () => {
    assert.throws(() => subtotal([item('OK', 100, 1), item('BAD', 100, 0)]), /Invalid quantity for BAD/);
  });
});

describe('discount', () => {
  it('returns 0 when no code is given', () => {
    assert.equal(discount(5000, undefined), 0);
    assert.equal(discount(5000, null), 0);
    assert.equal(discount(5000, ''), 0);
  });

  it('SAVE10 takes 10% of the amount', () => {
    assert.equal(discount(5000, 'SAVE10'), 500);
  });

  it('SAVE10 rounds to the nearest cent', () => {
    assert.equal(discount(15, 'SAVE10'), 2); // 1.5 rounds up
    assert.equal(discount(14, 'SAVE10'), 1); // 1.4 rounds down
  });

  it('SAVE10 on 0 is 0', () => {
    assert.equal(discount(0, 'SAVE10'), 0);
  });

  it('FLAT500 takes 500 at exactly the 2000 threshold', () => {
    assert.equal(discount(2000, 'FLAT500'), 500);
  });

  it('FLAT500 gives nothing below the threshold', () => {
    assert.equal(discount(1999, 'FLAT500'), 0);
  });

  it('codes are case-insensitive', () => {
    assert.equal(discount(5000, 'save10'), 500);
    assert.equal(discount(5000, 'Flat500'), 500);
  });

  it('rejects unknown codes and includes the code in the message', () => {
    assert.throws(
      () => discount(5000, 'BOGUS'),
      (err) => err instanceof RangeError && /Unknown discount code BOGUS/.test(err.message),
    );
  });

  it('does not treat object prototype keys as codes', () => {
    assert.throws(() => discount(5000, 'constructor'), RangeError);
  });
});

describe('tax', () => {
  it('computes tax rounded to the nearest cent', () => {
    assert.equal(tax(1000, 0.08), 80);
    assert.equal(tax(999, 0.0825), 82); // 82.42
    assert.equal(tax(1, 0.5), 1); // 0.5 rounds up
  });

  it('allows a 0 rate', () => {
    assert.equal(tax(1000, 0), 0);
  });

  it('allows the 0.5 upper bound', () => {
    assert.equal(tax(1000, 0.5), 500);
  });

  it('rejects negative rates', () => {
    assert.throws(() => tax(1000, -0.01), /Tax rate out of range: -0.01/);
  });

  it('rejects rates above 0.5', () => {
    assert.throws(
      () => tax(1000, 0.51),
      (err) => err instanceof RangeError && /Tax rate out of range: 0.51/.test(err.message),
    );
  });
});

describe('PaymentDeclinedError', () => {
  it('carries a name, reason and prefixed message', () => {
    const err = new PaymentDeclinedError('insufficient_funds');
    assert.ok(err instanceof Error);
    assert.equal(err.name, 'PaymentDeclinedError');
    assert.equal(err.reason, 'insufficient_funds');
    assert.equal(err.message, 'Payment declined: insufficient_funds');
  });
});

describe('checkout', () => {
  const baseCart = {
    customerId: 'cus_42',
    email: 'ana@example.com',
    items: [item('PLAN-PRO', 2500, 2)],
    taxRate: 0,
  };

  it('charges the total, emails a receipt and returns paid status', async () => {
    const gateway = fakeGateway({ ok: true, id: 'ch_abc' });
    const mailer = fakeMailer();

    const result = await checkout(baseCart, { gateway, mailer });

    assert.deepEqual(result, { status: 'paid', total: 5000, chargeId: 'ch_abc' });
    assert.deepEqual(gateway.charges, [{ customerId: 'cus_42', amount: 5000, currency: 'usd' }]);
    assert.deepEqual(mailer.sent, [
      { to: 'ana@example.com', template: 'receipt', data: { total: 5000, chargeId: 'ch_abc' } },
    ]);
  });

  it('applies discount before tax', async () => {
    const gateway = fakeGateway();
    const cart = { ...baseCart, items: [item('A', 10000, 1)], code: 'SAVE10', taxRate: 0.1 };

    const result = await checkout(cart, { gateway, mailer: fakeMailer() });

    // 10000 - 1000 = 9000; tax 900; total 9900
    assert.equal(result.total, 9900);
    assert.equal(gateway.charges[0].amount, 9900);
  });

  it('applies a flat discount code', async () => {
    const cart = { ...baseCart, items: [item('A', 2000, 1)], code: 'flat500' };
    const result = await checkout(cart, { gateway: fakeGateway(), mailer: fakeMailer() });
    assert.equal(result.total, 1500);
  });

  it('uses the cart currency when provided', async () => {
    const gateway = fakeGateway();
    await checkout({ ...baseCart, currency: 'eur' }, { gateway, mailer: fakeMailer() });
    assert.equal(gateway.charges[0].currency, 'eur');
  });

  it('defaults currency to usd', async () => {
    const gateway = fakeGateway();
    await checkout(baseCart, { gateway, mailer: fakeMailer() });
    assert.equal(gateway.charges[0].currency, 'usd');
  });

  it('returns free status without charging or emailing when total is 0', async () => {
    const gateway = fakeGateway();
    const mailer = fakeMailer();
    const cart = { ...baseCart, items: [item('TRIAL', 0, 1)] };

    const result = await checkout(cart, { gateway, mailer });

    assert.deepEqual(result, { status: 'free', total: 0 });
    assert.equal(gateway.charges.length, 0);
    assert.equal(mailer.sent.length, 0);
  });

  it('treats an empty cart as free', async () => {
    const result = await checkout({ ...baseCart, items: [] }, { gateway: fakeGateway(), mailer: fakeMailer() });
    assert.deepEqual(result, { status: 'free', total: 0 });
  });

  it('throws PaymentDeclinedError with the gateway reason and sends no receipt', async () => {
    const gateway = fakeGateway({ ok: false, reason: 'card_declined' });
    const mailer = fakeMailer();

    await assert.rejects(
      checkout(baseCart, { gateway, mailer }),
      (err) =>
        err instanceof PaymentDeclinedError &&
        err.reason === 'card_declined' &&
        err.message === 'Payment declined: card_declined',
    );
    assert.equal(mailer.sent.length, 0);
  });

  it('rejects an invalid cart before touching the gateway', async () => {
    const gateway = fakeGateway();
    const cart = { ...baseCart, items: [item('BAD', 100, 0)] };

    await assert.rejects(checkout(cart, { gateway, mailer: fakeMailer() }), RangeError);
    assert.equal(gateway.charges.length, 0);
  });

  it('rejects an unknown discount code before charging', async () => {
    const gateway = fakeGateway();
    await assert.rejects(
      checkout({ ...baseCart, code: 'NOPE' }, { gateway, mailer: fakeMailer() }),
      /Unknown discount code NOPE/,
    );
    assert.equal(gateway.charges.length, 0);
  });

  it('rejects an out-of-range tax rate before charging', async () => {
    const gateway = fakeGateway();
    await assert.rejects(
      checkout({ ...baseCart, taxRate: 0.9 }, { gateway, mailer: fakeMailer() }),
      /Tax rate out of range/,
    );
    assert.equal(gateway.charges.length, 0);
  });

  it('propagates gateway errors', async () => {
    const gateway = {
      async charge() {
        throw new Error('network timeout');
      },
    };
    const mailer = fakeMailer();

    await assert.rejects(checkout(baseCart, { gateway, mailer }), /network timeout/);
    assert.equal(mailer.sent.length, 0);
  });

  it('propagates mailer failures after the customer was charged', async () => {
    const gateway = fakeGateway();

    await assert.rejects(checkout(baseCart, { gateway, mailer: fakeMailer({ fail: true }) }), /smtp down/);
    assert.equal(gateway.charges.length, 1);
  });
});
