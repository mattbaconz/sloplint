// expect: none
import express from 'express';
import cors from 'cors';
import { pool } from './db';

const PORT = Number(process.env.PORT || 3000);
const LOG_LEVEL = process.env.LOG_LEVEL ?? 'info';
const allowed = (process.env.CORS_ORIGINS ?? '').split(',').filter(Boolean);

const app = express();
app.use(cors({ origin: allowed }));

app.get('/api/users/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT id, email FROM users WHERE id = $1', [req.params.id]);
  res.json(rows[0] ?? null);
});

export async function ping(url: string) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2_000) });
    return res.ok;
  } catch (error) {
    throw new Error(`Health check for ${url} failed`, { cause: error });
  }
}

app.listen(PORT, () => console.log(`listening on ${PORT} at ${LOG_LEVEL}`));
