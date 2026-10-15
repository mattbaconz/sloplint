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
  it('instantiates correctly and inherits from Error', () => {
    const err = new PaymentDeclinedError('insufficient_funds');

    assert.ok(err instanceof Error, 'should be instance of Error');
    assert.ok(err instanceof PaymentDeclinedError, 'should be instance of PaymentDeclinedError');
    assert.strictEqual(err.name, 'PaymentDeclinedError');
    assert.strictEqual(err.reason, 'insufficient_funds');
    assert.strictEqual(err.message, 'Payment declined: insufficient_funds');
    assert.ok(typeof err.stack === 'string' && err.stack.length > 0, 'should include stack trace');
  });

  it('handles arbitrary decline reasons', () => {
    const reasons = ['card_expired', 'stolen_card', 'invalid_cvc', 'unknown'];
    for (const reason of reasons) {
      const err = new PaymentDeclinedError(reason);
      assert.strictEqual(err.reason, reason);
      assert.strictEqual(err.message, `Payment declined: ${reason}`);
    }
  });
});

describe('subtotal', () => {
  it('returns 0 for an empty items array', () => {
    assert.strictEqual(subtotal([]), 0);
  });

  it('calculates the total for a single item with quantity 1', () => {
    const items = [{ sku: 'PRO-1', quantity: 1, unitPrice: 1500 }];
    assert.strictEqual(subtotal(items), 1500);
  });

  it('calculates the total for a single item with quantity > 1', () => {
    const items = [{ sku: 'PRO-1', quantity: 4, unitPrice: 1250 }];
    assert.strictEqual(subtotal(items), 5000);
  });

  it('calculates the total for multiple items', () => {
    const items = [
      { sku: 'ITEM-A', quantity: 2, unitPrice: 1000 },
      { sku: 'ITEM-B', quantity: 1, unitPrice: 2500 },
      { sku: 'ITEM-C', quantity: 3, unitPrice: 500 },
    ];
    // 2 * 1000 + 1 * 2500 + 3 * 500 = 2000 + 2500 + 1500 = 6000
    assert.strictEqual(subtotal(items), 6000);
  });

  it('allows items with unitPrice of 0 (e.g., free tier or promotion)', () => {
    const items = [
      { sku: 'FREE-STICKER', quantity: 2, unitPrice: 0 },
      { sku: 'PAID-APP', quantity: 1, unitPrice: 2000 },
    ];
    assert.strictEqual(subtotal(items), 2000);
  });

  it('handles large quantities and prices without precision loss', () => {
    const items = [
      { sku: 'ENTERPRISE', quantity: 1000, unitPrice: 1000000 },
    ];
    assert.strictEqual(subtotal(items), 1000000000);
  });

  describe('quantity validation', () => {
    it('throws RangeError when quantity is 0', () => {
      assert.throws(
        () => subtotal([{ sku: 'SKU-0', quantity: 0, unitPrice: 100 }]),
        (err) => {
          assert.ok(err instanceof RangeError);
          assert.strictEqual(err.message, 'Invalid quantity for SKU-0');
          return true;
        }
      );
    });

    it('throws RangeError when quantity is negative', () => {
      assert.throws(
        () => subtotal([{ sku: 'SKU-NEG', quantity: -1, unitPrice: 100 }]),
        (err) => {
          assert.ok(err instanceof RangeError);
          assert.strictEqual(err.message, 'Invalid quantity for SKU-NEG');
          return true;
        }
      );
    });

    it('throws RangeError when quantity is a float / non-integer', () => {
      for (const invalidQty of [1.5, 0.5, 2.0001, -0.5]) {
        assert.throws(
          () => subtotal([{ sku: 'SKU-FLOAT', quantity: invalidQty, unitPrice: 100 }]),
          (err) => {
            assert.ok(err instanceof RangeError);
            assert.strictEqual(err.message, 'Invalid quantity for SKU-FLOAT');
            return true;
          }
        );
      }
    });

    it('throws RangeError when quantity is non-numeric or special values', () => {
      for (const invalidQty of ['1', NaN, Infinity, -Infinity, null, undefined, true, {}]) {
        assert.throws(
          () => subtotal([{ sku: 'SKU-INVALID', quantity: invalidQty, unitPrice: 100 }]),
          (err) => {
            assert.ok(err instanceof RangeError);
            assert.strictEqual(err.message, 'Invalid quantity for SKU-INVALID');
            return true;
          }
        );
      }
    });

    it('identifies the correct failing item in multi-item carts', () => {
      const items = [
        { sku: 'ITEM-VALID', quantity: 2, unitPrice: 500 },
        { sku: 'ITEM-FAULTY', quantity: 0, unitPrice: 500 },
        { sku: 'ITEM-UNREACHED', quantity: 1, unitPrice: 500 },
      ];
      assert.throws(
        () => subtotal(items),
        (err) => {
          assert.ok(err instanceof RangeError);
          assert.strictEqual(err.message, 'Invalid quantity for ITEM-FAULTY');
          return true;
        }
      );
    });
  });

  describe('unitPrice validation', () => {
    it('throws RangeError when unitPrice is negative', () => {
      assert.throws(
        () => subtotal([{ sku: 'SKU-NEG-PRICE', quantity: 1, unitPrice: -1 }]),
        (err) => {
          assert.ok(err instanceof RangeError);
          assert.strictEqual(err.message, 'Invalid price for SKU-NEG-PRICE');
          return true;
        }
      );
    });

    it('throws RangeError when unitPrice is a float / non-integer', () => {
      for (const invalidPrice of [10.5, 0.99, -5.5]) {
        assert.throws(
          () => subtotal([{ sku: 'SKU-FLOAT-PRICE', quantity: 1, unitPrice: invalidPrice }]),
          (err) => {
            assert.ok(err instanceof RangeError);
            assert.strictEqual(err.message, 'Invalid price for SKU-FLOAT-PRICE');
            return true;
          }
        );
      }
    });

    it('throws RangeError when unitPrice is non-numeric or special values', () => {
      for (const invalidPrice of ['100', NaN, Infinity, -Infinity, null, undefined, false, []]) {
        assert.throws(
          () => subtotal([{ sku: 'SKU-INVALID-PRICE', quantity: 1, unitPrice: invalidPrice }]),
          (err) => {
            assert.ok(err instanceof RangeError);
            assert.strictEqual(err.message, 'Invalid price for SKU-INVALID-PRICE');
            return true;
          }
        );
      }
    });

    it('validates quantity before unitPrice if both are invalid', () => {
      assert.throws(
        () => subtotal([{ sku: 'BOTH-INVALID', quantity: -1, unitPrice: -100 }]),
        (err) => {
          assert.ok(err instanceof RangeError);
          assert.strictEqual(err.message, 'Invalid quantity for BOTH-INVALID');
          return true;
        }
      );
    });
  });
});

