import { billing } from './billing';
import { db } from './db';

export async function syncInvoices(accountId: string) {
  try {
    const invoices = await billing.listInvoices(accountId);
    await db.invoice.createMany({ data: invoices });
  } catch (error) {
    throw new Error(`Invoice sync failed for account ${accountId}`, { cause: error });
  }
}
