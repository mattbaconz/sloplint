import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { PaymentDeclinedError, subtotal, discount, tax, checkout } from '../src/cart.js';

function fakeGateway(response = { ok: true, id: 'ch_123' }) {
  const calls = [];
  return {
    calls,
    async charge(request) {
      calls.push(request);
      if (response instanceof Error) throw response;
      return response;
    },
  };
}

function fakeMailer(failure) {
  const sent = [];
  return {
    sent,
    async send(message) {
      if (failure) throw failure;
      sent.push(message);
    },
  };
}

const baseCart = {
  customerId: 'cus_42',
  email: 'ada@example.com',
  items: [{ sku: 'PLAN-PRO', quantity: 2, unitPrice: 1500 }],
  taxRate: 0,
};

describe('PaymentDeclinedError', () => {
  test('carries the reason and a prefixed message', () => {
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
      { sku: 'A', quantity: 2, unitPrice: 1500 },
      { sku: 'B', quantity: 3, unitPrice: 199 },
    ];
    assert.equal(subtotal(items), 3597);
  });

  test('accepts a zero unit price', () => {
    assert.equal(subtotal([{ sku: 'FREE', quantity: 1, unitPrice: 0 }]), 0);
  });

  for (const quantity of [0, -1, 1.5, '2', NaN, undefined]) {
    test(`rejects quantity ${String(quantity)}`, () => {
      assert.throws(
        () => subtotal([{ sku: 'BAD', quantity, unitPrice: 100 }]),
        { name: 'RangeError', message: 'Invalid quantity for BAD' },
      );
    });
  }

  for (const unitPrice of [-1, 9.99, '100', NaN, undefined]) {
    test(`rejects unit price ${String(unitPrice)}`, () => {
      assert.throws(
        () => subtotal([{ sku: 'BAD', quantity: 1, unitPrice }]),
        { name: 'RangeError', message: 'Invalid price for BAD' },
      );
    });
  }

  test('reports the offending sku when a later item is invalid', () => {
    const items = [
      { sku: 'OK', quantity: 1, unitPrice: 100 },
      { sku: 'BROKEN', quantity: 0, unitPrice: 100 },
    ];
    assert.throws(() => subtotal(items), /Invalid quantity for BROKEN/);
  });
});

describe('discount', () => {
  test('returns 0 when no code is given', () => {
    assert.equal(discount(5000, undefined), 0);
    assert.equal(discount(5000, null), 0);
    assert.equal(discount(5000, ''), 0);
  });

  test('SAVE10 takes 10 percent', () => {
    assert.equal(discount(3000, 'SAVE10'), 300);
  });

  test('SAVE10 rounds to the nearest cent', () => {
    assert.equal(discount(1234, 'SAVE10'), 123);
    assert.equal(discount(1236, 'SAVE10'), 124);
  });

  test('codes are case-insensitive', () => {
    assert.equal(discount(3000, 'save10'), 300);
    assert.equal(discount(3000, 'SaVe10'), 300);
  });

  test('FLAT500 takes 500 off at the 2000 threshold', () => {
    assert.equal(discount(2000, 'FLAT500'), 500);
    assert.equal(discount(10000, 'FLAT500'), 500);
  });

  test('FLAT500 gives nothing below the threshold', () => {
    assert.equal(discount(1999, 'FLAT500'), 0);
    assert.equal(discount(0, 'FLAT500'), 0);
  });

  test('throws for an unknown code and names it', () => {
    assert.throws(() => discount(3000, 'BOGUS'), {
      name: 'RangeError',
      message: 'Unknown discount code BOGUS',
    });
  });
});

describe('tax', () => {
  test('returns 0 at a zero rate', () => {
    assert.equal(tax(10000, 0), 0);
  });

  test('applies the rate and rounds to the nearest cent', () => {
    assert.equal(tax(10000, 0.2), 2000);
    assert.equal(tax(1234, 0.0725), 89);
    assert.equal(tax(999, 0.1), 100);
  });

  test('accepts the boundary rates 0 and 0.5', () => {
    assert.equal(tax(1000, 0), 0);
    assert.equal(tax(1000, 0.5), 500);
  });

  for (const rate of [-0.01, 0.51, 1, 20]) {
    test(`rejects rate ${rate}`, () => {
      assert.throws(() => tax(1000, rate), {
        name: 'RangeError',
        message: `Tax rate out of range: ${rate}`,
      });
    });
  }
});

