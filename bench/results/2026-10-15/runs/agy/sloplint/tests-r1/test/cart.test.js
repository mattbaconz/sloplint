import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  PaymentDeclinedError,
  subtotal,
  discount,
  tax,
  checkout,
} from '../src/cart.js';

describe('PaymentDeclinedError', () => {
  it('creates an error with expected message, name, and reason', () => {
    const error = new PaymentDeclinedError('insufficient_funds');

    assert.ok(error instanceof Error);
    assert.ok(error instanceof PaymentDeclinedError);
    assert.strictEqual(error.name, 'PaymentDeclinedError');
    assert.strictEqual(error.reason, 'insufficient_funds');
    assert.strictEqual(error.message, 'Payment declined: insufficient_funds');
  });
});

describe('subtotal', () => {
  it('calculates sum across multiple line items', () => {
    const items = [
      { sku: 'LEDGER-PRO', quantity: 2, unitPrice: 1500 },
      { sku: 'SEAT-ADDON', quantity: 3, unitPrice: 500 },
      { sku: 'SUPPORT-PRIORITY', quantity: 1, unitPrice: 2000 },
    ];

    const result = subtotal(items);

    assert.strictEqual(result, 6500);
  });

  it('returns 0 for empty items list', () => {
    const result = subtotal([]);

    assert.strictEqual(result, 0);
  });

  it('permits line items with zero unit price', () => {
    const items = [{ sku: 'TIER-COMMUNITY', quantity: 2, unitPrice: 0 }];

    const result = subtotal(items);

    assert.strictEqual(result, 0);
  });

  it('throws RangeError when quantity is zero or negative', () => {
    assert.throws(
      () => subtotal([{ sku: 'SKU-ZERO', quantity: 0, unitPrice: 1000 }]),
      {
        name: 'RangeError',
        message: 'Invalid quantity for SKU-ZERO',
      }
    );

    assert.throws(
      () => subtotal([{ sku: 'SKU-NEG', quantity: -3, unitPrice: 1000 }]),
      {
        name: 'RangeError',
        message: 'Invalid quantity for SKU-NEG',
      }
    );
  });

  it('throws RangeError when quantity is not an integer', () => {
    assert.throws(
      () => subtotal([{ sku: 'SKU-FLOAT', quantity: 1.5, unitPrice: 1000 }]),
      {
        name: 'RangeError',
        message: 'Invalid quantity for SKU-FLOAT',
      }
    );

    assert.throws(
      () => subtotal([{ sku: 'SKU-STR', quantity: '2', unitPrice: 1000 }]),
      {
        name: 'RangeError',
        message: 'Invalid quantity for SKU-STR',
      }
    );

    assert.throws(
      () => subtotal([{ sku: 'SKU-NULL', quantity: null, unitPrice: 1000 }]),
      {
        name: 'RangeError',
        message: 'Invalid quantity for SKU-NULL',
      }
    );
  });

  it('throws RangeError when unit price is negative', () => {
    assert.throws(
      () => subtotal([{ sku: 'SKU-NEG-PRICE', quantity: 1, unitPrice: -50 }]),
      {
        name: 'RangeError',
        message: 'Invalid price for SKU-NEG-PRICE',
      }
    );
  });

  it('throws RangeError when unit price is not an integer', () => {
    assert.throws(
      () => subtotal([{ sku: 'SKU-FLOAT-PRICE', quantity: 1, unitPrice: 99.99 }]),
      {
        name: 'RangeError',
        message: 'Invalid price for SKU-FLOAT-PRICE',
      }
    );

    assert.throws(
      () => subtotal([{ sku: 'SKU-STR-PRICE', quantity: 1, unitPrice: '500' }]),
      {
        name: 'RangeError',
        message: 'Invalid price for SKU-STR-PRICE',
      }
    );

    assert.throws(
      () => subtotal([{ sku: 'SKU-NULL-PRICE', quantity: 1, unitPrice: null }]),
      {
        name: 'RangeError',
        message: 'Invalid price for SKU-NULL-PRICE',
      }
    );
  });
});

