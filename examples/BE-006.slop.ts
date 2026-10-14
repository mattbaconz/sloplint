import { prisma } from './db';
import type { User } from './types';

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
}

export class PrismaUserRepository implements IUserRepository {
  findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  }
}

export class UserRepositoryFactory {
  static create(): IUserRepository {
    return new PrismaUserRepository();
  }
}
