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
  it('instantiates correctly with name, reason, and descriptive message', () => {
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
    const total = subtotal([]);
    assert.strictEqual(total, 0);
  });

  it('calculates the subtotal for a single item', () => {
    const total = subtotal([{ sku: 'tier-starter', unitPrice: 1500, quantity: 1 }]);
    assert.strictEqual(total, 1500);
  });

  it('calculates the subtotal for a single item with quantity greater than 1', () => {
    const total = subtotal([{ sku: 'seat-license', unitPrice: 800, quantity: 4 }]);
    assert.strictEqual(total, 3200);
  });

  it('calculates the subtotal across multiple diverse line items', () => {
    const total = subtotal([
      { sku: 'tier-pro', unitPrice: 4000, quantity: 2 },
      { sku: 'addon-storage', unitPrice: 500, quantity: 3 },
      { sku: 'addon-support', unitPrice: 1200, quantity: 1 },
    ]);
    assert.strictEqual(total, 10700);
  });

  it('allows items with a zero unit price', () => {
    const total = subtotal([
      { sku: 'tier-free', unitPrice: 0, quantity: 1 },
      { sku: 'addon-trial', unitPrice: 0, quantity: 5 },
    ]);
    assert.strictEqual(total, 0);
  });

  it('throws RangeError when item quantity is 0', () => {
    assert.throws(
      () => subtotal([{ sku: 'sku-zero-qty', unitPrice: 1000, quantity: 0 }]),
      {
        name: 'RangeError',
        message: 'Invalid quantity for sku-zero-qty',
      }
    );
  });

  it('throws RangeError when item quantity is negative', () => {
    assert.throws(
      () => subtotal([{ sku: 'sku-neg-qty', unitPrice: 1000, quantity: -2 }]),
      {
        name: 'RangeError',
        message: 'Invalid quantity for sku-neg-qty',
      }
    );
  });

  it('throws RangeError when item quantity is a non-integer float', () => {
    assert.throws(
      () => subtotal([{ sku: 'sku-float-qty', unitPrice: 1000, quantity: 2.5 }]),
      {
        name: 'RangeError',
        message: 'Invalid quantity for sku-float-qty',
      }
    );
  });

  it('throws RangeError when item quantity is not an integer', () => {
    assert.throws(
      () => subtotal([{ sku: 'sku-string-qty', unitPrice: 1000, quantity: '3' }]),
      {
        name: 'RangeError',
        message: 'Invalid quantity for sku-string-qty',
      }
    );
    assert.throws(
      () => subtotal([{ sku: 'sku-null-qty', unitPrice: 1000, quantity: null }]),
      {
        name: 'RangeError',
        message: 'Invalid quantity for sku-null-qty',
      }
    );
    assert.throws(
      () => subtotal([{ sku: 'sku-nan-qty', unitPrice: 1000, quantity: Number.NaN }]),
      {
        name: 'RangeError',
        message: 'Invalid quantity for sku-nan-qty',
      }
    );
  });

  it('throws RangeError when item unit price is negative', () => {
    assert.throws(
      () => subtotal([{ sku: 'sku-neg-price', unitPrice: -50, quantity: 1 }]),
      {
        name: 'RangeError',
        message: 'Invalid price for sku-neg-price',
      }
    );
  });

  it('throws RangeError when item unit price is a non-integer float', () => {
    assert.throws(
      () => subtotal([{ sku: 'sku-float-price', unitPrice: 12.99, quantity: 1 }]),
      {
        name: 'RangeError',
        message: 'Invalid price for sku-float-price',
      }
    );
  });

  it('throws RangeError when item unit price is not an integer', () => {
    assert.throws(
      () => subtotal([{ sku: 'sku-string-price', unitPrice: '1500', quantity: 1 }]),
      {
        name: 'RangeError',
        message: 'Invalid price for sku-string-price',
      }
    );
    assert.throws(
      () => subtotal([{ sku: 'sku-null-price', unitPrice: null, quantity: 1 }]),
      {
        name: 'RangeError',
        message: 'Invalid price for sku-null-price',
      }
    );
    assert.throws(
      () => subtotal([{ sku: 'sku-nan-price', unitPrice: Number.NaN, quantity: 1 }]),
      {
        name: 'RangeError',
        message: 'Invalid price for sku-nan-price',
      }
    );
  });
});