describe('discount', () => {
  it('returns 0 when discount code is falsy or omitted', () => {
    assert.strictEqual(discount(5000, undefined), 0);
    assert.strictEqual(discount(5000, null), 0);
    assert.strictEqual(discount(5000, ''), 0);
  });

  it('throws RangeError for unknown discount code', () => {
    assert.throws(
      () => discount(5000, 'EXPIRED50'),
      {
        name: 'RangeError',
        message: 'Unknown discount code EXPIRED50',
      }
    );
  });

  it('computes SAVE10 discount with 10 percent deduction and rounding', () => {
    assert.strictEqual(discount(1000, 'SAVE10'), 100);
    assert.strictEqual(discount(1005, 'SAVE10'), 101);
    assert.strictEqual(discount(1004, 'SAVE10'), 100);
    assert.strictEqual(discount(0, 'SAVE10'), 0);
  });

  it('handles discount codes case-insensitively', () => {
    assert.strictEqual(discount(1000, 'save10'), 100);
    assert.strictEqual(discount(2500, 'flat500'), 500);
  });

  it('applies FLAT500 discount when amount is at least 2000 cents', () => {
    assert.strictEqual(discount(2000, 'FLAT500'), 500);
    assert.strictEqual(discount(4500, 'FLAT500'), 500);
  });

  it('returns 0 for FLAT500 when amount is below 2000 cents threshold', () => {
    assert.strictEqual(discount(1999, 'FLAT500'), 0);
    assert.strictEqual(discount(1200, 'FLAT500'), 0);
    assert.strictEqual(discount(0, 'FLAT500'), 0);
  });
});

