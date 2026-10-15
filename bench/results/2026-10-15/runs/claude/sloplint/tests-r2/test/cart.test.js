import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PaymentDeclinedError, subtotal, discount, tax, checkout } from '../src/cart.js';

function makeGateway(result) {
  const calls = [];
  return {
    calls,
    async charge(request) {
      calls.push(request);
      if (result instanceof Error) throw result;
      return result;
    },
  };
}

function makeMailer(failure) {
  const sent = [];
  return {
    sent,
    async send(message) {
      if (failure) throw failure;
      sent.push(message);
    },
  };
}

function makeCart(overrides = {}) {
  return {
    customerId: 'cus_42',
    email: 'ada@example.com',
    items: [
      { sku: 'seat', unitPrice: 1500, quantity: 2 },
      { sku: 'addon', unitPrice: 250, quantity: 1 },
    ],
    taxRate: 0,
    ...overrides,
  };
}

describe('subtotal', () => {
  it('returns 0 for an empty cart', () => {
    assert.equal(subtotal([]), 0);
  });

  it('sums unitPrice * quantity across items', () => {
    assert.equal(
      subtotal([
        { sku: 'a', unitPrice: 1500, quantity: 2 },
        { sku: 'b', unitPrice: 250, quantity: 3 },
      ]),
      3750,
    );
  });

  it('accepts a zero unit price', () => {
    assert.equal(subtotal([{ sku: 'free-trial', unitPrice: 0, quantity: 1 }]), 0);
  });

  for (const quantity of [0, -1, 1.5, NaN, '2', undefined]) {
    it(`rejects quantity ${String(quantity)} and names the sku`, () => {
      assert.throws(
        () => subtotal([{ sku: 'seat', unitPrice: 100, quantity }]),
        { name: 'RangeError', message: 'Invalid quantity for seat' },
      );
    });
  }

  for (const unitPrice of [-1, 9.99, NaN, '100', undefined]) {
    it(`rejects unitPrice ${String(unitPrice)} and names the sku`, () => {
      assert.throws(
        () => subtotal([{ sku: 'addon', unitPrice, quantity: 1 }]),
        { name: 'RangeError', message: 'Invalid price for addon' },
      );
    });
  }

  it('rejects the whole cart when only a later item is invalid', () => {
    assert.throws(
      () =>
        subtotal([
          { sku: 'ok', unitPrice: 100, quantity: 1 },
          { sku: 'bad', unitPrice: 100, quantity: 0 },
        ]),
      /Invalid quantity for bad/,
    );
  });
});

describe('discount', () => {
  it('returns 0 when no code is given', () => {
    assert.equal(discount(5000, undefined), 0);
    assert.equal(discount(5000, null), 0);
    assert.equal(discount(5000, ''), 0);
  });

  it('SAVE10 takes 10% off', () => {
    assert.equal(discount(2500, 'SAVE10'), 250);
  });

  it('SAVE10 rounds half up to whole cents', () => {
    assert.equal(discount(15, 'SAVE10'), 2);
    assert.equal(discount(14, 'SAVE10'), 1);
  });

  it('SAVE10 on a zero amount is 0', () => {
    assert.equal(discount(0, 'SAVE10'), 0);
  });

  it('codes are case-insensitive', () => {
    assert.equal(discount(2500, 'save10'), 250);
    assert.equal(discount(2500, 'Flat500'), 500);
  });

  it('FLAT500 applies from exactly 2000 cents', () => {
    assert.equal(discount(2000, 'FLAT500'), 500);
    assert.equal(discount(10000, 'FLAT500'), 500);
  });

  it('FLAT500 does nothing below 2000 cents', () => {
    assert.equal(discount(1999, 'FLAT500'), 0);
    assert.equal(discount(0, 'FLAT500'), 0);
  });

  it('throws RangeError naming an unknown code', () => {
    assert.throws(() => discount(1000, 'BOGUS'), {
      name: 'RangeError',
      message: 'Unknown discount code BOGUS',
    });
  });

  it('does not resolve inherited object properties as codes', () => {
    assert.throws(() => discount(1000, 'constructor'), RangeError);
  });
});

describe('tax', () => {
  it('computes amount * rate', () => {
    assert.equal(tax(1000, 0.2), 200);
  });

  it('rounds to the nearest cent', () => {
    assert.equal(tax(15, 0.1), 2);
    assert.equal(tax(14, 0.1), 1);
  });

  it('allows the boundary rates 0 and 0.5', () => {
    assert.equal(tax(1000, 0), 0);
    assert.equal(tax(1000, 0.5), 500);
  });

  it('rejects rates below 0 or above 0.5', () => {
    assert.throws(() => tax(1000, -0.01), {
      name: 'RangeError',
      message: 'Tax rate out of range: -0.01',
    });
    assert.throws(() => tax(1000, 0.51), /Tax rate out of range: 0\.51/);
  });
});

