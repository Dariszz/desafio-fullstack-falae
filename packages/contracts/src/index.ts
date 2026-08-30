export const REVIEW_STATUSES = [
  'pending',
  'processing',
  'completed',
  'failed',
] as const;

export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export interface ReviewAnalysis {
  sentiment: string;
  category: string;
  confidence: number;
  matched_keywords: string[];
  processed_at: string;
}

export interface ReviewAlert {
  id: string;
  type: 'negative_review';
  message: string;
  created_at: string;
}

export interface ReviewSummary {
  id: string;
  external_id: string;
  company_id: string;
  rating: number;
  comment: string;
  status: ReviewStatus;
  attempts: number;
  analysis: ReviewAnalysis | null;
  alert: ReviewAlert | null;
  created_at: string;
  processed_at: string | null;
}

export interface ReviewDetail extends ReviewSummary {
  last_error: string | null;
  updated_at: string;
}

export interface CreateReviewResponse {
  id: string;
  external_id: string;
  status: ReviewStatus;
  duplicate: boolean;
}

export interface ReprocessReviewResponse {
  id: string;
  external_id: string;
  status: ReviewStatus;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface ReviewsListResponse {
  data: ReviewSummary[];
  meta: PaginationMeta;
}

export const REVIEW_ANALYSIS_QUEUE = 'review-analysis';
export const ANALYZE_REVIEW_JOB = 'analyze-review';

export interface AnalyzeReviewJobData {
  reviewId: string;
}
