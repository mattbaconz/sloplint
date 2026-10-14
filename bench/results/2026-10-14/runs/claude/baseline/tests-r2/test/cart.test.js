import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { PaymentDeclinedError, subtotal, discount, tax, checkout } from '../src/cart.js';

const item = (sku, unitPrice, quantity) => ({ sku, unitPrice, quantity });

function makeDeps({ chargeResult = { ok: true, id: 'ch_1' }, mailError } = {}) {
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
        if (mailError) throw mailError;
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

  test('multiplies price by quantity and sums lines', () => {
    assert.equal(subtotal([item('A', 250, 3), item('B', 1000, 1)]), 1750);
  });

  test('allows free (0-priced) items', () => {
    assert.equal(subtotal([item('A', 0, 5)]), 0);
  });

  for (const quantity of [0, -1, 1.5, '2', NaN, undefined, null]) {
    test(`rejects invalid quantity ${String(quantity)}`, () => {
      assert.throws(() => subtotal([item('SKU-Q', 100, quantity)]), {
        name: 'RangeError',
        message: 'Invalid quantity for SKU-Q',
      });
    });
  }

  for (const unitPrice of [-1, 9.99, '100', NaN, Infinity, undefined, null]) {
    test(`rejects invalid price ${String(unitPrice)}`, () => {
      assert.throws(() => subtotal([item('SKU-P', unitPrice, 1)]), {
        name: 'RangeError',
        message: 'Invalid price for SKU-P',
      });
    });
  }

  test('reports quantity error before price error on the same item', () => {
    assert.throws(() => subtotal([item('X', -5, 0)]), /Invalid quantity for X/);
  });

  test('throws when any single line in the cart is invalid', () => {
    assert.throws(() => subtotal([item('OK', 100, 1), item('BAD', 100, 0)]), /BAD/);
  });
});

describe('discount', () => {
  test('returns 0 when no code is given', () => {
    assert.equal(discount(5000, undefined), 0);
    assert.equal(discount(5000, null), 0);
    assert.equal(discount(5000, ''), 0);
  });

  test('SAVE10 gives 10% off', () => {
    assert.equal(discount(5000, 'SAVE10'), 500);
  });

  test('SAVE10 rounds to the nearest cent (half rounds up)', () => {
    assert.equal(discount(14, 'SAVE10'), 1); // 1.4
    assert.equal(discount(16, 'SAVE10'), 2); // 1.6
    assert.equal(discount(5, 'SAVE10'), 1); // 0.5
    assert.equal(discount(4, 'SAVE10'), 0); // 0.4
  });

  test('SAVE10 on zero is zero', () => {
    assert.equal(discount(0, 'SAVE10'), 0);
  });

  test('FLAT500 takes 500 off at or above the 2000 threshold', () => {
    assert.equal(discount(2000, 'FLAT500'), 500);
    assert.equal(discount(10000, 'FLAT500'), 500);
  });

  test('FLAT500 gives nothing just below the threshold', () => {
    assert.equal(discount(1999, 'FLAT500'), 0);
    assert.equal(discount(0, 'FLAT500'), 0);
  });

  test('codes are case-insensitive', () => {
    assert.equal(discount(5000, 'save10'), 500);
    assert.equal(discount(5000, 'Flat500'), 500);
  });

  test('unknown code throws RangeError naming the code', () => {
    assert.throws(() => discount(5000, 'BOGUS'), {
      name: 'RangeError',
      message: 'Unknown discount code BOGUS',
    });
  });

  test('does not match inherited object properties as codes', () => {
    assert.throws(() => discount(5000, 'constructor'), RangeError);
    assert.throws(() => discount(5000, 'toString'), RangeError);
  });

  test('codes with surrounding whitespace are not recognised', () => {
    assert.throws(() => discount(5000, ' SAVE10'), RangeError);
  });
});

describe('tax', () => {
  test('computes tax and rounds to the nearest cent', () => {
    assert.equal(tax(1000, 0.08), 80);
    assert.equal(tax(999, 0.1), 100); // 99.9
    assert.equal(tax(1001, 0.1), 100); // 100.1
  });

  test('zero rate yields zero tax', () => {
    assert.equal(tax(12345, 0), 0);
  });

  test('zero amount yields zero tax', () => {
    assert.equal(tax(0, 0.2), 0);
  });

  test('accepts the boundaries 0 and 0.5', () => {
    assert.equal(tax(1000, 0), 0);
    assert.equal(tax(1000, 0.5), 500);
  });

  test('rejects negative rates', () => {
    assert.throws(() => tax(1000, -0.01), { name: 'RangeError', message: 'Tax rate out of range: -0.01' });
  });

  test('rejects rates above 0.5', () => {
    assert.throws(() => tax(1000, 0.51), { name: 'RangeError', message: 'Tax rate out of range: 0.51' });
    assert.throws(() => tax(1000, 8), RangeError); // percent passed by mistake
  });
});

