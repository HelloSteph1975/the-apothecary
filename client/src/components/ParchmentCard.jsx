import { BOTANICALS, LeafOrnament } from './Botanicals.jsx';

export function ParchmentCard({ title, subtitle, botanical, children, className = '', headingRef }) {
  const Art = botanical ? BOTANICALS[botanical] : null;
  return (
    <section className={`panel ${className}`} aria-label={title}>
      <span className="panel-ornament"><LeafOrnament /></span>
      {title && <h2 ref={headingRef} tabIndex={headingRef ? -1 : undefined}>{title}</h2>}
      {subtitle && <p className="panel-subtitle">{subtitle}</p>}
      {children}
      {Art && <span className="botanical"><Art size={100} /></span>}
    </section>
  );
}
