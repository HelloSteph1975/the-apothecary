import { useEffect, useState } from 'react';

// The done checkbox for a task shown outside the to-do list. It stays busy until the refreshed task arrives,
// so a second click cannot repeat the change. `actions` comes from useTaskActions.
export function TaskCheck({ task, actions }) {
  const [busy, setBusy] = useState(false);
  useEffect(() => { setBusy(false); }, [task]);
  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    const res = await (task.done_on ? actions.uncomplete(task) : actions.complete(task));
    if (!res) setBusy(false);
  };
  return <input type="checkbox" className="task-check" aria-label={`Done: ${task.title}`} checked={Boolean(task.done_on)} aria-disabled={busy || undefined} onChange={toggle} />;
}
