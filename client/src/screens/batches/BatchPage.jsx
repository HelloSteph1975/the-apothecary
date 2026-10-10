import { Fragment, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader.jsx';
import { ParchmentCard } from '../../components/ParchmentCard.jsx';
import { PhotoGallery } from '../../components/PhotoGallery.jsx';
import { Button } from '../../components/Button.jsx';
import { WaxSeal } from '../../components/WaxSeal.jsx';
import { Field, TextInput, TextArea } from '../../components/Field.jsx';
import { useToast } from '../../components/ToastProvider.jsx';
import { useDeleteWithUndo } from '../../components/useDeleteWithUndo.jsx';
import { api } from '../../lib/api.js';
import { formatAmount, formatDay } from '../../lib/cabinet.js';
import { useLeaveGuard } from '../../lib/useLeaveGuard.js';
import { StepsEditor } from './StepsEditor.jsx';
import { FinishDialog } from './FinishDialog.jsx';

// [field, label shown in the journal, whether it is one line or a longer note]
const JOURNAL = [
  ['intention', 'Why I made it', 'text'],
  ['method', 'How I prepared it', 'long'],
  ['base', 'Base', 'line'],
  ['noticed', 'What I noticed', 'long'],
  ['would_change', 'What I would change', 'long'],
  ['label_notes', 'Label and shelf-life notes', 'long'],
  ['notes', 'Notes', 'long'],
];
const s = v => (v == null ? '' : String(v));
const orNull = v => (v.trim() === '' ? null : v.trim());
const fromBatch = b => Object.fromEntries(JOURNAL.map(([k]) => [k, s(b[k])]));

const STATUS = {
  steeping: () => 'Steeping',
  ready: () => 'Ready to finish',
  finished: b => `Finished ${formatDay(b.finished_on)}`,
};

function Journal({ batch, editing, form, setForm, errors, saving, onSave, onCancel }) {
  if (!editing) {
    const rows = JOURNAL.filter(([k]) => batch[k]);
    return rows.length === 0 ? <p className="muted">Nothing written yet. Use Edit to add your notes.</p> : (
      <dl className="dl-grid">
        {rows.map(([k, label]) => <Fragment key={k}><dt>{label}</dt><dd className="pre-line">{batch[k]}</dd></Fragment>)}
      </dl>
    );
  }
  return (
    <form onSubmit={onSave} noValidate>
      {errors.form && <p role="alert" className="field-error">{errors.form}</p>}
      {JOURNAL.map(([k, label, kind]) => (
        <Field key={k} label={label} error={errors[k]}>
          {kind === 'line'
            ? <TextInput value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
            : <TextArea rows={kind === 'long' ? 4 : 2} value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />}
        </Field>
      ))}
      <div className="step-form-actions">
        <Button type="submit" disabled={saving}>Save</Button>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

function Lines({ lines }) {
  if (lines.length === 0) return <p className="muted">Nothing was recorded.</p>;
  return (
    <ul>
      {lines.map(l => {
        const amount = l.amount == null ? '' : formatAmount(l.amount, l.unit);
        const drawn = l.drawn_amount == null ? '' : ` (${formatAmount(l.drawn_amount, l.drawn_unit)})`;
        return (
          <li key={l.id}>
            {amount && <span>{amount} </span>}
            {l.herb_id != null && l.herb_live ? <Link to={`/grimoire/${l.herb_id}`}>{l.name}</Link> : <span>{l.name}</span>}
            {l.item ? (
              <span>, from {l.item.live ? <Link to={`/cabinet/items/${l.item.id}`}>{l.item.name}</Link> : <span>{l.item.name} <span className="muted">(removed)</span></span>}{drawn}</span>
            ) : <span className="muted">, not drawn from a jar</span>}
          </li>
        );
      })}
    </ul>
  );
}

export function BatchPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const del = useDeleteWithUndo();
  const [batch, setBatch] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [tick, setTick] = useState(0);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);

  useEffect(() => {
    let live = true;
    api.get(`/api/batches/${id}`).then(
      data => { if (live) { setBatch(data); setLoadError(null); } },
      err => { if (live) { setLoadError(err); setBatch(null); } },
    );
    return () => { live = false; };
  }, [id, tick]);

  const reload = () => setTick(t => t + 1);
  const dirty = Boolean(editing && batch && JOURNAL.some(([k]) => form[k] !== s(batch[k])));
  useLeaveGuard(dirty);

  if (loadError) {
    return (
      <>
        <PageHeader title="Batch journal" />
        <p role="alert">{loadError.message}</p>
        <Button onClick={() => { setLoadError(null); reload(); }}>Try again</Button>
      </>
    );
  }
  if (!batch) return <><PageHeader title="Batch journal" /><p>Opening the batch…</p></>;

  const finished = Boolean(batch.finished_on);
  const recipeText = batch.recipe ? `${batch.recipe.name}${batch.type ? ` (${batch.type.name})` : ''}` : batch.type?.name ?? '';
  const startedText = `${recipeText ? `${recipeText}, started` : 'Started'} ${formatDay(batch.start_date)}`;

  const startEdit = () => { setForm(fromBatch(batch)); setErrors({}); setEditing(true); };
  async function saveJournal(e) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const body = Object.fromEntries(JOURNAL.map(([k]) => [k, orNull(form[k])]));
      setBatch(await api.patch(`/api/batches/${batch.id}`, body));
      setEditing(false);
    } catch (ex) {
      setErrors(ex.details && Object.keys(ex.details).length ? ex.details : { form: ex.message });
    } finally { setSaving(false); }
  }
  async function unfinish() {
    try {
      const hadJar = Boolean(batch.made_item);
      setBatch(await api.post(`/api/batches/${batch.id}/unfinish`));
      toast.show({ message: hadJar ? 'Finishing undone. The jar you added stays in your cabinet.' : 'Finishing undone.', duration: 6000 });
    } catch (err) { toast.show({ message: err.message, duration: 6000 }); }
  }
  const onFinished = detail => {
    setBatch(detail);
    setFinishOpen(false);
    toast.show({ message: `Finished ${detail.name}` });
  };

  return (
    <>
      <PageHeader title={batch.name}
        subtitle={<>{startedText} <span className={`badge ${finished ? 'badge-brass' : 'badge-oxblood'}`}>{STATUS[batch.status]?.(batch) ?? ''}</span></>}
        actions={(
          <>
            {!finished && <WaxSeal onClick={() => setFinishOpen(true)}>Finish this batch</WaxSeal>}
            <Button as={Link} variant="secondary" to={`/batches/${batch.id}/sheet`}>Print record sheet</Button>
            <Button variant="secondary" onClick={startEdit} disabled={editing}>Edit</Button>
            <Button variant="danger" onClick={async () => {
              if (await del({
                url: `/api/batches/${batch.id}`, label: batch.name, body: 'Delete this batch? The amounts drawn from your jars stay drawn.',
                onUndo: () => navigate(`/batches/${batch.id}`),
              })) navigate('/batches');
            }}>Delete</Button>
          </>
        )} />
      <div className="card-grid">
        <ParchmentCard title="Steps">
          <StepsEditor batchId={batch.id} steps={batch.steps} onChange={reload} />
        </ParchmentCard>

        <ParchmentCard title="What went in">
          <Lines lines={batch.lines} />
        </ParchmentCard>

        <ParchmentCard title="Journal" className="panel-wide">
          <Journal batch={batch} editing={editing} form={form} setForm={setForm} errors={errors} saving={saving}
            onSave={saveJournal} onCancel={() => { setEditing(false); setErrors({}); }} />
        </ParchmentCard>

        {finished && (
          <ParchmentCard title="Finished">
            <dl className="dl-grid">
              <dt>Finished on</dt><dd>{formatDay(batch.finished_on)}</dd>
              {batch.yield_amount != null && <><dt>Yield</dt><dd>{formatAmount(batch.yield_amount, batch.yield_unit)}</dd></>}
              {batch.expires_on && <><dt>Use by</dt><dd>{formatDay(batch.expires_on)}</dd></>}
              {batch.made_item && <><dt>Jar</dt><dd><Link to={`/cabinet/items/${batch.made_item.id}`}>{batch.made_item.name}</Link></dd></>}
            </dl>
            <Button variant="secondary" onClick={unfinish}>Undo finishing</Button>
          </ParchmentCard>
        )}

        <ParchmentCard title="Photos">
          <PhotoGallery ownerType="batch" ownerId={batch.id} photos={batch.photos ?? []} onChange={reload} />
        </ParchmentCard>
      </div>
      {!finished && <FinishDialog batch={batch} open={finishOpen} onClose={() => setFinishOpen(false)} onFinished={onFinished} />}
    </>
  );
}
