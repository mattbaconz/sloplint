// expect: none
// Constant column lists and page sizes are not input; the user id goes through a placeholder.
const INVOICE_COLUMNS = `id, customer_name, total_cents, due_date`;
const PAGE_SIZE = 50;

type Db = { query: (text: string, params: unknown[]) => Promise<{ rows: unknown[] }> };

export async function listInvoices(db: Db, userId: string) {
  const { rows } = await db.query(`SELECT ${INVOICE_COLUMNS} FROM invoices WHERE user_id = $1 ORDER BY due_date LIMIT ${PAGE_SIZE}`, [userId]);
  return rows;
}
