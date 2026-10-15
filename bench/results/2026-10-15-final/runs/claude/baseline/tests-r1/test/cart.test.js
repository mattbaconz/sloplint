import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { subtotal, discount, tax, checkout, PaymentDeclinedError } from '../src/cart.js';

function fakes({ charge } = {}) {
  const calls = { charge: [], send: [] };
  const gateway = {
    charge: async (req) => {
      calls.charge.push(req);
      return charge ? charge(req) : { ok: true, id: 'ch_1' };
    },
  };
  const mailer = {
    send: async (msg) => {
      calls.send.push(msg);
    },
  };
  return { gateway, mailer, calls };
}

const baseCart = (over = {}) => ({
  customerId: 'cus_1',
  email: 'a@example.com',
  items: [{ sku: 'A', quantity: 2, unitPrice: 1000 }],
  taxRate: 0,
  ...over,
});

describe('PaymentDeclinedError', () => {
  test('carries name, reason and formatted message', () => {
    const err = new PaymentDeclinedError('insufficient_funds');
    assert.ok(err instanceof Error);
    assert.equal(err.name, 'PaymentDeclinedError');
    assert.equal(err.reason, 'insufficient_funds');
    assert.equal(err.message, 'Payment declined: insufficient_funds');
  });
});

describe('subtotal', () => {
  test('sums unitPrice * quantity across items', () => {
    assert.equal(
      subtotal([
        { sku: 'A', quantity: 2, unitPrice: 500 },
        { sku: 'B', quantity: 3, unitPrice: 100 },
      ]),
      1300,
    );
  });

  test('returns 0 for an empty list', () => {
    assert.equal(subtotal([]), 0);
  });

  test('allows a zero unit price', () => {
    assert.equal(subtotal([{ sku: 'F', quantity: 5, unitPrice: 0 }]), 0);
  });

  for (const quantity of [0, -1, 1.5, '2', NaN, undefined, null]) {
    test(`rejects quantity ${String(quantity)}`, () => {
      assert.throws(
        () => subtotal([{ sku: 'X1', quantity, unitPrice: 100 }]),
        { name: 'RangeError', message: 'Invalid quantity for X1' },
      );
    });
  }

  for (const unitPrice of [-1, 9.99, '100', NaN, undefined, null, Infinity]) {
    test(`rejects unitPrice ${String(unitPrice)}`, () => {
      assert.throws(
        () => subtotal([{ sku: 'X2', quantity: 1, unitPrice }]),
        { name: 'RangeError', message: 'Invalid price for X2' },
      );
    });
  }

  test('reports the first invalid item even after valid ones', () => {
    assert.throws(
      () =>
        subtotal([
          { sku: 'OK', quantity: 1, unitPrice: 100 },
          { sku: 'BAD', quantity: 0, unitPrice: 100 },
        ]),
      /Invalid quantity for BAD/,
    );
  });

  test('checks quantity before price', () => {
    assert.throws(
      () => subtotal([{ sku: 'Z', quantity: 0, unitPrice: -5 }]),
      /Invalid quantity for Z/,
    );
  });
});

describe('discount', () => {
  test('returns 0 for missing codes', () => {
    for (const code of [undefined, null, '']) {
      assert.equal(discount(5000, code), 0);
    }
  });

  test('SAVE10 gives 10% rounded to the nearest cent', () => {
    assert.equal(discount(1000, 'SAVE10'), 100);
    assert.equal(discount(1234, 'SAVE10'), 123);
    assert.equal(discount(1235, 'SAVE10'), 124); // 123.5 rounds up
    assert.equal(discount(0, 'SAVE10'), 0);
  });

  test('codes are case-insensitive', () => {
    assert.equal(discount(1000, 'save10'), 100);
    assert.equal(discount(1000, 'SaVe10'), 100);
    assert.equal(discount(2000, 'flat500'), 500);
  });

  test('FLAT500 applies only at or above 2000', () => {
    assert.equal(discount(1999, 'FLAT500'), 0);
    assert.equal(discount(2000, 'FLAT500'), 500);
    assert.equal(discount(10000, 'FLAT500'), 500);
  });

  test('unknown code throws RangeError naming the code as given', () => {
    assert.throws(() => discount(1000, 'bogus'), {
      name: 'RangeError',
      message: 'Unknown discount code bogus',
    });
  });

  test('does not match inherited object properties as codes', () => {
    assert.throws(() => discount(1000, 'constructor'), RangeError);
  });
});

describe('tax', () => {
  test('computes and rounds tax', () => {
    assert.equal(tax(1000, 0.08), 80);
    assert.equal(tax(999, 0.0825), 82); // 82.4175
    assert.equal(tax(1000, 0), 0);
  });

  test('accepts the inclusive bounds 0 and 0.5', () => {
    assert.equal(tax(1000, 0.5), 500);
    assert.equal(tax(1000, 0), 0);
  });

  for (const rate of [-0.01, 0.51, 1, 8]) {
    test(`rejects rate ${rate}`, () => {
      assert.throws(() => tax(1000, rate), {
        name: 'RangeError',
        message: `Tax rate out of range: ${rate}`,
      });
    });
  }
});

