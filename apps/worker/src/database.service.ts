import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { createDatabaseClient, type PrismaClient } from '@falae/database';
import { loadWorkerConfig } from './config.js';

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  readonly client: PrismaClient = createDatabaseClient(
    loadWorkerConfig().databaseUrl,
  );

  async onApplicationShutdown(): Promise<void> {
    await this.client.$disconnect();
  }
}
