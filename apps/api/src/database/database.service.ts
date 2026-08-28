import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { createDatabaseClient, type PrismaClient } from '@falae/database';

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  readonly client: PrismaClient = createDatabaseClient();

  async onApplicationShutdown(): Promise<void> {
    await this.client.$disconnect();
  }
}
