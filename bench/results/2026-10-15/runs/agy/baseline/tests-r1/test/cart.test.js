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
  it('should be an instance of Error', () => {
    const err = new PaymentDeclinedError('insufficient_funds');
    assert.ok(err instanceof Error);
    assert.ok(err instanceof PaymentDeclinedError);
  });

  it('should set name to PaymentDeclinedError', () => {
    const err = new PaymentDeclinedError('card_expired');
    assert.strictEqual(err.name, 'PaymentDeclinedError');
  });

  it('should format error message and retain reason property', () => {
    const reason = 'fraud_suspected';
    const err = new PaymentDeclinedError(reason);
    assert.strictEqual(err.reason, reason);
    assert.strictEqual(err.message, `Payment declined: ${reason}`);
  });

  it('should handle empty string reason', () => {
    const err = new PaymentDeclinedError('');
    assert.strictEqual(err.reason, '');
    assert.strictEqual(err.message, 'Payment declined: ');
  });
});

describe('subtotal', () => {
  it('should return 0 for an empty items list', () => {
    assert.strictEqual(subtotal([]), 0);
  });

  it('should calculate subtotal for a single item', () => {
    const items = [{ sku: 'SKU-A', unitPrice: 1500, quantity: 2 }];
    assert.strictEqual(subtotal(items), 3000);
  });

  it('should calculate subtotal for multiple items', () => {
    const items = [
      { sku: 'SKU-A', unitPrice: 1200, quantity: 3 }, // 3600
      { sku: 'SKU-B', unitPrice: 450, quantity: 1 },  // 450
      { sku: 'SKU-C', unitPrice: 2000, quantity: 4 }, // 8000
    ];
    assert.strictEqual(subtotal(items), 12050);
  });

  it('should allow unitPrice of 0 for free items', () => {
    const items = [
      { sku: 'FREEBIE', unitPrice: 0, quantity: 5 },
      { sku: 'PAID', unitPrice: 500, quantity: 1 },
    ];
    assert.strictEqual(subtotal(items), 500);
  });

  it('should handle large quantities and prices within safe integer range', () => {
    const items = [
      { sku: 'EXPENSIVE', unitPrice: 100_000_000, quantity: 100 },
    ];
    assert.strictEqual(subtotal(items), 10_000_000_000);
  });

  describe('quantity validation', () => {
    it('should throw RangeError when quantity is 0', () => {
      assert.throws(
        () => subtotal([{ sku: 'SKU-1', unitPrice: 100, quantity: 0 }]),
        {
          name: 'RangeError',
          message: 'Invalid quantity for SKU-1',
        }
      );
    });

    it('should throw RangeError when quantity is negative', () => {
      assert.throws(
        () => subtotal([{ sku: 'SKU-NEG', unitPrice: 100, quantity: -2 }]),
        {
          name: 'RangeError',
          message: 'Invalid quantity for SKU-NEG',
        }
      );
    });

    it('should throw RangeError when quantity is a float', () => {
      assert.throws(
        () => subtotal([{ sku: 'SKU-FLOAT', unitPrice: 100, quantity: 2.5 }]),
        {
          name: 'RangeError',
          message: 'Invalid quantity for SKU-FLOAT',
        }
      );
    });

    it('should throw RangeError when quantity is NaN', () => {
      assert.throws(
        () => subtotal([{ sku: 'SKU-NAN', unitPrice: 100, quantity: NaN }]),
        {
          name: 'RangeError',
          message: 'Invalid quantity for SKU-NAN',
        }
      );
    });

    it('should throw RangeError when quantity is Infinity', () => {
      assert.throws(
        () => subtotal([{ sku: 'SKU-INF', unitPrice: 100, quantity: Infinity }]),
        {
          name: 'RangeError',
          message: 'Invalid quantity for SKU-INF',
        }
      );
    });

    it('should throw RangeError when quantity is a non-number type', () => {
      for (const invalidQty of ['2', null, undefined, true, {}, []]) {
        assert.throws(
          () => subtotal([{ sku: 'SKU-TYPE', unitPrice: 100, quantity: invalidQty }]),
          {
            name: 'RangeError',
            message: 'Invalid quantity for SKU-TYPE',
          }
        );
      }
    });

    it('should identify the correct sku when the invalid item is later in the list', () => {
      assert.throws(
        () =>
          subtotal([
            { sku: 'VALID-1', unitPrice: 100, quantity: 2 },
            { sku: 'VALID-2', unitPrice: 200, quantity: 1 },
            { sku: 'INVALID-QTY', unitPrice: 50, quantity: 0 },
          ]),
        {
          name: 'RangeError',
          message: 'Invalid quantity for INVALID-QTY',
        }
      );
    });
  });

  describe('unitPrice validation', () => {
    it('should throw RangeError when unitPrice is negative', () => {
      assert.throws(
        () => subtotal([{ sku: 'SKU-NEG-PRICE', unitPrice: -1, quantity: 1 }]),
        {
          name: 'RangeError',
          message: 'Invalid price for SKU-NEG-PRICE',
        }
      );
    });

    it('should throw RangeError when unitPrice is a float', () => {
      assert.throws(
        () => subtotal([{ sku: 'SKU-FLOAT-PRICE', unitPrice: 12.99, quantity: 1 }]),
        {
          name: 'RangeError',
          message: 'Invalid price for SKU-FLOAT-PRICE',
        }
      );
    });

    it('should throw RangeError when unitPrice is NaN', () => {
      assert.throws(
        () => subtotal([{ sku: 'SKU-NAN-PRICE', unitPrice: NaN, quantity: 1 }]),
        {
          name: 'RangeError',
          message: 'Invalid price for SKU-NAN-PRICE',
        }
      );
    });

    it('should throw RangeError when unitPrice is Infinity', () => {
      assert.throws(
        () => subtotal([{ sku: 'SKU-INF-PRICE', unitPrice: Infinity, quantity: 1 }]),
        {
          name: 'RangeError',
          message: 'Invalid price for SKU-INF-PRICE',
        }
      );
    });

    it('should throw RangeError when unitPrice is a non-number type', () => {
      for (const invalidPrice of ['500', null, undefined, false, {}, []]) {
        assert.throws(
          () => subtotal([{ sku: 'SKU-PRICE-TYPE', unitPrice: invalidPrice, quantity: 1 }]),
          {
            name: 'RangeError',
            message: 'Invalid price for SKU-PRICE-TYPE',
          }
        );
      }
    });

    it('should validate quantity before price if both are invalid', () => {
      assert.throws(
        () => subtotal([{ sku: 'BOTH-INVALID', unitPrice: -50, quantity: -1 }]),
        {
          name: 'RangeError',
          message: 'Invalid quantity for BOTH-INVALID',
        }
      );
    });
  });
});

