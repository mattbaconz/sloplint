import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PaymentDeclinedError, subtotal, discount, tax, checkout } from '../src/cart.js';

const item = (quantity, unitPrice, sku = 'sku-1') => ({ sku, quantity, unitPrice });

function makeDeps({ chargeResult = { ok: true, id: 'ch_1' } } = {}) {
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
  items: [item(2, 1000)],
  taxRate: 0,
  ...overrides,
});

describe('PaymentDeclinedError', () => {
  it('is an Error with name, reason and formatted message', () => {
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

  it('multiplies price by quantity for a single item', () => {
    assert.equal(subtotal([item(3, 250)]), 750);
  });

  it('sums multiple items', () => {
    assert.equal(subtotal([item(1, 100, 'a'), item(2, 50, 'b'), item(4, 25, 'c')]), 300);
  });

  it('allows free (0-priced) items', () => {
    assert.equal(subtotal([item(5, 0)]), 0);
  });

  for (const [label, qty] of [
    ['zero', 0],
    ['negative', -1],
    ['fractional', 1.5],
    ['NaN', NaN],
    ['a string', '2'],
    ['undefined', undefined],
  ]) {
    it(`rejects ${label} quantity`, () => {
      assert.throws(() => subtotal([item(qty, 100, 'bad-sku')]), {
        name: 'RangeError',
        message: 'Invalid quantity for bad-sku',
      });
    });
  }

  for (const [label, price] of [
    ['negative', -1],
    ['fractional', 9.99],
    ['NaN', NaN],
    ['a string', '100'],
    ['undefined', undefined],
  ]) {
    it(`rejects ${label} price`, () => {
      assert.throws(() => subtotal([item(1, price, 'bad-sku')]), {
        name: 'RangeError',
        message: 'Invalid price for bad-sku',
      });
    });
  }

  it('rejects the whole cart if any one item is invalid', () => {
    assert.throws(() => subtotal([item(1, 100, 'ok'), item(0, 100, 'bad')]), /Invalid quantity for bad/);
  });
});

describe('discount', () => {
  it('returns 0 when no code is given', () => {
    assert.equal(discount(5000, undefined), 0);
    assert.equal(discount(5000, null), 0);
    assert.equal(discount(5000, ''), 0);
  });

  it('SAVE10 takes 10%', () => {
    assert.equal(discount(5000, 'SAVE10'), 500);
  });

  it('SAVE10 rounds to the nearest cent', () => {
    assert.equal(discount(1234, 'SAVE10'), 123); // 123.4
    assert.equal(discount(1236, 'SAVE10'), 124); // 123.6
    assert.equal(discount(5, 'SAVE10'), 1); // 0.5 rounds up
    assert.equal(discount(4, 'SAVE10'), 0); // 0.4
  });

  it('SAVE10 on zero is zero', () => {
    assert.equal(discount(0, 'SAVE10'), 0);
  });

  it('FLAT500 applies at and above the 2000 threshold', () => {
    assert.equal(discount(2000, 'FLAT500'), 500);
    assert.equal(discount(100000, 'FLAT500'), 500);
  });

  it('FLAT500 does not apply below the threshold', () => {
    assert.equal(discount(1999, 'FLAT500'), 0);
    assert.equal(discount(0, 'FLAT500'), 0);
  });

  it('codes are case-insensitive', () => {
    assert.equal(discount(5000, 'save10'), 500);
    assert.equal(discount(5000, 'Flat500'), 500);
  });

  it('throws on unknown codes', () => {
    assert.throws(() => discount(5000, 'BOGUS'), {
      name: 'RangeError',
      message: 'Unknown discount code BOGUS',
    });
  });

  it('does not treat object prototype keys as codes', () => {
    assert.throws(() => discount(5000, 'constructor'), RangeError);
    assert.throws(() => discount(5000, 'toString'), RangeError);
  });
});

describe('tax', () => {
  it('computes tax at the given rate', () => {
    assert.equal(tax(10000, 0.08), 800);
  });

  it('returns 0 for a 0 rate or 0 amount', () => {
    assert.equal(tax(10000, 0), 0);
    assert.equal(tax(0, 0.2), 0);
  });

  it('rounds to the nearest cent', () => {
    assert.equal(tax(999, 0.0825), 82); // 82.4175
    assert.equal(tax(1000, 0.0825), 83); // 82.5
  });

  it('accepts the boundaries 0 and 0.5', () => {
    assert.equal(tax(1000, 0.5), 500);
    assert.equal(tax(1000, 0), 0);
  });

  it('rejects rates below 0 or above 0.5', () => {
    assert.throws(() => tax(1000, -0.01), {
      name: 'RangeError',
      message: 'Tax rate out of range: -0.01',
    });
    assert.throws(() => tax(1000, 0.51), /Tax rate out of range: 0.51/);
    assert.throws(() => tax(1000, 1), RangeError);
  });
});

describe('checkout', () => {
  it('charges the total and sends a receipt on success', async () => {
    const deps = makeDeps({ chargeResult: { ok: true, id: 'ch_42' } });
    const result = await checkout(baseCart({ items: [item(2, 1000)], taxRate: 0.1 }), deps);

    assert.deepEqual(result, { status: 'paid', total: 2200, chargeId: 'ch_42' });
    assert.deepEqual(deps.charges, [{ customerId: 'cus_1', amount: 2200, currency: 'usd' }]);
    assert.deepEqual(deps.emails, [
      { to: 'a@example.com', template: 'receipt', data: { total: 2200, chargeId: 'ch_42' } },
    ]);
  });

  it('uses the cart currency when provided', async () => {
    const deps = makeDeps();
    await checkout(baseCart({ currency: 'eur' }), deps);
    assert.equal(deps.charges[0].currency, 'eur');
  });

  it('defaults currency to usd', async () => {
    const deps = makeDeps();
    await checkout(baseCart(), deps);
    assert.equal(deps.charges[0].currency, 'usd');
  });

  it('applies discount before tax', async () => {
    const deps = makeDeps();
    // subtotal 10000, SAVE10 -> 9000, tax 10% of 9000 = 900, total 9900
    const result = await checkout(baseCart({ items: [item(1, 10000)], code: 'SAVE10', taxRate: 0.1 }), deps);
    assert.equal(result.total, 9900);
    assert.equal(deps.charges[0].amount, 9900);
  });

  it('applies a flat discount code', async () => {
    const deps = makeDeps();
    const result = await checkout(baseCart({ items: [item(1, 3000)], code: 'FLAT500' }), deps);
    assert.equal(result.total, 2500);
  });

  it('is case-insensitive about discount codes', async () => {
    const deps = makeDeps();
    const result = await checkout(baseCart({ items: [item(1, 1000)], code: 'save10' }), deps);
    assert.equal(result.total, 900);
  });

  it('returns free without charging or emailing when total is 0', async () => {
    const deps = makeDeps();
    const result = await checkout(baseCart({ items: [item(1, 0)] }), deps);
    assert.deepEqual(result, { status: 'free', total: 0 });
    assert.equal(deps.charges.length, 0);
    assert.equal(deps.emails.length, 0);
  });

  it('treats an empty cart as free', async () => {
    const deps = makeDeps();
    const result = await checkout(baseCart({ items: [] }), deps);
    assert.deepEqual(result, { status: 'free', total: 0 });
    assert.equal(deps.charges.length, 0);
  });

  it('throws PaymentDeclinedError with the reason and sends no receipt on decline', async () => {
    const deps = makeDeps({ chargeResult: { ok: false, reason: 'card_expired' } });
    await assert.rejects(checkout(baseCart(), deps), (err) => {
      assert.ok(err instanceof PaymentDeclinedError);
      assert.equal(err.reason, 'card_expired');
      return true;
    });
    assert.equal(deps.charges.length, 1);
    assert.equal(deps.emails.length, 0);
  });

  it('does not charge when the cart has an invalid item', async () => {
    const deps = makeDeps();
    await assert.rejects(checkout(baseCart({ items: [item(0, 100)] }), deps), RangeError);
    assert.equal(deps.charges.length, 0);
  });

  it('does not charge when the discount code is unknown', async () => {
    const deps = makeDeps();
    await assert.rejects(checkout(baseCart({ code: 'NOPE' }), deps), /Unknown discount code/);
    assert.equal(deps.charges.length, 0);
  });

  it('does not charge when the tax rate is out of range', async () => {
    const deps = makeDeps();
    await assert.rejects(checkout(baseCart({ taxRate: 0.9 }), deps), /Tax rate out of range/);
    assert.equal(deps.charges.length, 0);
  });

  it('propagates gateway errors without sending a receipt', async () => {
    const deps = makeDeps();
    deps.gateway.charge = async () => {
      throw new Error('network down');
    };
    await assert.rejects(checkout(baseCart(), deps), /network down/);
    assert.equal(deps.emails.length, 0);
  });

  it('propagates mailer errors after the charge was made', async () => {
    const deps = makeDeps();
    deps.mailer.send = async () => {
      throw new Error('smtp down');
    };
    await assert.rejects(checkout(baseCart(), deps), /smtp down/);
    assert.equal(deps.charges.length, 1);
  });
});
