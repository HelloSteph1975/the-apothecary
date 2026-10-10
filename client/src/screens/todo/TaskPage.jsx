import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader.jsx';
import { ParchmentCard } from '../../components/ParchmentCard.jsx';
import { PhotoGallery } from '../../components/PhotoGallery.jsx';
import { Button } from '../../components/Button.jsx';
import { useApi } from '../../lib/useApi.js';
import { todayString } from '../../lib/today.js';
import { formatDay } from '../../lib/cabinet.js';
import { priorityText, repeatText } from '../../lib/tasks.js';
import { RelatedLink, useTaskActions } from './Todo.jsx';
import { TaskForm } from './TaskForm.jsx';

export function TaskPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: task, error, reload } = useApi(`/api/tasks/${id}?today=${todayString()}`);
  const actions = useTaskActions({ onChange: () => reload() });
  const [form, setForm] = useState({ key: 0, open: false });

  if (error) {
    return (
      <>
        <PageHeader title="To-do" />
        <p role="alert">{error.message}</p>
        <Button onClick={reload}>Try again</Button>
      </>
    );
  }
  if (!task) return <><PageHeader title="To-do" /><p>Opening the task…</p></>;

  const auto = task.kind === 'auto';
  const repeat = repeatText(task);
  const status = task.done_on ? `Done ${formatDay(task.done_on)}` : task.overdue ? 'Overdue' : 'Open';
  return (
    <>
      <PageHeader title={task.title}
        subtitle={<>{status}{auto && <> <span className="badge badge-brass">Automatic</span></>}</>}
        actions={(
          <>
            {task.done_on
              ? <Button variant="secondary" onClick={() => actions.uncomplete(task)}>Undo done</Button>
              : <Button onClick={() => actions.complete(task)}>Done</Button>}
            <Button variant="secondary" onClick={() => setForm(f => ({ key: f.key + 1, open: true }))}>Edit</Button>
            {auto
              ? !task.done_on && <Button variant="danger" onClick={async () => { if (await actions.dismiss(task)) navigate('/todo'); }}>Dismiss</Button>
              : (
                <Button variant="danger" onClick={async () => {
                  if (await actions.remove(task, { onChange: undefined, onUndo: () => navigate(`/todo/${task.id}`) })) navigate('/todo');
                }}>Delete</Button>
              )}
          </>
        )} />
      <div className="card-grid">
        <ParchmentCard title="Details">
          <dl className="dl-grid">
            <dt>Due</dt><dd>{task.due_on ? formatDay(task.due_on) : 'No date'}</dd>
            {repeat && <><dt>Repeats</dt><dd>{repeat}</dd></>}
            <dt>Priority</dt><dd>{priorityText(task.priority)}</dd>
            {task.snoozed_until && <><dt>Snoozed until</dt><dd>{formatDay(task.snoozed_until)}</dd></>}
            {task.related && <><dt>About</dt><dd><RelatedLink related={task.related} /></dd></>}
            {task.notes && <><dt>Notes</dt><dd className="pre-line">{task.notes}</dd></>}
          </dl>
        </ParchmentCard>
        <ParchmentCard title="Photos">
          <PhotoGallery ownerType="task" ownerId={task.id} photos={task.photos ?? []} onChange={reload} />
        </ParchmentCard>
      </div>
      <TaskForm key={form.key} task={task} open={form.open} onClose={() => setForm(f => ({ ...f, open: false }))} onSaved={() => reload()} />
    </>
  );
}
