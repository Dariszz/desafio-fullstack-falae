import 'dotenv/config';
import process from 'node:process';
import { defineConfig } from 'prisma/config';

const localDatabaseUrl = 'postgresql://falae:falae_local@localhost:5432/falae';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? localDatabaseUrl,
  },
});
