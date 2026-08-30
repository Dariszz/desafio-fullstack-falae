import { ServiceUnavailableException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { DatabaseService } from './database/database.service.js';
import { AppController } from './app.controller.js';

describe('AppController', () => {
  const queryRaw = jest.fn<() => Promise<unknown>>();
  const database = {
    client: { $queryRaw: queryRaw },
  } as unknown as DatabaseService;

  beforeEach(() => {
    jest.clearAllMocks();
    queryRaw.mockResolvedValue([{ '?column?': 1 }]);
  });

  it('reports that the API is healthy', () => {
    const controller = new AppController(database);

    expect(controller.health()).toEqual({ status: 'ok' });
  });

  it('reports readiness when PostgreSQL is available', async () => {
    const controller = new AppController(database);

    await expect(controller.ready()).resolves.toEqual({
      status: 'ready',
      checks: { database: 'up' },
    });
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('reports that the API is not ready when PostgreSQL is unavailable', async () => {
    queryRaw.mockRejectedValue(new Error('PostgreSQL unavailable'));
    const controller = new AppController(database);

    const error = await controller.ready().catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as ServiceUnavailableException).getStatus()).toBe(503);
    expect((error as ServiceUnavailableException).getResponse()).toEqual({
      status: 'not_ready',
      checks: { database: 'down' },
    });
  });
});
