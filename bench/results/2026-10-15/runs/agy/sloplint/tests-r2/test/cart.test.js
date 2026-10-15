import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PaymentDeclinedError,
  subtotal,
  discount,
  tax,
  checkout,
} from '../src/cart.js';

describe('PaymentDeclinedError', () => {
  it('initializes with proper message, name, and reason', () => {
    const error = new PaymentDeclinedError('insufficient_funds');

    assert.ok(error instanceof Error);
    assert.ok(error instanceof PaymentDeclinedError);
    assert.strictEqual(error.name, 'PaymentDeclinedError');
    assert.strictEqual(error.message, 'Payment declined: insufficient_funds');
    assert.strictEqual(error.reason, 'insufficient_funds');
  });
});

describe('subtotal', () => {
  it('returns zero for an empty items array', () => {
    const total = subtotal([]);
    assert.strictEqual(total, 0);
  });

  it('calculates the subtotal for a single item', () => {
    const items = [{ sku: 'SEAT_MONTHLY', quantity: 2, unitPrice: 1500 }];
    const total = subtotal(items);
    assert.strictEqual(total, 3000);
  });

  it('calculates the subtotal for multiple items with different quantities and prices', () => {
    const items = [
      { sku: 'SEAT_MONTHLY', quantity: 3, unitPrice: 2000 },
      { sku: 'STORAGE_TIER_1', quantity: 2, unitPrice: 750 },
      { sku: 'SUPPORT_PLAN', quantity: 1, unitPrice: 5000 },
    ];
    const total = subtotal(items);
    assert.strictEqual(total, 12500);
  });

  it('permits a free item with unitPrice of zero', () => {
    const items = [{ sku: 'COMMUNITY_SEAT', quantity: 5, unitPrice: 0 }];
    const total = subtotal(items);
    assert.strictEqual(total, 0);
  });

  it('throws RangeError when quantity is zero', () => {
    assert.throws(
      () => subtotal([{ sku: 'SEAT_MONTHLY', quantity: 0, unitPrice: 1000 }]),
      {
        name: 'RangeError',
        message: 'Invalid quantity for SEAT_MONTHLY',
      }
    );
  });

  it('throws RangeError when quantity is negative', () => {
    assert.throws(
      () => subtotal([{ sku: 'STORAGE_TIER_1', quantity: -1, unitPrice: 1000 }]),
      {
        name: 'RangeError',
        message: 'Invalid quantity for STORAGE_TIER_1',
      }
    );
  });

  it('throws RangeError when quantity is not an integer', () => {
    assert.throws(
      () => subtotal([{ sku: 'USAGE_HOURS', quantity: 1.5, unitPrice: 1000 }]),
      {
        name: 'RangeError',
        message: 'Invalid quantity for USAGE_HOURS',
      }
    );
    assert.throws(
      () => subtotal([{ sku: 'USAGE_HOURS', quantity: '2', unitPrice: 1000 }]),
      {
        name: 'RangeError',
        message: 'Invalid quantity for USAGE_HOURS',
      }
    );
    assert.throws(
      () => subtotal([{ sku: 'USAGE_HOURS', quantity: null, unitPrice: 1000 }]),
      {
        name: 'RangeError',
        message: 'Invalid quantity for USAGE_HOURS',
      }
    );
  });

  it('throws RangeError when unitPrice is negative', () => {
    assert.throws(
      () => subtotal([{ sku: 'DISCOUNT_CREDIT', quantity: 1, unitPrice: -500 }]),
      {
        name: 'RangeError',
        message: 'Invalid price for DISCOUNT_CREDIT',
      }
    );
  });

  it('throws RangeError when unitPrice is not an integer', () => {
    assert.throws(
      () => subtotal([{ sku: 'ENTERPRISE_PLAN', quantity: 1, unitPrice: 99.99 }]),
      {
        name: 'RangeError',
        message: 'Invalid price for ENTERPRISE_PLAN',
      }
    );
    assert.throws(
      () => subtotal([{ sku: 'ENTERPRISE_PLAN', quantity: 1, unitPrice: '1500' }]),
      {
        name: 'RangeError',
        message: 'Invalid price for ENTERPRISE_PLAN',
      }
    );
    assert.throws(
      () => subtotal([{ sku: 'ENTERPRISE_PLAN', quantity: 1, unitPrice: undefined }]),
      {
        name: 'RangeError',
        message: 'Invalid price for ENTERPRISE_PLAN',
      }
    );
  });
});

