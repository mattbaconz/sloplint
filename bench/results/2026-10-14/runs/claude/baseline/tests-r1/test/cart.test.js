import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { PaymentDeclinedError, subtotal, discount, tax, checkout } from '../src/cart.js';

const item = (sku, unitPrice, quantity) => ({ sku, unitPrice, quantity });

function makeDeps({ chargeResult = { ok: true, id: 'ch_1' }, mailerError } = {}) {
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
        if (mailerError) throw mailerError;
        emails.push(msg);
      },
    },
  };
}

const baseCart = (overrides = {}) => ({
  customerId: 'cus_1',
  email: 'a@example.com',
  items: [item('A', 1000, 2)],
  taxRate: 0,
  ...overrides,
});

describe('PaymentDeclinedError', () => {
  test('carries name, reason and formatted message', () => {
    const err = new PaymentDeclinedError('card_expired');
    assert.ok(err instanceof Error);
    assert.equal(err.name, 'PaymentDeclinedError');
    assert.equal(err.reason, 'card_expired');
    assert.equal(err.message, 'Payment declined: card_expired');
  });
});

describe('subtotal', () => {
  test('returns 0 for an empty cart', () => {
    assert.equal(subtotal([]), 0);
  });

  test('sums unitPrice * quantity across items', () => {
    assert.equal(subtotal([item('A', 250, 3), item('B', 100, 1)]), 850);
  });

  test('allows free (0-priced) items', () => {
    assert.equal(subtotal([item('A', 0, 5)]), 0);
  });

  for (const quantity of [0, -1, 1.5, NaN, '2', undefined, null]) {
    test(`rejects quantity ${String(quantity)}`, () => {
      assert.throws(() => subtotal([item('BAD', 100, quantity)]), {
        name: 'RangeError',
        message: 'Invalid quantity for BAD',
      });
    });
  }

  for (const unitPrice of [-1, 9.99, NaN, '100', undefined, null, Infinity]) {
    test(`rejects unitPrice ${String(unitPrice)}`, () => {
      assert.throws(() => subtotal([item('BAD', unitPrice, 1)]), {
        name: 'RangeError',
        message: 'Invalid price for BAD',
      });
    });
  }

  test('reports quantity error before price error for the same item', () => {
    assert.throws(() => subtotal([item('X', -5, 0)]), /Invalid quantity for X/);
  });

  test('throws on an invalid item even after valid ones', () => {
    assert.throws(() => subtotal([item('A', 100, 1), item('B', 100, 0)]), /Invalid quantity for B/);
  });
});

describe('discount', () => {
  test('returns 0 when no code is given', () => {
    assert.equal(discount(5000, undefined), 0);
    assert.equal(discount(5000, null), 0);
    assert.equal(discount(5000, ''), 0);
  });

  test('SAVE10 takes 10% rounded to the nearest cent', () => {
    assert.equal(discount(1000, 'SAVE10'), 100);
    assert.equal(discount(1234, 'SAVE10'), 123);
    assert.equal(discount(1235, 'SAVE10'), 124);
    assert.equal(discount(0, 'SAVE10'), 0);
  });

  test('codes are case-insensitive', () => {
    assert.equal(discount(1000, 'save10'), 100);
    assert.equal(discount(1000, 'SaVe10'), 100);
    assert.equal(discount(2000, 'flat500'), 500);
  });

  test('FLAT500 applies only at or above 2000 cents', () => {
    assert.equal(discount(1999, 'FLAT500'), 0);
    assert.equal(discount(2000, 'FLAT500'), 500);
    assert.equal(discount(10000, 'FLAT500'), 500);
  });

  test('throws RangeError for unknown codes', () => {
    assert.throws(() => discount(1000, 'BOGUS'), {
      name: 'RangeError',
      message: 'Unknown discount code BOGUS',
    });
  });

  test('does not resolve inherited object properties as codes', () => {
    assert.throws(() => discount(1000, 'constructor'), RangeError);
    assert.throws(() => discount(1000, 'toString'), RangeError);
  });
});

describe('tax', () => {
  test('rounds amount * rate to the nearest cent', () => {
    assert.equal(tax(1000, 0.08), 80);
    assert.equal(tax(999, 0.0825), 82);
    assert.equal(tax(1, 0.5), 1);
  });

  test('accepts the boundary rates 0 and 0.5', () => {
    assert.equal(tax(1000, 0), 0);
    assert.equal(tax(1000, 0.5), 500);
  });

  test('returns 0 for a zero amount', () => {
    assert.equal(tax(0, 0.2), 0);
  });

  test('rejects rates outside [0, 0.5]', () => {
    assert.throws(() => tax(1000, -0.01), { name: 'RangeError', message: 'Tax rate out of range: -0.01' });
    assert.throws(() => tax(1000, 0.51), RangeError);
    assert.throws(() => tax(1000, 1), RangeError);
  });

  // Known gap: NaN slips through both comparisons and yields NaN tax.
  test('rejects NaN rate', { todo: 'tax() does not validate NaN' }, () => {
    assert.throws(() => tax(1000, NaN), RangeError);
  });

  // Known gap: a missing taxRate (undefined) yields NaN, which would be charged.
  test('rejects undefined rate', { todo: 'tax() does not validate undefined' }, () => {
    assert.throws(() => tax(1000, undefined), RangeError);
  });
});

