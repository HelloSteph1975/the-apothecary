import { Link } from 'react-router-dom';
import { Sprout, ShoppingBasket } from 'lucide-react';

// Garden and harvest events carry a small icon of their own; the title says the rest.
const ICONS = { garden: Sprout, harvest: ShoppingBasket };

// One line per event. Done and overdue are said in words as well as shown.
export function EventLink({ event }) {
  const Icon = ICONS[event.kind];
  return (
    <>
      {Icon && <><Icon size={14} aria-hidden="true" className="cal-event-icon" />{' '}</>}
      <Link to={event.link} className="cal-event-link">{event.title}</Link>
      {event.done && <span className="visually-hidden"> (done)</span>}
      {event.overdue && <span className="cal-overdue"> Overdue</span>}
    </>
  );
}

export function EventList({ events, limit, dayTo }) {
  const shown = limit ? events.slice(0, limit) : events;
  const more = events.length - shown.length;
  return (
    <ul className="cal-events">
      {shown.map(e => (
        <li key={`${e.kind}-${e.id}`} className={`cal-event cal-${e.kind}${e.done ? ' is-done' : ''}${e.overdue ? ' is-overdue' : ''}`}>
          <EventLink event={e} />
        </li>
      ))}
      {more > 0 && <li className="cal-more"><Link to={dayTo}>+{more} more</Link></li>}
    </ul>
  );
}
