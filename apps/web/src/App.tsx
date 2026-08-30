import type { FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  ReviewDetail,
  ReviewStatus,
  ReviewSummary,
} from '@falae/contracts';
import {
  ApiError,
  createReview,
  getReview,
  listReviews,
  reprocessReview,
  type CreateReviewInput,
} from './api.js';

const STATUS: Record<ReviewStatus, { label: string; description: string }> = {
  pending: { label: 'Pendente', description: 'Aguardando processamento' },
  processing: { label: 'Processando', description: 'Análise em andamento' },
  completed: { label: 'Concluída', description: 'Análise disponível' },
  failed: { label: 'Falhou', description: 'Não foi possível analisar' },
};

const FILTERS: Array<{ value: ReviewStatus | 'all'; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'processing', label: 'Processando' },
  { value: 'completed', label: 'Concluídas' },
  { value: 'failed', label: 'Falhas' },
];

const EMPTY_FORM: CreateReviewInput = {
  external_id: '',
  company_id: '',
  rating: 5,
  comment: '',
};

export function App() {
  const [form, setForm] = useState<CreateReviewInput>(EMPTY_FORM);
  const [reviews, setReviews] = useState<ReviewSummary[]>([]);
  const [filter, setFilter] = useState<ReviewStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState<{
    kind: 'success' | 'error';
    text: string;
  } | null>(null);
  const [selected, setSelected] = useState<ReviewDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);
  const [reprocessMessage, setReprocessMessage] = useState<{
    kind: 'success' | 'error';
    text: string;
  } | null>(null);

  const load = useCallback(
    async (quiet = false) => {
      if (quiet) setRefreshing(true);
      else setLoading(true);
      try {
        const response = await listReviews(
          filter === 'all' ? undefined : filter,
        );
        setReviews(response.data);
        setListError(null);
      } catch (error) {
        setListError(messageFrom(error));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filter],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const hasActiveReview = useMemo(
    () =>
      reviews.some(
        ({ status }) => status === 'pending' || status === 'processing',
      ),
    [reviews],
  );

  useEffect(() => {
    if (!hasActiveReview) return;
    const timer = window.setInterval(() => void load(true), 3000);
    return () => window.clearInterval(timer);
  }, [hasActiveReview, load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFormMessage(null);

    try {
      const response = await createReview({
        ...form,
        external_id: form.external_id.trim(),
        company_id: form.company_id.trim(),
        comment: form.comment.trim(),
      });
      setFormMessage({
        kind: 'success',
        text: response.duplicate
          ? 'Essa avaliação já existia e não foi processada novamente.'
          : 'Avaliação recebida. A análise continuará em segundo plano.',
      });
      setForm(EMPTY_FORM);
      if (filter === 'all') await load(true);
      else setFilter('all');
    } catch (error) {
      setFormMessage({ kind: 'error', text: messageFrom(error) });
    } finally {
      setSubmitting(false);
    }
  }

  async function openDetail(id: string) {
    setDetailLoading(true);
    setDetailError(null);
    setSelected(null);
    try {
      setSelected(await getReview(id));
    } catch (error) {
      setDetailError(messageFrom(error));
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    setSelected(null);
    setDetailError(null);
    setDetailLoading(false);
  }

  async function retryReview(id: string) {
    setReprocessingId(id);
    setReprocessMessage(null);

    try {
      await reprocessReview(id);
      setReprocessMessage({
        kind: 'success',
        text: 'Avaliação reenviada. A nova análise continuará em segundo plano.',
      });
      await load(true);
    } catch (error) {
      setReprocessMessage({ kind: 'error', text: messageFrom(error) });
    } finally {
      setReprocessingId(null);
    }
  }

  return (
    <main className="page-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Falaê! · Voz do cliente</p>
          <h1>Feedback que chega, análise que acontece.</h1>
          <p className="hero-copy">
            Registre uma avaliação agora. Mesmo que o serviço de análise oscile,
            o feedback fica seguro e continua sendo processado.
          </p>
        </div>
        <div className="hero-mark" aria-hidden="true">
          <span>F</span>
        </div>
      </header>

      <section className="workspace" aria-label="Gestão de avaliações">
        <article className="panel form-panel">
          <div className="section-heading">
            <p className="step">01 · Nova avaliação</p>
            <h2>O que o cliente contou?</h2>
          </div>

          <form onSubmit={(event) => void submit(event)}>
            <div className="field-row">
              <label>
                ID da avaliação
                <input
                  name="external_id"
                  value={form.external_id}
                  onChange={(event) =>
                    setForm({ ...form, external_id: event.target.value })
                  }
                  placeholder="review-order-123"
                  maxLength={100}
                  required
                />
              </label>
              <label>
                ID da empresa
                <input
                  name="company_id"
                  value={form.company_id}
                  onChange={(event) =>
                    setForm({ ...form, company_id: event.target.value })
                  }
                  placeholder="company-456"
                  maxLength={100}
                  required
                />
              </label>
            </div>

            <fieldset>
              <legend>Nota</legend>
              <div className="rating-options">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <label key={rating}>
                    <input
                      type="radio"
                      name="rating"
                      value={rating}
                      checked={form.rating === rating}
                      onChange={() => setForm({ ...form, rating })}
                    />
                    <span>{rating}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label>
              Comentário
              <textarea
                name="comment"
                value={form.comment}
                onChange={(event) =>
                  setForm({ ...form, comment: event.target.value })
                }
                placeholder="Conte como foi a experiência do cliente..."
                minLength={3}
                maxLength={2000}
                rows={5}
                required
              />
              <span className="character-count">
                {form.comment.length}/2000
              </span>
            </label>

            {formMessage && (
              <p className={`notice ${formMessage.kind}`} role="status">
                {formMessage.text}
              </p>
            )}

            <button className="primary-button" disabled={submitting}>
              {submitting ? 'Enviando…' : 'Enviar para análise'}
            </button>
          </form>
        </article>

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
            {FILTERS.map(({ value, label }) => (
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
            <p
              className={`notice list-notice ${reprocessMessage.kind}`}
              role="status"
            >
              {reprocessMessage.text}
            </p>
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

          {!listError && reviews.length > 0 && (
            <div className="review-list">
              {reviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  onOpen={() => void openDetail(review.id)}
                  onReprocess={() => void retryReview(review.id)}
                  reprocessing={reprocessingId === review.id}
                />
              ))}
            </div>
          )}
        </article>
      </section>

      {(detailLoading || detailError || selected) && (
        <div className="detail-backdrop" role="presentation">
          <aside
            className="detail-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Detalhes da avaliação"
          >
            <button
              className="close-button"
              type="button"
              aria-label="Fechar detalhes"
              onClick={closeDetail}
            >
              ×
            </button>
            {detailLoading && <p>Carregando detalhes…</p>}
            {detailError && <p className="notice error">{detailError}</p>}
            {selected && <ReviewDetails review={selected} />}
          </aside>
        </div>
      )}
    </main>
  );
}

function ReviewCard({
  review,
  onOpen,
  onReprocess,
  reprocessing,
}: {
  review: ReviewSummary;
  onOpen: () => void;
  onReprocess: () => void;
  reprocessing: boolean;
}) {
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
          <button type="button" onClick={onOpen}>
            Ver detalhes →
          </button>
        </div>
      </div>
    </article>
  );
}

function ReviewDetails({ review }: { review: ReviewDetail }) {
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
        <p className="analysis-pending">{STATUS[review.status].description}.</p>
      )}

      {review.last_error && (
        <p className="notice error">
          <strong>Último erro:</strong> {review.last_error}
        </p>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: ReviewStatus }) {
  return (
    <span className={`status status-${status}`}>
      <span aria-hidden="true" />
      {STATUS[status].label}
    </span>
  );
}

function ReviewSkeleton() {
  return (
    <div className="skeleton-list" aria-label="Carregando avaliações">
      {[1, 2, 3].map((item) => (
        <div className="skeleton-card" key={item} />
      ))}
    </div>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function translateSentiment(sentiment: string): string {
  return (
    { positive: 'Positivo', neutral: 'Neutro', negative: 'Negativo' }[
      sentiment
    ] ?? sentiment
  );
}

function messageFrom(error: unknown): string {
  return error instanceof ApiError || error instanceof Error
    ? error.message
    : 'Algo inesperado aconteceu.';
}
