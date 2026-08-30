import type { ReviewDetail } from '@falae/contracts';
import { formatDate, REVIEW_STATUS, translateSentiment } from '../review-ui.js';
import { StatusBadge } from './StatusBadge.js';

export function ReviewDetails({ review }: { review: ReviewDetail }) {
  return (
    <div className="detail-content">
      <p className="step">Detalhes da avaliação</p>
      <h2 id="detail-title">{review.external_id}</h2>
      <StatusBadge status={review.status} />
      <dl className="detail-meta">
        <div>
          <dt>Empresa</dt>
          <dd>{review.company_id}</dd>
        </div>
        <div>
          <dt>Nota</dt>
          <dd>{review.rating} de 5</dd>
        </div>
        <div>
          <dt>Tentativas</dt>
          <dd>{review.attempts}</dd>
        </div>
        <div>
          <dt>Recebida em</dt>
          <dd>{formatDate(review.created_at)}</dd>
        </div>
      </dl>
      <blockquote>{review.comment}</blockquote>
      {review.alert && (
        <div className="negative-alert" role="alert">
          <strong>Atenção: avaliação negativa</strong>
          <span>{review.alert.message}</span>
          <small>Criado em {formatDate(review.alert.created_at)}</small>
        </div>
      )}
      {review.analysis ? (
        <section className="analysis-card">
          <p className="step">Resultado da análise</p>
          <div className="analysis-grid">
            <div>
              <span>Sentimento</span>
              <strong>{translateSentiment(review.analysis.sentiment)}</strong>
            </div>
            <div>
              <span>Categoria</span>
              <strong>{review.analysis.category}</strong>
            </div>
            <div>
              <span>Confiança</span>
              <strong>{Math.round(review.analysis.confidence * 100)}%</strong>
            </div>
          </div>
          {review.analysis.matched_keywords.length > 0 && (
            <div className="keywords">
              {review.analysis.matched_keywords.map((keyword) => (
                <span key={keyword}>{keyword}</span>
              ))}
            </div>
          )}
        </section>
      ) : (
        <p className="analysis-pending">
          {REVIEW_STATUS[review.status].description}.
        </p>
      )}
      {review.last_error && (
        <p className="notice error">
          <strong>Último erro:</strong> {review.last_error}
        </p>
      )}
    </div>
  );
}
