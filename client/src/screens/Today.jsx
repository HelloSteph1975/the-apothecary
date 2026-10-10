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
import { useTaskActions } from './todo/Todo.jsx';
import { TaskCheck } from './todo/TaskCheck.jsx';
import { FOLK_LABEL, phaseText, skyLine, clockTime, nextMoonText, festivalText } from '../lib/sky.js';

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

function SkyLines({ sky }) {
  if (!sky?.phase || !sky.moon) return null;
  return (
    <div className="sky-lines">
      <p>{skyLine(sky)}</p>
      {(sky.moon.changes ?? []).map(c => <p key={c.at}>Moon enters {c.sign} at {clockTime(c.at)}</p>)}
      {sky.next_full && sky.next_new && <p>{nextMoonText(sky)}</p>}
      {festivalText(sky) && <p>{festivalText(sky)}</p>}
    </div>
  );
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
  const due = data?.batchesDue ?? [];
  const taskActions = useTaskActions({ onChange: () => today.reload() });
  const tasks = data?.tasks ?? [];
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
        actions={<WaxSeal onClick={() => navigate('/batches/new')}>Log a batch</WaxSeal>}
      />
      {data?.sky && <SkyLines sky={data.sky} />}
      <p className="flourish-line">gather ✦ steep ✦ strain ✦ keep</p>
      <div className="card-grid">
        <ParchmentCard title="Tasks" subtitle="due today and overdue">
          {status(!data ? <p className="muted">Looking at the list…</p> : tasks.length === 0 ? (
            <p className="muted">Nothing due today.</p>
          ) : (
            <>
              <ul className="today-list">
                {tasks.map(t => (
                  <li key={t.id}><TaskCheck task={t} actions={taskActions} /> <Link to={`/todo/${t.id}`}>{t.title}</Link></li>
                ))}
              </ul>
              <p><Link to="/todo">See all</Link></p>
            </>
          ))}
        </ParchmentCard>
        {data?.sky && (
          <ParchmentCard title="The sky today" subtitle={settings && settings.sky_suggestions !== 'off' ? "folk timing, for what you're making" : 'the moon and the day'}>
            <p>{phaseText(data.sky.phase)}</p>
            {!settings ? null : settings.sky_suggestions === 'off' ? (
              <p className="muted">Suggestions are off. Turn them on in Settings.</p>
            ) : (data.suggestions ?? []).length === 0 ? (
              <p className="muted">No folk timing for today. You can add your own.</p>
            ) : (
              <ul className="today-list">
                {data.suggestions.map(s => (
                  <li key={s.id}>{s.text} <span className="badge badge-brass">{FOLK_LABEL}</span></li>
                ))}
              </ul>
            )}
            <p><Link to="/settings/timing-rules">Timing rules</Link></p>
          </ParchmentCard>
        )}
        <ParchmentCard title="Batches due" subtitle="what's steeping, and when it's ready" botanical="calendula">
          {status(!data ? <p className="muted">Looking in the journal…</p> : due.length === 0 ? (
            <p className="muted">Nothing due in the next few days.</p>
          ) : (
            <>
              <ul className="today-list">
                {due.map(d => (
                  <li key={d.step_id}>
                    {d.title}: <Link to={`/batches/${d.batch_id}`}>{d.batch_name}</Link>, due {formatShortDay(d.due_on)}
                    {d.overdue && <> <span className="badge badge-oxblood">Overdue</span></>}
                  </li>
                ))}
              </ul>
              <p><Link to="/batches">See all</Link></p>
            </>
          ))}
        </ParchmentCard>
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
        {herbApi.error && (
          <ParchmentCard title="Herb of the day" subtitle="from the grimoire" botanical="lavender">
            <p role="alert">The herb of the day couldn't load. <button type="button" className="btn" onClick={herbApi.reload}>Try again</button></p>
          </ParchmentCard>
        )}
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
