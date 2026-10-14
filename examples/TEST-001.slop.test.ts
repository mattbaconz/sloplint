import { describe, it, expect, vi } from 'vitest';
import { checkout } from './checkout';

describe('checkout', () => {
  it('charges the card', async () => {
    const charge = vi.fn().mockResolvedValue({ ok: true });
    await checkout({ cartId: 'c1', total: 4200 }, { charge });
    expect(charge).toHaveBeenCalled();
  });
});
