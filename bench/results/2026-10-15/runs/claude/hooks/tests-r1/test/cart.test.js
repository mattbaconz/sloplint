import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PaymentDeclinedError,
  subtotal,
  discount,
  tax,
  checkout,
} from '../src/cart.js';

function fakeGateway(response) {
  const calls = [];
  return {
    calls,
    async charge(payload) {
      calls.push(payload);
      return typeof response === 'function' ? response(payload) : response;
    },
  };
}

function fakeMailer() {
  const sent = [];
  return {
    sent,
    async send(message) {
      sent.push(message);
    },
  };
}

function baseCart(overrides = {}) {
  return {
    customerId: 'cus_42',
    email: 'billing@example.com',
    items: [{ sku: 'SEAT', unitPrice: 1000, quantity: 2 }],
    taxRate: 0,
    ...overrides,
  };
}

describe('PaymentDeclinedError', () => {
  it('carries the reason, name and a prefixed message', () => {
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
      { sku: 'A', unitPrice: 1999, quantity: 1 },
      { sku: 'B', unitPrice: 250, quantity: 4 },
    ];
    assert.equal(subtotal(items), 2999);
  });

  it('allows free items with a price of 0', () => {
    assert.equal(subtotal([{ sku: 'FREE', unitPrice: 0, quantity: 3 }]), 0);
  });

  for (const quantity of [0, -1, 1.5, '2', null, undefined, NaN]) {
    it(`rejects quantity ${String(quantity)} and names the sku`, () => {
      assert.throws(
        () => subtotal([{ sku: 'BAD-QTY', unitPrice: 100, quantity }]),
        { name: 'RangeError', message: 'Invalid quantity for BAD-QTY' },
      );
    });
  }

  for (const unitPrice of [-1, 9.99, '100', null, undefined, NaN]) {
    it(`rejects unitPrice ${String(unitPrice)} and names the sku`, () => {
      assert.throws(
        () => subtotal([{ sku: 'BAD-PRICE', unitPrice, quantity: 1 }]),
        { name: 'RangeError', message: 'Invalid price for BAD-PRICE' },
      );
    });
  }

  it('reports the first invalid item even when earlier items are valid', () => {
    const items = [
      { sku: 'OK', unitPrice: 100, quantity: 1 },
      { sku: 'BROKEN', unitPrice: 100, quantity: 0 },
    ];
    assert.throws(() => subtotal(items), /BROKEN/);
  });
});

describe('discount', () => {
  it('returns 0 when no code is given', () => {
    assert.equal(discount(5000, undefined), 0);
    assert.equal(discount(5000, null), 0);
    assert.equal(discount(5000, ''), 0);
  });

  it('SAVE10 takes 10% off', () => {
    assert.equal(discount(5000, 'SAVE10'), 500);
  });

  it('SAVE10 rounds half up to whole cents', () => {
    assert.equal(discount(15, 'SAVE10'), 2);
    assert.equal(discount(14, 'SAVE10'), 1);
    assert.equal(discount(4, 'SAVE10'), 0);
  });

  it('SAVE10 on a zero amount is 0', () => {
    assert.equal(discount(0, 'SAVE10'), 0);
  });

  it('FLAT500 takes 500 off at or above the 2000 threshold', () => {
    assert.equal(discount(2000, 'FLAT500'), 500);
    assert.equal(discount(10000, 'FLAT500'), 500);
  });

  it('FLAT500 gives nothing below the 2000 threshold', () => {
    assert.equal(discount(1999, 'FLAT500'), 0);
    assert.equal(discount(0, 'FLAT500'), 0);
  });

  it('matches codes case-insensitively', () => {
    assert.equal(discount(5000, 'save10'), 500);
    assert.equal(discount(5000, 'Flat500'), 500);
  });

  it('throws RangeError for an unknown code, echoing the code as typed', () => {
    assert.throws(() => discount(5000, 'bogus'), {
      name: 'RangeError',
      message: 'Unknown discount code bogus',
    });
  });

  it('does not treat inherited object keys as codes', () => {
    assert.throws(() => discount(5000, 'constructor'), RangeError);
  });
});

describe('tax', () => {
  it('computes tax and rounds to whole cents', () => {
    assert.equal(tax(10000, 0.0825), 825);
    assert.equal(tax(999, 0.1), 100);
    assert.equal(tax(1001, 0.1), 100);
  });

  it('returns 0 for a zero rate or zero amount', () => {
    assert.equal(tax(10000, 0), 0);
    assert.equal(tax(0, 0.2), 0);
  });

  it('accepts the boundary rates 0 and 0.5', () => {
    assert.equal(tax(1000, 0), 0);
    assert.equal(tax(1000, 0.5), 500);
  });

  for (const rate of [-0.01, 0.51, 1, 8.25]) {
    it(`rejects out-of-range rate ${rate}`, () => {
      assert.throws(() => tax(1000, rate), {
        name: 'RangeError',
        message: `Tax rate out of range: ${rate}`,
      });
    });
  }
});

