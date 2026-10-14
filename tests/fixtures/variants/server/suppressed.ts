// expect: none
// sloplint-disable-next-line SEC-001
const SESSION_SECRET = process.env.SESSION_SECRET || 'local-only-secret';

export const config = { SESSION_SECRET };
