import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader.jsx';
import { ParchmentCard } from '../../components/ParchmentCard.jsx';
import { CabinetTabs } from '../../components/CabinetTabs.jsx';
import { WaxSealLink } from '../../components/WaxSeal.jsx';
import { Button } from '../../components/Button.jsx';
import { useApi } from '../../lib/useApi.js';
import { formatMoney, formatDay } from '../../lib/cabinet.js';
import { Stars } from './Stars.jsx';

const add = <WaxSealLink to="/cabinet/suppliers/new">Add a supplier</WaxSealLink>;

export function Suppliers() {
  const { data, error, reload } = useApi('/api/suppliers');
  return (
    <>
      <PageHeader title="Herb cabinet" actions={add} />
      <CabinetTabs />
      {error && (
        <>
          <p role="alert">{error.message}</p>
          <Button onClick={reload}>Try again</Button>
        </>
      )}
      {!error && !data && <p>Opening the ledger…</p>}
      {data && data.length === 0 && (
        <ParchmentCard title="No suppliers yet">
          <p className="muted">Add the shops and growers you buy from, and their purchases will gather here.</p>
          {add}
        </ParchmentCard>
      )}
      {data && data.length > 0 && (
        <div className="card-grid">
          {data.map(s => (
            <ParchmentCard key={s.id}>
              <h2><Link to={`/cabinet/suppliers/${s.id}`}>{s.name}</Link></h2>
              <p><Stars rating={s.rating} /></p>
              {s.good_for && <p>Good for: {s.good_for}</p>}
              <p className="muted">
                {s.purchase_count > 0
                  ? `${s.purchase_count} ${s.purchase_count === 1 ? 'purchase' : 'purchases'}, ${formatMoney(s.total_spent)} spent, last on ${formatDay(s.last_purchased_on)}`
                  : 'No purchases yet.'}
              </p>
              {s.website && <p><a href={s.website} target="_blank" rel="noopener noreferrer">Website</a></p>}
            </ParchmentCard>
          ))}
        </div>
      )}
    </>
  );
}