describe('checkout', () => {
  describe('successful payment', () => {
    it('charges subtotal plus tax, emails a receipt and returns paid status', async () => {
      const gateway = fakeGateway({ ok: true, id: 'ch_1' });
      const mailer = fakeMailer();
      const cart = baseCart({ taxRate: 0.1 });

      const result = await checkout(cart, { gateway, mailer });

      assert.deepEqual(result, { status: 'paid', total: 2200, chargeId: 'ch_1' });
      assert.deepEqual(gateway.calls, [
        { customerId: 'cus_42', amount: 2200, currency: 'usd' },
      ]);
      assert.deepEqual(mailer.sent, [
        {
          to: 'billing@example.com',
          template: 'receipt',
          data: { total: 2200, chargeId: 'ch_1' },
        },
      ]);
    });

    it('defaults currency to usd and honours an explicit currency', async () => {
      const gateway = fakeGateway({ ok: true, id: 'ch_2' });
      const mailer = fakeMailer();

      await checkout(baseCart(), { gateway, mailer });
      await checkout(baseCart({ currency: 'eur' }), { gateway, mailer });

      assert.deepEqual(
        gateway.calls.map((c) => c.currency),
        ['usd', 'eur'],
      );
    });

    it('applies the discount before tax', async () => {
      const gateway = fakeGateway({ ok: true, id: 'ch_3' });
      const mailer = fakeMailer();
      const cart = baseCart({ code: 'SAVE10', taxRate: 0.1 });

      const result = await checkout(cart, { gateway, mailer });

      // 2000 - 200 = 1800; tax 180; total 1980
      assert.equal(result.total, 1980);
      assert.equal(gateway.calls[0].amount, 1980);
    });

    it('applies FLAT500 on a qualifying cart', async () => {
      const gateway = fakeGateway({ ok: true, id: 'ch_4' });
      const mailer = fakeMailer();

      const result = await checkout(baseCart({ code: 'FLAT500' }), { gateway, mailer });

      assert.equal(result.total, 1500);
    });

    it('treats a lowercase discount code the same as uppercase', async () => {
      const gateway = fakeGateway({ ok: true, id: 'ch_5' });
      const mailer = fakeMailer();

      const result = await checkout(baseCart({ code: 'save10' }), { gateway, mailer });

      assert.equal(result.total, 1800);
    });
  });

  describe('free carts', () => {
    it('returns free status without charging or emailing for an empty cart', async () => {
      const gateway = fakeGateway({ ok: true, id: 'never' });
      const mailer = fakeMailer();

      const result = await checkout(baseCart({ items: [] }), { gateway, mailer });

      assert.deepEqual(result, { status: 'free', total: 0 });
      assert.equal(gateway.calls.length, 0);
      assert.equal(mailer.sent.length, 0);
    });

    it('returns free status when every item costs 0', async () => {
      const gateway = fakeGateway({ ok: true, id: 'never' });
      const mailer = fakeMailer();
      const cart = baseCart({ items: [{ sku: 'TRIAL', unitPrice: 0, quantity: 1 }] });

      const result = await checkout(cart, { gateway, mailer });

      assert.equal(result.status, 'free');
      assert.equal(gateway.calls.length, 0);
    });
  });

  describe('declined payment', () => {
    it('throws PaymentDeclinedError with the gateway reason and sends no receipt', async () => {
      const gateway = fakeGateway({ ok: false, reason: 'card_declined' });
      const mailer = fakeMailer();

      await assert.rejects(
        () => checkout(baseCart(), { gateway, mailer }),
        (err) => {
          assert.ok(err instanceof PaymentDeclinedError);
          assert.equal(err.reason, 'card_declined');
          assert.equal(err.message, 'Payment declined: card_declined');
          return true;
        },
      );
      assert.equal(gateway.calls.length, 1);
      assert.equal(mailer.sent.length, 0);
    });
  });

  describe('failures', () => {
    it('rejects with RangeError and never charges when an item is invalid', async () => {
      const gateway = fakeGateway({ ok: true, id: 'never' });
      const mailer = fakeMailer();
      const cart = baseCart({ items: [{ sku: 'X', unitPrice: 100, quantity: 0 }] });

      await assert.rejects(() => checkout(cart, { gateway, mailer }), RangeError);
      assert.equal(gateway.calls.length, 0);
    });

    it('rejects with RangeError and never charges for an unknown discount code', async () => {
      const gateway = fakeGateway({ ok: true, id: 'never' });
      const mailer = fakeMailer();

      await assert.rejects(
        () => checkout(baseCart({ code: 'NOPE' }), { gateway, mailer }),
        /Unknown discount code NOPE/,
      );
      assert.equal(gateway.calls.length, 0);
    });

    it('rejects with RangeError and never charges for an out-of-range tax rate', async () => {
      const gateway = fakeGateway({ ok: true, id: 'never' });
      const mailer = fakeMailer();

      await assert.rejects(
        () => checkout(baseCart({ taxRate: 0.9 }), { gateway, mailer }),
        /Tax rate out of range/,
      );
      assert.equal(gateway.calls.length, 0);
    });

    it('propagates gateway errors and sends no receipt', async () => {
      const gateway = {
        async charge() {
          throw new Error('gateway unreachable');
        },
      };
      const mailer = fakeMailer();

      await assert.rejects(
        () => checkout(baseCart(), { gateway, mailer }),
        { message: 'gateway unreachable' },
      );
      assert.equal(mailer.sent.length, 0);
    });

    it('propagates mailer errors after the charge has gone through', async () => {
      const gateway = fakeGateway({ ok: true, id: 'ch_9' });
      const mailer = {
        async send() {
          throw new Error('smtp down');
        },
      };

      await assert.rejects(
        () => checkout(baseCart(), { gateway, mailer }),
        { message: 'smtp down' },
      );
      assert.equal(gateway.calls.length, 1);
    });
  });
});
