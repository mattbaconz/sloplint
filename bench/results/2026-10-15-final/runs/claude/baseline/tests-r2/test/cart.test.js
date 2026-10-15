import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { PaymentDeclinedError, subtotal, discount, tax, checkout } from '../src/cart.js';

const item = (sku, unitPrice, quantity) => ({ sku, unitPrice, quantity });

function makeDeps({ chargeResult = { ok: true, id: 'ch_1' }, chargeError, mailError } = {}) {
  const calls = { charge: [], send: [] };
  return {
    calls,
    gateway: {
      async charge(req) {
        calls.charge.push(req);
        if (chargeError) throw chargeError;
        return chargeResult;
      },
    },
    mailer: {
      async send(msg) {
        calls.send.push(msg);
        if (mailError) throw mailError;
      },
    },
  };
}

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

  test('sums unitPrice * quantity across items', () => {
    assert.equal(subtotal([item('a', 1000, 2), item('b', 250, 3)]), 2750);
  });

  test('allows free (0-priced) items', () => {
    assert.equal(subtotal([item('a', 0, 5), item('b', 100, 1)]), 100);
  });

  for (const quantity of [0, -1, 1.5, '2', NaN, undefined, null]) {
    test(`rejects invalid quantity ${String(quantity)}`, () => {
      assert.throws(() => subtotal([item('widget', 100, quantity)]), {
        name: 'RangeError',
        message: 'Invalid quantity for widget',
      });
    });
  }

  for (const unitPrice of [-1, 9.99, '100', NaN, undefined, null]) {
    test(`rejects invalid unitPrice ${String(unitPrice)}`, () => {
      assert.throws(() => subtotal([item('widget', unitPrice, 1)]), {
        name: 'RangeError',
        message: 'Invalid price for widget',
      });
    });
  }

  test('one bad item invalidates the whole cart', () => {
    assert.throws(() => subtotal([item('ok', 100, 1), item('bad', 100, 0)]), /Invalid quantity for bad/);
  });
});

describe('discount', () => {
  test('returns 0 when no code is given', () => {
    assert.equal(discount(5000, undefined), 0);
    assert.equal(discount(5000, null), 0);
    assert.equal(discount(5000, ''), 0);
  });

  test('SAVE10 takes 10% off', () => {
    assert.equal(discount(5000, 'SAVE10'), 500);
    assert.equal(discount(0, 'SAVE10'), 0);
  });

  test('SAVE10 rounds to the nearest cent (half rounds up)', () => {
    assert.equal(discount(15, 'SAVE10'), 2); // 1.5 -> 2
    assert.equal(discount(14, 'SAVE10'), 1); // 1.4 -> 1
    assert.equal(discount(4, 'SAVE10'), 0); // 0.4 -> 0
  });

  test('FLAT500 takes 500 off at or above the 2000 threshold', () => {
    assert.equal(discount(2000, 'FLAT500'), 500);
    assert.equal(discount(10000, 'FLAT500'), 500);
  });

  test('FLAT500 gives nothing below the threshold', () => {
    assert.equal(discount(1999, 'FLAT500'), 0);
    assert.equal(discount(0, 'FLAT500'), 0);
  });

  test('codes are case-insensitive', () => {
    assert.equal(discount(1000, 'save10'), 100);
    assert.equal(discount(2000, 'Flat500'), 500);
  });

  test('unknown code throws RangeError naming the code', () => {
    assert.throws(() => discount(1000, 'BOGUS'), {
      name: 'RangeError',
      message: 'Unknown discount code BOGUS',
    });
  });

  test('does not treat inherited object properties as codes', () => {
    // "constructor".toUpperCase() is "CONSTRUCTOR", which is not a key
    assert.throws(() => discount(1000, 'constructor'), RangeError);
    assert.throws(() => discount(1000, 'toString'), RangeError);
  });
});

describe('tax', () => {
  test('applies the rate and rounds to the nearest cent', () => {
    assert.equal(tax(1000, 0.08), 80);
    assert.equal(tax(999, 0.08), 80); // 79.92
    assert.equal(tax(1001, 0.1), 100); // 100.1
    assert.equal(tax(5, 0.1), 1); // 0.5 -> 1
  });

  test('zero rate or zero amount yields zero tax', () => {
    assert.equal(tax(1000, 0), 0);
    assert.equal(tax(0, 0.2), 0);
  });

  test('accepts the boundary rates 0 and 0.5', () => {
    assert.equal(tax(1000, 0.5), 500);
    assert.equal(tax(1000, 0), 0);
  });

  test('rejects rates outside [0, 0.5]', () => {
    assert.throws(() => tax(1000, -0.01), { name: 'RangeError', message: 'Tax rate out of range: -0.01' });
    assert.throws(() => tax(1000, 0.51), { name: 'RangeError', message: 'Tax rate out of range: 0.51' });
    assert.throws(() => tax(1000, 1), RangeError);
  });
});

