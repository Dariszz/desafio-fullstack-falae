import { Injectable, Logger } from '@nestjs/common';
import { ReviewStatus } from '@falae/database';
import type { AnalyzeReviewJobData } from '@falae/contracts';
import { UnrecoverableError, type Job } from 'bullmq';
import { loadWorkerConfig } from '../config.js';
import { DatabaseService } from '../database.service.js';
import { AnalysisClient } from './analysis.client.js';
import { AnalysisApiError } from './analysis.types.js';

@Injectable()
export class ReviewProcessor {
  private readonly config = loadWorkerConfig();
  private readonly logger = new Logger(ReviewProcessor.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly analysisClient: AnalysisClient,
  ) {}

  async process(job: Job<AnalyzeReviewJobData>): Promise<void> {
    const review = await this.database.client.review.findUnique({
      where: { id: job.data.reviewId },
    });

    if (!review) throw new UnrecoverableError('Avaliação não encontrada.');
    if (review.status === ReviewStatus.COMPLETED) return;

    const attempt = job.attemptsMade + 1;
    const jobId = String(job.id ?? 'unknown');
    const startedAt = Date.now();
    await this.database.client.review.update({
      where: { id: review.id },
      data: { status: ReviewStatus.PROCESSING, attempts: attempt },
    });
    this.logger.log({
      event: 'analysis.started',
      review_id: review.id,
      job_id: jobId,
      attempt,
      max_attempts: this.config.maxAttempts,
    });

    try {
      const analysis = await this.analysisClient.analyze({
        externalId: review.externalId,
        companyId: review.companyId,
        rating: review.rating,
        comment: review.comment,
        requestId: `${review.id}-${attempt}`,
      });

      await this.database.client.review.update({
        where: { id: review.id },
        data: {
          status: ReviewStatus.COMPLETED,
          lastError: null,
          analysisSentiment: analysis.sentiment,
          analysisCategory: analysis.category,
          analysisConfidence: analysis.confidence,
          analysisKeywords: analysis.matchedKeywords,
          analysisRequestId: analysis.requestId,
          analysisProcessedAt: analysis.processedAt,
          processedAt: new Date(),
        },
      });
      this.logger.log({
        event: 'analysis.completed',
        review_id: review.id,
        job_id: jobId,
        attempt,
        duration_ms: Date.now() - startedAt,
        sentiment: analysis.sentiment,
        category: analysis.category,
      });
    } catch (error: unknown) {
      const analysisError =
        error instanceof AnalysisApiError
          ? error
          : new AnalysisApiError(
              error instanceof Error ? error.message : String(error),
              true,
            );
      const exhausted = attempt >= this.config.maxAttempts;
      const failed = !analysisError.retryable || exhausted;

      await this.database.client.review.update({
        where: { id: review.id },
        data: {
          status: failed ? ReviewStatus.FAILED : ReviewStatus.PROCESSING,
          lastError: analysisError.message.slice(0, 2000),
          processedAt: failed ? new Date() : null,
        },
      });

      const logEvent = {
        event: failed ? 'analysis.failed' : 'analysis.retry_scheduled',
        review_id: review.id,
        job_id: jobId,
        attempt,
        max_attempts: this.config.maxAttempts,
        duration_ms: Date.now() - startedAt,
        retryable: analysisError.retryable,
        error: analysisError.message,
      };
      if (failed) this.logger.error(logEvent);
      else this.logger.warn(logEvent);

      if (!analysisError.retryable) {
        throw new UnrecoverableError(analysisError.message);
      }
      throw analysisError;
    }
  }
}
