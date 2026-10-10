import { Link } from 'react-router-dom';
import { MoonGlyph } from '../../lib/moonGlyph.jsx';
import { badge, dayLabel } from '../../lib/calendar.js';
import { EventList } from './EventList.jsx';

export function AgendaView({ days, eventsByDay }) {
  const busy = days.filter(d => (eventsByDay.get(d.day) ?? []).length || badge(d));
  if (!busy.length) return <p>Nothing planned in these 30 days.</p>;
  return (
    <div className="cal-agenda">
      {busy.map(d => {
        const events = eventsByDay.get(d.day) ?? [];
        const text = badge(d);
        return (
          <section key={d.day} className="cal-agenda-day">
            <h3>
              <Link to={`/calendar/${d.day}`}>{dayLabel(d.day)}</Link>
              <MoonGlyph phase={d.phase} size={18} />
            </h3>
            {text && <p className="cal-badge">{text}</p>}
            {events.length > 0 && <EventList events={events} />}
          </section>
        );
      })}
    </div>
  );
}