describe('checkout', () => {
  test('charges the gateway and sends a receipt on success', async () => {
    const deps = makeDeps();
    const result = await checkout(baseCart(), deps);

    assert.deepEqual(result, { status: 'paid', total: 2000, chargeId: 'ch_1' });
    assert.deepEqual(deps.charges, [{ customerId: 'cus_1', amount: 2000, currency: 'usd' }]);
    assert.deepEqual(deps.emails, [
      { to: 'a@example.com', template: 'receipt', data: { total: 2000, chargeId: 'ch_1' } },
    ]);
  });

  test('uses the cart currency when provided', async () => {
    const deps = makeDeps();
    await checkout(baseCart({ currency: 'eur' }), deps);
    assert.equal(deps.charges[0].currency, 'eur');
  });

  test('applies discount before tax', async () => {
    const deps = makeDeps();
    // subtotal 2000, SAVE10 -> 200 off, net 1800, tax 10% -> 180, total 1980
    const result = await checkout(baseCart({ code: 'SAVE10', taxRate: 0.1 }), deps);
    assert.equal(result.total, 1980);
    assert.equal(deps.charges[0].amount, 1980);
  });

  test('applies FLAT500 then tax', async () => {
    const deps = makeDeps();
    // subtotal 2000, -500 -> 1500, tax 20% -> 300, total 1800
    const result = await checkout(baseCart({ code: 'FLAT500', taxRate: 0.2 }), deps);
    assert.equal(result.total, 1800);
  });

  test('FLAT500 is not applied under the threshold', async () => {
    const deps = makeDeps();
    const result = await checkout(baseCart({ items: [item('A', 1999, 1)], code: 'FLAT500' }), deps);
    assert.equal(result.total, 1999);
  });

  test('returns "free" without charging or emailing when total is 0', async () => {
    const deps = makeDeps();
    const result = await checkout(baseCart({ items: [item('A', 0, 1)] }), deps);
    assert.deepEqual(result, { status: 'free', total: 0 });
    assert.equal(deps.charges.length, 0);
    assert.equal(deps.emails.length, 0);
  });

  test('an empty cart is free', async () => {
    const deps = makeDeps();
    const result = await checkout(baseCart({ items: [] }), deps);
    assert.deepEqual(result, { status: 'free', total: 0 });
    assert.equal(deps.charges.length, 0);
  });

  test('throws PaymentDeclinedError with the gateway reason and sends no email', async () => {
    const deps = makeDeps({ chargeResult: { ok: false, reason: 'insufficient_funds' } });
    await assert.rejects(checkout(baseCart(), deps), (err) => {
      assert.ok(err instanceof PaymentDeclinedError);
      assert.equal(err.reason, 'insufficient_funds');
      return true;
    });
    assert.equal(deps.charges.length, 1);
    assert.equal(deps.emails.length, 0);
  });

  test('invalid items reject before the gateway is called', async () => {
    const deps = makeDeps();
    await assert.rejects(checkout(baseCart({ items: [item('A', 100, 0)] }), deps), RangeError);
    assert.equal(deps.charges.length, 0);
  });

  test('unknown discount code rejects before the gateway is called', async () => {
    const deps = makeDeps();
    await assert.rejects(checkout(baseCart({ code: 'NOPE' }), deps), /Unknown discount code/);
    assert.equal(deps.charges.length, 0);
  });

  test('out-of-range tax rate rejects before the gateway is called', async () => {
    const deps = makeDeps();
    await assert.rejects(checkout(baseCart({ taxRate: 0.9 }), deps), /Tax rate out of range/);
    assert.equal(deps.charges.length, 0);
  });

  test('gateway errors propagate and no email is sent', async () => {
    const deps = makeDeps();
    deps.gateway.charge = async () => {
      throw new Error('network down');
    };
    await assert.rejects(checkout(baseCart(), deps), /network down/);
    assert.equal(deps.emails.length, 0);
  });

  test('mailer errors propagate after the charge has been made', async () => {
    const deps = makeDeps({ mailerError: new Error('smtp down') });
    await assert.rejects(checkout(baseCart(), deps), /smtp down/);
    assert.equal(deps.charges.length, 1);
  });

  test('does not mutate the cart', async () => {
    const cart = baseCart({ code: 'SAVE10', taxRate: 0.1 });
    const snapshot = JSON.parse(JSON.stringify(cart));
    await checkout(cart, makeDeps());
    assert.deepEqual(cart, snapshot);
  });
});
