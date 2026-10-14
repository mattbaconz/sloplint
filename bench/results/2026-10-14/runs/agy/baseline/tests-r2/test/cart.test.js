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
  it('creates an error instance with correct name, message, and reason', () => {
    const err = new PaymentDeclinedError('insufficient_funds');
    assert.ok(err instanceof Error);
    assert.ok(err instanceof PaymentDeclinedError);
    assert.strictEqual(err.name, 'PaymentDeclinedError');
    assert.strictEqual(err.reason, 'insufficient_funds');
    assert.strictEqual(err.message, 'Payment declined: insufficient_funds');
  });

  it('captures stack trace', () => {
    const err = new PaymentDeclinedError('expired_card');
    assert.strictEqual(typeof err.stack, 'string');
    assert.ok(err.stack.includes('PaymentDeclinedError'));
  });
});

describe('subtotal', () => {
  it('returns 0 for an empty items array', () => {
    assert.strictEqual(subtotal([]), 0);
  });

  it('calculates the subtotal for a single item with quantity 1', () => {
    const items = [{ sku: 'SKU-A', quantity: 1, unitPrice: 1500 }];
    assert.strictEqual(subtotal(items), 1500);
  });

  it('calculates the subtotal for a single item with quantity > 1', () => {
    const items = [{ sku: 'SKU-A', quantity: 4, unitPrice: 250 }];
    assert.strictEqual(subtotal(items), 1000);
  });

  it('calculates the subtotal across multiple items', () => {
    const items = [
      { sku: 'SKU-A', quantity: 2, unitPrice: 500 },  // 1000
      { sku: 'SKU-B', quantity: 3, unitPrice: 1200 }, // 3600
      { sku: 'SKU-C', quantity: 1, unitPrice: 400 },  // 400
    ];
    assert.strictEqual(subtotal(items), 5000);
  });

  it('allows items with unitPrice of 0 (free items)', () => {
    const items = [
      { sku: 'FREE-STICKER', quantity: 5, unitPrice: 0 },
      { sku: 'PAID-ITEM', quantity: 1, unitPrice: 1000 },
    ];
    assert.strictEqual(subtotal(items), 1000);
  });

  describe('quantity validation', () => {
    it('throws RangeError when quantity is 0', () => {
      assert.throws(
        () => subtotal([{ sku: 'SKU-ZERO', quantity: 0, unitPrice: 100 }]),
        { name: 'RangeError', message: 'Invalid quantity for SKU-ZERO' }
      );
    });

    it('throws RangeError when quantity is negative', () => {
      assert.throws(
        () => subtotal([{ sku: 'SKU-NEG', quantity: -3, unitPrice: 100 }]),
        { name: 'RangeError', message: 'Invalid quantity for SKU-NEG' }
      );
    });

    it('throws RangeError when quantity is a non-integer float', () => {
      assert.throws(
        () => subtotal([{ sku: 'SKU-FLOAT', quantity: 2.5, unitPrice: 100 }]),
        { name: 'RangeError', message: 'Invalid quantity for SKU-FLOAT' }
      );
    });

    it('throws RangeError when quantity is not a number (string, null, undefined, NaN)', () => {
      for (const invalidQty of ['2', null, undefined, NaN, Infinity, -Infinity]) {
        assert.throws(
          () => subtotal([{ sku: 'SKU-BAD', quantity: invalidQty, unitPrice: 100 }]),
          { name: 'RangeError', message: 'Invalid quantity for SKU-BAD' }
        );
      }
    });

    it('identifies the exact sku in the error when a later item has invalid quantity', () => {
      const items = [
        { sku: 'SKU-OK', quantity: 1, unitPrice: 500 },
        { sku: 'SKU-ERR', quantity: 0, unitPrice: 500 },
      ];
      assert.throws(
        () => subtotal(items),
        { name: 'RangeError', message: 'Invalid quantity for SKU-ERR' }
      );
    });
  });

  describe('unitPrice validation', () => {
    it('throws RangeError when unitPrice is negative', () => {
      assert.throws(
        () => subtotal([{ sku: 'SKU-NEG-PRICE', quantity: 1, unitPrice: -50 }]),
        { name: 'RangeError', message: 'Invalid price for SKU-NEG-PRICE' }
      );
    });

    it('throws RangeError when unitPrice is a float', () => {
      assert.throws(
        () => subtotal([{ sku: 'SKU-FLOAT-PRICE', quantity: 1, unitPrice: 19.99 }]),
        { name: 'RangeError', message: 'Invalid price for SKU-FLOAT-PRICE' }
      );
    });

    it('throws RangeError when unitPrice is not an integer (string, null, undefined, NaN)', () => {
      for (const invalidPrice of ['100', null, undefined, NaN, Infinity, -Infinity]) {
        assert.throws(
          () => subtotal([{ sku: 'SKU-BAD-PRICE', quantity: 1, unitPrice: invalidPrice }]),
          { name: 'RangeError', message: 'Invalid price for SKU-BAD-PRICE' }
        );
      }
    });

    it('identifies the exact sku in the error when a later item has invalid unitPrice', () => {
      const items = [
        { sku: 'SKU-VALID', quantity: 2, unitPrice: 500 },
        { sku: 'SKU-INVALID-PRICE', quantity: 1, unitPrice: -10 },
      ];
      assert.throws(
        () => subtotal(items),
        { name: 'RangeError', message: 'Invalid price for SKU-INVALID-PRICE' }
      );
    });
  });
});

