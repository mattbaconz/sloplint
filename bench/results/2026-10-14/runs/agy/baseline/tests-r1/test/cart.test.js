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
  it('should set name, reason, and descriptive error message', () => {
    const error = new PaymentDeclinedError('insufficient_funds');

    assert.equal(error.name, 'PaymentDeclinedError');
    assert.equal(error.reason, 'insufficient_funds');
    assert.equal(error.message, 'Payment declined: insufficient_funds');
  });

  it('should inherit from Error', () => {
    const error = new PaymentDeclinedError('card_expired');

    assert.ok(error instanceof Error);
    assert.ok(error instanceof PaymentDeclinedError);
  });
});

describe('subtotal', () => {
  it('should return 0 for an empty items array', () => {
    assert.equal(subtotal([]), 0);
  });

  it('should calculate subtotal for a single item', () => {
    const items = [{ sku: 'ledger-basic', quantity: 2, unitPrice: 1500 }];
    assert.equal(subtotal(items), 3000);
  });

  it('should calculate subtotal for multiple items', () => {
    const items = [
      { sku: 'ledger-basic', quantity: 1, unitPrice: 2000 },
      { sku: 'ledger-pro', quantity: 3, unitPrice: 5000 },
      { sku: 'addon-seats', quantity: 5, unitPrice: 300 },
    ];
    // 2000*1 + 5000*3 + 300*5 = 2000 + 15000 + 1500 = 18500
    assert.equal(subtotal(items), 18500);
  });

  it('should allow unitPrice of 0 for free items', () => {
    const items = [{ sku: 'free-tier', quantity: 1, unitPrice: 0 }];
    assert.equal(subtotal(items), 0);
  });

  describe('quantity validation', () => {
    it('should throw RangeError when quantity is 0', () => {
      const items = [{ sku: 'sku-zero-qty', quantity: 0, unitPrice: 100 }];
      assert.throws(
        () => subtotal(items),
        {
          name: 'RangeError',
          message: 'Invalid quantity for sku-zero-qty',
        }
      );
    });

    it('should throw RangeError when quantity is negative', () => {
      const items = [{ sku: 'sku-neg-qty', quantity: -2, unitPrice: 100 }];
      assert.throws(
        () => subtotal(items),
        {
          name: 'RangeError',
          message: 'Invalid quantity for sku-neg-qty',
        }
      );
    });

    it('should throw RangeError when quantity is a float', () => {
      const items = [{ sku: 'sku-float-qty', quantity: 1.5, unitPrice: 100 }];
      assert.throws(
        () => subtotal(items),
        {
          name: 'RangeError',
          message: 'Invalid quantity for sku-float-qty',
        }
      );
    });

    it('should throw RangeError when quantity is not a number', () => {
      const testCases = ['2', null, undefined, NaN, Infinity, {}, []];
      for (const qty of testCases) {
        assert.throws(
          () => subtotal([{ sku: 'sku-invalid-qty', quantity: qty, unitPrice: 100 }]),
          {
            name: 'RangeError',
            message: 'Invalid quantity for sku-invalid-qty',
          }
        );
      }
    });
  });

  describe('unitPrice validation', () => {
    it('should throw RangeError when unitPrice is negative', () => {
      const items = [{ sku: 'sku-neg-price', quantity: 1, unitPrice: -50 }];
      assert.throws(
        () => subtotal(items),
        {
          name: 'RangeError',
          message: 'Invalid price for sku-neg-price',
        }
      );
    });

    it('should throw RangeError when unitPrice is a float', () => {
      const items = [{ sku: 'sku-float-price', quantity: 1, unitPrice: 19.99 }];
      assert.throws(
        () => subtotal(items),
        {
          name: 'RangeError',
          message: 'Invalid price for sku-float-price',
        }
      );
    });

    it('should throw RangeError when unitPrice is not a number', () => {
      const testCases = ['100', null, undefined, NaN, Infinity, {}, []];
      for (const price of testCases) {
        assert.throws(
          () => subtotal([{ sku: 'sku-invalid-price', quantity: 1, unitPrice: price }]),
          {
            name: 'RangeError',
            message: 'Invalid price for sku-invalid-price',
          }
        );
      }
    });
  });
});

