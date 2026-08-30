import { Injectable } from '@nestjs/common';
import { Prisma } from '@falae/database';
import { DatabaseService } from './database.service.js';
import { QueueService } from './queue.service.js';

export interface WorkerReadiness {
  status: 'ready' | 'not_ready';
  checks: {
    database: 'up' | 'down';
    redis: 'up' | 'down';
  };
}

@Injectable()
export class ReadinessService {
  constructor(
    private readonly database: DatabaseService,
    private readonly queue: QueueService,
  ) {}

  async check(): Promise<WorkerReadiness> {
    const [database, redis] = await Promise.allSettled([
      this.database.client.$queryRaw(Prisma.sql`SELECT 1`),
      this.queue.checkConnection(),
    ]);
    const checks: WorkerReadiness['checks'] = {
      database: database.status === 'fulfilled' ? 'up' : 'down',
      redis: redis.status === 'fulfilled' ? 'up' : 'down',
    };

    return {
      status:
        checks.database === 'up' && checks.redis === 'up'
          ? 'ready'
          : 'not_ready',
      checks,
    };
  }
}
