import { Link } from 'react-router-dom';
import { MoonGlyph } from '../../lib/moonGlyph.jsx';
import { badge, dayLabel, phaseText, weekdayShort } from '../../lib/calendar.js';
import { EventList } from './EventList.jsx';

export function WeekView({ days, eventsByDay, today }) {
  return (
    <div className="cal-week">
      {days.map(d => {
        const events = eventsByDay.get(d.day) ?? [];
        const text = badge(d);
        const id = `cal-week-${d.day}`;
        return (
          <section key={d.day} aria-labelledby={id} className={`cal-col${d.day === today ? ' is-today' : ''}`}>
            <h3 id={id}>
              <Link to={`/calendar/${d.day}`} aria-current={d.day === today ? 'date' : undefined}>
                <span className="visually-hidden">{dayLabel(d.day)}</span>
                <span aria-hidden="true">{weekdayShort(d.day)} {Number(d.day.slice(8))}</span>
              </Link>
            </h3>
            <p className="cal-sky"><MoonGlyph phase={d.phase} size={18} /> <span>{phaseText(d.phase)} in {d.sign}</span></p>
            {text && <p className="cal-badge">{text}</p>}
            {events.length ? <EventList events={events} /> : <p className="cal-none">Nothing due</p>}
          </section>
        );
      })}
    </div>
  );
}
