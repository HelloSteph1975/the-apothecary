import { Link, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader.jsx';
import { ParchmentCard } from '../../components/ParchmentCard.jsx';
import { WaxSealLink } from '../../components/WaxSeal.jsx';
import { Button } from '../../components/Button.jsx';
import { useApi } from '../../lib/useApi.js';
import { formatShortDay } from '../../lib/cabinet.js';
import { todayString } from '../../lib/today.js';
import { addDaysTo } from '../../lib/tasks.js';
import { kindLabel } from '../../lib/garden.js';
import { MoonGarden } from './MoonGarden.jsx';

const DUE_DAYS = 7;

function PlantCard({ plant, dueBy }) {
  const due = !plant.ended_on && plant.expected_harvest_on && plant.expected_harvest_on <= dueBy;
  const herb = plant.herb && plant.herb.name !== plant.name ? plant.herb.name : null;
  return (
    <ParchmentCard className="herb-card plant-card">
      <div className="herb-card-head">
        {plant.cover && <img className="herb-cover" src={`/photos/${plant.cover}`} alt="" />}
        <div>
          <h2><Link to={`/garden/plants/${plant.id}`}>{plant.name}</Link></h2>
          {herb && <p className="muted">{herb}</p>}
          {plant.place && <p className="muted">{plant.place}</p>}
        </div>
      </div>
      {plant.planted_on && <p>Planted {formatShortDay(plant.planted_on)}</p>}
      {plant.expected_harvest_on && (
        <p>
          Harvest around {formatShortDay(plant.expected_harvest_on)}
          {due && <> <span className="badge badge-oxblood">Harvest due</span></>}
        </p>
      )}
      {plant.last_entry && <p className="muted">{kindLabel(plant.last_entry.kind)}, {formatShortDay(plant.last_entry.entry_date)}</p>}
    </ParchmentCard>
  );
}

export function Garden() {
  const [params] = useSearchParams();
  const status = params.get('status') === 'ended' ? 'ended' : 'growing';
  const plants = useApi(`/api/garden/plants?status=${status}`, { keepPrevious: true });
  const dueBy = addDaysTo(todayString(), DUE_DAYS);

  const header = (
    <PageHeader title="Garden log" subtitle="What grows, what you gathered, and when"
      actions={<><Link to="/garden/log">The whole log</Link><Link to="/garden/plants/new">Add a plant</Link><WaxSealLink to="/garden/entries/new">Log something</WaxSealLink></>} />
  );
  const tabLink = (value, label) => (
    <Link className="tab" to={value === 'growing' ? '?' : `?status=${value}`} replace aria-current={status === value ? 'page' : undefined}>{label}</Link>
  );
  const tabs = <nav className="tabs" aria-label="Plant status">{tabLink('growing', 'Growing')}{tabLink('ended', 'Ended')}</nav>;

  let body;
  if (plants.error) body = <><p role="alert">{plants.error.message}</p><Button onClick={plants.reload}>Try again</Button></>;
  else if (!plants.data) body = <p>Opening the garden…</p>;
  else if (plants.data.length === 0) {
    body = status === 'growing'
      ? <ParchmentCard botanical="calendula"><p className="muted">Nothing planted yet. <Link to="/garden/plants/new">Add the first plant.</Link></p></ParchmentCard>
      : <ParchmentCard botanical="calendula"><p className="muted">No ended plants.</p></ParchmentCard>;
  } else body = <div className="card-grid">{plants.data.map(p => <PlantCard key={p.id} plant={p} dueBy={dueBy} />)}</div>;

  return <>{header}{tabs}{body}<MoonGarden /></>;
}