describe('discount', () => {
  it('should return 0 when discount code is not provided or falsy', () => {
    assert.strictEqual(discount(1000, undefined), 0);
    assert.strictEqual(discount(1000, null), 0);
    assert.strictEqual(discount(1000, ''), 0);
  });

  describe('SAVE10 code', () => {
    it('should calculate 10% discount on amount', () => {
      assert.strictEqual(discount(1000, 'SAVE10'), 100);
      assert.strictEqual(discount(5000, 'SAVE10'), 500);
      assert.strictEqual(discount(0, 'SAVE10'), 0);
    });

    it('should round 10% discount to nearest integer', () => {
      // 95 * 0.1 = 9.5 -> rounds to 10
      assert.strictEqual(discount(95, 'SAVE10'), 10);
      // 94 * 0.1 = 9.4 -> rounds to 9
      assert.strictEqual(discount(94, 'SAVE10'), 9);
      // 1005 * 0.1 = 100.5 -> rounds to 101
      assert.strictEqual(discount(1005, 'SAVE10'), 101);
      // 1004 * 0.1 = 100.4 -> rounds to 100
      assert.strictEqual(discount(1004, 'SAVE10'), 100);
    });

    it('should be case-insensitive', () => {
      assert.strictEqual(discount(2000, 'save10'), 200);
      assert.strictEqual(discount(2000, 'Save10'), 200);
      assert.strictEqual(discount(2000, 'sAvE10'), 200);
    });
  });

  describe('FLAT500 code', () => {
    it('should return 500 when amount is strictly greater than 2000', () => {
      assert.strictEqual(discount(2001, 'FLAT500'), 500);
      assert.strictEqual(discount(5000, 'FLAT500'), 500);
    });

    it('should return 500 when amount is exactly 2000 (boundary condition)', () => {
      assert.strictEqual(discount(2000, 'FLAT500'), 500);
    });

    it('should return 0 when amount is strictly less than 2000 (boundary condition)', () => {
      assert.strictEqual(discount(1999, 'FLAT500'), 0);
      assert.strictEqual(discount(1000, 'FLAT500'), 0);
      assert.strictEqual(discount(0, 'FLAT500'), 0);
    });

    it('should be case-insensitive', () => {
      assert.strictEqual(discount(2500, 'flat500'), 500);
      assert.strictEqual(discount(2500, 'Flat500'), 500);
      assert.strictEqual(discount(2500, 'fLaT500'), 500);
      assert.strictEqual(discount(1500, 'flat500'), 0);
    });
  });

  describe('unknown discount code', () => {
    it('should throw RangeError for unrecognized discount codes', () => {
      assert.throws(
        () => discount(1000, 'INVALID'),
        {
          name: 'RangeError',
          message: 'Unknown discount code INVALID',
        }
      );
      assert.throws(
        () => discount(1000, 'SAVE20'),
        {
          name: 'RangeError',
          message: 'Unknown discount code SAVE20',
        }
      );
      assert.throws(
        () => discount(1000, 'flat100'),
        {
          name: 'RangeError',
          message: 'Unknown discount code flat100',
        }
      );
    });
  });
});

