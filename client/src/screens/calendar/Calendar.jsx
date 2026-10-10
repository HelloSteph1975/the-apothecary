import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader.jsx';
import { ParchmentCard } from '../../components/ParchmentCard.jsx';
import { Button } from '../../components/Button.jsx';
import { Checkbox } from '../../components/Field.jsx';
import { useApi } from '../../lib/useApi.js';
import { todayString } from '../../lib/today.js';
import {
  KINDS, VIEWS, byDay, isDay, monthDayLabel, monthLabel, monthStart, rangeFor, step, weekStart,
} from '../../lib/calendar.js';
import { MonthView } from './MonthView.jsx';
import { WeekView } from './WeekView.jsx';
import { AgendaView } from './AgendaView.jsx';

const LABELS = { month: 'Month', week: 'Week', agenda: 'Agenda' };

export function Calendar() {
  const [params, setParams] = useSearchParams();
  const today = todayString();
  const view = VIEWS.includes(params.get('view')) ? params.get('view') : 'month';
  const date = isDay(params.get('date')) ? params.get('date') : today;
  const hidden = useMemo(() => new Set((params.get('hide') ?? '').split(',').filter(k => KINDS.some(x => x.kind === k))), [params]);
  const { from, to } = rangeFor(view, date);
  const { data, error, loading, reload } = useApi(`/api/calendar?from=${from}&to=${to}`);

  const update = changes => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v == null || v === '') next.delete(k);
      else next.set(k, v);
    }
    setParams(next, { replace: true });
  };
  const toggle = kind => {
    const next = new Set(hidden);
    if (next.has(kind)) next.delete(kind); else next.add(kind);
    update({ hide: KINDS.map(k => k.kind).filter(k => next.has(k)).join(',') });
  };

  const visible = data ? data.events.filter(e => !hidden.has(e.kind)) : [];
  const eventsByDay = byDay(visible);
  let title;
  if (view === 'month') title = monthLabel(date);
  else if (view === 'week') title = `Week of ${monthDayLabel(weekStart(date))}`;
  else title = `Next 30 days from ${monthDayLabel(date)}`;

  let body = <p role="status">Opening the calendar...</p>;
  if (error) body = <><p role="alert">{error.message}</p><Button onClick={reload}>Try again</Button></>;
  else if (data && !loading) {
    const sky = data.days;
    if (view === 'month') body = <MonthView days={sky} eventsByDay={eventsByDay} month={monthStart(date).slice(0, 7)} today={today} startDay={date} />;
    else if (view === 'week') body = <WeekView days={sky} eventsByDay={eventsByDay} today={today} />;
    else body = <AgendaView days={sky} eventsByDay={eventsByDay} />;
  }

  return (
    <>
      <PageHeader title="Calendar" subtitle="The moon, the wheel, and what's due" />
      <ParchmentCard>
        <div className="cal-controls">
          <div className="cal-switch" role="group" aria-label="View">
            {VIEWS.map(v => (
              <Button key={v} variant={v === view ? 'primary' : 'secondary'} size="sm" aria-pressed={v === view} onClick={() => update({ view: v })}>{LABELS[v]}</Button>
            ))}
          </div>
          <div className="cal-nav" role="group" aria-label="Move">
            <Button variant="secondary" size="sm" onClick={() => update({ date: step(view, date, -1) })}>Previous</Button>
            <Button variant="secondary" size="sm" onClick={() => update({ date: null })}>Today</Button>
            <Button variant="secondary" size="sm" onClick={() => update({ date: step(view, date, 1) })}>Next</Button>
          </div>
        </div>
        <fieldset className="cal-filters">
          <legend className="visually-hidden">Show on the calendar</legend>
          {KINDS.map(k => <Checkbox key={k.kind} label={k.label} checked={!hidden.has(k.kind)} onChange={() => toggle(k.kind)} />)}
        </fieldset>
        <h2 className="cal-title" aria-live="polite">{title}</h2>
        {body}
      </ParchmentCard>
    </>
  );
}
