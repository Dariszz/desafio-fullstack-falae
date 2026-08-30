import { Hero } from './components/Hero.js';
import { ReviewDetailDrawer } from './components/ReviewDetailDrawer.js';
import { ReviewForm } from './components/ReviewForm.js';
import { ReviewsPanel } from './components/ReviewsPanel.js';
import { useReviewDetail } from './hooks/useReviewDetail.js';
import { useReviewForm } from './hooks/useReviewForm.js';
import { useReviews } from './hooks/useReviews.js';

export function App() {
  const reviews = useReviews();
  const form = useReviewForm(reviews.afterReviewCreated);
  const detail = useReviewDetail();

  return (
    <main className="page-shell">
      <Hero />
      <section className="workspace" aria-label="Gestão de avaliações">
        <ReviewForm {...form} />
        <ReviewsPanel {...reviews} onOpenDetail={detail.open} />
      </section>
      <ReviewDetailDrawer {...detail} />
    </main>
  );
}
