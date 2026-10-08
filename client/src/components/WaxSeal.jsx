function Sprig() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="#f0d3c4" strokeWidth="1.4" strokeLinecap="round">
      <path d="M12 22 V6" />
      <path d="M12 16 C8 15 6 13 5 10 M12 16 C16 15 18 13 19 10 M12 11 C9 10 8 8 8 6 M12 11 C15 10 16 8 16 6" />
      <circle cx="12" cy="4" r="1.6" />
    </svg>
  );
}

export function WaxSeal({ children, ...props }) {
  return (
    <button type="button" className="wax-seal" {...props}>
      <Sprig />
      {children}
    </button>
  );
}
