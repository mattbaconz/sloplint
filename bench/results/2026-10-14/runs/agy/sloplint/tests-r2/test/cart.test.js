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
  it('instantiates correctly with error name, custom message, and reason property', () => {
    const error = new PaymentDeclinedError('insufficient_funds');

    assert.ok(error instanceof Error);
    assert.ok(error instanceof PaymentDeclinedError);
    assert.strictEqual(error.name, 'PaymentDeclinedError');
    assert.strictEqual(error.reason, 'insufficient_funds');
    assert.strictEqual(error.message, 'Payment declined: insufficient_funds');
  });
});

describe('subtotal', () => {
  it('returns 0 for an empty items list', () => {
    const result = subtotal([]);
    assert.strictEqual(result, 0);
  });

  it('calculates the subtotal for a single item', () => {
    const items = [{ sku: 'seat-monthly', quantity: 2, unitPrice: 1500 }];
    const result = subtotal(items);
    assert.strictEqual(result, 3000);
  });

  it('calculates the accumulated subtotal across multiple items', () => {
    const items = [
      { sku: 'seat-monthly', quantity: 3, unitPrice: 2000 },
      { sku: 'storage-addon', quantity: 2, unitPrice: 500 },
      { sku: 'api-access', quantity: 1, unitPrice: 1000 },
    ];
    const result = subtotal(items);
    assert.strictEqual(result, 8000);
  });

  it('allows items with zero unit price', () => {
    const items = [
      { sku: 'community-tier', quantity: 1, unitPrice: 0 },
      { sku: 'support-tier', quantity: 1, unitPrice: 2500 },
    ];
    const result = subtotal(items);
    assert.strictEqual(result, 2500);
  });

  it('throws RangeError when quantity is not an integer', () => {
    assert.throws(
      () => subtotal([{ sku: 'item-fractional', quantity: 2.5, unitPrice: 1000 }]),
      {
        name: 'RangeError',
        message: 'Invalid quantity for item-fractional',
      }
    );
  });

  it('throws RangeError when quantity is non-numeric', () => {
    assert.throws(
      () => subtotal([{ sku: 'item-string', quantity: '3', unitPrice: 1000 }]),
      {
        name: 'RangeError',
        message: 'Invalid quantity for item-string',
      }
    );
  });

  it('throws RangeError when quantity is less than 1', () => {
    assert.throws(
      () => subtotal([{ sku: 'item-zero', quantity: 0, unitPrice: 1000 }]),
      {
        name: 'RangeError',
        message: 'Invalid quantity for item-zero',
      }
    );
    assert.throws(
      () => subtotal([{ sku: 'item-negative', quantity: -1, unitPrice: 1000 }]),
      {
        name: 'RangeError',
        message: 'Invalid quantity for item-negative',
      }
    );
  });

  it('throws RangeError when unitPrice is not an integer', () => {
    assert.throws(
      () => subtotal([{ sku: 'item-float-price', quantity: 1, unitPrice: 19.99 }]),
      {
        name: 'RangeError',
        message: 'Invalid price for item-float-price',
      }
    );
  });

  it('throws RangeError when unitPrice is negative', () => {
    assert.throws(
      () => subtotal([{ sku: 'item-negative-price', quantity: 1, unitPrice: -100 }]),
      {
        name: 'RangeError',
        message: 'Invalid price for item-negative-price',
      }
    );
  });

  it('throws RangeError when unitPrice is non-numeric', () => {
    assert.throws(
      () => subtotal([{ sku: 'item-string-price', quantity: 1, unitPrice: '500' }]),
      {
        name: 'RangeError',
        message: 'Invalid price for item-string-price',
      }
    );
  });
});

