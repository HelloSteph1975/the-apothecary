import { Fragment, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader.jsx';
import { ParchmentCard } from '../../components/ParchmentCard.jsx';
import { PhotoGallery } from '../../components/PhotoGallery.jsx';
import { Button } from '../../components/Button.jsx';
import { Dialog } from '../../components/Dialog.jsx';
import { Field, DateInput } from '../../components/Field.jsx';
import { WaxSealLink } from '../../components/WaxSeal.jsx';
import { useDeleteWithUndo } from '../../components/useDeleteWithUndo.jsx';
import { useToast } from '../../components/ToastProvider.jsx';
import { api } from '../../lib/api.js';
import { useApi } from '../../lib/useApi.js';
import { todayString } from '../../lib/today.js';
import { formatAmount, formatShortDay } from '../../lib/cabinet.js';
import { phaseText } from '../../lib/calendar.js';
import { KIND_ICON, kindLabel, harvestTaskFor, taskLabel } from '../../lib/garden.js';

const MAX_DAYS = 5;

// "Fri Oct 17", read as a local date so it never slips a day.
function chipDay(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${date.toLocaleDateString('en-US', { weekday: 'short' })} ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

// Stays mounted and toggles `open`, like the other dialogs. Reopening starts from today.
function EndedDialog({ plant, open, onClose, onSaved }) {
  const [day, setDay] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  useEffect(() => {
    if (!open) return;
    setDay(todayString());
    setError('');
  }, [open]);

  async function save(e) {
    e.preventDefault();
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      await api.patch(`/api/garden/plants/${plant.id}`, { ended_on: day || null });
      onSaved();
    } catch (ex) {
      setError(ex.details?.ended_on ?? ex.message);
    } finally { savingRef.current = false; setSaving(false); }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Mark as ended"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="plant-ended-form" disabled={saving}>Mark as ended</Button></>}>
      <form id="plant-ended-form" onSubmit={save} noValidate>
        {error && <p role="alert" className="field-error">{error}</p>}
        <Field label="Ended on" hint="The day it died back, came out or was finished.">
          <DateInput data-autofocus value={day} onChange={e => setDay(e.target.value)} />
        </Field>
      </form>
    </Dialog>
  );
}

export function PlantPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const del = useDeleteWithUndo();
  const { data: plant, error, reload } = useApi(`/api/garden/plants/${id}`);
  const sug = useApi('/api/garden/suggestions');
  const [endOpen, setEndOpen] = useState(false);

  if (error) {
    return (
      <>
        <PageHeader title="Garden log" />
        <p role="alert">{error.message}</p>
        <Button onClick={reload}>Try again</Button>
        <p><Link to="/garden">Back to the garden</Link></p>
      </>
    );
  }
  if (!plant) return <><PageHeader title="Garden log" /><p role="status">Opening the plant…</p></>;

  async function growAgain() {
    try {
      await api.patch(`/api/garden/plants/${plant.id}`, { ended_on: null });
      toast.show({ message: 'Growing again' });
      reload();
    } catch (ex) {
      toast.show({ message: ex.message, duration: 6000 });
    }
  }

  const notes = plant.garden_notes;
  const noteRows = notes ? [
    ['Part harvested', notes.garden_harvest_part], ['Harvest timing', notes.garden_harvest_timing],
    ['Sun', notes.garden_sun], ['Water', notes.garden_water], ['Grows well with', (notes.garden_companions ?? []).join(', ')],
  ].filter(([, v]) => v) : [];
  const task = harvestTaskFor(notes?.garden_harvest_part);
  const days = sug.data?.tasks?.find(t => t.task === task)?.days?.slice(0, MAX_DAYS) ?? [];
  const showDays = sug.data && !sug.data.off && !plant.ended_on;
  const subtitle = [plant.place, plant.planted_on && `Planted ${formatShortDay(plant.planted_on)}`].filter(Boolean).join(', ');
  const liveHerb = plant.herb?.live ? plant.herb : null;

  return (
    <>
      <PageHeader title={plant.name} subtitle={subtitle}
        actions={(
          <>
            <Button as={Link} variant="secondary" to={`/garden/plants/${plant.id}/edit`}>Edit</Button>
            {plant.ended_on
              ? <Button variant="secondary" onClick={growAgain}>Growing again</Button>
              : <Button variant="secondary" onClick={() => setEndOpen(true)}>Mark as ended</Button>}
            <Button variant="danger" onClick={async () => {
              if (await del({ url: `/api/garden/plants/${plant.id}`, label: plant.name, onUndo: () => navigate(`/garden/plants/${plant.id}`) })) navigate('/garden');
            }}>Delete</Button>
          </>
        )} />
      {liveHerb && <p>In the grimoire: <Link to={`/grimoire/${liveHerb.id}`}>{liveHerb.name}</Link></p>}
      {plant.ended_on && <p><span className="badge badge-brass">Ended {formatShortDay(plant.ended_on)}</span></p>}
      {plant.expected_harvest_on && !plant.ended_on && <p>Harvest around {formatShortDay(plant.expected_harvest_on)}</p>}
      <div className="card-grid">
        <ParchmentCard title="In the garden">
          {noteRows.length > 0 ? (
            <dl className="dl-grid">
              {noteRows.map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>)}
            </dl>
          ) : <p className="muted">No grimoire notes for this plant.</p>}
        </ParchmentCard>

        {showDays && (
          <ParchmentCard title="Good days to harvest">
            <p className="muted">Folk tradition, for interest: {taskLabel(task).toLowerCase()}.</p>
            {days.length > 0 ? (
              <ul className="chip-row">
                {days.map(d => (
                  <li key={d.day}>
                    <Link className="chip" to={`/calendar/${d.day}`} title={d.reasons.join(' ')}>
                      {chipDay(d.day)}, {phaseText(d.sky.phase)} in {d.sky.sign}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <p className="muted">No special days stand out in the next four weeks.</p>}
          </ParchmentCard>
        )}

        {plant.notes && <ParchmentCard title="Notes"><p style={{ whiteSpace: 'pre-wrap' }}>{plant.notes}</p></ParchmentCard>}

        <ParchmentCard title="Garden log" className="panel-wide">
          {plant.entries.length > 0 ? (
            <ul className="plant-log">
              {plant.entries.map(e => {
                const Icon = KIND_ICON[e.kind];
                return (
                  <li key={e.id}>
                    <span>{formatShortDay(e.entry_date)}</span>{' '}
                    {Icon && <Icon size={16} aria-hidden="true" />}{' '}
                    <Link to={`/garden/entries/${e.id}`}>{kindLabel(e.kind)}</Link>
                    {e.amount != null && <span> {formatAmount(e.amount, e.unit)}</span>}
                  </li>
                );
              })}
            </ul>
          ) : <p className="muted">Nothing logged for this plant yet.</p>}
          <p><WaxSealLink to={`/garden/entries/new?plant=${plant.id}`}>Log something</WaxSealLink></p>
        </ParchmentCard>

        <ParchmentCard title="Photos">
          <PhotoGallery ownerType="garden_plant" ownerId={plant.id} photos={plant.photos ?? []} onChange={reload} />
        </ParchmentCard>
      </div>
      <EndedDialog plant={plant} open={endOpen} onClose={() => setEndOpen(false)}
        onSaved={() => { setEndOpen(false); toast.show({ message: 'Saved' }); reload(); }} />
    </>
  );
}
