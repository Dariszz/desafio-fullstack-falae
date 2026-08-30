import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { AnalysisClient } from './analysis.client.js';
import { AnalysisApiError } from './analysis.types.js';

describe('AnalysisClient', () => {
  beforeEach(() => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.ANALYSIS_API_URL = 'http://analysis.test';
    process.env.ANALYSIS_TIMEOUT_MS = '5000';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('parses a successful analysis', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        request_id: 'request-1',
        processed_at: '2026-08-29T12:00:00.000Z',
        analysis: {
          sentiment: 'negative',
          category: 'delivery',
          confidence: 0.91,
          matched_keywords: ['demorou', 'frio'],
        },
      }),
    );

    await expect(new AnalysisClient().analyze(input())).resolves.toMatchObject({
      requestId: 'request-1',
      sentiment: 'negative',
      confidence: 0.91,
    });
  });

  it('classifies 429 and respects Retry-After', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(
        429,
        {
          error: { message: 'Limite atingido.', retryable: true },
        },
        { 'retry-after': '2' },
      ),
    );

    const promise = new AnalysisClient().analyze(input());

    await expect(promise).rejects.toMatchObject({
      retryable: true,
      retryAfterMs: 2000,
    });
  });

  it('classifies 503 as retryable and respects Retry-After', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(
        503,
        {
          error: { message: 'Serviço indisponível.', retryable: true },
        },
        { 'retry-after': '3' },
      ),
    );

    await expect(new AnalysisClient().analyze(input())).rejects.toMatchObject({
      message: 'Serviço indisponível.',
      retryable: true,
      retryAfterMs: 3000,
    });
  });

  it('does not retry a permanent 422 response', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(422, {
        error: { message: 'Payload inválido.', retryable: false },
      }),
    );

    await expect(new AnalysisClient().analyze(input())).rejects.toMatchObject({
      retryable: false,
    });
  });

  it('treats network errors as retryable', async () => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));

    const promise = new AnalysisClient().analyze(input());

    await expect(promise).rejects.toBeInstanceOf(AnalysisApiError);
    await expect(promise).rejects.toMatchObject({
      retryable: true,
    });
  });

  it('treats request timeout as retryable', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new DOMException('Timed out', 'TimeoutError'));

    const promise = new AnalysisClient().analyze(input());

    await expect(promise).rejects.toBeInstanceOf(AnalysisApiError);
    await expect(promise).rejects.toHaveProperty('retryable', true);
    await expect(promise).rejects.toHaveProperty(
      'message',
      expect.stringContaining('Timed out'),
    );
  });
});

function input() {
  return {
    externalId: 'review-1',
    companyId: 'company-1',
    rating: 2,
    comment: 'Pedido demorou.',
    requestId: 'trace-1',
  };
}

function jsonResponse(
  status: number,
  body: unknown,
  headers?: HeadersInit,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}
