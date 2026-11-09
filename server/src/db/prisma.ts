import 'dotenv/config';
import { PrismaClient as SqlitePrismaClient } from '@prisma/client';
import { PrismaClient as PostgresPrismaClient } from '../../node_modules/.prisma/postgres-client/index.js';

declare global {
  // eslint-disable-next-line no-var
  var prismaClientGlobal: SqlitePrismaClient | undefined;
}

function createPrismaClient(): SqlitePrismaClient {
  const databaseUrl = process.env.DATABASE_URL ?? '';
  const log: ('error' | 'warn')[] =
    process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'];
  const options = { log };

  if (/^postgres(?:ql)?:\/\//i.test(databaseUrl)) {
    // Both clients are generated from the same models; the shared app type avoids a union of incompatible generated delegate types.
    return new PostgresPrismaClient(options) as unknown as SqlitePrismaClient;
  }
  if (/^file:/i.test(databaseUrl)) {
    return new SqlitePrismaClient(options);
  }
  throw new Error('DATABASE_URL must use the PostgreSQL or SQLite protocol');
}

export const prisma = globalThis.prismaClientGlobal ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaClientGlobal = prisma;
}
