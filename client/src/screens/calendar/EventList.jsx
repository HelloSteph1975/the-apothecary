import { Link } from 'react-router-dom';

// One line per event. Done and overdue are said in words as well as shown.
export function EventLink({ event }) {
  return (
    <>
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