describe('checkout', () => {
  test('charges the total and emails a receipt', async () => {
    const gateway = fakeGateway({ ok: true, id: 'ch_777' });
    const mailer = fakeMailer();

    const result = await checkout(baseCart, { gateway, mailer });

    assert.deepEqual(result, { status: 'paid', total: 3000, chargeId: 'ch_777' });
    assert.deepEqual(gateway.calls, [{ customerId: 'cus_42', amount: 3000, currency: 'usd' }]);
    assert.deepEqual(mailer.sent, [
      { to: 'ada@example.com', template: 'receipt', data: { total: 3000, chargeId: 'ch_777' } },
    ]);
  });

  test('uses the cart currency when provided', async () => {
    const gateway = fakeGateway();
    await checkout({ ...baseCart, currency: 'eur' }, { gateway, mailer: fakeMailer() });
    assert.equal(gateway.calls[0].currency, 'eur');
  });

  test('applies the discount before tax', async () => {
    const gateway = fakeGateway();
    // subtotal 3000, SAVE10 -> 300 off, net 2700, 8% tax -> 216
    const result = await checkout(
      { ...baseCart, code: 'SAVE10', taxRate: 0.08 },
      { gateway, mailer: fakeMailer() },
    );
    assert.equal(result.total, 2916);
    assert.equal(gateway.calls[0].amount, 2916);
  });

  test('applies a flat discount', async () => {
    const gateway = fakeGateway();
    const result = await checkout({ ...baseCart, code: 'flat500' }, { gateway, mailer: fakeMailer() });
    assert.equal(result.total, 2500);
  });

  test('returns free without charging or emailing when the total is zero', async () => {
    const gateway = fakeGateway();
    const mailer = fakeMailer();
    const cart = { ...baseCart, items: [{ sku: 'TRIAL', quantity: 1, unitPrice: 0 }] };

    const result = await checkout(cart, { gateway, mailer });

    assert.deepEqual(result, { status: 'free', total: 0 });
    assert.equal(gateway.calls.length, 0);
    assert.equal(mailer.sent.length, 0);
  });

  test('treats an empty cart as free', async () => {
    const gateway = fakeGateway();
    const result = await checkout({ ...baseCart, items: [] }, { gateway, mailer: fakeMailer() });
    assert.deepEqual(result, { status: 'free', total: 0 });
    assert.equal(gateway.calls.length, 0);
  });

  test('throws PaymentDeclinedError and sends no receipt when the charge is declined', async () => {
    const gateway = fakeGateway({ ok: false, reason: 'card_expired' });
    const mailer = fakeMailer();

    await assert.rejects(
      checkout(baseCart, { gateway, mailer }),
      (err) => {
        assert.ok(err instanceof PaymentDeclinedError);
        assert.equal(err.reason, 'card_expired');
        assert.equal(err.message, 'Payment declined: card_expired');
        return true;
      },
    );
    assert.equal(gateway.calls.length, 1);
    assert.equal(mailer.sent.length, 0);
  });

  test('propagates gateway failures and sends no receipt', async () => {
    const gateway = fakeGateway(new Error('gateway unreachable'));
    const mailer = fakeMailer();

    await assert.rejects(checkout(baseCart, { gateway, mailer }), /gateway unreachable/);
    assert.equal(mailer.sent.length, 0);
  });

  test('propagates mailer failures after the charge went through', async () => {
    const gateway = fakeGateway({ ok: true, id: 'ch_9' });
    const mailer = fakeMailer(new Error('smtp down'));

    await assert.rejects(checkout(baseCart, { gateway, mailer }), /smtp down/);
    assert.equal(gateway.calls.length, 1);
  });

  test('rejects an invalid item before charging', async () => {
    const gateway = fakeGateway();
    const cart = { ...baseCart, items: [{ sku: 'BAD', quantity: 0, unitPrice: 100 }] };

    await assert.rejects(checkout(cart, { gateway, mailer: fakeMailer() }), RangeError);
    assert.equal(gateway.calls.length, 0);
  });

  test('rejects an unknown discount code before charging', async () => {
    const gateway = fakeGateway();

    await assert.rejects(
      checkout({ ...baseCart, code: 'NOPE' }, { gateway, mailer: fakeMailer() }),
      /Unknown discount code NOPE/,
    );
    assert.equal(gateway.calls.length, 0);
  });

  test('rejects an out-of-range tax rate before charging', async () => {
    const gateway = fakeGateway();

    await assert.rejects(
      checkout({ ...baseCart, taxRate: 0.9 }, { gateway, mailer: fakeMailer() }),
      /Tax rate out of range: 0.9/,
    );
    assert.equal(gateway.calls.length, 0);
  });
});
