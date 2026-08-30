import { Logger } from '@nestjs/common';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import type { DatabaseService } from './database.service.js';
import { OutboxPublisher } from './outbox.publisher.js';
import type { QueueService } from './queue.service.js';
import type { MetricsService } from './metrics.service.js';

interface ClaimedEvent {
  id: string;
  reviewId: string;
}

describe('OutboxPublisher', () => {
  let logSpy: jest.SpiedFunction<Logger['log']>;
  const event: ClaimedEvent = {
    id: 'outbox-id',
    reviewId: 'review-id',
  };
  const queryRaw = jest.fn<() => Promise<ClaimedEvent[]>>();
  const update = jest.fn<(args: unknown) => Promise<unknown>>();
  const deleteMany = jest.fn<(args: unknown) => Promise<{ count: number }>>();
  const addReview =
    jest.fn<(reviewId: string, eventId: string) => Promise<void>>();
  const database = {
    client: {
      $queryRaw: queryRaw,
      outboxEvent: { update, deleteMany },
    },
  } as unknown as DatabaseService;
  const queue = { addReview } as unknown as QueueService;
  const recordOutbox = jest.fn<MetricsService['recordOutbox']>();
  const metrics = { recordOutbox } as unknown as MetricsService;

  beforeEach(() => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.OUTBOX_RETENTION_DAYS = '30';
    jest.clearAllMocks();
    queryRaw.mockResolvedValue([event]);
    update.mockResolvedValue({});
    deleteMany.mockResolvedValue({ count: 0 });
    addReview.mockResolvedValue();
    logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('publica o job e marca o evento como concluído', async () => {
    await new OutboxPublisher(database, queue, metrics).publishPending();

    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(addReview).toHaveBeenCalledWith(event.reviewId, event.id);
    expect(update).toHaveBeenCalledWith({
      where: { id: event.id },
      data: { publishedAt: expect.any(Date), lastError: null },
    });
    expect(logSpy).toHaveBeenCalledWith({
      event: 'outbox.published',
      outbox_event_id: event.id,
      review_id: event.reviewId,
      job_id: event.id,
    });
    expect(recordOutbox).toHaveBeenCalledWith('published');
  });

  it('reagenda o evento quando o Redis está indisponível', async () => {
    const now = new Date('2026-08-30T12:00:00.000Z').getTime();
    jest.spyOn(Date, 'now').mockReturnValue(now);
    addReview.mockRejectedValue(new Error('Redis indisponível.'));

    await expect(
      new OutboxPublisher(database, queue, metrics).publishPending(),
    ).resolves.toBeUndefined();

    expect(update).toHaveBeenCalledWith({
      where: { id: event.id },
      data: {
        availableAt: new Date(now + 2000),
        lastError: 'Redis indisponível.',
      },
    });
    expect(recordOutbox).toHaveBeenCalledWith('failed');
  });

  it('remove somente eventos publicados além do período de retenção', async () => {
    const now = new Date('2026-08-30T12:00:00.000Z').getTime();
    jest.spyOn(Date, 'now').mockReturnValue(now);
    deleteMany.mockResolvedValue({ count: 3 });

    await new OutboxPublisher(database, queue, metrics).cleanupPublished();

    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        publishedAt: {
          not: null,
          lt: new Date('2026-07-31T12:00:00.000Z'),
        },
      },
    });
    expect(logSpy).toHaveBeenCalledWith({
      event: 'outbox.cleanup_completed',
      deleted_count: 3,
      retention_days: 30,
    });
  });
});
