// expect: SEC-001
const note = 'sloplint-disable-next-line SEC-001';
const SESSION_SECRET = process.env.SESSION_SECRET || 'local-only-secret';

export const config = { note, SESSION_SECRET };
