import { Logger } from '@nestjs/common';
import { ReviewStatus } from '@falae/database';
import { UnrecoverableError, type Job } from 'bullmq';
import type { AnalyzeReviewJobData } from '@falae/contracts';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import type { DatabaseService } from '../database.service.js';
import type { AnalysisClient } from './analysis.client.js';
import { ReviewProcessor } from './review.processor.js';
import { AnalysisApiError } from './analysis.types.js';

describe('ReviewProcessor', () => {
  const review = {
    id: 'review-id',
    externalId: 'external-id',
    companyId: 'company-id',
    rating: 2,
    comment: 'O pedido demorou.',
    status: ReviewStatus.PENDING,
  };
  const findUnique = jest.fn<() => Promise<typeof review | null>>();
  const update = jest.fn<(args: unknown) => Promise<typeof review>>();
  const analyze = jest.fn<AnalysisClient['analyze']>();
  const database = {
    client: { review: { findUnique, update } },
  } as unknown as DatabaseService;
  const analysisClient = { analyze } as unknown as AnalysisClient;
  let logSpy: jest.SpiedFunction<Logger['log']>;
  let warnSpy: jest.SpiedFunction<Logger['warn']>;

  beforeAll(() => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.REVIEW_MAX_ATTEMPTS = '4';
  });

  beforeEach(() => {
    jest.clearAllMocks();
    logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    findUnique.mockResolvedValue(review);
    update.mockResolvedValue(review);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function job(attemptsMade = 0): Job<AnalyzeReviewJobData> {
    return {
      id: 'job-id',
      data: { reviewId: review.id },
      attemptsMade,
    } as Job<AnalyzeReviewJobData>;
  }

  it('persiste a análise e conclui a avaliação', async () => {
    const processedAt = new Date('2026-08-29T12:00:00.000Z');
    analyze.mockResolvedValue({
      requestId: 'request-id',
      sentiment: 'negative',
      category: 'delivery',
      confidence: 0.91,
      matchedKeywords: ['demorou'],
      processedAt,
    });

    await new ReviewProcessor(database, analysisClient).process(job());

    expect(update).toHaveBeenNthCalledWith(1, {
      where: { id: review.id },
      data: { status: ReviewStatus.PROCESSING, attempts: 1 },
    });
    expect(update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          status: ReviewStatus.COMPLETED,
          analysisSentiment: 'negative',
          analysisCategory: 'delivery',
          analysisProcessedAt: processedAt,
        }),
      }),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'analysis.completed',
        review_id: review.id,
        job_id: 'job-id',
        attempt: 1,
      }),
    );
  });

  it('mantém processing quando uma falha temporária ainda pode ser repetida', async () => {
    const error = new AnalysisApiError('Serviço indisponível.', true, 2000);
    analyze.mockRejectedValue(error);

    await expect(
      new ReviewProcessor(database, analysisClient).process(job(1)),
    ).rejects.toBe(error);

    expect(update).toHaveBeenLastCalledWith({
      where: { id: review.id },
      data: {
        status: ReviewStatus.PROCESSING,
        lastError: error.message,
        processedAt: null,
      },
    });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'analysis.retry_scheduled',
        review_id: review.id,
        job_id: 'job-id',
        attempt: 2,
        retryable: true,
      }),
    );
  });

  it('marca como failed quando uma falha temporária esgota quatro tentativas', async () => {
    const error = new AnalysisApiError('Serviço ainda indisponível.', true);
    analyze.mockRejectedValue(error);

    await expect(
      new ReviewProcessor(database, analysisClient).process(job(3)),
    ).rejects.toBe(error);

    expect(update).toHaveBeenNthCalledWith(1, {
      where: { id: review.id },
      data: { status: ReviewStatus.PROCESSING, attempts: 4 },
    });
    expect(update).toHaveBeenLastCalledWith({
      where: { id: review.id },
      data: {
        status: ReviewStatus.FAILED,
        lastError: error.message,
        processedAt: expect.any(Date),
      },
    });
  });

  it('marca como failed e interrompe retries para uma falha definitiva', async () => {
    analyze.mockRejectedValue(new AnalysisApiError('Payload inválido.', false));

    await expect(
      new ReviewProcessor(database, analysisClient).process(job()),
    ).rejects.toBeInstanceOf(UnrecoverableError);

    expect(update).toHaveBeenLastCalledWith({
      where: { id: review.id },
      data: {
        status: ReviewStatus.FAILED,
        lastError: 'Payload inválido.',
        processedAt: expect.any(Date),
      },
    });
  });
});