describe('discount', () => {
  it('returns 0 when discount code is omitted or falsy', () => {
    assert.strictEqual(discount(5000, undefined), 0);
    assert.strictEqual(discount(5000, null), 0);
    assert.strictEqual(discount(5000, ''), 0);
  });

  it('calculates SAVE10 percentage discount rounded to nearest cent', () => {
    assert.strictEqual(discount(1000, 'SAVE10'), 100);
    assert.strictEqual(discount(2550, 'SAVE10'), 255);
    assert.strictEqual(discount(105, 'SAVE10'), 11);
    assert.strictEqual(discount(104, 'SAVE10'), 10);
    assert.strictEqual(discount(0, 'SAVE10'), 0);
  });

  it('handles discount codes case-insensitively', () => {
    assert.strictEqual(discount(1000, 'save10'), 100);
    assert.strictEqual(discount(1000, 'Save10'), 100);
    assert.strictEqual(discount(2500, 'flat500'), 500);
    assert.strictEqual(discount(2500, 'Flat500'), 500);
  });

  it('applies FLAT500 discount when amount is at or above 2000 cents threshold', () => {
    assert.strictEqual(discount(2000, 'FLAT500'), 500);
    assert.strictEqual(discount(5000, 'FLAT500'), 500);
  });

  it('returns 0 for FLAT500 discount when amount is below 2000 cents threshold', () => {
    assert.strictEqual(discount(1999, 'FLAT500'), 0);
    assert.strictEqual(discount(1000, 'FLAT500'), 0);
    assert.strictEqual(discount(0, 'FLAT500'), 0);
  });

  it('throws RangeError for unrecognized discount codes', () => {
    assert.throws(() => discount(3000, 'DISCOUNT50'), {
      name: 'RangeError',
      message: 'Unknown discount code DISCOUNT50',
    });
    assert.throws(() => discount(3000, 'UNKNOWN'), {
      name: 'RangeError',
      message: 'Unknown discount code UNKNOWN',
    });
  });
});

describe('tax', () => {
  it('calculates tax accurately within allowable rate bounds', () => {
    assert.strictEqual(tax(1000, 0), 0);
    assert.strictEqual(tax(1000, 0.1), 100);
    assert.strictEqual(tax(1000, 0.0825), 83);
    assert.strictEqual(tax(1000, 0.5), 500);
    assert.strictEqual(tax(0, 0.2), 0);
  });

  it('throws RangeError when tax rate is below zero', () => {
    assert.throws(() => tax(1000, -0.01), {
      name: 'RangeError',
      message: 'Tax rate out of range: -0.01',
    });
  });

  it('throws RangeError when tax rate exceeds 0.5', () => {
    assert.throws(() => tax(1000, 0.51), {
      name: 'RangeError',
      message: 'Tax rate out of range: 0.51',
    });
    assert.throws(() => tax(1000, 0.8), {
      name: 'RangeError',
      message: 'Tax rate out of range: 0.8',
    });
  });
});

