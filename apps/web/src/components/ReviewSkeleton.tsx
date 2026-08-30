export function ReviewSkeleton() {
  return (
    <div className="skeleton-list" aria-label="Carregando avaliações">
      {[1, 2, 3].map((item) => (
        <div className="skeleton-card" key={item} />
      ))}
    </div>
  );
}
