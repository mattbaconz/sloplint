import { prisma } from './db';

export async function ordersWithCustomers(orderIds: string[]) {
  const result = [];
  for (const id of orderIds) {
    const order = await prisma.order.findUnique({ where: { id }, include: { customer: true } });
    result.push(order);
  }
  return result;
}
