import {
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import {
  REVIEW_ANALYSIS_QUEUE,
  type AnalyzeReviewJobData,
} from '@falae/contracts';
import { Worker } from 'bullmq';
import { loadWorkerConfig } from '../config.js';
import { AnalysisApiError } from './analysis.types.js';
import { ReviewProcessor } from './review.processor.js';

@Injectable()
export class AnalysisWorker implements OnModuleInit, OnApplicationShutdown {
  private readonly config = loadWorkerConfig();
  private readonly logger = new Logger(AnalysisWorker.name);
  private worker?: Worker<AnalyzeReviewJobData>;

  constructor(private readonly processor: ReviewProcessor) {}

  onModuleInit(): void {
    this.worker = new Worker<AnalyzeReviewJobData>(
      REVIEW_ANALYSIS_QUEUE,
      (job) => this.processor.process(job),
      {
        connection: {
          host: this.config.redisHost,
          port: this.config.redisPort,
        },
        concurrency: 5,
        settings: {
          backoffStrategy: (attemptsMade, type, error) => {
            if (type !== 'analysis')
              throw new Error(`Backoff inválido: ${type}`);
            if (
              error instanceof AnalysisApiError &&
              error.retryAfterMs !== undefined
            ) {
              return Math.min(error.retryAfterMs, 30_000);
            }
            return Math.min(1000 * 2 ** Math.max(0, attemptsMade - 1), 30_000);
          },
        },
      },
    );
    this.worker.on('failed', (job, error) => {
      this.logger.error(
        `Job ${job?.id ?? 'desconhecido'} falhou: ${error.message}`,
      );
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.worker?.close();
  }
}
