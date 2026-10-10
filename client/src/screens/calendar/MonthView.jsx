import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MoonGlyph } from '../../lib/moonGlyph.jsx';
import { addDaysTo, WEEKDAYS } from '../../lib/tasks.js';
import { MAX_SHOWN, badge, cellName } from '../../lib/calendar.js';
import { EventList } from './EventList.jsx';

const MOVES = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };

export function MonthView({ days, eventsByDay, month, today, startDay, onLeave, pendingFocus }) {
  const table = useRef(null);
  const [focusDay, setFocusDay] = useState(null);
  const inGrid = new Set(days.filter(d => !d.blank).map(d => d.day));
  const roving = focusDay && inGrid.has(focusDay) ? focusDay : inGrid.has(startDay) ? startDay : days.find(d => !d.blank).day;
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  // After moving to another month, focus the day she was heading for once its grid is on screen.
  useEffect(() => {
    const day = pendingFocus?.current;
    if (!day || !inGrid.has(day)) return;
    pendingFocus.current = null;
    setFocusDay(day);
    table.current?.querySelector(`a[data-day="${day}"]`)?.focus();
  }, [days]); // eslint-disable-line react-hooks/exhaustive-deps

  const onKeyDown = (e, day) => {
    const move = MOVES[e.key];
    if (!move || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    e.preventDefault();
    const next = addDaysTo(day, move);
    if (!inGrid.has(next)) { onLeave?.(next); return; }
    setFocusDay(next);
    table.current?.querySelector(`a[data-day="${next}"]`)?.focus();
  };

  return (
    <table className="cal-month" ref={table}>
      <caption className="visually-hidden">Days of the month with the moon and what is due</caption>
      <thead>
        <tr>{WEEKDAYS.map(w => <th key={w} scope="col" abbr={w}>{w.slice(0, 3)}</th>)}</tr>
      </thead>
      <tbody>
        {weeks.map(week => (
          <tr key={week[0].day}>
            {week.map(d => {
              if (d.blank) return <td key={d.day} className="cal-cell is-outside is-blank" aria-hidden="true" />;
              const events = eventsByDay.get(d.day) ?? [];
              const outside = d.day.slice(0, 7) !== month;
              const text = badge(d);
              return (
                <td key={d.day} className={`cal-cell${outside ? ' is-outside' : ''}${d.day === today ? ' is-today' : ''}`}>
                  <Link
                    to={`/calendar/${d.day}`} data-day={d.day} className="cal-day" aria-label={cellName(d, events)}
                    aria-current={d.day === today ? 'date' : undefined}
                    tabIndex={d.day === roving ? 0 : -1} onKeyDown={e => onKeyDown(e, d.day)} onFocus={() => setFocusDay(d.day)}
                  >
                    <span className="cal-num" aria-hidden="true">{Number(d.day.slice(8))}</span>
                    <MoonGlyph phase={d.phase} size={18} />
                    <span className="cal-sign" aria-hidden="true">{d.sign}</span>
                    {text && <span className="cal-badge" aria-hidden="true">{text}</span>}
                  </Link>
                  {events.length > 0 && <EventList events={events} limit={MAX_SHOWN} dayTo={`/calendar/${d.day}`} />}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
