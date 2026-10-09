import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader.jsx';
import { ParchmentCard } from '../components/ParchmentCard.jsx';
import { WaxSeal } from '../components/WaxSeal.jsx';
import { useSettings } from '../components/SettingsProvider.jsx';
import { greeting, longDate } from '../lib/dates.js';
import { todayString } from '../lib/today.js';
import { formatAmount, formatShortDay } from '../lib/cabinet.js';
import { useApi } from '../lib/useApi.js';

const EMPTY = 'Nothing here yet. This fills in once the herb cabinet is stocked.';

const firstSentence = text => {
  const t = (text ?? '').trim();
  return t.match(/^.*?[.!?](?=\s|$)/s)?.[0] ?? t;
};

const leftText = it => `${formatAmount(it.amount, it.unit)} left`;
const seeAll = (count, shown, to) => (count > shown ? <p><Link to={to}>See all {count}</Link></p> : null);

function Rows({ items }) {
  return (
    <ul className="today-list">
      {items.map(({ it, text }) => (
        <li key={it.id}><Link to={`/cabinet/items/${it.id}`}>{it.name}, {text}</Link></li>
      ))}
    </ul>
  );
}

function EmptyCabinet() {
  return (
    <>
      <p className="muted">{EMPTY}</p>
      <p><Link to="/cabinet/new">Stock the cabinet</Link></p>
    </>
  );
}

// Keeps the clock fresh so the greeting and date don't go stale on a page left open.
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const refresh = () => setNow(prev => {
      const next = new Date();
      return greeting(prev) === greeting(next) && longDate(prev) === longDate(next) ? prev : next;
    });
    const timer = setInterval(refresh, 60000);
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, []);
  return now;
}

export function Today() {
  const { settings } = useSettings();
  const navigate = useNavigate();
  const now = useNow();
  const name = settings?.keeper_name;
  const day = todayString(now);
  const today = useApi(`/api/today?today=${day}`);
  const data = today.data;
  const counts = data?.counts;
  const allZero = Boolean(counts) && counts.runningLow === 0 && counts.nearingExpiry === 0 && counts.expired === 0;
  const items = useApi(allZero ? `/api/items?today=${day}` : null);
  const cabinetEmpty = allZero && !items.loading && !items.error && (items.data ?? []).length === 0;
  const failed = today.error || (allZero && items.error);
  const herbApi = useApi(`/api/herb-of-the-day?today=${day}`);
  const herb = herbApi.data?.id ? herbApi.data : null;
  const retry = () => { today.reload(); items.reload(); };
  const nearing = data
    ? [
      ...data.expired.map(it => ({ it, text: `past its best since ${formatShortDay(it.expires_on)}` })),
      ...data.nearingExpiry.map(it => ({ it, text: `use by ${formatShortDay(it.expires_on)}` })),
    ]
    : [];
  const status = body => (failed ? (
    <p role="alert">Couldn't read the cabinet. <button type="button" className="btn" onClick={retry}>Try again</button></p>
  ) : body);
  return (
    <>
      <PageHeader
        title={name ? `${greeting(now)}, ${name}` : greeting(now)}
        subtitle={longDate(now)}
        actions={<WaxSeal onClick={() => navigate('/batches')}>Log a batch</WaxSeal>}
      />
      <p className="flourish-line">gather ✦ steep ✦ strain ✦ keep</p>
      <div className="card-grid">
        <ParchmentCard title="Batches due" subtitle="what's steeping, and when it's ready" botanical="calendula"><p className="muted">Batches arrive in a later stage.</p></ParchmentCard>
        <ParchmentCard title="Running low" subtitle="jars to refill soon" botanical="chamomile">
          {status(!data ? <p className="muted">Looking in the cabinet…</p> : cabinetEmpty ? <EmptyCabinet /> : data.runningLow.length === 0 ? (
            <p className="muted">Nothing is running low.</p>
          ) : (
            <>
              <Rows items={data.runningLow.map(it => ({ it, text: leftText(it) }))} />
              {seeAll(counts.runningLow, data.runningLow.length, '/cabinet?status=low')}
            </>
          ))}
        </ParchmentCard>
        <ParchmentCard title="Nearing expiry" subtitle="use these first" botanical="lavender">
          {status(!data ? <p className="muted">Looking in the cabinet…</p> : cabinetEmpty ? <EmptyCabinet /> : nearing.length === 0 ? (
            <p className="muted">Nothing is close to its date.</p>
          ) : (
            <>
              <Rows items={nearing} />
              {seeAll(counts.expired, data.expired.length, '/cabinet?status=expired')}
              {seeAll(counts.nearingExpiry, data.nearingExpiry.length, '/cabinet?status=expiring')}
            </>
          ))}
        </ParchmentCard>
        {herb && (
          <ParchmentCard title="Herb of the day" subtitle="from the grimoire" botanical="lavender">
            <p><Link to={`/grimoire/${herb.id}`}>{herb.common_name}</Link></p>
            {herb.latin_name && <p className="muted"><em>{herb.latin_name}</em></p>}
            {herb.uses && <p>{firstSentence(herb.uses)}</p>}
            {(herb.planet || herb.element) && <p className="muted">{[herb.planet, herb.element].filter(Boolean).join(', ')}</p>}
            <p className="muted"><Link to={`/grimoire/${herb.id}`}>Read its cautions before you use it.</Link></p>
          </ParchmentCard>
        )}
      </div>
    </>
  );
}
