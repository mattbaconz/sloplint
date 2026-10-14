import { db } from './db';

export async function listOrders(customerId: string) {
  return db.order.findMany({ where: { customerId }, orderBy: { createdAt: 'desc' } });
}
