import { useApi } from '../../lib/useApi.js';
import { todayString } from '../../lib/today.js';
import { FOLK_LABEL, suggestionLabel } from '../../lib/sky.js';

// Up to five days the timing rules like for this recipe. Choosing one hands the day to the start date,
// which plans the batch again the same way a typed date does. Shows nothing when suggestions are off or none fit.
export function StartDates({ recipeId, current, onPick }) {
  const { data } = useApi(`/api/recipes/${recipeId}/start-dates?from=${todayString()}`);
  if (!Array.isArray(data) || data.length === 0) return null;
  return (
    <div role="group" aria-label="Good days to start" className="start-dates">
      <h3>Good days to start <span className="badge badge-brass">{FOLK_LABEL}</span></h3>
      <ul className="today-list">
        {data.map(s => {
          const ids = s.reasons.map((_, i) => `start-day-${recipeId}-${s.day}-${i}`);
          return (
            <li key={s.day}>
              <button type="button" className="btn btn-secondary btn-sm" aria-pressed={current === s.day}
                aria-describedby={ids.length ? ids.join(' ') : undefined} onClick={() => onPick(s.day)}>
                {suggestionLabel(s)}
              </button>
              {s.reasons.map((r, i) => <p key={i} id={ids[i]} className="muted">{r}</p>)}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