describe('discount', () => {
  it('returns 0 when discount code is undefined, null, or empty string', () => {
    assert.strictEqual(discount(1000, undefined), 0);
    assert.strictEqual(discount(1000, null), 0);
    assert.strictEqual(discount(1000, ''), 0);
    assert.strictEqual(discount(1000), 0);
  });

  describe('SAVE10 code', () => {
    it('applies 10% discount on round amounts', () => {
      assert.strictEqual(discount(1000, 'SAVE10'), 100);
      assert.strictEqual(discount(5000, 'SAVE10'), 500);
      assert.strictEqual(discount(0, 'SAVE10'), 0);
    });

    it('rounds to nearest integer cents correctly', () => {
      // 1004 * 0.1 = 100.4 -> 100
      assert.strictEqual(discount(1004, 'SAVE10'), 100);
      // 1005 * 0.1 = 100.5 -> 101
      assert.strictEqual(discount(1005, 'SAVE10'), 101);
      // 1006 * 0.1 = 100.6 -> 101
      assert.strictEqual(discount(1006, 'SAVE10'), 101);
      // 1015 * 0.1 = 101.5 -> 102
      assert.strictEqual(discount(1015, 'SAVE10'), 102);
    });

    it('is case-insensitive', () => {
      assert.strictEqual(discount(1000, 'save10'), 100);
      assert.strictEqual(discount(1000, 'Save10'), 100);
      assert.strictEqual(discount(1000, 'sAvE10'), 100);
    });
  });

  describe('FLAT500 code', () => {
    it('returns 500 when amount is exactly 2000 (threshold)', () => {
      assert.strictEqual(discount(2000, 'FLAT500'), 500);
    });

    it('returns 500 when amount is strictly greater than 2000', () => {
      assert.strictEqual(discount(2001, 'FLAT500'), 500);
      assert.strictEqual(discount(5000, 'FLAT500'), 500);
    });

    it('returns 0 when amount is less than 2000', () => {
      assert.strictEqual(discount(1999, 'FLAT500'), 0);
      assert.strictEqual(discount(1000, 'FLAT500'), 0);
      assert.strictEqual(discount(0, 'FLAT500'), 0);
    });

    it('is case-insensitive', () => {
      assert.strictEqual(discount(2500, 'flat500'), 500);
      assert.strictEqual(discount(2500, 'Flat500'), 500);
      assert.strictEqual(discount(2500, 'fLaT500'), 500);
      assert.strictEqual(discount(1500, 'flat500'), 0);
    });
  });

  describe('invalid discount codes', () => {
    it('throws RangeError for unknown discount codes with the code in message', () => {
      assert.throws(
        () => discount(1000, 'BOGUS'),
        { name: 'RangeError', message: 'Unknown discount code BOGUS' }
      );
      assert.throws(
        () => discount(1000, 'save20'),
        { name: 'RangeError', message: 'Unknown discount code save20' }
      );
    });
  });
});