describe('checkout', () => {
  it('returns free status and skips payment gateway and mailer when total is 0', async () => {
    const cart = {
      customerId: 'cust_free',
      email: 'user-free@ledgerly.internal',
      items: [{ sku: 'starter-plan', quantity: 1, unitPrice: 0 }],
      taxRate: 0,
    };
    const gateway = {
      charge: mock.fn(async () => ({ ok: true, id: 'ch_free' })),
    };
    const mailer = {
      send: mock.fn(async () => ({ sent: true })),
    };

    const order = await checkout(cart, { gateway, mailer });

    assert.deepStrictEqual(order, { status: 'free', total: 0 });
    assert.strictEqual(gateway.charge.mock.calls.length, 0);
    assert.strictEqual(mailer.send.mock.calls.length, 0);
  });

  it('charges default usd currency and sends receipt email upon successful checkout', async () => {
    const cart = {
      customerId: 'cust_usd_default',
      email: 'finance@acme.corp',
      items: [
        { sku: 'seat-monthly', quantity: 2, unitPrice: 2000 },
      ],
      code: 'SAVE10',
      taxRate: 0.1,
    };
    const gateway = {
      charge: mock.fn(async () => ({ ok: true, id: 'ch_usd_123' })),
    };
    const mailer = {
      send: mock.fn(async () => ({ sent: true })),
    };

    const order = await checkout(cart, { gateway, mailer });

    assert.deepStrictEqual(order, { status: 'paid', total: 3960, chargeId: 'ch_usd_123' });
    assert.strictEqual(gateway.charge.mock.calls.length, 1);
    assert.deepStrictEqual(gateway.charge.mock.calls[0].arguments[0], {
      customerId: 'cust_usd_default',
      amount: 3960,
      currency: 'usd',
    });
    assert.strictEqual(mailer.send.mock.calls.length, 1);
    assert.deepStrictEqual(mailer.send.mock.calls[0].arguments[0], {
      to: 'finance@acme.corp',
      template: 'receipt',
      data: { total: 3960, chargeId: 'ch_usd_123' },
    });
  });

  it('respects explicitly provided currency in charge request', async () => {
    const cart = {
      customerId: 'cust_eur',
      email: 'accounting@berlin.de',
      currency: 'eur',
      items: [{ sku: 'pro-eur', quantity: 1, unitPrice: 5000 }],
      taxRate: 0.2,
    };
    const gateway = {
      charge: mock.fn(async () => ({ ok: true, id: 'ch_eur_456' })),
    };
    const mailer = {
      send: mock.fn(async () => ({ sent: true })),
    };

    const order = await checkout(cart, { gateway, mailer });

    assert.deepStrictEqual(order, { status: 'paid', total: 6000, chargeId: 'ch_eur_456' });
    assert.strictEqual(gateway.charge.mock.calls.length, 1);
    assert.strictEqual(gateway.charge.mock.calls[0].arguments[0].currency, 'eur');
    assert.strictEqual(mailer.send.mock.calls.length, 1);
  });

  it('computes total with FLAT500 discount code', async () => {
    const cart = {
      customerId: 'cust_flat_order',
      email: 'buyer@flat.org',
      items: [{ sku: 'annual-plan', quantity: 1, unitPrice: 2500 }],
      code: 'FLAT500',
      taxRate: 0.05,
    };
    const gateway = {
      charge: mock.fn(async () => ({ ok: true, id: 'ch_flat_789' })),
    };
    const mailer = {
      send: mock.fn(async () => ({ sent: true })),
    };

    const order = await checkout(cart, { gateway, mailer });

    assert.deepStrictEqual(order, { status: 'paid', total: 2100, chargeId: 'ch_flat_789' });
    assert.strictEqual(gateway.charge.mock.calls.length, 1);
    assert.strictEqual(gateway.charge.mock.calls[0].arguments[0].amount, 2100);
    assert.strictEqual(mailer.send.mock.calls.length, 1);
  });

  it('processes checkout without discount code', async () => {
    const cart = {
      customerId: 'cust_no_discount',
      email: 'regular@acme.corp',
      items: [{ sku: 'storage-tier', quantity: 2, unitPrice: 1000 }],
      taxRate: 0.08,
    };
    const gateway = {
      charge: mock.fn(async () => ({ ok: true, id: 'ch_standard_555' })),
    };
    const mailer = {
      send: mock.fn(async () => ({ sent: true })),
    };

    const order = await checkout(cart, { gateway, mailer });

    assert.deepStrictEqual(order, { status: 'paid', total: 2160, chargeId: 'ch_standard_555' });
    assert.strictEqual(gateway.charge.mock.calls.length, 1);
    assert.strictEqual(mailer.send.mock.calls.length, 1);
  });

  it('throws PaymentDeclinedError when gateway returns failure and suppresses mailer', async () => {
    const cart = {
      customerId: 'cust_declined',
      email: 'declined@ledgerly.internal',
      items: [{ sku: 'pro-tier', quantity: 1, unitPrice: 4000 }],
      taxRate: 0,
    };
    const gateway = {
      charge: mock.fn(async () => ({ ok: false, reason: 'card_declined' })),
    };
    const mailer = {
      send: mock.fn(async () => ({ sent: true })),
    };

    await assert.rejects(
      async () => checkout(cart, { gateway, mailer }),
      (err) => {
        assert.ok(err instanceof PaymentDeclinedError);
        assert.strictEqual(err.name, 'PaymentDeclinedError');
        assert.strictEqual(err.reason, 'card_declined');
        assert.strictEqual(err.message, 'Payment declined: card_declined');
        return true;
      }
    );

    assert.strictEqual(gateway.charge.mock.calls.length, 1);
    assert.strictEqual(mailer.send.mock.calls.length, 0);
  });

  it('propagates gateway network failure and suppresses mailer', async () => {
    const cart = {
      customerId: 'cust_timeout',
      email: 'timeout@ledgerly.internal',
      items: [{ sku: 'pro-tier', quantity: 1, unitPrice: 4000 }],
      taxRate: 0,
    };
    const networkError = new Error('Gateway timed out');
    const gateway = {
      charge: mock.fn(async () => {
        throw networkError;
      }),
    };
    const mailer = {
      send: mock.fn(async () => ({ sent: true })),
    };

    await assert.rejects(
      async () => checkout(cart, { gateway, mailer }),
      (err) => {
        assert.strictEqual(err, networkError);
        return true;
      }
    );

    assert.strictEqual(gateway.charge.mock.calls.length, 1);
    assert.strictEqual(mailer.send.mock.calls.length, 0);
  });

  it('propagates mailer service error after successful charge', async () => {
    const cart = {
      customerId: 'cust_mailer_fail',
      email: 'user@ledgerly.internal',
      items: [{ sku: 'pro-tier', quantity: 1, unitPrice: 4000 }],
      taxRate: 0,
    };
    const mailerError = new Error('SMTP server unresponsive');
    const gateway = {
      charge: mock.fn(async () => ({ ok: true, id: 'ch_charge_saved' })),
    };
    const mailer = {
      send: mock.fn(async () => {
        throw mailerError;
      }),
    };

    await assert.rejects(
      async () => checkout(cart, { gateway, mailer }),
      (err) => {
        assert.strictEqual(err, mailerError);
        return true;
      }
    );

    assert.strictEqual(gateway.charge.mock.calls.length, 1);
    assert.strictEqual(mailer.send.mock.calls.length, 1);
  });

  it('rejects without calling gateway or mailer when cart item quantity is invalid', async () => {
    const cart = {
      customerId: 'cust_bad_item',
      email: 'user@ledgerly.internal',
      items: [{ sku: 'broken-sku', quantity: 0, unitPrice: 1000 }],
      taxRate: 0,
    };
    const gateway = {
      charge: mock.fn(async () => ({ ok: true, id: 'ch_never' })),
    };
    const mailer = {
      send: mock.fn(async () => ({ sent: true })),
    };

    await assert.rejects(
      async () => checkout(cart, { gateway, mailer }),
      {
        name: 'RangeError',
        message: 'Invalid quantity for broken-sku',
      }
    );

    assert.strictEqual(gateway.charge.mock.calls.length, 0);
    assert.strictEqual(mailer.send.mock.calls.length, 0);
  });

  it('rejects without calling gateway or mailer when discount code is invalid', async () => {
    const cart = {
      customerId: 'cust_bad_code',
      email: 'user@ledgerly.internal',
      items: [{ sku: 'valid-sku', quantity: 1, unitPrice: 1000 }],
      code: 'INVALID_CODE',
      taxRate: 0,
    };
    const gateway = {
      charge: mock.fn(async () => ({ ok: true, id: 'ch_never' })),
    };
    const mailer = {
      send: mock.fn(async () => ({ sent: true })),
    };

    await assert.rejects(
      async () => checkout(cart, { gateway, mailer }),
      {
        name: 'RangeError',
        message: 'Unknown discount code INVALID_CODE',
      }
    );

    assert.strictEqual(gateway.charge.mock.calls.length, 0);
    assert.strictEqual(mailer.send.mock.calls.length, 0);
  });

  it('rejects without calling gateway or mailer when tax rate is out of range', async () => {
    const cart = {
      customerId: 'cust_bad_tax',
      email: 'user@ledgerly.internal',
      items: [{ sku: 'valid-sku', quantity: 1, unitPrice: 1000 }],
      taxRate: 0.9,
    };
    const gateway = {
      charge: mock.fn(async () => ({ ok: true, id: 'ch_never' })),
    };
    const mailer = {
      send: mock.fn(async () => ({ sent: true })),
    };

    await assert.rejects(
      async () => checkout(cart, { gateway, mailer }),
      {
        name: 'RangeError',
        message: 'Tax rate out of range: 0.9',
      }
    );

    assert.strictEqual(gateway.charge.mock.calls.length, 0);
    assert.strictEqual(mailer.send.mock.calls.length, 0);
  });
});