describe('tax', () => {
  it('should return 0 when tax rate is 0', () => {
    assert.strictEqual(tax(1000, 0), 0);
    assert.strictEqual(tax(0, 0), 0);
  });

  it('should calculate tax at the maximum allowed rate (0.5)', () => {
    assert.strictEqual(tax(1000, 0.5), 500);
    assert.strictEqual(tax(99, 0.5), 50); // 49.5 rounded to 50
  });

  it('should calculate and round tax correctly for various rates', () => {
    // 1000 * 0.08 = 80
    assert.strictEqual(tax(1000, 0.08), 80);
    // 105 * 0.08 = 8.4 -> 8
    assert.strictEqual(tax(105, 0.08), 8);
    // 107 * 0.08 = 8.56 -> 9
    assert.strictEqual(tax(107, 0.08), 9);
    // 100 * 0.0825 = 8.25 -> 8
    assert.strictEqual(tax(100, 0.0825), 8);
    // 150 * 0.0825 = 12.375 -> 12
    assert.strictEqual(tax(150, 0.0825), 12);
  });

  it('should return 0 when amount is 0 regardless of rate', () => {
    assert.strictEqual(tax(0, 0.25), 0);
  });

  describe('rate validation', () => {
    it('should throw RangeError when rate is negative', () => {
      assert.throws(
        () => tax(1000, -0.01),
        {
          name: 'RangeError',
          message: 'Tax rate out of range: -0.01',
        }
      );
      assert.throws(
        () => tax(1000, -1),
        {
          name: 'RangeError',
          message: 'Tax rate out of range: -1',
        }
      );
    });

    it('should throw RangeError when rate exceeds 0.5', () => {
      assert.throws(
        () => tax(1000, 0.50001),
        {
          name: 'RangeError',
          message: 'Tax rate out of range: 0.50001',
        }
      );
      assert.throws(
        () => tax(1000, 0.8),
        {
          name: 'RangeError',
          message: 'Tax rate out of range: 0.8',
        }
      );
      assert.throws(
        () => tax(1000, 1.5),
        {
          name: 'RangeError',
          message: 'Tax rate out of range: 1.5',
        }
      );
    });
  });
});

