// Seeded bugs for src/cart.js. A strong suite fails on each one; a suite that only checks
// that mocks were called passes most of them. Each edit must match the seed exactly once.

export const MUTANTS = [
  ['quantity zero accepted', 'item.quantity < 1', 'item.quantity < 0'],
  ['negative price accepted', 'item.unitPrice < 0', 'item.unitPrice < -100'],
  ['quantity ignored', 'total += item.unitPrice * item.quantity', 'total += item.unitPrice'],
  ['SAVE10 is 1%', 'Math.round(amount * 0.1)', 'Math.round(amount * 0.01)'],
  ['FLAT500 boundary', 'amount >= 2000 ? 500 : 0', 'amount > 2000 ? 500 : 0'],
  ['codes case-sensitive', 'CODES[code.toUpperCase()]', 'CODES[code]'],
  ['unknown code ignored', 'if (!rule) throw new RangeError(`Unknown discount code ${code}`);', 'if (!rule) return 0;'],
  ['tax ceiling raised', 'rate > 0.5', 'rate > 1'],
  ['tax truncated', 'return Math.round(amount * rate);', 'return Math.floor(amount * rate);'],
  ['tax before discount', 'const total = net + tax(net, cart.taxRate);', 'const total = net + tax(sub, cart.taxRate);'],
  ['free orders charged', "if (total === 0) return { status: 'free', total };", "if (total < 0) return { status: 'free', total };"],
  ['charge ignores discount', 'amount: total,', 'amount: sub,'],
  ['currency forced', "currency: cart.currency ?? 'usd'", "currency: 'usd'"],
  ['decline swallowed', 'if (!result.ok) throw new PaymentDeclinedError(result.reason);', "if (!result.ok) return { status: 'declined', total };"],
  ['receipt to wrong address', 'to: cart.email', 'to: cart.customerId'],
  ['charge id dropped', "return { status: 'paid', total, chargeId: result.id };", "return { status: 'paid', total };"],
];
