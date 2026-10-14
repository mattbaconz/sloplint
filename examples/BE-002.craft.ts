import { prisma } from './db';

export async function ordersWithCustomers(orderIds: string[]) {
  return prisma.order.findMany({ where: { id: { in: orderIds } }, include: { customer: true } });
}
