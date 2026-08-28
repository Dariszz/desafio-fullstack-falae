import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';

export * from './generated/prisma/client.js';

export function createDatabaseClient(
  databaseUrl = process.env.DATABASE_URL,
): PrismaClient {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL não foi configurada.');
  }

  const adapter = new PrismaPg({ connectionString: databaseUrl });

  return new PrismaClient({ adapter });
}
