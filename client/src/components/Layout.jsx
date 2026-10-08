import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Cabinet, Brand } from './Cabinet.jsx';
import { VineCorner } from './Botanicals.jsx';

export function Layout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const mainRef = useRef(null);
  const lastPath = useRef(pathname);

  useEffect(() => {
    setOpen(false);
    // Move focus to the new page for keyboard and screen-reader users, but not on first load.
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = e => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="topbar">
        <Brand />
        <button className="icon-btn" aria-expanded={open} aria-controls="cabinet"
          aria-label={open ? 'Close the cabinet' : 'Open the cabinet'} onClick={() => setOpen(o => !o)}>
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>
      <Cabinet id="cabinet" open={open} />
      {open && <div className="scrim" onClick={() => setOpen(false)} aria-hidden="true" />}
      <main id="main" className="main" tabIndex={-1} ref={mainRef}>
        <div className="page sheet">
          {['tl', 'tr', 'bl', 'br'].map(c => <VineCorner key={c} className={`sheet-vine ${c}`} />)}
          <Outlet />
        </div>
      </main>
    </div>
  );
}
