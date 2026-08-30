import type { Dispatch, SetStateAction } from 'react';
import type { ReviewStatus, ReviewSummary } from '@falae/contracts';
import { REVIEW_FILTERS, type NoticeMessage } from '../review-ui.js';
import { Notice } from './Notice.js';
import { ReviewCard } from './ReviewCard.js';
import { ReviewSkeleton } from './ReviewSkeleton.js';

interface ReviewsPanelProps {
  reviews: ReviewSummary[];
  filter: ReviewStatus | 'all';
  setFilter: Dispatch<SetStateAction<ReviewStatus | 'all'>>;
  loading: boolean;
  loadingMore: boolean;
  refreshing: boolean;
  page: number;
  totalPages: number;
  listError: string | null;
  paginationError: string | null;
  reprocessingId: string | null;
  reprocessMessage: NoticeMessage | null;
  load: (
    quiet?: boolean,
    requestedPage?: number,
    append?: boolean,
  ) => Promise<void>;
  retryReview: (id: string) => Promise<void>;
  onOpenDetail: (id: string, trigger: HTMLButtonElement) => Promise<void>;
}

export function ReviewsPanel(props: ReviewsPanelProps) {
  const {
    reviews,
    filter,
    setFilter,
    loading,
    loadingMore,
    refreshing,
    page,
    totalPages,
    listError,
    paginationError,
    reprocessingId,
    reprocessMessage,
    load,
    retryReview,
    onOpenDetail,
  } = props;

  return (
    <article className="panel reviews-panel">
      <div className="section-heading reviews-heading">
        <div>
          <p className="step">02 · Acompanhamento</p>
          <h2>Avaliações recentes</h2>
        </div>
        <button
          className="refresh-button"
          type="button"
          onClick={() => void load(true)}
          disabled={refreshing}
        >
          {refreshing ? 'Atualizando…' : 'Atualizar'}
        </button>
      </div>
      <div className="filters" aria-label="Filtrar por status">
        {REVIEW_FILTERS.map(({ value, label }) => (
          <button
            type="button"
            key={value}
            className={filter === value ? 'active' : ''}
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {reprocessMessage && (
        <Notice message={reprocessMessage} className="list-notice" />
      )}
      {listError && (
        <div className="state-card error-state" role="alert">
          <strong>Não conseguimos carregar as avaliações.</strong>
          <span>{listError}</span>
          <button type="button" onClick={() => void load()}>
            Tentar novamente
          </button>
        </div>
      )}
      {!listError && loading && <ReviewSkeleton />}
      {!listError && !loading && reviews.length === 0 && (
        <div className="state-card empty-state">
          <span className="empty-icon" aria-hidden="true">
            ◌
          </span>
          <strong>Nenhuma avaliação por aqui.</strong>
          <span>
            {filter === 'all'
              ? 'Envie o primeiro feedback pelo formulário.'
              : 'Não há avaliações com esse status.'}
          </span>
        </div>
      )}
      {!listError && !loading && reviews.length > 0 && (
        <>
          <div className="review-list">
            {reviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                onOpen={(trigger) => void onOpenDetail(review.id, trigger)}
                onReprocess={() => void retryReview(review.id)}
                reprocessing={reprocessingId === review.id}
              />
            ))}
          </div>
          {paginationError && (
            <Notice
              message={{ kind: 'error', text: paginationError }}
              className="pagination-notice"
              alert
            />
          )}
          {page < totalPages && (
            <div className="load-more-container">
              <button
                className="load-more-button"
                type="button"
                disabled={loadingMore}
                onClick={() => void load(false, page + 1, true)}
              >
                {loadingMore ? 'Carregando…' : 'Carregar mais'}
              </button>
            </div>
          )}
        </>
      )}
    </article>
  );
}
