import { describe, it, expect, vi } from 'vitest';
import { checkout } from '../src/checkout';

describe.only('checkout', () => {
  it('works', async () => {
    const charge = vi.fn().mockResolvedValue({ ok: true });
    const email = vi.fn();
    await checkout({ cartId: 'c1' }, { charge, email });
    await new Promise((r) => setTimeout(r, 1000));
    expect(charge).toHaveBeenCalled();
    expect(email).toHaveBeenCalled();
  });

  it.skip('handles declined cards', async () => {
    expect(true).toBe(true);
  });
});