describe('discount', () => {
  it('returns zero when discount code is falsy', () => {
    assert.strictEqual(discount(5000, undefined), 0);
    assert.strictEqual(discount(5000, null), 0);
    assert.strictEqual(discount(5000, ''), 0);
  });

  it('calculates 10 percent discount for SAVE10 code', () => {
    assert.strictEqual(discount(1000, 'SAVE10'), 100);
    assert.strictEqual(discount(0, 'SAVE10'), 0);
  });

  it('rounds SAVE10 discount to nearest integer cent', () => {
    // 1005 * 0.1 = 100.5 -> 101
    assert.strictEqual(discount(1005, 'SAVE10'), 101);
    // 1004 * 0.1 = 100.4 -> 100
    assert.strictEqual(discount(1004, 'SAVE10'), 100);
  });

  it('handles lowercase and mixed-case SAVE10 code', () => {
    assert.strictEqual(discount(2000, 'save10'), 200);
    assert.strictEqual(discount(2000, 'Save10'), 200);
  });

  it('calculates flat 500 cents discount for FLAT500 when amount is at or above 2000', () => {
    assert.strictEqual(discount(2000, 'FLAT500'), 500);
    assert.strictEqual(discount(4500, 'FLAT500'), 500);
  });

  it('returns zero for FLAT500 when amount is strictly below 2000', () => {
    assert.strictEqual(discount(1999, 'FLAT500'), 0);
    assert.strictEqual(discount(1200, 'FLAT500'), 0);
    assert.strictEqual(discount(0, 'FLAT500'), 0);
  });

  it('handles lowercase and mixed-case FLAT500 code', () => {
    assert.strictEqual(discount(2500, 'flat500'), 500);
    assert.strictEqual(discount(2500, 'Flat500'), 500);
  });

  it('throws RangeError for unknown discount code', () => {
    assert.throws(
      () => discount(3000, 'PROMO50'),
      {
        name: 'RangeError',
        message: 'Unknown discount code PROMO50',
      }
    );
  });
});

describe('tax', () => {
  it('calculates tax for valid rate and rounds to nearest cent', () => {
    assert.strictEqual(tax(1000, 0.08), 80);
    // 105 * 0.1 = 10.5 -> 11
    assert.strictEqual(tax(105, 0.1), 11);
    // 104 * 0.1 = 10.4 -> 10
    assert.strictEqual(tax(104, 0.1), 10);
  });

  it('calculates tax at minimum boundary rate of 0', () => {
    assert.strictEqual(tax(2500, 0), 0);
  });

  it('calculates tax at maximum boundary rate of 0.5', () => {
    assert.strictEqual(tax(2000, 0.5), 1000);
  });

  it('throws RangeError when tax rate is less than 0', () => {
    assert.throws(
      () => tax(1000, -0.01),
      {
        name: 'RangeError',
        message: 'Tax rate out of range: -0.01',
      }
    );
  });

  it('throws RangeError when tax rate is greater than 0.5', () => {
    assert.throws(
      () => tax(1000, 0.51),
      {
        name: 'RangeError',
        message: 'Tax rate out of range: 0.51',
      }
    );
  });
});