describe('checkout', () => {
  const baseCart = {
    customerId: 'cus_42',
    email: 'pat@example.com',
    items: [item('a', 1000, 2), item('b', 500, 1)], // subtotal 2500
    taxRate: 0,
  };

  test('charges the gateway and sends a receipt on success', async () => {
    const deps = makeDeps({ chargeResult: { ok: true, id: 'ch_abc' } });
    const result = await checkout(baseCart, deps);

    assert.deepEqual(result, { status: 'paid', total: 2500, chargeId: 'ch_abc' });
    assert.deepEqual(deps.calls.charge, [{ customerId: 'cus_42', amount: 2500, currency: 'usd' }]);
    assert.deepEqual(deps.calls.send, [
      { to: 'pat@example.com', template: 'receipt', data: { total: 2500, chargeId: 'ch_abc' } },
    ]);
  });

  test('defaults currency to usd and honours an explicit currency', async () => {
    const d1 = makeDeps();
    await checkout(baseCart, d1);
    assert.equal(d1.calls.charge[0].currency, 'usd');

    const d2 = makeDeps();
    await checkout({ ...baseCart, currency: 'eur' }, d2);
    assert.equal(d2.calls.charge[0].currency, 'eur');
  });

  test('applies the discount before tax', async () => {
    // subtotal 2500, SAVE10 -> 250 off => net 2250, tax 10% => 225, total 2475
    const deps = makeDeps();
    const result = await checkout({ ...baseCart, code: 'SAVE10', taxRate: 0.1 }, deps);
    assert.equal(result.total, 2475);
    assert.equal(deps.calls.charge[0].amount, 2475);
    assert.equal(deps.calls.send[0].data.total, 2475);
  });

  test('applies a flat discount', async () => {
    const deps = makeDeps();
    const result = await checkout({ ...baseCart, code: 'FLAT500' }, deps);
    assert.equal(result.total, 2000);
  });

  test('flat discount does not apply below its threshold', async () => {
    const deps = makeDeps();
    const cart = { ...baseCart, items: [item('a', 1500, 1)], code: 'FLAT500' };
    const result = await checkout(cart, deps);
    assert.equal(result.total, 1500);
  });

  test('taxes the net amount, rounding to the cent', async () => {
    // 1999 * 0.0825 = 164.9175 -> 165
    const deps = makeDeps();
    const result = await checkout({ ...baseCart, items: [item('a', 1999, 1)], taxRate: 0.0825 }, deps);
    assert.equal(result.total, 1999 + 165);
  });

  test('returns status free and skips gateway and mailer when total is 0', async () => {
    const deps = makeDeps();
    const result = await checkout({ ...baseCart, items: [item('promo', 0, 3)] }, deps);
    assert.deepEqual(result, { status: 'free', total: 0 });
    assert.equal(deps.calls.charge.length, 0);
    assert.equal(deps.calls.send.length, 0);
  });

  test('an empty cart is free', async () => {
    const deps = makeDeps();
    const result = await checkout({ ...baseCart, items: [] }, deps);
    assert.deepEqual(result, { status: 'free', total: 0 });
    assert.equal(deps.calls.charge.length, 0);
  });

  test('throws PaymentDeclinedError with the gateway reason and sends no receipt', async () => {
    const deps = makeDeps({ chargeResult: { ok: false, reason: 'card_expired' } });
    await assert.rejects(checkout(baseCart, deps), (err) => {
      assert.ok(err instanceof PaymentDeclinedError);
      assert.equal(err.reason, 'card_expired');
      assert.equal(err.message, 'Payment declined: card_expired');
      return true;
    });
    assert.equal(deps.calls.charge.length, 1);
    assert.equal(deps.calls.send.length, 0);
  });

  test('propagates gateway errors without sending a receipt', async () => {
    const boom = new Error('network down');
    const deps = makeDeps({ chargeError: boom });
    await assert.rejects(checkout(baseCart, deps), boom);
    assert.equal(deps.calls.send.length, 0);
  });

  test('propagates mailer errors after the charge was made', async () => {
    const boom = new Error('smtp down');
    const deps = makeDeps({ mailError: boom });
    await assert.rejects(checkout(baseCart, deps), boom);
    assert.equal(deps.calls.charge.length, 1);
  });

  test('rejects invalid items before touching the gateway', async () => {
    const deps = makeDeps();
    await assert.rejects(checkout({ ...baseCart, items: [item('a', 100, 0)] }, deps), RangeError);
    assert.equal(deps.calls.charge.length, 0);
  });

  test('rejects an unknown discount code before touching the gateway', async () => {
    const deps = makeDeps();
    await assert.rejects(checkout({ ...baseCart, code: 'NOPE' }, deps), /Unknown discount code NOPE/);
    assert.equal(deps.calls.charge.length, 0);
  });

  test('rejects an out-of-range tax rate before touching the gateway', async () => {
    const deps = makeDeps();
    await assert.rejects(checkout({ ...baseCart, taxRate: 0.9 }, deps), /Tax rate out of range/);
    assert.equal(deps.calls.charge.length, 0);
  });

  // KNOWN BUG: tax() only checks `rate < 0 || rate > 0.5`, which is false for
  // undefined/NaN, so a missing taxRate yields a NaN total and the gateway is
  // charged NaN. Remove `todo` once src/cart.js validates the rate.
  test('a missing taxRate is rejected rather than charging NaN', { todo: true }, async () => {
    const deps = makeDeps();
    const { taxRate, ...cart } = baseCart;
    await assert.rejects(checkout(cart, deps));
    assert.equal(deps.calls.charge.length, 0);
  });
});