describe('checkout', () => {
  function createMocks({ chargeResult = { ok: true, id: 'ch_test_123' }, mailerResult = { sent: true } } = {}) {
    const gateway = {
      charge: mock.fn(async () => chargeResult),
    };
    const mailer = {
      send: mock.fn(async () => mailerResult),
    };
    return { gateway, mailer };
  }

  describe('free checkout (total === 0)', () => {
    it('should return free status without charging or emailing when items list is empty and tax is 0', async () => {
      const { gateway, mailer } = createMocks();
      const cart = {
        items: [],
        taxRate: 0,
        customerId: 'cust_free',
        email: 'free@example.com',
      };

      const result = await checkout(cart, { gateway, mailer });

      assert.deepStrictEqual(result, { status: 'free', total: 0 });
      assert.strictEqual(gateway.charge.mock.callCount(), 0);
      assert.strictEqual(mailer.send.mock.callCount(), 0);
    });

    it('should return free status when items have unitPrice of 0 and tax is 0', async () => {
      const { gateway, mailer } = createMocks();
      const cart = {
        items: [
          { sku: 'FREE-1', unitPrice: 0, quantity: 2 },
          { sku: 'FREE-2', unitPrice: 0, quantity: 1 },
        ],
        taxRate: 0,
        customerId: 'cust_free_2',
        email: 'free2@example.com',
      };

      const result = await checkout(cart, { gateway, mailer });

      assert.deepStrictEqual(result, { status: 'free', total: 0 });
      assert.strictEqual(gateway.charge.mock.callCount(), 0);
      assert.strictEqual(mailer.send.mock.callCount(), 0);
    });
  });

  describe('successful paid checkout', () => {
    it('should complete checkout with default currency (usd)', async () => {
      const { gateway, mailer } = createMocks({
        chargeResult: { ok: true, id: 'ch_default_curr' },
      });
      const cart = {
        items: [{ sku: 'PRO-PLAN', unitPrice: 3000, quantity: 1 }],
        taxRate: 0.1,
        customerId: 'cust_100',
        email: 'user100@example.com',
      };

      // subtotal = 3000
      // discount = 0
      // net = 3000
      // tax = 3000 * 0.1 = 300
      // total = 3300
      const result = await checkout(cart, { gateway, mailer });

      assert.deepStrictEqual(result, {
        status: 'paid',
        total: 3300,
        chargeId: 'ch_default_curr',
      });

      assert.strictEqual(gateway.charge.mock.callCount(), 1);
      assert.deepStrictEqual(gateway.charge.mock.calls[0].arguments[0], {
        customerId: 'cust_100',
        amount: 3300,
        currency: 'usd',
      });

      assert.strictEqual(mailer.send.mock.callCount(), 1);
      assert.deepStrictEqual(mailer.send.mock.calls[0].arguments[0], {
        to: 'user100@example.com',
        template: 'receipt',
        data: {
          total: 3300,
          chargeId: 'ch_default_curr',
        },
      });
    });

    it('should respect custom currency specified in cart', async () => {
      const { gateway, mailer } = createMocks({
        chargeResult: { ok: true, id: 'ch_eur_999' },
      });
      const cart = {
        items: [{ sku: 'PLAN-EUR', unitPrice: 2000, quantity: 2 }],
        taxRate: 0.2,
        currency: 'eur',
        customerId: 'cust_eur',
        email: 'eur@example.com',
      };

      // subtotal = 4000
      // discount = 0
      // net = 4000
      // tax = 800
      // total = 4800
      const result = await checkout(cart, { gateway, mailer });

      assert.deepStrictEqual(result, {
        status: 'paid',
        total: 4800,
        chargeId: 'ch_eur_999',
      });

      assert.strictEqual(gateway.charge.mock.callCount(), 1);
      assert.deepStrictEqual(gateway.charge.mock.calls[0].arguments[0], {
        customerId: 'cust_eur',
        amount: 4800,
        currency: 'eur',
      });
    });

    it('should apply SAVE10 discount and calculate tax on net amount', async () => {
      const { gateway, mailer } = createMocks({
        chargeResult: { ok: true, id: 'ch_discount_save10' },
      });
      const cart = {
        items: [
          { sku: 'ITEM-1', unitPrice: 2500, quantity: 2 }, // 5000
        ],
        code: 'SAVE10',
        taxRate: 0.08,
        customerId: 'cust_discount',
        email: 'discount@example.com',
      };

      // sub = 5000
      // discount = Math.round(5000 * 0.1) = 500
      // net = 4500
      // tax = Math.round(4500 * 0.08) = 360
      // total = 4500 + 360 = 4860
      const result = await checkout(cart, { gateway, mailer });

      assert.deepStrictEqual(result, {
        status: 'paid',
        total: 4860,
        chargeId: 'ch_discount_save10',
      });

      assert.strictEqual(gateway.charge.mock.calls[0].arguments[0].amount, 4860);
      assert.strictEqual(mailer.send.mock.calls[0].arguments[0].data.total, 4860);
    });

    it('should apply FLAT500 discount when subtotal >= 2000 and calculate tax on net amount', async () => {
      const { gateway, mailer } = createMocks({
        chargeResult: { ok: true, id: 'ch_flat500' },
      });
      const cart = {
        items: [
          { sku: 'ITEM-A', unitPrice: 1500, quantity: 1 },
          { sku: 'ITEM-B', unitPrice: 1000, quantity: 1 },
        ],
        code: 'flat500',
        taxRate: 0.05,
        customerId: 'cust_flat',
        email: 'flat@example.com',
      };

      // sub = 2500
      // discount = 500
      // net = 2000
      // tax = Math.round(2000 * 0.05) = 100
      // total = 2100
      const result = await checkout(cart, { gateway, mailer });

      assert.deepStrictEqual(result, {
        status: 'paid',
        total: 2100,
        chargeId: 'ch_flat500',
      });

      assert.strictEqual(gateway.charge.mock.calls[0].arguments[0].amount, 2100);
    });

    it('should handle rounding across subtotal, discount, and tax', async () => {
      const { gateway, mailer } = createMocks({
        chargeResult: { ok: true, id: 'ch_round' },
      });
      const cart = {
        items: [{ sku: 'ITEM-ODD', unitPrice: 199, quantity: 1 }], // sub = 199
        code: 'SAVE10', // 199 * 0.1 = 19.9 -> discount = 20
        taxRate: 0.0825, // net = 179; 179 * 0.0825 = 14.7675 -> tax = 15
        customerId: 'cust_odd',
        email: 'odd@example.com',
      };

      // total = 179 + 15 = 194
      const result = await checkout(cart, { gateway, mailer });

      assert.deepStrictEqual(result, {
        status: 'paid',
        total: 194,
        chargeId: 'ch_round',
      });
      assert.strictEqual(gateway.charge.mock.calls[0].arguments[0].amount, 194);
      assert.strictEqual(mailer.send.mock.calls[0].arguments[0].data.total, 194);
    });
  });

  describe('payment declined', () => {
    it('should throw PaymentDeclinedError when gateway charge is not ok', async () => {
      const { gateway, mailer } = createMocks({
        chargeResult: { ok: false, reason: 'insufficient_funds' },
      });
      const cart = {
        items: [{ sku: 'SUB-MONTHLY', unitPrice: 1000, quantity: 1 }],
        taxRate: 0,
        customerId: 'cust_declined',
        email: 'declined@example.com',
      };

      await assert.rejects(
        async () => {
          await checkout(cart, { gateway, mailer });
        },
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
      // Ensure mailer is never invoked on payment failure
      assert.strictEqual(mailer.send.mock.callCount(), 0);
    });

    it('should preserve custom decline reasons', async () => {
      const { gateway, mailer } = createMocks({
        chargeResult: { ok: false, reason: 'card_velocity_exceeded' },
      });
      const cart = {
        items: [{ sku: 'ITEM-1', unitPrice: 2000, quantity: 1 }],
        taxRate: 0.05,
        customerId: 'cust_velocity',
        email: 'velocity@example.com',
      };

      await assert.rejects(
        () => checkout(cart, { gateway, mailer }),
        {
          name: 'PaymentDeclinedError',
          reason: 'card_velocity_exceeded',
          message: 'Payment declined: card_velocity_exceeded',
        }
      );

      assert.strictEqual(mailer.send.mock.callCount(), 0);
    });
  });

  describe('gateway and mailer exceptions', () => {
    it('should propagate gateway errors and not send receipt email', async () => {
      const networkError = new Error('Gateway timeout');
      const gateway = {
        charge: mock.fn(async () => {
          throw networkError;
        }),
      };
      const mailer = {
        send: mock.fn(async () => {}),
      };

      const cart = {
        items: [{ sku: 'ITEM-1', unitPrice: 1000, quantity: 1 }],
        taxRate: 0,
        customerId: 'cust_gw_err',
        email: 'timeout@example.com',
      };

      await assert.rejects(
        () => checkout(cart, { gateway, mailer }),
        (err) => {
          assert.strictEqual(err, networkError);
          return true;
        }
      );

      assert.strictEqual(gateway.charge.mock.callCount(), 1);
      assert.strictEqual(mailer.send.mock.callCount(), 0);
    });

    it('should propagate mailer errors when email delivery fails after charge', async () => {
      const mailError = new Error('SMTP connection failed');
      const gateway = {
        charge: mock.fn(async () => ({ ok: true, id: 'ch_mail_fail' })),
      };
      const mailer = {
        send: mock.fn(async () => {
          throw mailError;
        }),
      };

      const cart = {
        items: [{ sku: 'ITEM-1', unitPrice: 1000, quantity: 1 }],
        taxRate: 0,
        customerId: 'cust_mail_err',
        email: 'smtp_error@example.com',
      };

      await assert.rejects(
        () => checkout(cart, { gateway, mailer }),
        (err) => {
          assert.strictEqual(err, mailError);
          return true;
        }
      );

      assert.strictEqual(gateway.charge.mock.callCount(), 1);
      assert.strictEqual(mailer.send.mock.callCount(), 1);
    });
  });

  describe('cart validation errors abort checkout early', () => {
    it('should fail before gateway if items contain invalid quantity', async () => {
      const { gateway, mailer } = createMocks();
      const cart = {
        items: [{ sku: 'SKU-BAD', unitPrice: 100, quantity: -1 }],
        taxRate: 0.1,
        customerId: 'cust_bad',
        email: 'bad@example.com',
      };

      await assert.rejects(
        () => checkout(cart, { gateway, mailer }),
        {
          name: 'RangeError',
          message: 'Invalid quantity for SKU-BAD',
        }
      );

      assert.strictEqual(gateway.charge.mock.callCount(), 0);
      assert.strictEqual(mailer.send.mock.callCount(), 0);
    });

    it('should fail before gateway if discount code is invalid', async () => {
      const { gateway, mailer } = createMocks();
      const cart = {
        items: [{ sku: 'SKU-OK', unitPrice: 100, quantity: 1 }],
        code: 'NON_EXISTENT_CODE',
        taxRate: 0.1,
        customerId: 'cust_bad_code',
        email: 'code@example.com',
      };

      await assert.rejects(
        () => checkout(cart, { gateway, mailer }),
        {
          name: 'RangeError',
          message: 'Unknown discount code NON_EXISTENT_CODE',
        }
      );

      assert.strictEqual(gateway.charge.mock.callCount(), 0);
      assert.strictEqual(mailer.send.mock.callCount(), 0);
    });

    it('should fail before gateway if taxRate is out of range', async () => {
      const { gateway, mailer } = createMocks();
      const cart = {
        items: [{ sku: 'SKU-OK', unitPrice: 100, quantity: 1 }],
        taxRate: 0.75,
        customerId: 'cust_bad_tax',
        email: 'tax@example.com',
      };

      await assert.rejects(
        () => checkout(cart, { gateway, mailer }),
        {
          name: 'RangeError',
          message: 'Tax rate out of range: 0.75',
        }
      );

      assert.strictEqual(gateway.charge.mock.callCount(), 0);
      assert.strictEqual(mailer.send.mock.callCount(), 0);
    });
  });
});