describe('tax', () => {
  it('calculates 0 tax when rate is 0', () => {
    assert.strictEqual(tax(1000, 0), 0);
  });

  it('calculates tax correctly at maximum rate (0.5)', () => {
    assert.strictEqual(tax(1000, 0.5), 500);
    assert.strictEqual(tax(105, 0.5), 53); // 105 * 0.5 = 52.5 -> 53
  });

  it('calculates tax for typical rates and rounds to nearest cent', () => {
    // 1000 * 0.0825 = 82.5 -> 83
    assert.strictEqual(tax(1000, 0.0825), 83);
    // 100 * 0.082 = 8.2 -> 8
    assert.strictEqual(tax(100, 0.082), 8);
    // 100 * 0.086 = 8.6 -> 9
    assert.strictEqual(tax(100, 0.086), 9);
    // 0 amount with valid rate -> 0
    assert.strictEqual(tax(0, 0.15), 0);
  });

  it('throws RangeError when tax rate is negative', () => {
    assert.throws(
      () => tax(1000, -0.01),
      { name: 'RangeError', message: 'Tax rate out of range: -0.01' }
    );
    assert.throws(
      () => tax(1000, -0.5),
      { name: 'RangeError', message: 'Tax rate out of range: -0.5' }
    );
  });

  it('throws RangeError when tax rate exceeds 0.5', () => {
    assert.throws(
      () => tax(1000, 0.5001),
      { name: 'RangeError', message: 'Tax rate out of range: 0.5001' }
    );
    assert.throws(
      () => tax(1000, 0.75),
      { name: 'RangeError', message: 'Tax rate out of range: 0.75' }
    );
    assert.throws(
      () => tax(1000, 1.0),
      { name: 'RangeError', message: 'Tax rate out of range: 1' }
    );
  });
});

