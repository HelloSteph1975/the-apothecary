export function Stars({ rating }) {
  if (rating == null) return <span className="muted">Not rated</span>;
  return (
    <span className="stars">
      <span aria-hidden="true">{'★'.repeat(rating)}{'☆'.repeat(5 - rating)}</span>
      <span className="visually-hidden">Rated {rating} out of 5</span>
    </span>
  );
}