describe('discount', () => {
  it('should return 0 when code is undefined, null, or empty', () => {
    assert.equal(discount(5000, undefined), 0);
    assert.equal(discount(5000, null), 0);
    assert.equal(discount(5000, ''), 0);
  });

  describe('SAVE10 code', () => {
    it('should apply 10% discount on integer amounts', () => {
      assert.equal(discount(1000, 'SAVE10'), 100);
      assert.equal(discount(5000, 'SAVE10'), 500);
      assert.equal(discount(0, 'SAVE10'), 0);
    });

    it('should round discounted amounts properly', () => {
      // 1005 * 0.1 = 100.5 -> 101
      assert.equal(discount(1005, 'SAVE10'), 101);
      // 1004 * 0.1 = 100.4 -> 100
      assert.equal(discount(1004, 'SAVE10'), 100);
    });

    it('should be case-insensitive', () => {
      assert.equal(discount(1000, 'save10'), 100);
      assert.equal(discount(1000, 'Save10'), 100);
      assert.equal(discount(1000, 'SaVe10'), 100);
    });
  });

  describe('FLAT500 code', () => {
    it('should apply 500 cents discount if amount is at least 2000 cents', () => {
      assert.equal(discount(2000, 'FLAT500'), 500);
      assert.equal(discount(3500, 'FLAT500'), 500);
    });

    it('should return 0 discount if amount is less than 2000 cents', () => {
      assert.equal(discount(1999, 'FLAT500'), 0);
      assert.equal(discount(1000, 'FLAT500'), 0);
      assert.equal(discount(0, 'FLAT500'), 0);
    });

    it('should be case-insensitive', () => {
      assert.equal(discount(2500, 'flat500'), 500);
      assert.equal(discount(2500, 'Flat500'), 500);
    });
  });

  describe('unknown discount codes', () => {
    it('should throw RangeError for an unrecognised code', () => {
      assert.throws(
        () => discount(5000, 'SUMMER50'),
        {
          name: 'RangeError',
          message: 'Unknown discount code SUMMER50',
        }
      );
    });

    it('should include the original case of the code in the error message', () => {
      assert.throws(
        () => discount(5000, 'invalidCode'),
        {
          name: 'RangeError',
          message: 'Unknown discount code invalidCode',
        }
      );
    });
  });
});

describe('tax', () => {
  it('should calculate tax on amount at valid rates', () => {
    assert.equal(tax(1000, 0.1), 100);
    assert.equal(tax(2000, 0.08), 160);
    assert.equal(tax(0, 0.2), 0);
  });

  it('should support boundary tax rates 0 and 0.5', () => {
    assert.equal(tax(1000, 0), 0);
    assert.equal(tax(1000, 0.5), 500);
  });

  it('should round tax amounts properly', () => {
    // 105 * 0.05 = 5.25 -> 5
    assert.equal(tax(105, 0.05), 5);
    // 110 * 0.05 = 5.5 -> 6
    assert.equal(tax(110, 0.05), 6);
  });

  it('should throw RangeError when tax rate is negative', () => {
    assert.throws(
      () => tax(1000, -0.01),
      {
        name: 'RangeError',
        message: 'Tax rate out of range: -0.01',
      }
    );
  });

  it('should throw RangeError when tax rate exceeds 0.5', () => {
    assert.throws(
      () => tax(1000, 0.51),
      {
        name: 'RangeError',
        message: 'Tax rate out of range: 0.51',
      }
    );

    assert.throws(
      () => tax(1000, 1.0),
      {
        name: 'RangeError',
        message: 'Tax rate out of range: 1',
      }
    );
  });
});

