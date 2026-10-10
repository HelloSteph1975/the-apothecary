import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '../../components/Button.jsx';
import { api } from '../../lib/api.js';
import { dayLine } from '../../lib/sky.js';
import { formatAmount, formatDay } from '../../lib/cabinet.js';

// Blank ruled lines so she can write the answer by hand.
function WritingLines({ count = 2 }) {
  return (
    <div className="writing-lines" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => <span key={i} />)}
    </div>
  );
}

function Field({ label, children, lines = 2 }) {
  return (
    <section className="sheet-field">
      <h2>{label}</h2>
      {children ?? <WritingLines count={lines} />}
    </section>
  );
}

// The recipe amount, plus what came out of the jar when that is a different amount or unit.
function herbText(l) {
  const drawn = l.drawn_amount == null ? null : formatAmount(l.drawn_amount, l.drawn_unit);
  const asked = l.amount == null ? null : formatAmount(l.amount, l.unit);
  const shown = asked ?? drawn;
  const differs = asked != null && drawn != null && (l.drawn_amount !== l.amount || l.drawn_unit !== l.unit);
  const from = differs ? ` (${drawn} drawn from ${l.item?.name ?? 'a jar'})` : '';
  return `${shown ? `${shown} ` : ''}${l.name}${from}`;
}

const text = v => (v && String(v).trim() ? <p className="pre-line">{v}</p> : null);

export function RecordSheet() {
  const { id } = useParams();
  const [batch, setBatch] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    api.get(`/api/batches/${id}`).then(
      data => { if (live) { setBatch(data); setLoadError(null); } },
      err => { if (live) { setLoadError(err); setBatch(null); } },
    );
    return () => { live = false; };
  }, [id, tick]);

  if (loadError) {
    return (
      <>
        <p role="alert">{loadError.message}</p>
        <Button onClick={() => { setLoadError(null); setTick(t => t + 1); }}>Try again</Button>
      </>
    );
  }
  if (!batch) return <p>Opening the record sheet…</p>;

  const sky = batch.sky ? ` (${dayLine(batch.start_date, batch.sky)})` : '';
  const dates = batch.finished_on
    ? `Started ${formatDay(batch.start_date)}${sky}, finished ${formatDay(batch.finished_on)}`
    : `Started ${formatDay(batch.start_date)}${sky}`;
  const lines = batch.lines ?? [];
  const labelNotes = [batch.label_notes, batch.expires_on ? `Use by ${formatDay(batch.expires_on)}` : null]
    .filter(v => v && String(v).trim()).join('\n');

  return (
    <>
      <div className="sheet-controls no-print">
        <Button onClick={() => window.print()}>Print</Button>
        <Button as={Link} variant="secondary" to={`/batches/${batch.id}`}>Back to the batch</Button>
      </div>
      <article className="record-sheet" data-testid="record-sheet">
        <div className="record-frame">
          <h1>{batch.name}</h1>
          <p className="record-kicker">Batch record</p>
          <Field label="Date"><p>{dates}</p></Field>
          <Field label="Recipe" lines={1}>{batch.recipe ? <p>{batch.recipe.name}</p> : null}</Field>
          <Field label="Preparation type" lines={1}>{batch.type ? <p>{batch.type.name}</p> : null}</Field>
          <Field label="Herbs used" lines={3}>
            {lines.length > 0 ? (
              <ul className="sheet-herbs">
                {lines.map(l => <li key={l.id}>{herbText(l)}</li>)}
              </ul>
            ) : null}
          </Field>
          <Field label="Base" lines={1}>{text(batch.base)}</Field>
          <Field label="Why I made it">{text(batch.intention)}</Field>
          <Field label="How I prepared it" lines={3}>{text(batch.method)}</Field>
          <Field label="What I noticed" lines={3}>{text(batch.noticed)}</Field>
          <Field label="What I would change">{text(batch.would_change)}</Field>
          <Field label="Label and shelf-life notes">{labelNotes ? <p className="pre-line">{labelNotes}</p> : null}</Field>
        </div>
      </article>
    </>
  );
}
