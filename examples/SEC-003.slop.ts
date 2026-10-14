import { pool } from './db';

export async function findUser(email: string) {
  const { rows } = await pool.query(`SELECT id, email FROM users WHERE email = '${email}'`);
  return rows[0] ?? null;
}