describe('discount', () => {
  it('returns 0 when discount code is undefined, null, or empty string', () => {
    assert.strictEqual(discount(5000, undefined), 0);
    assert.strictEqual(discount(5000, null), 0);
    assert.strictEqual(discount(5000, ''), 0);
  });

  describe('SAVE10 code', () => {
    it('applies a 10% discount to the amount', () => {
      assert.strictEqual(discount(1000, 'SAVE10'), 100);
      assert.strictEqual(discount(3000, 'SAVE10'), 300);
    });

    it('rounds the discount to the nearest integer cent', () => {
      assert.strictEqual(discount(1005, 'SAVE10'), 101);
      assert.strictEqual(discount(1004, 'SAVE10'), 100);
    });

    it('returns 0 when amount is 0', () => {
      assert.strictEqual(discount(0, 'SAVE10'), 0);
    });

    it('is case-insensitive', () => {
      assert.strictEqual(discount(2000, 'save10'), 200);
      assert.strictEqual(discount(2000, 'Save10'), 200);
      assert.strictEqual(discount(2000, 'SaVe10'), 200);
    });
  });

  describe('FLAT500 code', () => {
    it('deducts 500 when amount is exactly at the 2000 cents threshold', () => {
      assert.strictEqual(discount(2000, 'FLAT500'), 500);
    });

    it('deducts 500 when amount is above the threshold', () => {
      assert.strictEqual(discount(5000, 'FLAT500'), 500);
    });

    it('returns 0 when amount is below the 2000 cents threshold', () => {
      assert.strictEqual(discount(1999, 'FLAT500'), 0);
      assert.strictEqual(discount(1000, 'FLAT500'), 0);
      assert.strictEqual(discount(0, 'FLAT500'), 0);
    });

    it('is case-insensitive', () => {
      assert.strictEqual(discount(3000, 'flat500'), 500);
      assert.strictEqual(discount(3000, 'Flat500'), 500);
    });
  });

  it('throws RangeError for unrecognized discount codes', () => {
    assert.throws(
      () => discount(2500, 'INVALIDCODE'),
      {
        name: 'RangeError',
        message: 'Unknown discount code INVALIDCODE',
      }
    );
    assert.throws(
      () => discount(2500, 'save20'),
      {
        name: 'RangeError',
        message: 'Unknown discount code save20',
      }
    );
  });
});

