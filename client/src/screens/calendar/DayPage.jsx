import { Link, useParams } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader.jsx';
import { ParchmentCard } from '../../components/ParchmentCard.jsx';
import { Button } from '../../components/Button.jsx';
import { useSettings } from '../../components/SettingsProvider.jsx';
import { useApi } from '../../lib/useApi.js';
import { isDay } from '../../lib/calendar.js';
import { addDaysTo } from '../../lib/tasks.js';
import { taskLabel } from '../../lib/garden.js';
import { FOLK_LABEL, clockTime, phaseText, skyLine } from '../../lib/sky.js';
import { useTaskActions } from '../todo/Todo.jsx';
import { TaskCheck } from '../todo/TaskCheck.jsx';
import { EventLink } from './EventList.jsx';
import { NotFound } from '../NotFound.jsx';

const longDay = iso => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
};

function festivalLine(sky) {
  if (sky.festival) return `Festival: ${sky.festival}`;
  const n = sky.next_festival;
  return n ? `${n.name} in ${n.in_days} ${n.in_days === 1 ? 'day' : 'days'}` : null;
}

export function DayPage() {
  const { day } = useParams();
  const valid = isDay(day);
  const { settings } = useSettings();
  const { data, error, reload } = useApi(valid ? `/api/calendar/day/${day}` : null);
  const actions = useTaskActions({ onChange: () => reload() });
  if (!valid) return <NotFound />;

  const nav = (
    <>
      <Button as={Link} variant="secondary" size="sm" to={`/calendar/${addDaysTo(day, -1)}`}>Previous day</Button>
      <Button as={Link} variant="secondary" size="sm" to={`/calendar/${addDaysTo(day, 1)}`}>Next day</Button>
    </>
  );
  const header = (
    <PageHeader title={longDay(day)} subtitle={data?.sky ? skyLine(data.sky) : undefined} actions={nav} />
  );
  const back = <p><Link to={`/calendar?date=${day}`}>Back to the calendar</Link></p>;

  if (error) return <>{header}<p role="alert">{error.message}</p><Button onClick={reload}>Try again</Button>{back}</>;
  if (!data) return <>{header}<p role="status">Opening the day…</p>{back}</>;

  const { sky, suggestions } = data;
  const garden = data.garden ?? [];
  const events = data.events.filter(e => e.kind !== 'journal');
  const entries = data.events.filter(e => e.kind === 'journal');
  const festival = festivalLine(sky);
  const showFolk = settings != null && settings.sky_suggestions !== 'off';
  return (
    <>
      {header}
      <ParchmentCard title="Sky">
        <p>{phaseText(sky.phase)}</p>
        <p>Moon in {sky.moon.sign}</p>
        {(sky.moon.changes ?? []).map(c => <p key={c.at}>Moon enters {c.sign} at {clockTime(c.at)}</p>)}
        <p>Ruled by {sky.ruler}</p>
        {festival && <p>{festival}</p>}
      </ParchmentCard>
      {showFolk && (
        <ParchmentCard title="Folk timing" subtitle="what tradition says about this day">
          {suggestions.length === 0 ? <p className="muted">No folk timing for this day.</p> : (
            <ul className="today-list">
              {suggestions.map(s => <li key={s.id}>{s.text} <span className="badge badge-brass">{FOLK_LABEL}</span></li>)}
            </ul>
          )}
          <p><Link to="/settings/timing-rules">Timing rules</Link></p>
        </ParchmentCard>
      )}
      {garden.length > 0 && (
        <ParchmentCard title="In the garden" subtitle="what tradition says about this day">
          <ul className="today-list">
            {garden.map(g => (
              <li key={g.task}>
                <strong>{taskLabel(g.task)}</strong>
                <ul>{g.reasons.map(r => <li key={r}>{r}</li>)}</ul>
              </li>
            ))}
          </ul>
          <p><span className="badge badge-brass">{FOLK_LABEL}</span></p>
        </ParchmentCard>
      )}
      <ParchmentCard title="On this day">
        {events.length === 0 ? <p className="muted">Nothing on this day.</p> : (
          <ul className="cal-events">
            {events.map(e => (
              <li key={`${e.kind}-${e.id}`} className={`cal-event cal-${e.kind}${e.done ? ' is-done' : ''}${e.overdue ? ' is-overdue' : ''}`}>
                {e.kind === 'task' && <TaskCheck task={{ id: e.id, title: e.title, done_on: e.done ? day : null }} actions={actions} />}
                {' '}<EventLink event={e} />
              </li>
            ))}
          </ul>
        )}
        <p className="page-actions">
          <Button as={Link} to={`/todo?due=${day}`}>Add a task for this day</Button>
          <Button as={Link} variant="secondary" to={`/batches/new?start=${day}`}>Start a batch on this day</Button>
          <Button as={Link} variant="secondary" to={`/garden/entries/new?date=${day}`}>Log garden work</Button>
        </p>
      </ParchmentCard>
      <ParchmentCard title="Journal entries">
        {entries.length === 0 ? <p className="muted">No journal entries for this day.</p> : (
          <ul className="cal-events">
            {entries.map(e => <li key={e.id} className="cal-event cal-journal"><EventLink event={e} /></li>)}
          </ul>
        )}
        <p className="page-actions">
          <Button as={Link} to={`/journal/new?date=${day}`}>Add a journal entry</Button>
        </p>
      </ParchmentCard>
      {back}
    </>
  );
}
