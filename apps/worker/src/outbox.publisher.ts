import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Prisma } from '@falae/database';
import { DatabaseService } from './database.service.js';
import { QueueService } from './queue.service.js';

interface ClaimedEvent {
  id: string;
  reviewId: string;
}

@Injectable()
export class OutboxPublisher {
  private readonly logger = new Logger(OutboxPublisher.name);
  private publishing = false;

  constructor(
    private readonly database: DatabaseService,
    private readonly queue: QueueService,
  ) {}

  @Interval(1000)
  async publishPending(): Promise<void> {
    if (this.publishing) return;
    this.publishing = true;

    try {
      const events = await this.claimBatch();
      await Promise.all(events.map((event) => this.publish(event)));
    } finally {
      this.publishing = false;
    }
  }

  private claimBatch(): Promise<ClaimedEvent[]> {
    return this.database.client.$queryRaw<ClaimedEvent[]>(Prisma.sql`
      WITH candidates AS (
        SELECT id
        FROM outbox_events
        WHERE published_at IS NULL
          AND available_at <= NOW()
        ORDER BY created_at
        FOR UPDATE SKIP LOCKED
        LIMIT 20
      )
      UPDATE outbox_events AS event
      SET available_at = NOW() + INTERVAL '30 seconds',
          attempts = event.attempts + 1,
          updated_at = NOW()
      FROM candidates
      WHERE event.id = candidates.id
      RETURNING event.id, event.review_id AS "reviewId"
    `);
  }

  private async publish(event: ClaimedEvent): Promise<void> {
    try {
      await this.queue.addReview(event.reviewId, event.id);
      await this.database.client.outboxEvent.update({
        where: { id: event.id },
        data: { publishedAt: new Date(), lastError: null },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Falha ao publicar outbox ${event.id}: ${message}`);
      await this.database.client.outboxEvent.update({
        where: { id: event.id },
        data: {
          availableAt: new Date(Date.now() + 2000),
          lastError: message.slice(0, 2000),
        },
      });
    }
  }
}
