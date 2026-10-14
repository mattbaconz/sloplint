import { describe, it, expect } from 'vitest';
import { total } from './invoice';

describe('invoice totals', () => {
  it('adds tax', () => {
    expect(total([100], 0.2)).toBe(120);
  });
  it('rounds half-cents up', () => {
    expect(total([0.005], 0)).toBe(0.01);
  });
});