describe('checkout', () => {
  function makeGateway(response = { ok: true, id: 'ch_test_1001' }) {
    const calls = [];
    return {
      calls,
      charge: async (params) => {
        calls.push(params);
        if (typeof response === 'function') {
          return response(params);
        }
        return response;
      },
    };
  }

  function makeMailer() {
    const calls = [];
    return {
      calls,
      send: async (payload) => {
        calls.push(payload);
        return { sent: true };
      },
    };
  }

  it('completes payment, sends receipt, and returns paid status for standard cart', async () => {
    const gateway = makeGateway({ ok: true, id: 'ch_paid_001' });
    const mailer = makeMailer();

    const cart = {
      customerId: 'cust_acct_42',
      email: 'billing@mercantile.internal',
      items: [
        { sku: 'SEAT_MONTHLY', quantity: 2, unitPrice: 2000 },
      ],
      code: null,
      taxRate: 0.05,
    };

    const order = await checkout(cart, { gateway, mailer });

    // subtotal = 4000, discount = 0, net = 4000, tax = 200, total = 4200
    assert.deepStrictEqual(order, {
      status: 'paid',
      total: 4200,
      chargeId: 'ch_paid_001',
    });
    assert.strictEqual(gateway.calls.length, 1);
    assert.deepStrictEqual(gateway.calls[0], {
      customerId: 'cust_acct_42',
      amount: 4200,
      currency: 'usd',
    });
    assert.strictEqual(mailer.calls.length, 1);
    assert.deepStrictEqual(mailer.calls[0], {
      to: 'billing@mercantile.internal',
      template: 'receipt',
      data: { total: 4200, chargeId: 'ch_paid_001' },
    });
  });

  it('forwards explicit currency to gateway when specified', async () => {
    const gateway = makeGateway({ ok: true, id: 'ch_eur_002' });
    const mailer = makeMailer();

    const cart = {
      customerId: 'cust_acct_88',
      email: 'finance@europay.internal',
      currency: 'eur',
      items: [{ sku: 'SEAT_MONTHLY', quantity: 1, unitPrice: 3000 }],
      code: null,
      taxRate: 0,
    };

    const order = await checkout(cart, { gateway, mailer });

    assert.strictEqual(order.status, 'paid');
    assert.strictEqual(order.total, 3000);
    assert.strictEqual(order.chargeId, 'ch_eur_002');
    assert.strictEqual(gateway.calls.length, 1);
    assert.strictEqual(gateway.calls[0].currency, 'eur');
  });

  it('applies percentage discount and calculates tax on discounted net', async () => {
    const gateway = makeGateway({ ok: true, id: 'ch_discount_003' });
    const mailer = makeMailer();

    const cart = {
      customerId: 'cust_acct_15',
      email: 'billing@mercantile.internal',
      items: [{ sku: 'ANNUAL_TIER', quantity: 1, unitPrice: 10000 }],
      code: 'SAVE10',
      taxRate: 0.1,
    };

    // subtotal = 10000, discount = 1000, net = 9000, tax = 900, total = 9900
    const order = await checkout(cart, { gateway, mailer });

    assert.deepStrictEqual(order, {
      status: 'paid',
      total: 9900,
      chargeId: 'ch_discount_003',
    });
    assert.strictEqual(gateway.calls.length, 1);
    assert.strictEqual(gateway.calls[0].amount, 9900);
    assert.strictEqual(mailer.calls.length, 1);
    assert.strictEqual(mailer.calls[0].data.total, 9900);
  });

  it('applies flat discount above qualification threshold', async () => {
    const gateway = makeGateway({ ok: true, id: 'ch_flat_004' });
    const mailer = makeMailer();

    const cart = {
      customerId: 'cust_acct_27',
      email: 'billing@mercantile.internal',
      items: [{ sku: 'PROFESSIONAL_TIER', quantity: 1, unitPrice: 3000 }],
      code: 'FLAT500',
      taxRate: 0.2,
    };

    // subtotal = 3000, discount = 500, net = 2500, tax = 500, total = 3000
    const order = await checkout(cart, { gateway, mailer });

    assert.deepStrictEqual(order, {
      status: 'paid',
      total: 3000,
      chargeId: 'ch_flat_004',
    });
    assert.strictEqual(gateway.calls.length, 1);
    assert.strictEqual(gateway.calls[0].amount, 3000);
  });

  it('resolves free status and bypasses gateway charge and email receipt when total is zero', async () => {
    const gateway = makeGateway();
    const mailer = makeMailer();

    const cart = {
      customerId: 'cust_acct_free',
      email: 'member@freeplan.internal',
      items: [{ sku: 'FREE_SEAT', quantity: 1, unitPrice: 0 }],
      code: null,
      taxRate: 0.1,
    };

    const order = await checkout(cart, { gateway, mailer });

    assert.deepStrictEqual(order, {
      status: 'free',
      total: 0,
    });
    assert.strictEqual(gateway.calls.length, 0);
    assert.strictEqual(mailer.calls.length, 0);
  });

  it('throws PaymentDeclinedError without sending receipt when gateway charge fails', async () => {
    const gateway = makeGateway({ ok: false, reason: 'insufficient_funds' });
    const mailer = makeMailer();

    const cart = {
      customerId: 'cust_acct_decline',
      email: 'declined@mercantile.internal',
      items: [{ sku: 'SEAT_MONTHLY', quantity: 1, unitPrice: 2000 }],
      code: null,
      taxRate: 0,
    };

    await assert.rejects(
      async () => checkout(cart, { gateway, mailer }),
      (err) => {
        assert.ok(err instanceof PaymentDeclinedError);
        assert.strictEqual(err.name, 'PaymentDeclinedError');
        assert.strictEqual(err.reason, 'insufficient_funds');
        assert.strictEqual(err.message, 'Payment declined: insufficient_funds');
        return true;
      }
    );

    assert.strictEqual(gateway.calls.length, 1);
    assert.strictEqual(mailer.calls.length, 0);
  });

  it('propagates error and skips mailer if gateway throws', async () => {
    const gateway = {
      calls: [],
      charge: async () => {
        throw new Error('Connection reset by payment peer');
      },
    };
    const mailer = makeMailer();

    const cart = {
      customerId: 'cust_acct_network_err',
      email: 'ops@mercantile.internal',
      items: [{ sku: 'SEAT_MONTHLY', quantity: 1, unitPrice: 1500 }],
      code: null,
      taxRate: 0,
    };

    await assert.rejects(
      async () => checkout(cart, { gateway, mailer }),
      {
        name: 'Error',
        message: 'Connection reset by payment peer',
      }
    );

    assert.strictEqual(mailer.calls.length, 0);
  });

  it('propagates error if mailer fails after charge', async () => {
    const gateway = makeGateway({ ok: true, id: 'ch_post_mail_err' });
    const mailer = {
      send: async () => {
        throw new Error('Receipt delivery service unavailable');
      },
    };

    const cart = {
      customerId: 'cust_acct_mail_err',
      email: 'receipt@mercantile.internal',
      items: [{ sku: 'SEAT_MONTHLY', quantity: 1, unitPrice: 1500 }],
      code: null,
      taxRate: 0,
    };

    await assert.rejects(
      async () => checkout(cart, { gateway, mailer }),
      {
        name: 'Error',
        message: 'Receipt delivery service unavailable',
      }
    );

    assert.strictEqual(gateway.calls.length, 1);
  });

  it('fails validation on invalid items before calling gateway or mailer', async () => {
    const gateway = makeGateway();
    const mailer = makeMailer();

    const cart = {
      customerId: 'cust_acct_invalid_items',
      email: 'invalid@mercantile.internal',
      items: [{ sku: 'BAD_SEAT', quantity: -1, unitPrice: 2000 }],
      code: null,
      taxRate: 0,
    };

    await assert.rejects(
      async () => checkout(cart, { gateway, mailer }),
      {
        name: 'RangeError',
        message: 'Invalid quantity for BAD_SEAT',
      }
    );

    assert.strictEqual(gateway.calls.length, 0);
    assert.strictEqual(mailer.calls.length, 0);
  });

  it('fails validation on invalid discount code before calling gateway or mailer', async () => {
    const gateway = makeGateway();
    const mailer = makeMailer();

    const cart = {
      customerId: 'cust_acct_invalid_code',
      email: 'invalid@mercantile.internal',
      items: [{ sku: 'SEAT_MONTHLY', quantity: 1, unitPrice: 2000 }],
      code: 'BOGUS_CODE',
      taxRate: 0,
    };

    await assert.rejects(
      async () => checkout(cart, { gateway, mailer }),
      {
        name: 'RangeError',
        message: 'Unknown discount code BOGUS_CODE',
      }
    );

    assert.strictEqual(gateway.calls.length, 0);
    assert.strictEqual(mailer.calls.length, 0);
  });

  it('fails validation on out-of-range tax rate before calling gateway or mailer', async () => {
    const gateway = makeGateway();
    const mailer = makeMailer();

    const cart = {
      customerId: 'cust_acct_invalid_tax',
      email: 'invalid@mercantile.internal',
      items: [{ sku: 'SEAT_MONTHLY', quantity: 1, unitPrice: 2000 }],
      code: null,
      taxRate: 0.75,
    };

    await assert.rejects(
      async () => checkout(cart, { gateway, mailer }),
      {
        name: 'RangeError',
        message: 'Tax rate out of range: 0.75',
      }
    );

    assert.strictEqual(gateway.calls.length, 0);
    assert.strictEqual(mailer.calls.length, 0);
  });
});
