import { Link } from 'react-router-dom';
import { ParchmentCard } from '../../components/ParchmentCard.jsx';
import { Button } from '../../components/Button.jsx';
import { useApi } from '../../lib/useApi.js';
import { taskLabel } from '../../lib/garden.js';
import { phaseText } from '../../lib/calendar.js';

// "Fri Oct 17", read as a local date so it never slips a day.
function chipDay(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const wd = date.toLocaleDateString('en-US', { weekday: 'short' });
  const md = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${wd} ${md}`;
}

export function MoonGarden() {
  const sug = useApi('/api/garden/suggestions');
  let body;
  if (sug.error) body = <><p role="alert">{sug.error.message}</p><Button onClick={sug.reload}>Try again</Button></>;
  else if (!sug.data) body = <p>Reading the sky…</p>;
  else if (sug.data.off) body = <p className="muted">Moon suggestions are turned off in <Link to="/settings">Settings</Link>.</p>;
  else if (sug.data.tasks.length === 0) body = <p className="muted">No special days stand out in the next four weeks.</p>;
  else {
    body = (
      <>
        <p className="muted">Folk tradition, for interest. Your soil and weather know best.</p>
        <ul className="moon-garden">
          {sug.data.tasks.map(t => (
            <li key={t.task}>
              <h3>{taskLabel(t.task)}</h3>
              <ul className="chip-row">
                {[...t.days].sort((a, b) => a.day.localeCompare(b.day)).map(d => (
                  <li key={d.day}>
                    <Link className="chip" to={`/calendar/${d.day}`} title={d.reasons.join(' ')}>
                      {chipDay(d.day)}, {phaseText(d.sky.phase)} in {d.sky.sign}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </>
    );
  }
  return <ParchmentCard title="By the moon, the next four weeks" className="moon-garden-card">{body}</ParchmentCard>;
}
