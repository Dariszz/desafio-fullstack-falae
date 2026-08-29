export interface AnalysisResult {
  requestId: string;
  sentiment: string;
  category: string;
  confidence: number;
  matchedKeywords: string[];
  processedAt: Date;
}

export class AnalysisApiError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'AnalysisApiError';
  }
}
