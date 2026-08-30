import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { DatabaseService } from './database.service.js';
import type { QueueService } from './queue.service.js';
import { ReadinessService } from './readiness.service.js';

describe('ReadinessService', () => {
  const queryRaw = jest.fn<() => Promise<unknown>>();
  const checkConnection = jest.fn<() => Promise<void>>();
  const database = {
    client: { $queryRaw: queryRaw },
  } as unknown as DatabaseService;
  const queue = { checkConnection } as unknown as QueueService;

  beforeEach(() => {
    jest.clearAllMocks();
    queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    checkConnection.mockResolvedValue();
  });

  it('reports readiness when PostgreSQL and Redis are available', async () => {
    await expect(
      new ReadinessService(database, queue).check(),
    ).resolves.toEqual({
      status: 'ready',
      checks: { database: 'up', redis: 'up' },
    });
  });

  it('identifies every unavailable dependency', async () => {
    queryRaw.mockRejectedValue(new Error('PostgreSQL unavailable'));
    checkConnection.mockRejectedValue(new Error('Redis unavailable'));

    await expect(
      new ReadinessService(database, queue).check(),
    ).resolves.toEqual({
      status: 'not_ready',
      checks: { database: 'down', redis: 'down' },
    });
  });
});
