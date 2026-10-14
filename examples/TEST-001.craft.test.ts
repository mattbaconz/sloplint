import { describe, it, expect, vi } from 'vitest';
import { checkout } from './checkout';

describe('checkout', () => {
  it('charges the cart total and marks the order paid', async () => {
    const charge = vi.fn().mockResolvedValue({ ok: true });
    const order = await checkout({ cartId: 'c1', total: 4200 }, { charge });
    expect(charge).toHaveBeenCalledWith(4200);
    expect(order.status).toBe('paid');
  });
});
