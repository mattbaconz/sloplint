import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { PaymentDeclinedError, subtotal, discount, tax, checkout } from '../src/cart.js';

function fakeGateway(result) {
  const calls = [];
  return {
    calls,
    async charge(args) {
      calls.push(args);
      return typeof result === 'function' ? result(args) : result;
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
  email: 'ada@example.com',
  items: [{ sku: 'PLAN-PRO', unitPrice: 1000, quantity: 2 }],
  taxRate: 0,
};

describe('PaymentDeclinedError', () => {
  test('carries name, reason and a prefixed message', () => {
    const err = new PaymentDeclinedError('insufficient_funds');
    assert.ok(err instanceof Error);
    assert.equal(err.name, 'PaymentDeclinedError');
    assert.equal(err.reason, 'insufficient_funds');
    assert.equal(err.message, 'Payment declined: insufficient_funds');
  });
});

describe('subtotal', () => {
  test('returns 0 for an empty cart', () => {
    assert.equal(subtotal([]), 0);
  });

  test('sums unitPrice * quantity across items', () => {
    const items = [
      { sku: 'A', unitPrice: 250, quantity: 3 },
      { sku: 'B', unitPrice: 1999, quantity: 1 },
    ];
    assert.equal(subtotal(items), 2749);
  });

  test('allows a free item with unitPrice 0', () => {
    assert.equal(subtotal([{ sku: 'FREE', unitPrice: 0, quantity: 5 }]), 0);
  });

  for (const quantity of [0, -1, 1.5, '2', NaN, undefined]) {
    test(`rejects quantity ${String(quantity)}`, () => {
      assert.throws(
        () => subtotal([{ sku: 'BAD', unitPrice: 100, quantity }]),
        { name: 'RangeError', message: 'Invalid quantity for BAD' },
      );
    });
  }

  for (const unitPrice of [-1, 9.99, '100', NaN, undefined]) {
    test(`rejects unitPrice ${String(unitPrice)}`, () => {
      assert.throws(
        () => subtotal([{ sku: 'BAD', unitPrice, quantity: 1 }]),
        { name: 'RangeError', message: 'Invalid price for BAD' },
      );
    });
  }

  test('reports the quantity error before the price error for the same item', () => {
    assert.throws(
      () => subtotal([{ sku: 'X', unitPrice: -5, quantity: 0 }]),
      /Invalid quantity for X/,
    );
  });
});

describe('discount', () => {
  test('returns 0 when no code is given', () => {
    assert.equal(discount(5000, undefined), 0);
    assert.equal(discount(5000, null), 0);
    assert.equal(discount(5000, ''), 0);
  });

  test('SAVE10 takes 10% rounded to the nearest cent', () => {
    assert.equal(discount(5000, 'SAVE10'), 500);
    assert.equal(discount(1234, 'SAVE10'), 123);
    assert.equal(discount(1235, 'SAVE10'), 124);
  });

  test('codes are case-insensitive', () => {
    assert.equal(discount(5000, 'save10'), 500);
    assert.equal(discount(5000, 'Flat500'), 500);
  });

  test('FLAT500 applies 500 only at or above 2000', () => {
    assert.equal(discount(1999, 'FLAT500'), 0);
    assert.equal(discount(2000, 'FLAT500'), 500);
    assert.equal(discount(10000, 'FLAT500'), 500);
  });

  test('throws on an unknown code, naming it', () => {
    assert.throws(() => discount(1000, 'BOGUS'), {
      name: 'RangeError',
      message: 'Unknown discount code BOGUS',
    });
  });

  test('does not resolve inherited object properties as codes', () => {
    assert.throws(() => discount(1000, 'constructor'), RangeError);
  });
});

describe('tax', () => {
  test('rounds to the nearest cent', () => {
    assert.equal(tax(1000, 0.0825), 83);
    assert.equal(tax(999, 0.1), 100);
  });

  test('accepts boundary rates 0 and 0.5', () => {
    assert.equal(tax(1000, 0), 0);
    assert.equal(tax(1000, 0.5), 500);
  });

  test('rejects rates below 0 or above 0.5', () => {
    assert.throws(() => tax(1000, -0.01), /Tax rate out of range: -0.01/);
    assert.throws(() => tax(1000, 0.51), /Tax rate out of range: 0.51/);
  });
});

describe('checkout', () => {
  test('charges subtotal, sends a receipt and returns paid status', async () => {
    const gateway = fakeGateway({ ok: true, id: 'ch_123' });
    const mailer = fakeMailer();

    const result = await checkout(baseCart, { gateway, mailer });

    assert.deepEqual(result, { status: 'paid', total: 2000, chargeId: 'ch_123' });
    assert.deepEqual(gateway.calls, [{ customerId: 'cus_1', amount: 2000, currency: 'usd' }]);
    assert.deepEqual(mailer.sent, [
      { to: 'ada@example.com', template: 'receipt', data: { total: 2000, chargeId: 'ch_123' } },
    ]);
  });

  test('applies discount before tax', async () => {
    const gateway = fakeGateway({ ok: true, id: 'ch_1' });
    const cart = { ...baseCart, code: 'SAVE10', taxRate: 0.1 };

    const result = await checkout(cart, { gateway, mailer: fakeMailer() });

    // 2000 - 200 = 1800, tax 180
    assert.equal(result.total, 1980);
    assert.equal(gateway.calls[0].amount, 1980);
  });

  test('uses the cart currency when provided', async () => {
    const gateway = fakeGateway({ ok: true, id: 'ch_1' });
    await checkout({ ...baseCart, currency: 'eur' }, { gateway, mailer: fakeMailer() });
    assert.equal(gateway.calls[0].currency, 'eur');
  });

  test('returns free without charging or emailing when total is 0', async () => {
    const gateway = fakeGateway({ ok: true, id: 'unused' });
    const mailer = fakeMailer();
    const cart = { ...baseCart, items: [{ sku: 'FREE', unitPrice: 0, quantity: 1 }] };

    const result = await checkout(cart, { gateway, mailer });

    assert.deepEqual(result, { status: 'free', total: 0 });
    assert.equal(gateway.calls.length, 0);
    assert.equal(mailer.sent.length, 0);
  });

  test('FLAT500 below its 2000 threshold leaves the full amount charged', async () => {
    const gateway = fakeGateway({ ok: true, id: 'ch_1' });
    const cart = { ...baseCart, items: [{ sku: 'S', unitPrice: 500, quantity: 1 }], code: 'FLAT500' };
    const result = await checkout(cart, { gateway, mailer: fakeMailer() });
    assert.equal(result.total, 500);
  });

  test('throws PaymentDeclinedError with the gateway reason and sends no email', async () => {
    const gateway = fakeGateway({ ok: false, reason: 'card_declined' });
    const mailer = fakeMailer();

    await assert.rejects(
      checkout(baseCart, { gateway, mailer }),
      (err) => {
        assert.ok(err instanceof PaymentDeclinedError);
        assert.equal(err.reason, 'card_declined');
        return true;
      },
    );
    assert.equal(mailer.sent.length, 0);
  });

  test('propagates validation errors without touching the gateway', async () => {
    const gateway = fakeGateway({ ok: true, id: 'x' });
    const cart = { ...baseCart, items: [{ sku: 'BAD', unitPrice: 100, quantity: 0 }] };

    await assert.rejects(checkout(cart, { gateway, mailer: fakeMailer() }), RangeError);
    assert.equal(gateway.calls.length, 0);
  });

  test('propagates unknown discount code and bad tax rate errors', async () => {
    const deps = { gateway: fakeGateway({ ok: true, id: 'x' }), mailer: fakeMailer() };
    await assert.rejects(checkout({ ...baseCart, code: 'NOPE' }, deps), /Unknown discount code NOPE/);
    await assert.rejects(checkout({ ...baseCart, taxRate: 0.9 }, deps), /Tax rate out of range/);
    assert.equal(deps.gateway.calls.length, 0);
  });

  test('propagates gateway failures', async () => {
    const gateway = {
      async charge() {
        throw new Error('network down');
      },
    };
    await assert.rejects(checkout(baseCart, { gateway, mailer: fakeMailer() }), /network down/);
  });

  test('propagates mailer failures after the charge was made', async () => {
    const gateway = fakeGateway({ ok: true, id: 'ch_9' });
    const mailer = {
      async send() {
        throw new Error('smtp unavailable');
      },
    };
    await assert.rejects(checkout(baseCart, { gateway, mailer }), /smtp unavailable/);
    assert.equal(gateway.calls.length, 1);
  });
});
