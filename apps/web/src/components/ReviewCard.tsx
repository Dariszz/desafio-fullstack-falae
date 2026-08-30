import type { ReviewSummary } from '@falae/contracts';
import { formatDate } from '../review-ui.js';
import { StatusBadge } from './StatusBadge.js';

interface ReviewCardProps {
  review: ReviewSummary;
  onOpen: (trigger: HTMLButtonElement) => void;
  onReprocess: () => void;
  reprocessing: boolean;
}

export function ReviewCard({
  review,
  onOpen,
  onReprocess,
  reprocessing,
}: ReviewCardProps) {
  return (
    <article className="review-card">
      <div className="review-topline">
        <StatusBadge status={review.status} />
        <time dateTime={review.created_at}>
          {formatDate(review.created_at)}
        </time>
      </div>
      <div className="review-company">
        <strong>{review.company_id}</strong>
        <span>{review.external_id}</span>
      </div>
      <p className="review-comment">“{review.comment}”</p>
      {review.alert && (
        <div className="negative-alert negative-alert-compact">
          <strong>Alerta negativo</strong>
          <span>{review.alert.message}</span>
        </div>
      )}
      <div className="review-footer">
        <span className="stars" aria-label={`Nota ${review.rating} de 5`}>
          {'★'.repeat(review.rating)}
          <span>{'★'.repeat(5 - review.rating)}</span>
        </span>
        <div className="review-actions">
          {review.status === 'failed' && (
            <button
              className="retry-button"
              type="button"
              onClick={onReprocess}
              disabled={reprocessing}
            >
              {reprocessing ? 'Reenviando…' : 'Tentar novamente'}
            </button>
          )}
          <button
            type="button"
            onClick={(event) => onOpen(event.currentTarget)}
          >
            Ver detalhes →
          </button>
        </div>
      </div>
    </article>
  );
}
