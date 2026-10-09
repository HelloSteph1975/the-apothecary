import { Link } from 'react-router-dom';
import { formatAmount, statusBadges, sourceText } from '../../lib/cabinet.js';

function Jar() {
  return (
    <svg className="item-thumb" viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="15" y="7" width="18" height="6" rx="1.5" />
      <path d="M17 13 C12 16 12 20 12 24 V38 C12 41 14 43 17 43 H31 C34 43 36 41 36 38 V24 C36 20 36 16 31 13" />
      <path d="M12 24 H36" />
    </svg>
  );
}

export function ItemRow({ item }) {
  const badges = statusBadges(item.status);
  if (item.used_up_at) badges.push({ key: 'used_up', label: 'Used up', tone: 'brass' });
  return (
    <Link to={`/cabinet/items/${item.id}`} className="item-row">
      {item.cover ? <img src={`/photos/${item.cover}`} alt="" /> : <Jar />}
      <span>
        <strong>{item.name}</strong>
        {item.latin_name && <> <em>{item.latin_name}</em></>}
        {item.size_label && <small> {item.size_label}</small>}
      </span>
      <span>{formatAmount(item.amount, item.unit)}</span>
      <span>{sourceText(item)}</span>
      {badges.length > 0 && (
        <span className="badges">
          {badges.map(b => <span key={b.key} className={`badge badge-${b.tone}`}>{b.label}</span>)}
        </span>
      )}
    </Link>
  );
}