describe('checkout', () => {
  describe('free carts (total === 0)', () => {
    it('should return { status: "free", total: 0 } for an empty cart', async () => {
      const chargeMock = mock.fn();
      const sendMock = mock.fn();

      const cart = {
        customerId: 'cust_123',
        email: 'alex@example.com',
        items: [],
        taxRate: 0.1,
      };

      const result = await checkout(cart, {
        gateway: { charge: chargeMock },
        mailer: { send: sendMock },
      });

      assert.deepEqual(result, { status: 'free', total: 0 });
      assert.equal(chargeMock.mock.callCount(), 0);
      assert.equal(sendMock.mock.callCount(), 0);
    });

    it('should return { status: "free", total: 0 } when items have zero price', async () => {
      const chargeMock = mock.fn();
      const sendMock = mock.fn();

      const cart = {
        customerId: 'cust_123',
        email: 'alex@example.com',
        items: [{ sku: 'free-tier', quantity: 2, unitPrice: 0 }],
        taxRate: 0.2,
      };

      const result = await checkout(cart, {
        gateway: { charge: chargeMock },
        mailer: { send: sendMock },
      });

      assert.deepEqual(result, { status: 'free', total: 0 });
      assert.equal(chargeMock.mock.callCount(), 0);
      assert.equal(sendMock.mock.callCount(), 0);
    });
  });

  describe('successful payment', () => {
    it('should charge gateway and send email receipt with default currency "usd"', async () => {
      const chargeMock = mock.fn(async () => ({ ok: true, id: 'ch_test_123' }));
      const sendMock = mock.fn(async () => ({ sent: true }));

      const cart = {
        customerId: 'cust_abc',
        email: 'customer@example.com',
        items: [
          { sku: 'plan-basic', quantity: 1, unitPrice: 2000 },
          { sku: 'extra-users', quantity: 2, unitPrice: 500 },
        ],
        taxRate: 0.1,
      };
      // subtotal: 2000*1 + 500*2 = 3000
      // discount: 0
      // net: 3000
      // tax: 3000 * 0.1 = 300
      // total: 3300

      const result = await checkout(cart, {
        gateway: { charge: chargeMock },
        mailer: { send: sendMock },
      });

      assert.deepEqual(result, {
        status: 'paid',
        total: 3300,
        chargeId: 'ch_test_123',
      });

      assert.equal(chargeMock.mock.callCount(), 1);
      assert.deepEqual(chargeMock.mock.calls[0].arguments, [
        {
          customerId: 'cust_abc',
          amount: 3300,
          currency: 'usd',
        },
      ]);

      assert.equal(sendMock.mock.callCount(), 1);
      assert.deepEqual(sendMock.mock.calls[0].arguments, [
        {
          to: 'customer@example.com',
          template: 'receipt',
          data: {
            total: 3300,
            chargeId: 'ch_test_123',
          },
        },
      ]);
    });

    it('should use specified currency if provided in cart', async () => {
      const chargeMock = mock.fn(async () => ({ ok: true, id: 'ch_eur_456' }));
      const sendMock = mock.fn(async () => ({ sent: true }));

      const cart = {
        customerId: 'cust_eu',
        email: 'eu@example.com',
        currency: 'eur',
        items: [{ sku: 'ledger-eu', quantity: 1, unitPrice: 1000 }],
        taxRate: 0.2,
      };
      // subtotal: 1000, tax: 200, total: 1200

      const result = await checkout(cart, {
        gateway: { charge: chargeMock },
        mailer: { send: sendMock },
      });

      assert.deepEqual(result, {
        status: 'paid',
        total: 1200,
        chargeId: 'ch_eur_456',
      });

      assert.equal(chargeMock.mock.calls[0].arguments[0].currency, 'eur');
    });

    it('should apply discount code before computing tax and charging', async () => {
      const chargeMock = mock.fn(async () => ({ ok: true, id: 'ch_disc_789' }));
      const sendMock = mock.fn(async () => ({ sent: true }));

      const cart = {
        customerId: 'cust_discount',
        email: 'disc@example.com',
        code: 'SAVE10',
        items: [{ sku: 'ledger-pro', quantity: 1, unitPrice: 10000 }],
        taxRate: 0.08,
      };
      // subtotal: 10000
      // discount (SAVE10): 1000
      // net: 9000
      // tax: 9000 * 0.08 = 720
      // total: 9720

      const result = await checkout(cart, {
        gateway: { charge: chargeMock },
        mailer: { send: sendMock },
      });

      assert.deepEqual(result, {
        status: 'paid',
        total: 9720,
        chargeId: 'ch_disc_789',
      });

      assert.equal(chargeMock.mock.calls[0].arguments[0].amount, 9720);
      assert.equal(sendMock.mock.calls[0].arguments[0].data.total, 9720);
    });

    it('should apply FLAT500 discount when applicable', async () => {
      const chargeMock = mock.fn(async () => ({ ok: true, id: 'ch_flat_101' }));
      const sendMock = mock.fn(async () => ({ sent: true }));

      const cart = {
        customerId: 'cust_flat',
        email: 'flat@example.com',
        code: 'flat500',
        items: [{ sku: 'annual-plan', quantity: 1, unitPrice: 2500 }],
        taxRate: 0,
      };
      // subtotal: 2500
      // discount: 500
      // net: 2000
      // tax: 0
      // total: 2000

      const result = await checkout(cart, {
        gateway: { charge: chargeMock },
        mailer: { send: sendMock },
      });

      assert.deepEqual(result, {
        status: 'paid',
        total: 2000,
        chargeId: 'ch_flat_101',
      });
      assert.equal(chargeMock.mock.calls[0].arguments[0].amount, 2000);
    });
  });

  describe('payment declined', () => {
    it('should throw PaymentDeclinedError when gateway returns ok: false', async () => {
      const chargeMock = mock.fn(async () => ({
        ok: false,
        reason: 'insufficient_funds',
      }));
      const sendMock = mock.fn();

      const cart = {
        customerId: 'cust_broke',
        email: 'broke@example.com',
        items: [{ sku: 'ledger-basic', quantity: 1, unitPrice: 2500 }],
        taxRate: 0.05,
      };

      await assert.rejects(
        async () => {
          await checkout(cart, {
            gateway: { charge: chargeMock },
            mailer: { send: sendMock },
          });
        },
        (err) => {
          assert.ok(err instanceof PaymentDeclinedError);
          assert.equal(err.name, 'PaymentDeclinedError');
          assert.equal(err.reason, 'insufficient_funds');
          assert.equal(err.message, 'Payment declined: insufficient_funds');
          return true;
        }
      );

      assert.equal(chargeMock.mock.callCount(), 1);
      assert.equal(sendMock.mock.callCount(), 0);
    });

    it('should not send email if payment is declined', async () => {
      const chargeMock = mock.fn(async () => ({
        ok: false,
        reason: 'card_declined',
      }));
      const sendMock = mock.fn();

      const cart = {
        customerId: 'cust_1',
        email: 'cust1@example.com',
        items: [{ sku: 'ledger-basic', quantity: 1, unitPrice: 1000 }],
        taxRate: 0,
      };

      await assert.rejects(
        async () => {
          await checkout(cart, {
            gateway: { charge: chargeMock },
            mailer: { send: sendMock },
          });
        },
        PaymentDeclinedError
      );

      assert.equal(sendMock.mock.callCount(), 0);
    });
  });

  describe('error propagation and validation', () => {
    it('should propagate errors from subtotal calculation and avoid calling gateway or mailer', async () => {
      const chargeMock = mock.fn();
      const sendMock = mock.fn();

      const cart = {
        customerId: 'cust_err',
        email: 'err@example.com',
        items: [{ sku: 'bad-item', quantity: -1, unitPrice: 100 }],
        taxRate: 0.1,
      };

      await assert.rejects(
        async () => {
          await checkout(cart, {
            gateway: { charge: chargeMock },
            mailer: { send: sendMock },
          });
        },
        {
          name: 'RangeError',
          message: 'Invalid quantity for bad-item',
        }
      );

      assert.equal(chargeMock.mock.callCount(), 0);
      assert.equal(sendMock.mock.callCount(), 0);
    });

    it('should propagate errors from discount calculation and avoid calling gateway or mailer', async () => {
      const chargeMock = mock.fn();
      const sendMock = mock.fn();

      const cart = {
        customerId: 'cust_err',
        email: 'err@example.com',
        code: 'INVALID_CODE',
        items: [{ sku: 'item-1', quantity: 1, unitPrice: 1000 }],
        taxRate: 0.1,
      };

      await assert.rejects(
        async () => {
          await checkout(cart, {
            gateway: { charge: chargeMock },
            mailer: { send: sendMock },
          });
        },
        {
          name: 'RangeError',
          message: 'Unknown discount code INVALID_CODE',
        }
      );

      assert.equal(chargeMock.mock.callCount(), 0);
      assert.equal(sendMock.mock.callCount(), 0);
    });

    it('should propagate errors from tax calculation and avoid calling gateway or mailer', async () => {
      const chargeMock = mock.fn();
      const sendMock = mock.fn();

      const cart = {
        customerId: 'cust_err',
        email: 'err@example.com',
        items: [{ sku: 'item-1', quantity: 1, unitPrice: 1000 }],
        taxRate: 0.75,
      };

      await assert.rejects(
        async () => {
          await checkout(cart, {
            gateway: { charge: chargeMock },
            mailer: { send: sendMock },
          });
        },
        {
          name: 'RangeError',
          message: 'Tax rate out of range: 0.75',
        }
      );

      assert.equal(chargeMock.mock.callCount(), 0);
      assert.equal(sendMock.mock.callCount(), 0);
    });

    it('should propagate unexpected gateway errors and avoid calling mailer', async () => {
      const chargeMock = mock.fn(async () => {
        throw new Error('Gateway connection timeout');
      });
      const sendMock = mock.fn();

      const cart = {
        customerId: 'cust_timeout',
        email: 'timeout@example.com',
        items: [{ sku: 'item-1', quantity: 1, unitPrice: 1000 }],
        taxRate: 0,
      };

      await assert.rejects(
        async () => {
          await checkout(cart, {
            gateway: { charge: chargeMock },
            mailer: { send: sendMock },
          });
        },
        {
          name: 'Error',
          message: 'Gateway connection timeout',
        }
      );

      assert.equal(sendMock.mock.callCount(), 0);
    });

    it('should propagate mailer errors if sending the receipt fails', async () => {
      const chargeMock = mock.fn(async () => ({ ok: true, id: 'ch_mail_fail' }));
      const sendMock = mock.fn(async () => {
        throw new Error('SMTP connection refused');
      });

      const cart = {
        customerId: 'cust_mail_err',
        email: 'mailerr@example.com',
        items: [{ sku: 'item-1', quantity: 1, unitPrice: 1000 }],
        taxRate: 0,
      };

      await assert.rejects(
        async () => {
          await checkout(cart, {
            gateway: { charge: chargeMock },
            mailer: { send: sendMock },
          });
        },
        {
          name: 'Error',
          message: 'SMTP connection refused',
        }
      );

      assert.equal(chargeMock.mock.callCount(), 1);
      assert.equal(sendMock.mock.callCount(), 1);
    });
  });
});
