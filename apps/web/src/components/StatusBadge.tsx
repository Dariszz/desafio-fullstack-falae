import type { ReviewStatus } from '@falae/contracts';
import { REVIEW_STATUS } from '../review-ui.js';

export function StatusBadge({ status }: { status: ReviewStatus }) {
  return (
    <span className={`status status-${status}`}>
      <span aria-hidden="true" />
      {REVIEW_STATUS[status].label}
    </span>
  );
}