describe('PaymentDeclinedError', () => {
  it('carries name, reason and a prefixed message', () => {
    const err = new PaymentDeclinedError('insufficient_funds');
    assert.ok(err instanceof Error);
    assert.equal(err.name, 'PaymentDeclinedError');
    assert.equal(err.reason, 'insufficient_funds');
    assert.equal(err.message, 'Payment declined: insufficient_funds');
  });
});

describe('checkout', () => {
  it('charges the subtotal, emails a receipt and returns paid', async () => {
    const gateway = makeGateway({ ok: true, id: 'ch_1' });
    const mailer = makeMailer();

    const result = await checkout(makeCart(), { gateway, mailer });

    assert.deepEqual(result, { status: 'paid', total: 3250, chargeId: 'ch_1' });
    assert.deepEqual(gateway.calls, [{ customerId: 'cus_42', amount: 3250, currency: 'usd' }]);
    assert.deepEqual(mailer.sent, [
      { to: 'ada@example.com', template: 'receipt', data: { total: 3250, chargeId: 'ch_1' } },
    ]);
  });

  it('uses the cart currency when provided', async () => {
    const gateway = makeGateway({ ok: true, id: 'ch_2' });
    await checkout(makeCart({ currency: 'eur' }), { gateway, mailer: makeMailer() });
    assert.equal(gateway.calls[0].currency, 'eur');
  });

  it('applies the discount before tax', async () => {
    // 3250 - 10% (325) = 2925; tax 20% = 585; total 3510
    const gateway = makeGateway({ ok: true, id: 'ch_3' });
    const result = await checkout(makeCart({ code: 'SAVE10', taxRate: 0.2 }), {
      gateway,
      mailer: makeMailer(),
    });
    assert.equal(result.total, 3510);
    assert.equal(gateway.calls[0].amount, 3510);
  });

  it('applies FLAT500 to the subtotal', async () => {
    const gateway = makeGateway({ ok: true, id: 'ch_4' });
    const result = await checkout(makeCart({ code: 'FLAT500' }), { gateway, mailer: makeMailer() });
    assert.equal(result.total, 2750);
  });

  it('returns free without charging or emailing when the total is 0', async () => {
    const gateway = makeGateway({ ok: true, id: 'unused' });
    const mailer = makeMailer();

    const result = await checkout(makeCart({ items: [] }), { gateway, mailer });

    assert.deepEqual(result, { status: 'free', total: 0 });
    assert.equal(gateway.calls.length, 0);
    assert.equal(mailer.sent.length, 0);
  });

  it('treats a cart of zero-priced items as free', async () => {
    const gateway = makeGateway({ ok: true, id: 'unused' });
    const result = await checkout(
      makeCart({ items: [{ sku: 'trial', unitPrice: 0, quantity: 1 }] }),
      { gateway, mailer: makeMailer() },
    );
    assert.equal(result.status, 'free');
    assert.equal(gateway.calls.length, 0);
  });

  it('throws PaymentDeclinedError with the gateway reason and sends no receipt', async () => {
    const gateway = makeGateway({ ok: false, reason: 'card_declined' });
    const mailer = makeMailer();

    await assert.rejects(checkout(makeCart(), { gateway, mailer }), (err) => {
      assert.ok(err instanceof PaymentDeclinedError);
      assert.equal(err.reason, 'card_declined');
      return true;
    });
    assert.equal(mailer.sent.length, 0);
  });

  it('propagates gateway failures without sending a receipt', async () => {
    const gateway = makeGateway(new Error('gateway timeout'));
    const mailer = makeMailer();

    await assert.rejects(checkout(makeCart(), { gateway, mailer }), /gateway timeout/);
    assert.equal(mailer.sent.length, 0);
  });

  it('propagates mailer failures after the charge was made', async () => {
    const gateway = makeGateway({ ok: true, id: 'ch_5' });
    const mailer = makeMailer(new Error('smtp down'));

    await assert.rejects(checkout(makeCart(), { gateway, mailer }), /smtp down/);
    assert.equal(gateway.calls.length, 1);
  });

  it('rejects invalid items before touching the gateway', async () => {
    const gateway = makeGateway({ ok: true, id: 'ch_6' });
    const cart = makeCart({ items: [{ sku: 'seat', unitPrice: 100, quantity: 0 }] });

    await assert.rejects(checkout(cart, { gateway, mailer: makeMailer() }), RangeError);
    assert.equal(gateway.calls.length, 0);
  });

  it('rejects an unknown code before charging', async () => {
    const gateway = makeGateway({ ok: true, id: 'ch_7' });

    await assert.rejects(
      checkout(makeCart({ code: 'NOPE' }), { gateway, mailer: makeMailer() }),
      /Unknown discount code NOPE/,
    );
    assert.equal(gateway.calls.length, 0);
  });

  it('rejects an out-of-range tax rate before charging', async () => {
    const gateway = makeGateway({ ok: true, id: 'ch_8' });

    await assert.rejects(
      checkout(makeCart({ taxRate: 0.9 }), { gateway, mailer: makeMailer() }),
      /Tax rate out of range/,
    );
    assert.equal(gateway.calls.length, 0);
  });
});