describe('checkout', () => {
  test('charges the computed total, emails a receipt and returns paid', async () => {
    const { gateway, mailer, calls } = fakes({ charge: () => ({ ok: true, id: 'ch_42' }) });
    const result = await checkout(baseCart({ taxRate: 0.1 }), { gateway, mailer });

    assert.deepEqual(result, { status: 'paid', total: 2200, chargeId: 'ch_42' });
    assert.deepEqual(calls.charge, [{ customerId: 'cus_1', amount: 2200, currency: 'usd' }]);
    assert.deepEqual(calls.send, [
      { to: 'a@example.com', template: 'receipt', data: { total: 2200, chargeId: 'ch_42' } },
    ]);
  });

  test('uses the cart currency when provided', async () => {
    const { gateway, mailer, calls } = fakes();
    await checkout(baseCart({ currency: 'eur' }), { gateway, mailer });
    assert.equal(calls.charge[0].currency, 'eur');
  });

  test('defaults currency to usd', async () => {
    const { gateway, mailer, calls } = fakes();
    await checkout(baseCart(), { gateway, mailer });
    assert.equal(calls.charge[0].currency, 'usd');
  });

  test('applies the discount before tax', async () => {
    const { gateway, mailer, calls } = fakes();
    // subtotal 2000, SAVE10 -> net 1800, 10% tax -> 180, total 1980
    const result = await checkout(baseCart({ code: 'SAVE10', taxRate: 0.1 }), { gateway, mailer });
    assert.equal(result.total, 1980);
    assert.equal(calls.charge[0].amount, 1980);
  });

  test('FLAT500 is evaluated against the subtotal', async () => {
    const { gateway, mailer } = fakes();
    const result = await checkout(baseCart({ code: 'FLAT500' }), { gateway, mailer });
    assert.equal(result.total, 1500);
  });

  test('FLAT500 does not apply below the threshold', async () => {
    const { gateway, mailer } = fakes();
    const cart = baseCart({ code: 'FLAT500', items: [{ sku: 'A', quantity: 1, unitPrice: 1999 }] });
    const result = await checkout(cart, { gateway, mailer });
    assert.equal(result.total, 1999);
  });

  test('zero total returns free without charging or emailing', async () => {
    const { gateway, mailer, calls } = fakes();
    const cart = baseCart({ items: [{ sku: 'F', quantity: 1, unitPrice: 0 }] });
    const result = await checkout(cart, { gateway, mailer });

    assert.deepEqual(result, { status: 'free', total: 0 });
    assert.equal(calls.charge.length, 0);
    assert.equal(calls.send.length, 0);
  });

  test('empty cart is free', async () => {
    const { gateway, mailer, calls } = fakes();
    const result = await checkout(baseCart({ items: [] }), { gateway, mailer });
    assert.deepEqual(result, { status: 'free', total: 0 });
    assert.equal(calls.charge.length, 0);
  });

  test('declined charge throws PaymentDeclinedError and sends no receipt', async () => {
    const { gateway, mailer, calls } = fakes({ charge: () => ({ ok: false, reason: 'card_expired' }) });
    await assert.rejects(
      checkout(baseCart(), { gateway, mailer }),
      (err) => {
        assert.ok(err instanceof PaymentDeclinedError);
        assert.equal(err.reason, 'card_expired');
        return true;
      },
    );
    assert.equal(calls.send.length, 0);
  });

  test('invalid items reject before any charge', async () => {
    const { gateway, mailer, calls } = fakes();
    const cart = baseCart({ items: [{ sku: 'A', quantity: 0, unitPrice: 100 }] });
    await assert.rejects(checkout(cart, { gateway, mailer }), RangeError);
    assert.equal(calls.charge.length, 0);
  });

  test('unknown discount code rejects before any charge', async () => {
    const { gateway, mailer, calls } = fakes();
    await assert.rejects(checkout(baseCart({ code: 'NOPE' }), { gateway, mailer }), /Unknown discount code NOPE/);
    assert.equal(calls.charge.length, 0);
  });

  test('out-of-range tax rate rejects before any charge', async () => {
    const { gateway, mailer, calls } = fakes();
    await assert.rejects(checkout(baseCart({ taxRate: 0.9 }), { gateway, mailer }), /Tax rate out of range/);
    assert.equal(calls.charge.length, 0);
  });

  test('gateway errors propagate and skip the receipt', async () => {
    const { mailer, calls } = fakes();
    const gateway = {
      charge: async () => {
        throw new Error('network down');
      },
    };
    await assert.rejects(checkout(baseCart(), { gateway, mailer }), /network down/);
    assert.equal(calls.send.length, 0);
  });

  test('mailer errors propagate after the charge succeeded', async () => {
    const { gateway, calls } = fakes();
    const mailer = {
      send: async () => {
        throw new Error('smtp down');
      },
    };
    await assert.rejects(checkout(baseCart(), { gateway, mailer }), /smtp down/);
    assert.equal(calls.charge.length, 1);
  });
});
