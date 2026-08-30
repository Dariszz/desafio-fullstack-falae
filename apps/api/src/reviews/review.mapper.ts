import type {
  ReviewAnalysis,
  ReviewDetail,
  ReviewStatus as ApiReviewStatus,
  ReviewSummary,
} from '@falae/contracts';
import { ReviewStatus as DatabaseReviewStatus } from '@falae/database';
import type { ReviewWithAlert } from './reviews.repository.js';

const STATUS_MAP: Record<DatabaseReviewStatus, ApiReviewStatus> = {
  [DatabaseReviewStatus.PENDING]: 'pending',
  [DatabaseReviewStatus.PROCESSING]: 'processing',
  [DatabaseReviewStatus.COMPLETED]: 'completed',
  [DatabaseReviewStatus.FAILED]: 'failed',
};

export function toDatabaseReviewStatus(
  status: ApiReviewStatus,
): DatabaseReviewStatus {
  const statuses: Record<ApiReviewStatus, DatabaseReviewStatus> = {
    pending: DatabaseReviewStatus.PENDING,
    processing: DatabaseReviewStatus.PROCESSING,
    completed: DatabaseReviewStatus.COMPLETED,
    failed: DatabaseReviewStatus.FAILED,
  };

  return statuses[status];
}

export function toApiReviewStatus(
  status: DatabaseReviewStatus,
): ApiReviewStatus {
  return STATUS_MAP[status];
}

export function toReviewSummary(review: ReviewWithAlert): ReviewSummary {
  return {
    id: review.id,
    external_id: review.externalId,
    company_id: review.companyId,
    rating: review.rating,
    comment: review.comment,
    status: toApiReviewStatus(review.status),
    attempts: review.attempts,
    analysis: toAnalysis(review),
    alert: review.alert
      ? {
          id: review.alert.id,
          type: 'negative_review',
          message: review.alert.message,
          created_at: review.alert.createdAt.toISOString(),
        }
      : null,
    created_at: review.createdAt.toISOString(),
    processed_at: review.processedAt?.toISOString() ?? null,
  };
}

export function toReviewDetail(review: ReviewWithAlert): ReviewDetail {
  return {
    ...toReviewSummary(review),
    last_error: review.lastError,
    updated_at: review.updatedAt.toISOString(),
  };
}

function toAnalysis(review: ReviewWithAlert): ReviewAnalysis | null {
  if (
    review.analysisSentiment === null ||
    review.analysisCategory === null ||
    review.analysisConfidence === null ||
    review.analysisProcessedAt === null
  ) {
    return null;
  }

  return {
    sentiment: review.analysisSentiment,
    category: review.analysisCategory,
    confidence: Number(review.analysisConfidence),
    matched_keywords: toStringArray(review.analysisKeywords),
    processed_at: review.analysisProcessedAt.toISOString(),
  };
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}