describe('checkout', () => {
  test('charges the computed total and returns paid status', async () => {
    const deps = makeDeps();
    const res = await checkout(baseCart(), deps);
    assert.deepEqual(res, { status: 'paid', total: 2000, chargeId: 'ch_1' });
    assert.deepEqual(deps.charges, [{ customerId: 'cus_1', amount: 2000, currency: 'usd' }]);
  });

  test('applies discount before tax', async () => {
    // subtotal 5000, SAVE10 -> net 4500, tax 10% -> 450, total 4950
    const deps = makeDeps();
    const cart = baseCart({ items: [item('A', 2500, 2)], code: 'SAVE10', taxRate: 0.1 });
    const res = await checkout(cart, deps);
    assert.equal(res.total, 4950);
    assert.equal(deps.charges[0].amount, 4950);
  });

  test('applies FLAT500 then tax', async () => {
    // 3000 - 500 = 2500; tax 0.08 -> 200; total 2700
    const deps = makeDeps();
    const res = await checkout(baseCart({ items: [item('A', 3000, 1)], code: 'FLAT500', taxRate: 0.08 }), deps);
    assert.equal(res.total, 2700);
  });

  test('uses the cart currency when provided', async () => {
    const deps = makeDeps();
    await checkout(baseCart({ currency: 'eur' }), deps);
    assert.equal(deps.charges[0].currency, 'eur');
  });

  test('defaults currency to usd', async () => {
    const deps = makeDeps();
    await checkout(baseCart({ currency: undefined }), deps);
    assert.equal(deps.charges[0].currency, 'usd');
  });

  test('sends a receipt email with total and charge id', async () => {
    const deps = makeDeps({ chargeResult: { ok: true, id: 'ch_42' } });
    await checkout(baseCart({ taxRate: 0.1 }), deps);
    assert.deepEqual(deps.emails, [
      { to: 'a@example.com', template: 'receipt', data: { total: 2200, chargeId: 'ch_42' } },
    ]);
  });

  test('free order skips gateway and mailer', async () => {
    const deps = makeDeps();
    const res = await checkout(baseCart({ items: [item('A', 0, 1)] }), deps);
    assert.deepEqual(res, { status: 'free', total: 0 });
    assert.equal(deps.charges.length, 0);
    assert.equal(deps.emails.length, 0);
  });

  test('empty cart is treated as free', async () => {
    const deps = makeDeps();
    const res = await checkout(baseCart({ items: [] }), deps);
    assert.deepEqual(res, { status: 'free', total: 0 });
    assert.equal(deps.charges.length, 0);
  });

  test('declined payment throws PaymentDeclinedError and sends no email', async () => {
    const deps = makeDeps({ chargeResult: { ok: false, reason: 'card_declined' } });
    await assert.rejects(checkout(baseCart(), deps), (err) => {
      assert.ok(err instanceof PaymentDeclinedError);
      assert.equal(err.reason, 'card_declined');
      return true;
    });
    assert.equal(deps.charges.length, 1);
    assert.equal(deps.emails.length, 0);
  });

  test('invalid items reject before any charge', async () => {
    const deps = makeDeps();
    await assert.rejects(checkout(baseCart({ items: [item('A', 100, 0)] }), deps), RangeError);
    assert.equal(deps.charges.length, 0);
  });

  test('unknown discount code rejects before any charge', async () => {
    const deps = makeDeps();
    await assert.rejects(checkout(baseCart({ code: 'NOPE' }), deps), /Unknown discount code/);
    assert.equal(deps.charges.length, 0);
  });

  test('out-of-range tax rate rejects before any charge', async () => {
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

  test('mailer failure propagates after the charge has gone through', async () => {
    const deps = makeDeps({ mailError: new Error('smtp down') });
    await assert.rejects(checkout(baseCart(), deps), /smtp down/);
    assert.equal(deps.charges.length, 1);
  });
});