describe('discount', () => {
  describe('when no code or falsy code is provided', () => {
    it('returns 0 for undefined, null, empty string, or false', () => {
      assert.strictEqual(discount(1000, undefined), 0);
      assert.strictEqual(discount(1000, null), 0);
      assert.strictEqual(discount(1000, ''), 0);
      assert.strictEqual(discount(1000, false), 0);
      assert.strictEqual(discount(1000, 0), 0);
    });
  });

  describe('SAVE10 code', () => {
    it('calculates 10% discount on exact round numbers', () => {
      assert.strictEqual(discount(1000, 'SAVE10'), 100);
      assert.strictEqual(discount(2500, 'SAVE10'), 250);
      assert.strictEqual(discount(0, 'SAVE10'), 0);
    });

    it('rounds to nearest integer when 10% is fractional', () => {
      // 1004 * 0.1 = 100.4 -> Math.round -> 100
      assert.strictEqual(discount(1004, 'SAVE10'), 100);
      // 1005 * 0.1 = 100.5 -> Math.round -> 101
      assert.strictEqual(discount(1005, 'SAVE10'), 101);
      // 1006 * 0.1 = 100.6 -> Math.round -> 101
      assert.strictEqual(discount(1006, 'SAVE10'), 101);
    });

    it('is case-insensitive', () => {
      assert.strictEqual(discount(1000, 'save10'), 100);
      assert.strictEqual(discount(1000, 'Save10'), 100);
      assert.strictEqual(discount(1000, 'sAvE10'), 100);
    });
  });

  describe('FLAT500 code', () => {
    it('gives 500 discount when amount is greater than 2000', () => {
      assert.strictEqual(discount(2500, 'FLAT500'), 500);
      assert.strictEqual(discount(10000, 'FLAT500'), 500);
    });

    it('gives 500 discount at the exact 2000 boundary', () => {
      assert.strictEqual(discount(2000, 'FLAT500'), 500);
    });

    it('gives 0 discount when amount is strictly less than 2000', () => {
      assert.strictEqual(discount(1999, 'FLAT500'), 0);
      assert.strictEqual(discount(1500, 'FLAT500'), 0);
      assert.strictEqual(discount(500, 'FLAT500'), 0);
      assert.strictEqual(discount(0, 'FLAT500'), 0);
    });

    it('is case-insensitive', () => {
      assert.strictEqual(discount(2500, 'flat500'), 500);
      assert.strictEqual(discount(2500, 'Flat500'), 500);
      assert.strictEqual(discount(2500, 'fLaT500'), 500);
    });
  });

  describe('unknown discount code', () => {
    it('throws RangeError with the unknown code in the message', () => {
      assert.throws(
        () => discount(1000, 'SAVE20'),
        (err) => {
          assert.ok(err instanceof RangeError);
          assert.strictEqual(err.message, 'Unknown discount code SAVE20');
          return true;
        }
      );
    });

    it('preserves the original casing in the error message', () => {
      assert.throws(
        () => discount(1000, 'bogusCode'),
        (err) => {
          assert.ok(err instanceof RangeError);
          assert.strictEqual(err.message, 'Unknown discount code bogusCode');
          return true;
        }
      );
    });
  });
});

