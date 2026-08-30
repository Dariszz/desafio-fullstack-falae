import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import {
  ANALYZE_REVIEW_JOB,
  REVIEW_ANALYSIS_QUEUE,
  type AnalyzeReviewJobData,
} from '@falae/contracts';
import { Queue } from 'bullmq';
import { loadWorkerConfig } from './config.js';

@Injectable()
export class QueueService implements OnApplicationShutdown {
  private readonly config = loadWorkerConfig();
  readonly queue = new Queue<AnalyzeReviewJobData>(REVIEW_ANALYSIS_QUEUE, {
    connection: {
      host: this.config.redisHost,
      port: this.config.redisPort,
    },
    defaultJobOptions: {
      attempts: this.config.maxAttempts,
      backoff: { type: 'analysis' },
      removeOnComplete: { age: 86_400, count: 1000 },
      removeOnFail: false,
    },
  });

  async addReview(reviewId: string, eventId: string): Promise<void> {
    await this.queue.add(ANALYZE_REVIEW_JOB, { reviewId }, { jobId: eventId });
  }

  async checkConnection(): Promise<void> {
    await this.queue.getJobCounts();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.queue.close();
  }
}