describe('checkout', () => {
  describe('free orders (total === 0)', () => {
    it('returns free status and skips gateway and mailer when items array is empty', async () => {
      const chargeMock = mock.fn();
      const sendMock = mock.fn();

      const result = await checkout(
        { items: [], taxRate: 0, customerId: 'cust_1', email: 'user@example.com' },
        { gateway: { charge: chargeMock }, mailer: { send: sendMock } }
      );

      assert.deepStrictEqual(result, { status: 'free', total: 0 });
      assert.strictEqual(chargeMock.mock.calls.length, 0);
      assert.strictEqual(sendMock.mock.calls.length, 0);
    });

    it('returns free status and skips gateway and mailer when item prices are 0', async () => {
      const chargeMock = mock.fn();
      const sendMock = mock.fn();

      const result = await checkout(
        {
          items: [{ sku: 'FREE-TIER', quantity: 1, unitPrice: 0 }],
          taxRate: 0.1,
          customerId: 'cust_free',
          email: 'free@example.com',
        },
        { gateway: { charge: chargeMock }, mailer: { send: sendMock } }
      );

      assert.deepStrictEqual(result, { status: 'free', total: 0 });
      assert.strictEqual(chargeMock.mock.calls.length, 0);
      assert.strictEqual(sendMock.mock.calls.length, 0);
    });
  });

  describe('successful paid orders', () => {
    it('processes order, charges gateway in USD by default, sends receipt, and returns paid result', async () => {
      const chargeMock = mock.fn(async () => ({ ok: true, id: 'ch_test_123' }));
      const sendMock = mock.fn(async () => ({ ok: true }));

      const cart = {
        items: [
          { sku: 'PLAN-PRO', quantity: 2, unitPrice: 2000 }, // 4000
        ],
        code: 'SAVE10', // 400 discount -> net 3600
        taxRate: 0.1,    // 360 tax -> total 3960
        customerId: 'cust_456',
        email: 'pro@example.com',
      };

      const result = await checkout(cart, {
        gateway: { charge: chargeMock },
        mailer: { send: sendMock },
      });

      assert.deepStrictEqual(result, {
        status: 'paid',
        total: 3960,
        chargeId: 'ch_test_123',
      });

      // Verify gateway call
      assert.strictEqual(chargeMock.mock.calls.length, 1);
      assert.deepStrictEqual(chargeMock.mock.calls[0].arguments[0], {
        customerId: 'cust_456',
        amount: 3960,
        currency: 'usd',
      });

      // Verify mailer call
      assert.strictEqual(sendMock.mock.calls.length, 1);
      assert.deepStrictEqual(sendMock.mock.calls[0].arguments[0], {
        to: 'pro@example.com',
        template: 'receipt',
        data: { total: 3960, chargeId: 'ch_test_123' },
      });
    });

    it('respects custom currency specified in cart', async () => {
      const chargeMock = mock.fn(async () => ({ ok: true, id: 'ch_eur_999' }));
      const sendMock = mock.fn(async () => {});

      const cart = {
        items: [{ sku: 'SKU-EUR', quantity: 1, unitPrice: 1000 }],
        taxRate: 0.2, // net 1000 + tax 200 = 1200
        currency: 'eur',
        customerId: 'cust_eu',
        email: 'eu@example.com',
      };

      const result = await checkout(cart, {
        gateway: { charge: chargeMock },
        mailer: { send: sendMock },
      });

      assert.strictEqual(result.status, 'paid');
      assert.strictEqual(result.total, 1200);
      assert.strictEqual(result.chargeId, 'ch_eur_999');

      assert.strictEqual(chargeMock.mock.calls.length, 1);
      assert.strictEqual(chargeMock.mock.calls[0].arguments[0].currency, 'eur');
      assert.strictEqual(chargeMock.mock.calls[0].arguments[0].amount, 1200);
    });

    it('works without discount code and 0 tax rate', async () => {
      const chargeMock = mock.fn(async () => ({ ok: true, id: 'ch_simple' }));
      const sendMock = mock.fn(async () => {});

      const cart = {
        items: [{ sku: 'SKU-A', quantity: 3, unitPrice: 500 }],
        taxRate: 0,
        customerId: 'cust_simple',
        email: 'simple@example.com',
      };

      const result = await checkout(cart, {
        gateway: { charge: chargeMock },
        mailer: { send: sendMock },
      });

      assert.deepStrictEqual(result, {
        status: 'paid',
        total: 1500,
        chargeId: 'ch_simple',
      });
      assert.strictEqual(chargeMock.mock.calls[0].arguments[0].amount, 1500);
    });

    it('correctly applies FLAT500 discount during checkout', async () => {
      const chargeMock = mock.fn(async () => ({ ok: true, id: 'ch_flat' }));
      const sendMock = mock.fn(async () => {});

      const cart = {
        items: [{ sku: 'BIG-PLAN', quantity: 1, unitPrice: 2500 }],
        code: 'FLAT500', // 2500 - 500 = 2000
        taxRate: 0.05,   // 2000 * 0.05 = 100 -> total 2100
        customerId: 'cust_flat',
        email: 'flat@example.com',
      };

      const result = await checkout(cart, {
        gateway: { charge: chargeMock },
        mailer: { send: sendMock },
      });

      assert.deepStrictEqual(result, {
        status: 'paid',
        total: 2100,
        chargeId: 'ch_flat',
      });
      assert.strictEqual(chargeMock.mock.calls[0].arguments[0].amount, 2100);
    });
  });

  describe('payment declined', () => {
    it('throws PaymentDeclinedError with reason and does not call mailer', async () => {
      const chargeMock = mock.fn(async () => ({ ok: false, reason: 'insufficient_funds' }));
      const sendMock = mock.fn(async () => {});

      const cart = {
        items: [{ sku: 'SUB-1', quantity: 1, unitPrice: 1000 }],
        taxRate: 0,
        customerId: 'cust_broke',
        email: 'broke@example.com',
      };

      await assert.rejects(
        () => checkout(cart, { gateway: { charge: chargeMock }, mailer: { send: sendMock } }),
        (err) => {
          assert.ok(err instanceof PaymentDeclinedError);
          assert.strictEqual(err.name, 'PaymentDeclinedError');
          assert.strictEqual(err.reason, 'insufficient_funds');
          assert.strictEqual(err.message, 'Payment declined: insufficient_funds');
          return true;
        }
      );

      assert.strictEqual(chargeMock.mock.calls.length, 1);
      assert.strictEqual(sendMock.mock.calls.length, 0);
    });
  });

  describe('upstream validation and execution errors', () => {
    it('propagates invalid item quantity RangeError without calling gateway or mailer', async () => {
      const chargeMock = mock.fn();
      const sendMock = mock.fn();

      const cart = {
        items: [{ sku: 'SKU-BAD', quantity: -1, unitPrice: 1000 }],
        taxRate: 0,
        customerId: 'cust_1',
        email: 'test@example.com',
      };

      await assert.rejects(
        () => checkout(cart, { gateway: { charge: chargeMock }, mailer: { send: sendMock } }),
        { name: 'RangeError', message: 'Invalid quantity for SKU-BAD' }
      );

      assert.strictEqual(chargeMock.mock.calls.length, 0);
      assert.strictEqual(sendMock.mock.calls.length, 0);
    });

    it('propagates invalid item price RangeError without calling gateway or mailer', async () => {
      const chargeMock = mock.fn();
      const sendMock = mock.fn();

      const cart = {
        items: [{ sku: 'SKU-BAD-PRICE', quantity: 1, unitPrice: -500 }],
        taxRate: 0,
        customerId: 'cust_1',
        email: 'test@example.com',
      };

      await assert.rejects(
        () => checkout(cart, { gateway: { charge: chargeMock }, mailer: { send: sendMock } }),
        { name: 'RangeError', message: 'Invalid price for SKU-BAD-PRICE' }
      );

      assert.strictEqual(chargeMock.mock.calls.length, 0);
      assert.strictEqual(sendMock.mock.calls.length, 0);
    });

    it('propagates unknown discount code RangeError without calling gateway or mailer', async () => {
      const chargeMock = mock.fn();
      const sendMock = mock.fn();

      const cart = {
        items: [{ sku: 'SKU-A', quantity: 1, unitPrice: 1000 }],
        code: 'NOTEXIST',
        taxRate: 0,
        customerId: 'cust_1',
        email: 'test@example.com',
      };

      await assert.rejects(
        () => checkout(cart, { gateway: { charge: chargeMock }, mailer: { send: sendMock } }),
        { name: 'RangeError', message: 'Unknown discount code NOTEXIST' }
      );

      assert.strictEqual(chargeMock.mock.calls.length, 0);
      assert.strictEqual(sendMock.mock.calls.length, 0);
    });

    it('propagates tax rate out of range RangeError without calling gateway or mailer', async () => {
      const chargeMock = mock.fn();
      const sendMock = mock.fn();

      const cart = {
        items: [{ sku: 'SKU-A', quantity: 1, unitPrice: 1000 }],
        taxRate: 0.6,
        customerId: 'cust_1',
        email: 'test@example.com',
      };

      await assert.rejects(
        () => checkout(cart, { gateway: { charge: chargeMock }, mailer: { send: sendMock } }),
        { name: 'RangeError', message: 'Tax rate out of range: 0.6' }
      );

      assert.strictEqual(chargeMock.mock.calls.length, 0);
      assert.strictEqual(sendMock.mock.calls.length, 0);
    });

    it('propagates gateway network or runtime rejection without calling mailer', async () => {
      const networkError = new Error('Gateway connection timeout');
      const chargeMock = mock.fn(async () => {
        throw networkError;
      });
      const sendMock = mock.fn();

      const cart = {
        items: [{ sku: 'SKU-A', quantity: 1, unitPrice: 1000 }],
        taxRate: 0,
        customerId: 'cust_1',
        email: 'test@example.com',
      };

      await assert.rejects(
        () => checkout(cart, { gateway: { charge: chargeMock }, mailer: { send: sendMock } }),
        (err) => err === networkError
      );

      assert.strictEqual(chargeMock.mock.calls.length, 1);
      assert.strictEqual(sendMock.mock.calls.length, 0);
    });

    it('propagates mailer rejection when mail delivery fails after successful charge', async () => {
      const mailerError = new Error('SMTP connection refused');
      const chargeMock = mock.fn(async () => ({ ok: true, id: 'ch_mailer_fail' }));
      const sendMock = mock.fn(async () => {
        throw mailerError;
      });

      const cart = {
        items: [{ sku: 'SKU-A', quantity: 1, unitPrice: 1000 }],
        taxRate: 0,
        customerId: 'cust_1',
        email: 'test@example.com',
      };

      await assert.rejects(
        () => checkout(cart, { gateway: { charge: chargeMock }, mailer: { send: sendMock } }),
        (err) => err === mailerError
      );

      assert.strictEqual(chargeMock.mock.calls.length, 1);
      assert.strictEqual(sendMock.mock.calls.length, 1);
    });
  });
});
