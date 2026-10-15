import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PaymentDeclinedError, subtotal, discount, tax, checkout } from '../src/cart.js';

function fakeDeps({ chargeResult = { ok: true, id: 'ch_1' } } = {}) {
  const charges = [];
  const emails = [];
  return {
    charges,
    emails,
    gateway: {
      async charge(req) {
        charges.push(req);
        return chargeResult;
      },
    },
    mailer: {
      async send(msg) {
        emails.push(msg);
      },
    },
  };
}

const baseCart = (overrides = {}) => ({
  customerId: 'cus_1',
  email: 'a@example.com',
  items: [{ sku: 'A', quantity: 2, unitPrice: 1000 }],
  taxRate: 0,
  ...overrides,
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

describe('subtotal', () => {
  it('returns 0 for an empty cart', () => {
    assert.equal(subtotal([]), 0);
  });

  it('sums unitPrice * quantity across items', () => {
    const items = [
      { sku: 'A', quantity: 2, unitPrice: 500 },
      { sku: 'B', quantity: 1, unitPrice: 799 },
      { sku: 'C', quantity: 3, unitPrice: 100 },
    ];
    assert.equal(subtotal(items), 2099);
  });

  it('allows free (0-priced) items', () => {
    assert.equal(subtotal([{ sku: 'F', quantity: 4, unitPrice: 0 }]), 0);
  });

  for (const [label, quantity] of [
    ['zero', 0],
    ['negative', -1],
    ['fractional', 1.5],
    ['NaN', NaN],
    ['string', '2'],
    ['undefined', undefined],
  ]) {
    it(`rejects ${label} quantity`, () => {
      assert.throws(
        () => subtotal([{ sku: 'BAD', quantity, unitPrice: 100 }]),
        (e) => e instanceof RangeError && /Invalid quantity for BAD/.test(e.message),
      );
    });
  }

  for (const [label, unitPrice] of [
    ['negative', -1],
    ['fractional', 9.99],
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['string', '100'],
    ['undefined', undefined],
  ]) {
    it(`rejects ${label} unitPrice`, () => {
      assert.throws(
        () => subtotal([{ sku: 'BAD', quantity: 1, unitPrice }]),
        (e) => e instanceof RangeError && /Invalid price for BAD/.test(e.message),
      );
    });
  }

  it('validates every item, not just the first', () => {
    assert.throws(
      () =>
        subtotal([
          { sku: 'OK', quantity: 1, unitPrice: 100 },
          { sku: 'BAD', quantity: 0, unitPrice: 100 },
        ]),
      /Invalid quantity for BAD/,
    );
  });

  it('checks quantity before price', () => {
    assert.throws(
      () => subtotal([{ sku: 'X', quantity: 0, unitPrice: -5 }]),
      /Invalid quantity for X/,
    );
  });
});

describe('discount', () => {
  it('returns 0 when no code is given', () => {
    assert.equal(discount(10000, undefined), 0);
    assert.equal(discount(10000, null), 0);
    assert.equal(discount(10000, ''), 0);
  });

  it('SAVE10 takes 10% rounded to the nearest cent', () => {
    assert.equal(discount(10000, 'SAVE10'), 1000);
    assert.equal(discount(1234, 'SAVE10'), 123);
    assert.equal(discount(1235, 'SAVE10'), 124); // 123.5 rounds up
    assert.equal(discount(0, 'SAVE10'), 0);
  });

  it('FLAT500 gives 500 off at or above the 2000 threshold', () => {
    assert.equal(discount(2000, 'FLAT500'), 500);
    assert.equal(discount(50000, 'FLAT500'), 500);
  });

  it('FLAT500 gives nothing below the 2000 threshold', () => {
    assert.equal(discount(1999, 'FLAT500'), 0);
    assert.equal(discount(0, 'FLAT500'), 0);
  });

  it('is case-insensitive on the code', () => {
    assert.equal(discount(10000, 'save10'), 1000);
    assert.equal(discount(10000, 'Flat500'), 500);
  });

  it('throws RangeError for unknown codes', () => {
    assert.throws(
      () => discount(1000, 'BOGUS'),
      (e) => e instanceof RangeError && /Unknown discount code BOGUS/.test(e.message),
    );
  });

  it('does not treat inherited object properties as codes', () => {
    for (const code of ['toString', 'constructor', '__proto__', 'hasOwnProperty']) {
      assert.throws(() => discount(1000, code), RangeError, code);
    }
  });
});

describe('tax', () => {
  it('computes and rounds tax in cents', () => {
    assert.equal(tax(1000, 0.08), 80);
    assert.equal(tax(999, 0.0825), 82); // 82.4175
    assert.equal(tax(1000, 0.0005), 1); // 0.5 rounds up
  });

  it('returns 0 for a zero rate or zero amount', () => {
    assert.equal(tax(1000, 0), 0);
    assert.equal(tax(0, 0.2), 0);
  });

  it('accepts the boundary rates 0 and 0.5', () => {
    assert.equal(tax(1000, 0), 0);
    assert.equal(tax(1000, 0.5), 500);
  });

  it('rejects rates outside 0..0.5', () => {
    for (const rate of [-0.01, 0.51, 1, 8]) {
      assert.throws(
        () => tax(1000, rate),
        (e) => e instanceof RangeError && /Tax rate out of range/.test(e.message),
        String(rate),
      );
    }
  });
});

describe('checkout', () => {
  it('charges subtotal + tax and emails a receipt', async () => {
    const deps = fakeDeps({ chargeResult: { ok: true, id: 'ch_42' } });
    const cart = baseCart({ taxRate: 0.1 }); // 2000 + 200
    const res = await checkout(cart, deps);

    assert.deepEqual(res, { status: 'paid', total: 2200, chargeId: 'ch_42' });
    assert.deepEqual(deps.charges, [{ customerId: 'cus_1', amount: 2200, currency: 'usd' }]);
    assert.deepEqual(deps.emails, [
      { to: 'a@example.com', template: 'receipt', data: { total: 2200, chargeId: 'ch_42' } },
    ]);
  });

  it('applies the discount before tax', async () => {
    const deps = fakeDeps();
    // subtotal 2000, SAVE10 -> 1800, tax 10% -> 180, total 1980
    const res = await checkout(baseCart({ code: 'SAVE10', taxRate: 0.1 }), deps);
    assert.equal(res.total, 1980);
    assert.equal(deps.charges[0].amount, 1980);
  });

  it('applies FLAT500 before tax', async () => {
    const deps = fakeDeps();
    // 2000 - 500 = 1500, tax 20% = 300
    const res = await checkout(baseCart({ code: 'FLAT500', taxRate: 0.2 }), deps);
    assert.equal(res.total, 1800);
  });

  it('uses the cart currency when provided', async () => {
    const deps = fakeDeps();
    await checkout(baseCart({ currency: 'eur' }), deps);
    assert.equal(deps.charges[0].currency, 'eur');
  });

  it('defaults currency to usd', async () => {
    const deps = fakeDeps();
    await checkout(baseCart(), deps);
    assert.equal(deps.charges[0].currency, 'usd');
  });

  it('returns a free status without charging or emailing when total is 0', async () => {
    const deps = fakeDeps();
    const res = await checkout(baseCart({ items: [{ sku: 'F', quantity: 1, unitPrice: 0 }] }), deps);
    assert.deepEqual(res, { status: 'free', total: 0 });
    assert.equal(deps.charges.length, 0);
    assert.equal(deps.emails.length, 0);
  });

  it('handles an empty cart as free', async () => {
    const deps = fakeDeps();
    const res = await checkout(baseCart({ items: [] }), deps);
    assert.deepEqual(res, { status: 'free', total: 0 });
    assert.equal(deps.charges.length, 0);
  });

  it('throws PaymentDeclinedError with the gateway reason and sends no email', async () => {
    const deps = fakeDeps({ chargeResult: { ok: false, reason: 'card_declined' } });
    await assert.rejects(
      checkout(baseCart(), deps),
      (e) => e instanceof PaymentDeclinedError && e.reason === 'card_declined',
    );
    assert.equal(deps.charges.length, 1);
    assert.equal(deps.emails.length, 0);
  });

  it('propagates validation errors before touching the gateway', async () => {
    const deps = fakeDeps();
    await assert.rejects(
      checkout(baseCart({ items: [{ sku: 'X', quantity: 0, unitPrice: 100 }] }), deps),
      RangeError,
    );
    await assert.rejects(checkout(baseCart({ code: 'NOPE' }), deps), /Unknown discount code/);
    await assert.rejects(checkout(baseCart({ taxRate: 0.9 }), deps), /Tax rate out of range/);
    assert.equal(deps.charges.length, 0);
    assert.equal(deps.emails.length, 0);
  });

  it('propagates gateway errors and does not email', async () => {
    const deps = fakeDeps();
    deps.gateway.charge = async () => {
      throw new Error('network down');
    };
    await assert.rejects(checkout(baseCart(), deps), /network down/);
    assert.equal(deps.emails.length, 0);
  });

  it('propagates mailer errors after the charge succeeded', async () => {
    const deps = fakeDeps();
    deps.mailer.send = async () => {
      throw new Error('smtp down');
    };
    await assert.rejects(checkout(baseCart(), deps), /smtp down/);
    assert.equal(deps.charges.length, 1);
  });
});
