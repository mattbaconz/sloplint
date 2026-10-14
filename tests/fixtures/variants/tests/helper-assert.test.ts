// expect: none
// Assertions made through a named helper (expectX / assertX) count as real assertions.
import { test, expect } from 'vitest';
import { total } from '../src/cart';

function expectTotal(items: number[], want: number) {
  expect(total(items)).toBe(want);
}

const assertEmpty = (items: number[]) => expect(total(items)).toBe(0);

test('sums line items', () => {
  expectTotal([2, 3], 5);
});

test('empty cart is zero', () => {
  assertEmpty([]);
});
