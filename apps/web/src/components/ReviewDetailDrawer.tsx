import type { RefObject } from 'react';
import type { ReviewDetail } from '@falae/contracts';
import { ReviewDetails } from './ReviewDetails.js';

interface ReviewDetailDrawerProps {
  review: ReviewDetail | null;
  loading: boolean;
  error: string | null;
  isOpen: boolean;
  drawerRef: RefObject<HTMLElement | null>;
  close: () => void;
}

export function ReviewDetailDrawer({
  review,
  loading,
  error,
  isOpen,
  drawerRef,
  close,
}: ReviewDetailDrawerProps) {
  if (!isOpen) return null;
  return (
    <div className="detail-backdrop" role="presentation">
      <aside
        ref={drawerRef}
        className="detail-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Detalhes da avaliação"
      >
        <button
          className="close-button"
          type="button"
          aria-label="Fechar detalhes"
          onClick={close}
        >
          ×
        </button>
        {loading && <p>Carregando detalhes…</p>}
        {error && <p className="notice error">{error}</p>}
        {review && <ReviewDetails review={review} />}
      </aside>
    </div>
  );
}
