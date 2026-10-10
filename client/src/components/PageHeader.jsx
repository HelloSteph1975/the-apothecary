export function PageHeader({ title, subtitle, actions, headingRef }) {
  return (
    <header className="page-header">
      <div>
        <h1 ref={headingRef} tabIndex={headingRef ? -1 : undefined}>{title}</h1>
        {subtitle && <p className="subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}