describe('tax', () => {
  describe('valid tax rates', () => {
    it('returns 0 when rate is 0', () => {
      assert.strictEqual(tax(1000, 0), 0);
    });

    it('calculates correct tax at the maximum boundary of 0.5', () => {
      assert.strictEqual(tax(1000, 0.5), 500);
    });

    it('calculates correct tax for standard rates', () => {
      assert.strictEqual(tax(1000, 0.08), 80);
      assert.strictEqual(tax(2000, 0.20), 400);
    });

    it('rounds to nearest integer when tax is fractional', () => {
      // 104 * 0.1 = 10.4 -> 10
      assert.strictEqual(tax(104, 0.1), 10);
      // 105 * 0.1 = 10.5 -> 11
      assert.strictEqual(tax(105, 0.1), 11);
      // 106 * 0.1 = 10.6 -> 11
      assert.strictEqual(tax(106, 0.1), 11);
    });

    it('returns 0 when amount is 0 regardless of rate', () => {
      assert.strictEqual(tax(0, 0.25), 0);
    });
  });

  describe('out of range tax rates', () => {
    it('throws RangeError when rate is negative', () => {
      for (const negativeRate of [-0.001, -0.01, -0.5, -1]) {
        assert.throws(
          () => tax(1000, negativeRate),
          (err) => {
            assert.ok(err instanceof RangeError);
            assert.strictEqual(err.message, `Tax rate out of range: ${negativeRate}`);
            return true;
          }
        );
      }
    });

    it('throws RangeError when rate is strictly greater than 0.5', () => {
      for (const highRate of [0.500001, 0.51, 0.75, 1.0]) {
        assert.throws(
          () => tax(1000, highRate),
          (err) => {
            assert.ok(err instanceof RangeError);
            assert.strictEqual(err.message, `Tax rate out of range: ${highRate}`);
            return true;
          }
        );
      }
    });
  });
});

