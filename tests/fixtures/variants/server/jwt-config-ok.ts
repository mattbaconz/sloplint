// expect: none
// Token lifetimes, claims and cost factors are settings, not secrets; a default is fine.
const JWT_TTL = process.env.JWT_TTL || '1h';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '15m';
const SESSION_TOKEN_MAX_AGE_SECONDS = process.env.SESSION_TOKEN_MAX_AGE_SECONDS || '3600';
const JWT_ISSUER = process.env.JWT_ISSUER || 'api.example.com';
const SALT_ROUNDS = process.env.SALT_ROUNDS || '12';

export const auth = { JWT_TTL, JWT_EXPIRES_IN, SESSION_TOKEN_MAX_AGE_SECONDS, JWT_ISSUER, SALT_ROUNDS };