describe('tax', () => {
  it('returns 0 when tax rate is 0', () => {
    assert.strictEqual(tax(5000, 0), 0);
  });

  it('calculates tax correctly at intermediate rates', () => {
    assert.strictEqual(tax(10000, 0.08), 800);
    assert.strictEqual(tax(5000, 0.20), 1000);
  });

  it('calculates tax at the maximum allowed rate of 0.5 (50%)', () => {
    assert.strictEqual(tax(4000, 0.5), 2000);
  });

  it('rounds tax to the nearest integer cent', () => {
    assert.strictEqual(tax(125, 0.0825), 10);
    assert.strictEqual(tax(130, 0.0825), 11);
  });

  it('returns 0 when amount is 0 regardless of rate', () => {
    assert.strictEqual(tax(0, 0.15), 0);
  });

  it('throws RangeError when tax rate is negative', () => {
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
  it('completes successful paid checkout with discount, tax, payment charge, and receipt email', async () => {
    const gateway = {
      charge: mock.fn(async () => ({ ok: true, id: 'ch_ledger_987' })),
    };
    const mailer = {
      send: mock.fn(async () => ({ messageId: 'msg_001' })),
    };

    const cart = {
      customerId: 'cus_alpha123',
      email: 'billing@ledgerly.internal',
      currency: 'usd',
      items: [
        { sku: 'plan-starter', unitPrice: 3000, quantity: 1 },
        { sku: 'extra-seat', unitPrice: 500, quantity: 2 },
      ],
      code: 'SAVE10',
      taxRate: 0.05,
    };

    const receipt = await checkout(cart, { gateway, mailer });

    assert.deepStrictEqual(receipt, {
      status: 'paid',
      total: 3780,
      chargeId: 'ch_ledger_987',
    });

    assert.strictEqual(gateway.charge.mock.calls.length, 1);
    assert.deepStrictEqual(gateway.charge.mock.calls[0].arguments[0], {
      customerId: 'cus_alpha123',
      amount: 3780,
      currency: 'usd',
    });

    assert.strictEqual(mailer.send.mock.calls.length, 1);
    assert.deepStrictEqual(mailer.send.mock.calls[0].arguments[0], {
      to: 'billing@ledgerly.internal',
      template: 'receipt',
      data: {
        total: 3780,
        chargeId: 'ch_ledger_987',
      },
    });
  });

  it('defaults currency to usd when cart does not specify currency', async () => {
    const gateway = {
      charge: mock.fn(async () => ({ ok: true, id: 'ch_def_curr' })),
    };
    const mailer = {
      send: mock.fn(async () => ({ ok: true })),
    };

    const cart = {
      customerId: 'cus_no_curr',
      email: 'member@ledgerly.internal',
      items: [{ sku: 'seat-monthly', unitPrice: 1000, quantity: 1 }],
      taxRate: 0,
    };

    const receipt = await checkout(cart, { gateway, mailer });

    assert.strictEqual(receipt.status, 'paid');
    assert.strictEqual(receipt.total, 1000);
    assert.strictEqual(gateway.charge.mock.calls.length, 1);
    assert.strictEqual(gateway.charge.mock.calls[0].arguments[0].currency, 'usd');
  });

  it('preserves non-usd currency specified in the cart', async () => {
    const gateway = {
      charge: mock.fn(async () => ({ ok: true, id: 'ch_eur_999' })),
    };
    const mailer = {
      send: mock.fn(async () => ({ ok: true })),
    };

    const cart = {
      customerId: 'cus_eur_user',
      email: 'europe@ledgerly.internal',
      currency: 'eur',
      items: [{ sku: 'seat-eur', unitPrice: 2500, quantity: 1 }],
      taxRate: 0.20,
    };

    const receipt = await checkout(cart, { gateway, mailer });

    assert.strictEqual(receipt.status, 'paid');
    assert.strictEqual(receipt.total, 3000);
    assert.strictEqual(gateway.charge.mock.calls.length, 1);
    assert.strictEqual(gateway.charge.mock.calls[0].arguments[0].currency, 'eur');
  });

  it('completes free checkout without calling payment gateway or mailer when total is 0', async () => {
    const gateway = {
      charge: mock.fn(async () => ({ ok: true, id: 'should_not_run' })),
    };
    const mailer = {
      send: mock.fn(async () => ({ ok: true })),
    };

    const cart = {
      customerId: 'cus_free',
      email: 'free@ledgerly.internal',
      items: [{ sku: 'community-tier', unitPrice: 0, quantity: 1 }],
      taxRate: 0.1,
    };

    const receipt = await checkout(cart, { gateway, mailer });

    assert.deepStrictEqual(receipt, { status: 'free', total: 0 });
    assert.strictEqual(gateway.charge.mock.calls.length, 0);
    assert.strictEqual(mailer.send.mock.calls.length, 0);
  });

  it('completes free checkout when items list is empty and total is 0', async () => {
    const gateway = {
      charge: mock.fn(async () => ({ ok: true, id: 'should_not_run' })),
    };
    const mailer = {
      send: mock.fn(async () => ({ ok: true })),
    };

    const cart = {
      customerId: 'cus_empty',
      email: 'empty@ledgerly.internal',
      items: [],
      taxRate: 0,
    };

    const receipt = await checkout(cart, { gateway, mailer });

    assert.deepStrictEqual(receipt, { status: 'free', total: 0 });
    assert.strictEqual(gateway.charge.mock.calls.length, 0);
    assert.strictEqual(mailer.send.mock.calls.length, 0);
  });

  it('throws PaymentDeclinedError and does not send receipt when payment is declined', async () => {
    const gateway = {
      charge: mock.fn(async () => ({ ok: false, reason: 'insufficient_funds' })),
    };
    const mailer = {
      send: mock.fn(async () => ({ ok: true })),
    };

    const cart = {
      customerId: 'cus_declined',
      email: 'declined@ledgerly.internal',
      items: [{ sku: 'pro-tier', unitPrice: 5000, quantity: 1 }],
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

    assert.strictEqual(gateway.charge.mock.calls.length, 1);
    assert.strictEqual(mailer.send.mock.calls.length, 0);
  });

  it('propagates gateway network errors and does not send receipt', async () => {
    const networkError = new Error('Gateway connection timeout');
    const gateway = {
      charge: mock.fn(async () => {
        throw networkError;
      }),
    };
    const mailer = {
      send: mock.fn(async () => ({ ok: true })),
    };

    const cart = {
      customerId: 'cus_net_err',
      email: 'net@ledgerly.internal',
      items: [{ sku: 'tier-cloud', unitPrice: 2000, quantity: 1 }],
      taxRate: 0,
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

  it('propagates mailer errors after successful payment charge', async () => {
    const mailerError = new Error('SMTP service unavailable');
    const gateway = {
      charge: mock.fn(async () => ({ ok: true, id: 'ch_paid_ok' })),
    };
    const mailer = {
      send: mock.fn(async () => {
        throw mailerError;
      }),
    };

    const cart = {
      customerId: 'cus_mail_err',
      email: 'failmail@ledgerly.internal',
      items: [{ sku: 'tier-cloud', unitPrice: 2000, quantity: 1 }],
      taxRate: 0,
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

  it('propagates validation errors from subtotal without charging gateway or sending email', async () => {
    const gateway = {
      charge: mock.fn(async () => ({ ok: true, id: 'ch_never' })),
    };
    const mailer = {
      send: mock.fn(async () => ({ ok: true })),
    };

    const cartWithInvalidQty = {
      customerId: 'cus_inv_qty',
      email: 'invalid@ledgerly.internal',
      items: [{ sku: 'broken-item', unitPrice: 1000, quantity: -1 }],
      taxRate: 0,
    };

    await assert.rejects(
      async () => checkout(cartWithInvalidQty, { gateway, mailer }),
      {
        name: 'RangeError',
        message: 'Invalid quantity for broken-item',
      }
    );

    assert.strictEqual(gateway.charge.mock.calls.length, 0);
    assert.strictEqual(mailer.send.mock.calls.length, 0);
  });

  it('propagates validation errors from discount without charging gateway or sending email', async () => {
    const gateway = {
      charge: mock.fn(async () => ({ ok: true, id: 'ch_never' })),
    };
    const mailer = {
      send: mock.fn(async () => ({ ok: true })),
    };

    const cartWithInvalidCode = {
      customerId: 'cus_inv_code',
      email: 'invalid@ledgerly.internal',
      items: [{ sku: 'item-1', unitPrice: 1000, quantity: 1 }],
      code: 'NONEXISTENT',
      taxRate: 0,
    };

    await assert.rejects(
      async () => checkout(cartWithInvalidCode, { gateway, mailer }),
      {
        name: 'RangeError',
        message: 'Unknown discount code NONEXISTENT',
      }
    );

    assert.strictEqual(gateway.charge.mock.calls.length, 0);
    assert.strictEqual(mailer.send.mock.calls.length, 0);
  });

  it('propagates validation errors from tax calculation without charging gateway or sending email', async () => {
    const gateway = {
      charge: mock.fn(async () => ({ ok: true, id: 'ch_never' })),
    };
    const mailer = {
      send: mock.fn(async () => ({ ok: true })),
    };

    const cartWithInvalidTax = {
      customerId: 'cus_inv_tax',
      email: 'invalid@ledgerly.internal',
      items: [{ sku: 'item-1', unitPrice: 1000, quantity: 1 }],
      taxRate: 0.85,
    };

    await assert.rejects(
      async () => checkout(cartWithInvalidTax, { gateway, mailer }),
      {
        name: 'RangeError',
        message: 'Tax rate out of range: 0.85',
      }
    );

    assert.strictEqual(gateway.charge.mock.calls.length, 0);
    assert.strictEqual(mailer.send.mock.calls.length, 0);
  });
});
