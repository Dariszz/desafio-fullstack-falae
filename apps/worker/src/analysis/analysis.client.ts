import { Injectable } from '@nestjs/common';
import { loadWorkerConfig } from '../config.js';
import { AnalysisApiError, type AnalysisResult } from './analysis.types.js';

export interface AnalyzeInput {
  externalId: string;
  companyId: string;
  rating: number;
  comment: string;
  requestId: string;
}

@Injectable()
export class AnalysisClient {
  private readonly config = loadWorkerConfig();

  async analyze(input: AnalyzeInput): Promise<AnalysisResult> {
    let response: Response;

    try {
      response = await fetch(`${this.config.analysisApiUrl}/v1/analyze`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-client-id': 'falae-worker',
          'x-request-id': input.requestId,
        },
        body: JSON.stringify({
          review_id: input.externalId,
          company_id: input.companyId,
          rating: input.rating,
          text: input.comment,
        }),
        signal: AbortSignal.timeout(this.config.analysisTimeoutMs),
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Falha de conexão desconhecida.';
      throw new AnalysisApiError(
        `Falha temporária ao chamar a análise: ${message}`,
        true,
      );
    }

    const body: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const retryable =
        response.status === 408 ||
        response.status === 429 ||
        response.status >= 500 ||
        errorBodyIsRetryable(body);
      throw new AnalysisApiError(
        errorMessage(body) ??
          `API de análise retornou HTTP ${response.status}.`,
        retryable,
        parseRetryAfter(response.headers.get('retry-after')),
      );
    }

    return parseSuccess(body);
  }
}

function parseSuccess(value: unknown): AnalysisResult {
  if (!isRecord(value) || !isRecord(value.analysis)) {
    throw new AnalysisApiError('Resposta inválida da API de análise.', false);
  }

  const { analysis } = value;
  if (
    typeof value.request_id !== 'string' ||
    typeof value.processed_at !== 'string' ||
    typeof analysis.sentiment !== 'string' ||
    typeof analysis.category !== 'string' ||
    typeof analysis.confidence !== 'number' ||
    !Array.isArray(analysis.matched_keywords) ||
    !analysis.matched_keywords.every((item) => typeof item === 'string')
  ) {
    throw new AnalysisApiError('Resposta inválida da API de análise.', false);
  }

  const processedAt = new Date(value.processed_at);
  if (Number.isNaN(processedAt.getTime())) {
    throw new AnalysisApiError('Data inválida na resposta da análise.', false);
  }

  return {
    requestId: value.request_id,
    sentiment: analysis.sentiment,
    category: analysis.category,
    confidence: analysis.confidence,
    matchedKeywords: analysis.matched_keywords,
    processedAt,
  };
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

function errorBodyIsRetryable(value: unknown): boolean {
  return (
    isRecord(value) && isRecord(value.error) && value.error.retryable === true
  );
}

function errorMessage(value: unknown): string | undefined {
  return isRecord(value) &&
    isRecord(value.error) &&
    typeof value.error.message === 'string'
    ? value.error.message
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
