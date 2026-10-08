import { NavLink } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { useApi } from '../lib/useApi.js';

export const DRAWERS = [
  { to: '/', label: 'Today', end: true },
  { to: '/calendar', label: 'Calendar' },
  { to: '/todo', label: 'To-do' },
  { to: '/cabinet', label: 'Herb cabinet' },
  { to: '/grimoire', label: 'Grimoire' },
  { to: '/recipes', label: 'Recipe book' },
  { to: '/batches', label: 'Batch journal' },
  { to: '/journal', label: 'Journal' },
  { to: '/labels', label: 'Labels' },
  { to: '/shopping', label: 'Shopping list' },
  { to: '/garden', label: 'Garden log' },
];

export function Brand() {
  return (
    <NavLink to="/" className="cabinet-brand" aria-label="The Apothecary, Today">
      <span className="name">The<br />Apothecary</span>
      <span className="flourish" aria-hidden="true">✦ ☾ ✦</span>
    </NavLink>
  );
}

export function Cabinet({ id, open = false }) {
  const { data: health } = useApi('/api/health');
  return (
    <aside id={id} className={`cabinet${open ? ' is-open' : ''}`} aria-label="Cabinet">
      {health?.demo && <div className="demo-ribbon" role="note">Demo</div>}
      <Brand />
      <nav aria-label="Cabinet drawers">
        <ul className="drawers">
          {DRAWERS.map(d => (
            <li key={d.to}>
              <NavLink to={d.to} end={d.end} className="drawer">
                <span className="drawer-plate">{d.label}</span>
                <span className="drawer-knob" aria-hidden="true" />
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <NavLink to="/settings" className="cabinet-key"><KeyRound size={18} aria-hidden="true" />Settings</NavLink>
    </aside>
  );
}
