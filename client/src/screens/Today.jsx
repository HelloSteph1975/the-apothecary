import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader.jsx';
import { ParchmentCard } from '../components/ParchmentCard.jsx';
import { WaxSeal } from '../components/WaxSeal.jsx';
import { useSettings } from '../components/SettingsProvider.jsx';
import { greeting, longDate } from '../lib/dates.js';

const EMPTY = 'Nothing here yet. This fills in once the herb cabinet is stocked.';

export function Today() {
  const { settings } = useSettings();
  const navigate = useNavigate();
  const now = new Date();
  const name = settings?.keeper_name;
  return (
    <>
      <PageHeader
        title={name ? `${greeting(now)}, ${name}` : greeting(now)}
        subtitle={longDate(now)}
        actions={<WaxSeal onClick={() => navigate('/batches')}>Log a batch</WaxSeal>}
      />
      <p className="flourish-line">gather ✦ steep ✦ strain ✦ keep</p>
      <div className="card-grid">
        <ParchmentCard title="Batches due" subtitle="what's steeping, and when it's ready" botanical="calendula"><p className="muted">{EMPTY}</p></ParchmentCard>
        <ParchmentCard title="Running low" subtitle="jars to refill soon" botanical="chamomile"><p className="muted">{EMPTY}</p></ParchmentCard>
        <ParchmentCard title="Nearing expiry" subtitle="use these first" botanical="lavender"><p className="muted">{EMPTY}</p></ParchmentCard>
      </div>
    </>
  );
}
