import { NavLink } from 'react-router-dom';

export function CabinetTabs() {
  return (
    <nav className="tabs" aria-label="Herb cabinet">
      <NavLink to="/cabinet" end className="tab">Shelves</NavLink>
      <NavLink to="/cabinet/suppliers" className="tab">Suppliers</NavLink>
    </nav>
  );
}
