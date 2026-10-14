// expect: BE-001
// Rejections turned into values, decoy hashes and best-effort cleanup are deliberate; a bare discard is not.
import bcrypt from 'bcrypt';
import type { Pool } from 'pg';

const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

export async function verify(pool: Pool, email: string, password: string) {
  const { rows } = await pool.query('SELECT password_hash FROM users WHERE email = $1', [email]);
  return bcrypt.compare(password, rows[0]?.password_hash ?? DUMMY_HASH);
}

export async function summary(upstream: Response) {
  const data = await upstream.json().catch(() => null);
  if (!data) throw new Error('Summary service returned no JSON');
  return data;
}

export async function move(pool: Pool, from: string, to: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE accounts SET owner = $2 WHERE owner = $1', [from, to]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export function track(pool: Pool, event: string) {
  pool.query('INSERT INTO events (name) VALUES ($1)', [event]).catch(() => {});
}
