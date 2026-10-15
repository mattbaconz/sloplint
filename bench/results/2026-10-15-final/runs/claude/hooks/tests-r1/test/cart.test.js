import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PaymentDeclinedError, subtotal, discount, tax, checkout } from '../src/cart.js';

function fakeGateway(result) {
  const calls = [];
  return {
    calls,
    async charge(args) {
      calls.push(args);
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

const baseCart = {
  customerId: 'cus_1',
  email: 'ana@example.com',
  items: [{ sku: 'PLAN-PRO', unitPrice: 1000, quantity: 2 }],
};

describe('PaymentDeclinedError', () => {
  it('carries name, reason and a prefixed message', () => {
    const err = new PaymentDeclinedError('card_expired');
    assert.ok(err instanceof Error);
    assert.equal(err.name, 'PaymentDeclinedError');
    assert.equal(err.reason, 'card_expired');
    assert.equal(err.message, 'Payment declined: card_expired');
  });
});

describe('subtotal', () => {
  it('returns 0 for an empty cart', () => {
    assert.equal(subtotal([]), 0);
  });

  it('sums unitPrice * quantity across items', () => {
    const items = [
      { sku: 'A', unitPrice: 250, quantity: 3 },
      { sku: 'B', unitPrice: 1999, quantity: 1 },
    ];
    assert.equal(subtotal(items), 2749);
  });

  it('allows a zero unit price', () => {
    assert.equal(subtotal([{ sku: 'FREE', unitPrice: 0, quantity: 5 }]), 0);
  });

  for (const quantity of [0, -1, 1.5, '2', NaN, undefined]) {
    it(`rejects quantity ${String(quantity)}`, () => {
      assert.throws(
        () => subtotal([{ sku: 'X1', unitPrice: 100, quantity }]),
        { name: 'RangeError', message: 'Invalid quantity for X1' },
      );
    });
  }

  for (const unitPrice of [-1, 9.99, '100', NaN, undefined]) {
    it(`rejects unit price ${String(unitPrice)}`, () => {
      assert.throws(
        () => subtotal([{ sku: 'Y2', unitPrice, quantity: 1 }]),
        { name: 'RangeError', message: 'Invalid price for Y2' },
      );
    });
  }

  it('reports the sku of the first invalid item', () => {
    const items = [
      { sku: 'OK', unitPrice: 100, quantity: 1 },
      { sku: 'BAD', unitPrice: 100, quantity: 0 },
    ];
    assert.throws(() => subtotal(items), /BAD/);
  });
});

describe('discount', () => {
  it('returns 0 when no code is given', () => {
    assert.equal(discount(5000, undefined), 0);
    assert.equal(discount(5000, null), 0);
    assert.equal(discount(5000, ''), 0);
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

  it('FLAT500 applies only at 2000 cents or more', () => {
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
  it('rounds to the nearest cent', () => {
    assert.equal(tax(1000, 0.0825), 83);
    assert.equal(tax(999, 0.1), 100);
  });

  it('returns 0 for a zero rate or zero amount', () => {
    assert.equal(tax(1000, 0), 0);
    assert.equal(tax(0, 0.2), 0);
  });

  it('accepts the boundary rates 0 and 0.5', () => {
    assert.equal(tax(1000, 0.5), 500);
  });

  it('rejects rates below 0 or above 0.5', () => {
    assert.throws(() => tax(1000, -0.01), { name: 'RangeError', message: 'Tax rate out of range: -0.01' });
    assert.throws(() => tax(1000, 0.51), /Tax rate out of range: 0.51/);
  });
});

describe('checkout', () => {
  it('charges subtotal plus tax and sends a receipt', async () => {
    const gateway = fakeGateway({ ok: true, id: 'ch_123' });
    const mailer = fakeMailer();
    const result = await checkout({ ...baseCart, taxRate: 0.1 }, { gateway, mailer });

    assert.deepEqual(result, { status: 'paid', total: 2200, chargeId: 'ch_123' });
    assert.deepEqual(gateway.calls, [{ customerId: 'cus_1', amount: 2200, currency: 'usd' }]);
    assert.deepEqual(mailer.sent, [
      { to: 'ana@example.com', template: 'receipt', data: { total: 2200, chargeId: 'ch_123' } },
    ]);
  });

  it('applies the discount before tax', async () => {
    const gateway = fakeGateway({ ok: true, id: 'ch_2' });
    const mailer = fakeMailer();
    // 2000 - 200 (SAVE10) = 1800; tax 10% = 180
    const result = await checkout({ ...baseCart, code: 'SAVE10', taxRate: 0.1 }, { gateway, mailer });
    assert.equal(result.total, 1980);
    assert.equal(gateway.calls[0].amount, 1980);
  });

  it('uses the cart currency when provided', async () => {
    const gateway = fakeGateway({ ok: true, id: 'ch_3' });
    await checkout({ ...baseCart, taxRate: 0, currency: 'eur' }, { gateway, mailer: fakeMailer() });
    assert.equal(gateway.calls[0].currency, 'eur');
  });

  it('returns free without charging or emailing when the total is 0', async () => {
    const gateway = fakeGateway({ ok: true, id: 'unused' });
    const mailer = fakeMailer();
    const cart = { ...baseCart, items: [{ sku: 'TRIAL', unitPrice: 0, quantity: 1 }], taxRate: 0.1 };
    const result = await checkout(cart, { gateway, mailer });

    assert.deepEqual(result, { status: 'free', total: 0 });
    assert.equal(gateway.calls.length, 0);
    assert.equal(mailer.sent.length, 0);
  });

  it('throws PaymentDeclinedError and sends no receipt when the gateway declines', async () => {
    const gateway = fakeGateway({ ok: false, reason: 'insufficient_funds' });
    const mailer = fakeMailer();
    await assert.rejects(
      checkout({ ...baseCart, taxRate: 0 }, { gateway, mailer }),
      (err) => {
        assert.ok(err instanceof PaymentDeclinedError);
        assert.equal(err.reason, 'insufficient_funds');
        return true;
      },
    );
    assert.equal(mailer.sent.length, 0);
  });

  it('propagates validation errors without touching the gateway', async () => {
    const gateway = fakeGateway({ ok: true, id: 'x' });
    const mailer = fakeMailer();
    const bad = { ...baseCart, items: [{ sku: 'Z', unitPrice: 100, quantity: 0 }], taxRate: 0 };
    await assert.rejects(checkout(bad, { gateway, mailer }), RangeError);
    await assert.rejects(checkout({ ...baseCart, code: 'NOPE', taxRate: 0 }, { gateway, mailer }), /Unknown discount code/);
    await assert.rejects(checkout({ ...baseCart, taxRate: 0.9 }, { gateway, mailer }), /Tax rate out of range/);
    assert.equal(gateway.calls.length, 0);
  });

  it('propagates mailer failures after the charge succeeded', async () => {
    const gateway = fakeGateway({ ok: true, id: 'ch_9' });
    const mailer = {
      async send() {
        throw new Error('smtp down');
      },
    };
    await assert.rejects(checkout({ ...baseCart, taxRate: 0 }, { gateway, mailer }), /smtp down/);
    assert.equal(gateway.calls.length, 1);
  });
});
