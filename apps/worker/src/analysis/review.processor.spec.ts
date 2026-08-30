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
import type { MetricsService } from '../metrics.service.js';
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
  const upsert = jest.fn<(args: unknown) => Promise<unknown>>();
  const transaction =
    jest.fn<
      (
        callback: (client: {
          review: { update: typeof update };
          reviewAlert: { upsert: typeof upsert };
        }) => Promise<void>,
      ) => Promise<void>
    >();
  const analyze = jest.fn<AnalysisClient['analyze']>();
  const database = {
    client: { review: { findUnique, update }, $transaction: transaction },
  } as unknown as DatabaseService;
  const analysisClient = { analyze } as unknown as AnalysisClient;
  const analysisStarted = jest.fn<MetricsService['analysisStarted']>();
  const analysisEnded = jest.fn<MetricsService['analysisEnded']>();
  const analysisFinished = jest.fn<MetricsService['analysisFinished']>();
  const recordNegativeAlert = jest.fn<MetricsService['recordNegativeAlert']>();
  const metrics = {
    analysisStarted,
    analysisEnded,
    analysisFinished,
    recordNegativeAlert,
  } as unknown as MetricsService;
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
    upsert.mockResolvedValue({});
    transaction.mockImplementation(async (callback) =>
      callback({ review: { update }, reviewAlert: { upsert } }),
    );
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

    await new ReviewProcessor(database, analysisClient, metrics).process(job());

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
    expect(upsert).toHaveBeenCalledWith({
      where: { reviewId: review.id },
      create: {
        reviewId: review.id,
        type: 'NEGATIVE_REVIEW',
        message: 'Avaliação negativa na categoria delivery.',
      },
      update: { message: 'Avaliação negativa na categoria delivery.' },
    });
    expect(warnSpy).toHaveBeenCalledWith({
      event: 'alert.negative_review_created',
      review_id: review.id,
      job_id: 'job-id',
      category: 'delivery',
    });
    expect(recordNegativeAlert).toHaveBeenCalledTimes(1);
    expect(analysisStarted).toHaveBeenCalledTimes(1);
    expect(analysisFinished).toHaveBeenCalledWith(
      'completed',
      expect.any(Number),
    );
    expect(analysisEnded).toHaveBeenCalledTimes(1);
  });

  it('não cria alerta para uma análise positiva', async () => {
    analyze.mockResolvedValue({
      requestId: 'request-id',
      sentiment: 'positive',
      category: 'service',
      confidence: 0.95,
      matchedKeywords: ['excelente'],
      processedAt: new Date('2026-08-29T12:00:00.000Z'),
    });

    await new ReviewProcessor(database, analysisClient, metrics).process(job());

    expect(upsert).not.toHaveBeenCalled();
    expect(recordNegativeAlert).not.toHaveBeenCalled();
  });

  it('mantém processing quando uma falha temporária ainda pode ser repetida', async () => {
    const error = new AnalysisApiError('Serviço indisponível.', true, 2000);
    analyze.mockRejectedValue(error);

    await expect(
      new ReviewProcessor(database, analysisClient, metrics).process(job(1)),
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
    expect(analysisFinished).toHaveBeenCalledWith('retry', expect.any(Number));
  });

  it('marca como failed quando uma falha temporária esgota quatro tentativas', async () => {
    const error = new AnalysisApiError('Serviço ainda indisponível.', true);
    analyze.mockRejectedValue(error);

    await expect(
      new ReviewProcessor(database, analysisClient, metrics).process(job(3)),
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
    expect(analysisFinished).toHaveBeenCalledWith('failed', expect.any(Number));
  });

  it('marca como failed e interrompe retries para uma falha definitiva', async () => {
    analyze.mockRejectedValue(new AnalysisApiError('Payload inválido.', false));

    await expect(
      new ReviewProcessor(database, analysisClient, metrics).process(job()),
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

  it('encerra a gauge mesmo quando a persistência do erro falha', async () => {
    const analysisError = new AnalysisApiError('Serviço indisponível.', true);
    const persistenceError = new Error('Banco indisponível.');
    analyze.mockRejectedValue(analysisError);
    update
      .mockResolvedValueOnce(review)
      .mockRejectedValueOnce(persistenceError);

    await expect(
      new ReviewProcessor(database, analysisClient, metrics).process(job()),
    ).rejects.toBe(persistenceError);

    expect(analysisStarted).toHaveBeenCalledTimes(1);
    expect(analysisFinished).not.toHaveBeenCalled();
    expect(analysisEnded).toHaveBeenCalledTimes(1);
  });
});