describe('checkout', () => {
  function createMocks({ chargeResult = { ok: true, id: 'ch_123' }, mailerResult = { sent: true } } = {}) {
    const chargeCalls = [];
    const mailerCalls = [];

    const gateway = {
      charge: mock.fn(async (params) => {
        chargeCalls.push(params);
        return typeof chargeResult === 'function' ? chargeResult(params) : chargeResult;
      }),
    };

    const mailer = {
      send: mock.fn(async (params) => {
        mailerCalls.push(params);
        return typeof mailerResult === 'function' ? mailerResult(params) : mailerResult;
      }),
    };

    return { gateway, mailer, chargeCalls, mailerCalls };
  }

  it('successfully completes a paid checkout with default USD currency', async () => {
    const { gateway, mailer, chargeCalls, mailerCalls } = createMocks();
    const cart = {
      customerId: 'cust_abc123',
      email: 'customer@example.com',
      items: [
        { sku: 'PLAN-PRO', quantity: 1, unitPrice: 5000 },
      ],
      code: 'SAVE10',
      taxRate: 0.1,
    };

    // Subtotal: 5000
    // Discount (SAVE10): 5000 * 0.1 = 500
    // Net: 5000 - 500 = 4500
    // Tax: Math.round(4500 * 0.1) = 450
    // Total: 4500 + 450 = 4950

    const result = await checkout(cart, { gateway, mailer });

    assert.deepStrictEqual(result, {
      status: 'paid',
      total: 4950,
      chargeId: 'ch_123',
    });

    assert.strictEqual(gateway.charge.mock.callCount(), 1);
    assert.deepStrictEqual(chargeCalls[0], {
      customerId: 'cust_abc123',
      amount: 4950,
      currency: 'usd',
    });

    assert.strictEqual(mailer.send.mock.callCount(), 1);
    assert.deepStrictEqual(mailerCalls[0], {
      to: 'customer@example.com',
      template: 'receipt',
      data: {
        total: 4950,
        chargeId: 'ch_123',
      },
    });
  });

  it('uses explicitly provided currency instead of default usd', async () => {
    const { gateway, mailer, chargeCalls } = createMocks();
    const cart = {
      customerId: 'cust_eu_1',
      email: 'eu@example.com',
      currency: 'eur',
      items: [{ sku: 'PROD', quantity: 1, unitPrice: 2000 }],
      taxRate: 0.2,
    };

    // Subtotal: 2000
    // Discount: 0
    // Net: 2000
    // Tax: 400
    // Total: 2400

    const result = await checkout(cart, { gateway, mailer });

    assert.strictEqual(result.status, 'paid');
    assert.strictEqual(result.total, 2400);
    assert.strictEqual(chargeCalls[0].currency, 'eur');
  });

  it('correctly calculates checkout with FLAT500 discount code', async () => {
    const { gateway, mailer, chargeCalls } = createMocks();
    const cart = {
      customerId: 'cust_flat',
      email: 'flat@example.com',
      items: [{ sku: 'ITEM-1', quantity: 1, unitPrice: 2500 }],
      code: 'FLAT500',
      taxRate: 0.05,
    };

    // Subtotal: 2500
    // Discount (FLAT500 >= 2000): 500
    // Net: 2000
    // Tax: Math.round(2000 * 0.05) = 100
    // Total: 2100

    const result = await checkout(cart, { gateway, mailer });

    assert.deepStrictEqual(result, {
      status: 'paid',
      total: 2100,
      chargeId: 'ch_123',
    });
    assert.strictEqual(chargeCalls[0].amount, 2100);
  });

  it('returns status: "free" and skips gateway and mailer when total is 0', async () => {
    const { gateway, mailer } = createMocks();
    const cart = {
      customerId: 'cust_free',
      email: 'free@example.com',
      items: [{ sku: 'FREEBIE', quantity: 1, unitPrice: 0 }],
      taxRate: 0,
    };

    const result = await checkout(cart, { gateway, mailer });

    assert.deepStrictEqual(result, {
      status: 'free',
      total: 0,
    });
    assert.strictEqual(gateway.charge.mock.callCount(), 0, 'gateway should not be called');
    assert.strictEqual(mailer.send.mock.callCount(), 0, 'mailer should not be called');
  });

  it('returns status: "free" when items array is empty and tax is 0', async () => {
    const { gateway, mailer } = createMocks();
    const cart = {
      customerId: 'cust_empty',
      email: 'empty@example.com',
      items: [],
      taxRate: 0,
    };

    const result = await checkout(cart, { gateway, mailer });

    assert.deepStrictEqual(result, {
      status: 'free',
      total: 0,
    });
    assert.strictEqual(gateway.charge.mock.callCount(), 0);
    assert.strictEqual(mailer.send.mock.callCount(), 0);
  });

  it('throws PaymentDeclinedError and does NOT send receipt when charge fails', async () => {
    const { gateway, mailer } = createMocks({
      chargeResult: { ok: false, reason: 'insufficient_funds' },
    });
    const cart = {
      customerId: 'cust_declined',
      email: 'declined@example.com',
      items: [{ sku: 'ITEM', quantity: 1, unitPrice: 3000 }],
      taxRate: 0,
    };

    await assert.rejects(
      () => checkout(cart, { gateway, mailer }),
      (err) => {
        assert.ok(err instanceof PaymentDeclinedError);
        assert.ok(err instanceof Error);
        assert.strictEqual(err.name, 'PaymentDeclinedError');
        assert.strictEqual(err.reason, 'insufficient_funds');
        assert.strictEqual(err.message, 'Payment declined: insufficient_funds');
        return true;
      }
    );

    assert.strictEqual(gateway.charge.mock.callCount(), 1);
    assert.strictEqual(mailer.send.mock.callCount(), 0, 'mailer should never be called if payment declined');
  });

  it('supports different decline reasons from gateway', async () => {
    const { gateway, mailer } = createMocks({
      chargeResult: { ok: false, reason: 'fraud_risk_too_high' },
    });
    const cart = {
      customerId: 'cust_fraud',
      email: 'fraud@example.com',
      items: [{ sku: 'ITEM', quantity: 1, unitPrice: 1000 }],
      taxRate: 0,
    };

    await assert.rejects(
      () => checkout(cart, { gateway, mailer }),
      (err) => {
        assert.ok(err instanceof PaymentDeclinedError);
        assert.strictEqual(err.reason, 'fraud_risk_too_high');
        return true;
      }
    );
  });

  it('ensures gateway is called before mailer', async () => {
    const order = [];
    const gateway = {
      charge: mock.fn(async () => {
        order.push('gateway');
        return { ok: true, id: 'ch_seq' };
      }),
    };
    const mailer = {
      send: mock.fn(async () => {
        order.push('mailer');
        return { ok: true };
      }),
    };

    const cart = {
      customerId: 'cust_seq',
      email: 'seq@example.com',
      items: [{ sku: 'SEQ', quantity: 1, unitPrice: 100 }],
      taxRate: 0,
    };

    await checkout(cart, { gateway, mailer });
    assert.deepStrictEqual(order, ['gateway', 'mailer']);
  });

  it('propagates subtotal RangeError without calling gateway or mailer', async () => {
    const { gateway, mailer } = createMocks();
    const cart = {
      customerId: 'cust_bad_item',
      email: 'bad@example.com',
      items: [{ sku: 'BAD-QTY', quantity: -1, unitPrice: 100 }],
      taxRate: 0,
    };

    await assert.rejects(
      () => checkout(cart, { gateway, mailer }),
      { name: 'RangeError', message: 'Invalid quantity for BAD-QTY' }
    );
    assert.strictEqual(gateway.charge.mock.callCount(), 0);
    assert.strictEqual(mailer.send.mock.callCount(), 0);
  });

  it('propagates discount RangeError without calling gateway or mailer', async () => {
    const { gateway, mailer } = createMocks();
    const cart = {
      customerId: 'cust_bad_discount',
      email: 'bad@example.com',
      items: [{ sku: 'OK-ITEM', quantity: 1, unitPrice: 1000 }],
      code: 'INVALID_CODE',
      taxRate: 0,
    };

    await assert.rejects(
      () => checkout(cart, { gateway, mailer }),
      { name: 'RangeError', message: 'Unknown discount code INVALID_CODE' }
    );
    assert.strictEqual(gateway.charge.mock.callCount(), 0);
    assert.strictEqual(mailer.send.mock.callCount(), 0);
  });

  it('propagates tax RangeError without calling gateway or mailer', async () => {
    const { gateway, mailer } = createMocks();
    const cart = {
      customerId: 'cust_bad_tax',
      email: 'bad@example.com',
      items: [{ sku: 'OK-ITEM', quantity: 1, unitPrice: 1000 }],
      taxRate: 0.9,
    };

    await assert.rejects(
      () => checkout(cart, { gateway, mailer }),
      { name: 'RangeError', message: 'Tax rate out of range: 0.9' }
    );
    assert.strictEqual(gateway.charge.mock.callCount(), 0);
    assert.strictEqual(mailer.send.mock.callCount(), 0);
  });

  it('propagates unexpected gateway exception without calling mailer', async () => {
    const gateway = {
      charge: mock.fn(async () => {
        throw new Error('Gateway network timeout');
      }),
    };
    const mailer = {
      send: mock.fn(async () => {}),
    };
    const cart = {
      customerId: 'cust_net_err',
      email: 'err@example.com',
      items: [{ sku: 'ITEM', quantity: 1, unitPrice: 1000 }],
      taxRate: 0,
    };

    await assert.rejects(
      () => checkout(cart, { gateway, mailer }),
      { name: 'Error', message: 'Gateway network timeout' }
    );
    assert.strictEqual(mailer.send.mock.callCount(), 0);
  });

  it('propagates unexpected mailer exception after charge succeeds', async () => {
    const { gateway } = createMocks({ chargeResult: { ok: true, id: 'ch_mailer_fail' } });
    const mailer = {
      send: mock.fn(async () => {
        throw new Error('SMTP connection failed');
      }),
    };
    const cart = {
      customerId: 'cust_smtp_err',
      email: 'smtp@example.com',
      items: [{ sku: 'ITEM', quantity: 1, unitPrice: 1000 }],
      taxRate: 0,
    };

    await assert.rejects(
      () => checkout(cart, { gateway, mailer }),
      { name: 'Error', message: 'SMTP connection failed' }
    );
    assert.strictEqual(gateway.charge.mock.callCount(), 1);
  });
});
