import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PaymentDeclinedError, subtotal, discount, tax, checkout } from '../src/cart.js';

function fakeGateway(result) {
  const calls = [];
  return {
    calls,
    async charge(req) {
      calls.push(req);
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

describe('PaymentDeclinedError', () => {
  it('carries the reason and a prefixed message', () => {
    const err = new PaymentDeclinedError('insufficient_funds');
    assert.ok(err instanceof Error);
    assert.equal(err.name, 'PaymentDeclinedError');
    assert.equal(err.reason, 'insufficient_funds');
    assert.equal(err.message, 'Payment declined: insufficient_funds');
  });
});

describe('subtotal', () => {
  it('returns 0 for an empty cart', () => {
    assert.equal(subtotal([]), 0);
  });

  it('sums unitPrice * quantity across items', () => {
    assert.equal(subtotal([item('a', 1000, 2), item('b', 250, 3)]), 2750);
  });

  it('allows free items with a zero price', () => {
    assert.equal(subtotal([item('free', 0, 5)]), 0);
  });

  for (const quantity of [0, -1, 1.5, '2', NaN, undefined]) {
    it(`rejects quantity ${String(quantity)}`, () => {
      assert.throws(() => subtotal([item('bad', 100, quantity)]), {
        name: 'RangeError',
        message: 'Invalid quantity for bad',
      });
    });
  }

  for (const unitPrice of [-1, 9.99, '100', NaN, undefined]) {
    it(`rejects unit price ${String(unitPrice)}`, () => {
      assert.throws(() => subtotal([item('bad', unitPrice, 1)]), {
        name: 'RangeError',
        message: 'Invalid price for bad',
      });
    });
  }
});

describe('discount', () => {
  it('returns 0 when no code is given', () => {
    assert.equal(discount(5000, undefined), 0);
    assert.equal(discount(5000, ''), 0);
    assert.equal(discount(5000, null), 0);
  });

  it('SAVE10 takes 10% rounded to the nearest cent', () => {
    assert.equal(discount(5000, 'SAVE10'), 500);
    assert.equal(discount(1234, 'SAVE10'), 123);
    assert.equal(discount(1235, 'SAVE10'), 124);
  });

  it('matches codes case-insensitively', () => {
    assert.equal(discount(5000, 'save10'), 500);
    assert.equal(discount(2000, 'Flat500'), 500);
  });

  it('FLAT500 applies only at or above 2000 cents', () => {
    assert.equal(discount(1999, 'FLAT500'), 0);
    assert.equal(discount(2000, 'FLAT500'), 500);
    assert.equal(discount(10000, 'FLAT500'), 500);
  });

  it('throws on an unknown code', () => {
    assert.throws(() => discount(1000, 'BOGUS'), {
      name: 'RangeError',
      message: 'Unknown discount code BOGUS',
    });
  });
});

describe('tax', () => {
  it('computes tax rounded to the nearest cent', () => {
    assert.equal(tax(1000, 0.2), 200);
    assert.equal(tax(999, 0.0825), 82);
  });

  it('returns 0 for a zero rate or zero amount', () => {
    assert.equal(tax(1000, 0), 0);
    assert.equal(tax(0, 0.2), 0);
  });

  it('accepts the boundary rates 0 and 0.5', () => {
    assert.equal(tax(1000, 0.5), 500);
  });

  it('rejects rates outside 0..0.5', () => {
    assert.throws(() => tax(1000, -0.01), { name: 'RangeError', message: 'Tax rate out of range: -0.01' });
    assert.throws(() => tax(1000, 0.51), { name: 'RangeError', message: 'Tax rate out of range: 0.51' });
  });
});

describe('checkout', () => {
  const baseCart = {
    items: [item('plan', 2500, 2)],
    customerId: 'cus_1',
    email: 'ada@example.com',
    taxRate: 0.1,
  };

  it('charges subtotal plus tax, emails a receipt and returns paid', async () => {
    const gateway = fakeGateway({ ok: true, id: 'ch_1' });
    const mailer = fakeMailer();
    const result = await checkout(baseCart, { gateway, mailer });

    assert.deepEqual(result, { status: 'paid', total: 5500, chargeId: 'ch_1' });
    assert.deepEqual(gateway.calls, [{ customerId: 'cus_1', amount: 5500, currency: 'usd' }]);
    assert.deepEqual(mailer.sent, [
      { to: 'ada@example.com', template: 'receipt', data: { total: 5500, chargeId: 'ch_1' } },
    ]);
  });

  it('applies the discount before tax', async () => {
    const gateway = fakeGateway({ ok: true, id: 'ch_2' });
    const result = await checkout({ ...baseCart, code: 'SAVE10' }, { gateway, mailer: fakeMailer() });
    // 5000 - 500 = 4500; tax 450
    assert.equal(result.total, 4950);
    assert.equal(gateway.calls[0].amount, 4950);
  });

  it('uses the cart currency when provided', async () => {
    const gateway = fakeGateway({ ok: true, id: 'ch_3' });
    await checkout({ ...baseCart, currency: 'eur' }, { gateway, mailer: fakeMailer() });
    assert.equal(gateway.calls[0].currency, 'eur');
  });

  it('returns free without charging or emailing when the total is 0', async () => {
    const gateway = fakeGateway({ ok: true, id: 'unused' });
    const mailer = fakeMailer();
    const result = await checkout({ ...baseCart, items: [item('promo', 0, 1)] }, { gateway, mailer });

    assert.deepEqual(result, { status: 'free', total: 0 });
    assert.equal(gateway.calls.length, 0);
    assert.equal(mailer.sent.length, 0);
  });

  it('throws PaymentDeclinedError with the gateway reason and sends no receipt', async () => {
    const gateway = fakeGateway({ ok: false, reason: 'card_declined' });
    const mailer = fakeMailer();

    await assert.rejects(checkout(baseCart, { gateway, mailer }), (err) => {
      assert.ok(err instanceof PaymentDeclinedError);
      assert.equal(err.reason, 'card_declined');
      return true;
    });
    assert.equal(mailer.sent.length, 0);
  });

  it('rejects before charging when an item is invalid', async () => {
    const gateway = fakeGateway({ ok: true, id: 'x' });
    await assert.rejects(
      checkout({ ...baseCart, items: [item('bad', 100, 0)] }, { gateway, mailer: fakeMailer() }),
      RangeError,
    );
    assert.equal(gateway.calls.length, 0);
  });

  it('rejects before charging on an unknown discount code or bad tax rate', async () => {
    const gateway = fakeGateway({ ok: true, id: 'x' });
    await assert.rejects(checkout({ ...baseCart, code: 'NOPE' }, { gateway, mailer: fakeMailer() }), RangeError);
    await assert.rejects(checkout({ ...baseCart, taxRate: 0.9 }, { gateway, mailer: fakeMailer() }), RangeError);
    assert.equal(gateway.calls.length, 0);
  });

  it('propagates gateway errors', async () => {
    const gateway = {
      async charge() {
        throw new Error('network down');
      },
    };
    await assert.rejects(checkout(baseCart, { gateway, mailer: fakeMailer() }), { message: 'network down' });
  });

  it('propagates mailer errors after the charge has been made', async () => {
    const gateway = fakeGateway({ ok: true, id: 'ch_9' });
    const mailer = {
      async send() {
        throw new Error('smtp unavailable');
      },
    };
    await assert.rejects(checkout(baseCart, { gateway, mailer }), { message: 'smtp unavailable' });
    assert.equal(gateway.calls.length, 1);
  });
});
