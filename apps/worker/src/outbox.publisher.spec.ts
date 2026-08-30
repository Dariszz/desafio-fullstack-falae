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

interface ClaimedEvent {
  id: string;
  reviewId: string;
}

describe('OutboxPublisher', () => {
  const event: ClaimedEvent = {
    id: 'outbox-id',
    reviewId: 'review-id',
  };
  const queryRaw = jest.fn<() => Promise<ClaimedEvent[]>>();
  const update = jest.fn<(args: unknown) => Promise<unknown>>();
  const addReview =
    jest.fn<(reviewId: string, eventId: string) => Promise<void>>();
  const database = {
    client: {
      $queryRaw: queryRaw,
      outboxEvent: { update },
    },
  } as unknown as DatabaseService;
  const queue = { addReview } as unknown as QueueService;

  beforeEach(() => {
    jest.clearAllMocks();
    queryRaw.mockResolvedValue([event]);
    update.mockResolvedValue({});
    addReview.mockResolvedValue();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('publica o job e marca o evento como concluído', async () => {
    await new OutboxPublisher(database, queue).publishPending();

    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(addReview).toHaveBeenCalledWith(event.reviewId, event.id);
    expect(update).toHaveBeenCalledWith({
      where: { id: event.id },
      data: { publishedAt: expect.any(Date), lastError: null },
    });
  });

  it('reagenda o evento quando o Redis está indisponível', async () => {
    const now = new Date('2026-08-30T12:00:00.000Z').getTime();
    jest.spyOn(Date, 'now').mockReturnValue(now);
    addReview.mockRejectedValue(new Error('Redis indisponível.'));

    await expect(
      new OutboxPublisher(database, queue).publishPending(),
    ).resolves.toBeUndefined();

    expect(update).toHaveBeenCalledWith({
      where: { id: event.id },
      data: {
        availableAt: new Date(now + 2000),
        lastError: 'Redis indisponível.',
      },
    });
  });
});
