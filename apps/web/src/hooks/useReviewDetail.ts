import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReviewDetail } from '@falae/contracts';
import { getReview } from '../api.js';
import { messageFrom } from '../review-ui.js';

export function useReviewDetail() {
  const [review, setReview] = useState<ReviewDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const open = useCallback(async (id: string, trigger: HTMLButtonElement) => {
    triggerRef.current = trigger;
    setLoading(true);
    setError(null);
    setReview(null);
    try {
      setReview(await getReview(id));
    } catch (reason) {
      setError(messageFrom(reason));
    } finally {
      setLoading(false);
    }
  }, []);

  const close = useCallback(() => {
    setReview(null);
    setError(null);
    setLoading(false);
  }, []);

  const isOpen = loading || error !== null || review !== null;

  useEffect(() => {
    if (!isOpen) return;
    const drawer = drawerRef.current;
    if (!drawer) return;
    const drawerElement: HTMLElement = drawer;
    const trigger = triggerRef.current;
    drawerElement
      .querySelector<HTMLButtonElement>('[aria-label="Fechar detalhes"]')
      ?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(
        drawerElement.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      trigger?.focus();
      triggerRef.current = null;
    };
  }, [close, isOpen]);

  return { review, loading, error, isOpen, drawerRef, open, close };
}
