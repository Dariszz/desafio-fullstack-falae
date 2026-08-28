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

export interface ReviewSummary {
  id: string;
  external_id: string;
  company_id: string;
  rating: number;
  comment: string;
  status: ReviewStatus;
  attempts: number;
  analysis: ReviewAnalysis | null;
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
