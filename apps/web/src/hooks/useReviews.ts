import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReviewStatus, ReviewSummary } from '@falae/contracts';
import { listReviews, reprocessReview } from '../api.js';
import { messageFrom, type NoticeMessage } from '../review-ui.js';

export function useReviews() {
  const [reviews, setReviews] = useState<ReviewSummary[]>([]);
  const [filter, setFilter] = useState<ReviewStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [listError, setListError] = useState<string | null>(null);
  const [paginationError, setPaginationError] = useState<string | null>(null);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);
  const [reprocessMessage, setReprocessMessage] =
    useState<NoticeMessage | null>(null);

  const load = useCallback(
    async (quiet = false, requestedPage = 1, append = false) => {
      if (append) setLoadingMore(true);
      else if (quiet) setRefreshing(true);
      else setLoading(true);
      try {
        const response = await listReviews(
          filter === 'all' ? undefined : filter,
          requestedPage,
        );
        setReviews((current) =>
          append
            ? [
                ...current,
                ...response.data.filter(
                  (review) => !current.some(({ id }) => id === review.id),
                ),
              ]
            : response.data,
        );
        setPage(response.meta.page);
        setTotalPages(response.meta.total_pages);
        setListError(null);
        setPaginationError(null);
      } catch (error) {
        if (append) setPaginationError(messageFrom(error));
        else setListError(messageFrom(error));
      } finally {
        setLoading(false);
        setLoadingMore(false);
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

  const retryReview = useCallback(
    async (id: string) => {
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
    },
    [load],
  );

  const afterReviewCreated = useCallback(async () => {
    if (filter === 'all') await load(true);
    else setFilter('all');
  }, [filter, load]);

  return {
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
    afterReviewCreated,
  };
}
