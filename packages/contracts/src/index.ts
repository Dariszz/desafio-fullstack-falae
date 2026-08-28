export const REVIEW_STATUSES = [
  'pending',
  'processing',
  'completed',
  'failed',
] as const;

export type ReviewStatus = (typeof REVIEW_STATUSES)[number];
