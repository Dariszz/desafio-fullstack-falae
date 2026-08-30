import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@falae/database';
import { DatabaseService } from './database/database.service.js';

@Controller()
export class AppController {
  constructor(private readonly database: DatabaseService) {}

  @Get('health')
  health(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready(): Promise<{
    status: 'ready';
    checks: { database: 'up' };
  }> {
    try {
      await this.database.client.$queryRaw(Prisma.sql`SELECT 1`);
      return { status: 'ready', checks: { database: 'up' } };
    } catch {
      throw new ServiceUnavailableException({
        status: 'not_ready',
        checks: { database: 'down' },
      });
    }
  }
}
