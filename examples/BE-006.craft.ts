import { prisma } from './db';

export function findUser(id: string) {
  return prisma.user.findUnique({ where: { id } });
}