describe('tax', () => {
  it('computes tax based on amount and rate with rounding', () => {
    assert.strictEqual(tax(1000, 0.0825), 83);
    assert.strictEqual(tax(1000, 0.0824), 82);
    assert.strictEqual(tax(0, 0.2), 0);
  });

  it('permits tax rate at lower and upper boundaries', () => {
    assert.strictEqual(tax(2000, 0), 0);
    assert.strictEqual(tax(2000, 0.5), 1000);
  });

  it('throws RangeError when tax rate is below zero', () => {
    assert.throws(
      () => tax(1000, -0.01),
      {
        name: 'RangeError',
        message: 'Tax rate out of range: -0.01',
      }
    );
  });

  it('throws RangeError when tax rate exceeds 0.5', () => {
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
  it('returns free status and skips payment charge and receipt email when total is zero', async () => {
    const gateway = { charge: mock.fn() };
    const mailer = { send: mock.fn() };

    const cart = {
      items: [{ sku: 'FREE-PLAN', quantity: 1, unitPrice: 0 }],
      taxRate: 0,
      customerId: 'cust_free_1',
      email: 'founder@example.com',
    };

    const outcome = await checkout(cart, { gateway, mailer });

    assert.deepStrictEqual(outcome, { status: 'free', total: 0 });
    assert.strictEqual(gateway.charge.mock.calls.length, 0);
    assert.strictEqual(mailer.send.mock.calls.length, 0);
  });

  it('charges gateway and sends receipt email with default usd currency', async () => {
    const gateway = {
      charge: mock.fn(async () => ({ ok: true, id: 'ch_live_987' })),
    };
    const mailer = {
      send: mock.fn(async () => ({ delivered: true })),
    };

    const cart = {
      items: [
        { sku: 'SEAT-BASE', quantity: 2, unitPrice: 2000 },
        { sku: 'ADDON-STORAGE', quantity: 1, unitPrice: 1000 },
      ],
      taxRate: 0.1,
      customerId: 'cust_abc_123',
      email: 'billing@example.com',
    };

    const outcome = await checkout(cart, { gateway, mailer });

    assert.deepStrictEqual(outcome, {
      status: 'paid',
      total: 5500,
      chargeId: 'ch_live_987',
    });

    assert.strictEqual(gateway.charge.mock.calls.length, 1);
    assert.deepStrictEqual(gateway.charge.mock.calls[0].arguments[0], {
      customerId: 'cust_abc_123',
      amount: 5500,
      currency: 'usd',
    });

    assert.strictEqual(mailer.send.mock.calls.length, 1);
    assert.deepStrictEqual(mailer.send.mock.calls[0].arguments[0], {
      to: 'billing@example.com',
      template: 'receipt',
      data: {
        total: 5500,
        chargeId: 'ch_live_987',
      },
    });
  });

  it('charges gateway using explicit currency when provided in cart', async () => {
    const gateway = {
      charge: mock.fn(async () => ({ ok: true, id: 'ch_eur_111' })),
    };
    const mailer = {
      send: mock.fn(async () => ({ delivered: true })),
    };

    const cart = {
      items: [{ sku: 'EU-LICENSE', quantity: 1, unitPrice: 3000 }],
      taxRate: 0.2,
      currency: 'eur',
      customerId: 'cust_eu_999',
      email: 'paris@example.com',
    };

    const outcome = await checkout(cart, { gateway, mailer });

    assert.deepStrictEqual(outcome, {
      status: 'paid',
      total: 3600,
      chargeId: 'ch_eur_111',
    });
    assert.strictEqual(gateway.charge.mock.calls.length, 1);
    assert.strictEqual(gateway.charge.mock.calls[0].arguments[0].currency, 'eur');
  });

  it('applies discount code and tax rate in total checkout calculation', async () => {
    const gateway = {
      charge: mock.fn(async () => ({ ok: true, id: 'ch_disc_444' })),
    };
    const mailer = {
      send: mock.fn(async () => ({ delivered: true })),
    };

    const cart = {
      items: [{ sku: 'ENTERPRISE', quantity: 1, unitPrice: 4000 }],
      code: 'SAVE10',
      taxRate: 0.05,
      customerId: 'cust_corp_8',
      email: 'accounts@example.com',
    };

    const outcome = await checkout(cart, { gateway, mailer });

    assert.deepStrictEqual(outcome, {
      status: 'paid',
      total: 3780,
      chargeId: 'ch_disc_444',
    });
    assert.strictEqual(gateway.charge.mock.calls[0].arguments[0].amount, 3780);
    assert.strictEqual(mailer.send.mock.calls[0].arguments[0].data.total, 3780);
  });

  it('throws PaymentDeclinedError and suppresses email delivery when charge is rejected', async () => {
    const gateway = {
      charge: mock.fn(async () => ({ ok: false, reason: 'card_declined' })),
    };
    const mailer = {
      send: mock.fn(),
    };

    const cart = {
      items: [{ sku: 'SEAT', quantity: 1, unitPrice: 2500 }],
      taxRate: 0,
      customerId: 'cust_declined_1',
      email: 'client@example.com',
    };

    await assert.rejects(
      async () => checkout(cart, { gateway, mailer }),
      (err) => {
        assert.ok(err instanceof PaymentDeclinedError);
        assert.strictEqual(err.reason, 'card_declined');
        assert.strictEqual(err.message, 'Payment declined: card_declined');
        return true;
      }
    );

    assert.strictEqual(gateway.charge.mock.calls.length, 1);
    assert.strictEqual(mailer.send.mock.calls.length, 0);
  });

  it('propagates calculation errors before contacting gateway', async () => {
    const gateway = { charge: mock.fn() };
    const mailer = { send: mock.fn() };

    const cart = {
      items: [{ sku: 'BAD-SKU', quantity: 0, unitPrice: 1000 }],
      taxRate: 0.1,
      customerId: 'cust_err',
      email: 'err@example.com',
    };

    await assert.rejects(
      async () => checkout(cart, { gateway, mailer }),
      {
        name: 'RangeError',
        message: 'Invalid quantity for BAD-SKU',
      }
    );

    assert.strictEqual(gateway.charge.mock.calls.length, 0);
    assert.strictEqual(mailer.send.mock.calls.length, 0);
  });

  it('propagates gateway infrastructure failure without sending receipt', async () => {
    const networkError = new Error('Gateway connection timeout');
    const gateway = {
      charge: mock.fn(async () => {
        throw networkError;
      }),
    };
    const mailer = { send: mock.fn() };

    const cart = {
      items: [{ sku: 'PLAN', quantity: 1, unitPrice: 1500 }],
      taxRate: 0,
      customerId: 'cust_net_err',
      email: 'net@example.com',
    };

    await assert.rejects(
      async () => checkout(cart, { gateway, mailer }),
      {
        name: 'Error',
        message: 'Gateway connection timeout',
      }
    );

    assert.strictEqual(gateway.charge.mock.calls.length, 1);
    assert.strictEqual(mailer.send.mock.calls.length, 0);
  });
});
