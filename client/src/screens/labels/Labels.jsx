import { useCallback, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader.jsx';
import { ParchmentCard } from '../../components/ParchmentCard.jsx';
import { Field, TextInput, NumberInput, TextArea, Select } from '../../components/Field.jsx';
import { Button } from '../../components/Button.jsx';
import { useToast } from '../../components/ToastProvider.jsx';
import { api } from '../../lib/api.js';
import { useApi } from '../../lib/useApi.js';
import { useLeaveGuard } from '../../lib/useLeaveGuard.js';
import { todayString } from '../../lib/today.js';
import { formatDay } from '../../lib/cabinet.js';
import { startSlot } from '../../lib/labels.js';
import { LabelSheet } from './LabelSheet.jsx';

const MAX_PICKED = 60;
const MAX_PRINTED = 500;
const DEFAULT_SIZE = 'medium-rect';

const ids = raw => [...new Set((raw || '').split(',').filter(p => /^\d+$/.test(p.trim()) && Number(p) > 0).map(Number))];
const keyOf = source => `${source.kind}:${source.id}`;
const copiesOf = text => {
  const n = Number(text);
  return Number.isInteger(n) && n >= 1 && n <= 99 ? n : 1;
};
const kb = bytes => `${Math.max(1, Math.round(bytes / 1024))} KB`;
const savedDay = iso => {
  const d = new Date(iso);
  return formatDay(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
};

function PickBox({ checked, disabled, onChange, children }) {
  return (
    <label className="checkbox label-pick">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={onChange} /> {children}
    </label>
  );
}

function LabelSetup({ label, index, errors, onEdit, onReset }) {
  const err = f => errors[`labels.${index}.${f}`];
  return (
    <div className="label-setup" role="group" aria-label={`Settings for ${label.base.name}`}>
      <div className="label-setup-head">
        <h3>{label.base.name}</h3>
        <Button variant="secondary" size="sm" onClick={onReset}>Reset</Button>
      </div>
      <div className="label-setup-grid">
        <Field label="Name" error={err('name')}><TextInput maxLength={300} value={label.name} onChange={e => onEdit({ name: e.target.value })} /></Field>
        <Field label="Latin name" error={err('latin_name')}><TextInput maxLength={300} value={label.latin_name} onChange={e => onEdit({ latin_name: e.target.value })} /></Field>
        <Field label="Ingredients" error={err('ingredients')}><TextArea rows={2} maxLength={2000} value={label.ingredients} onChange={e => onEdit({ ingredients: e.target.value })} /></Field>
        <Field label="Caution" error={err('caution')}><TextArea rows={2} maxLength={2000} value={label.caution} onChange={e => onEdit({ caution: e.target.value })} /></Field>
        <Field label="Copies" error={err('copies')}>
          <NumberInput min={1} max={99} step={1} value={label.copiesText} onChange={e => onEdit({ copies: e.target.value })} />
        </Field>
        <label className="checkbox">
          <input type="checkbox" checked={label.show_moon} onChange={e => onEdit({ show_moon: e.target.checked })} /> Show the moon
        </label>
      </div>
    </div>
  );
}

export function Labels() {
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const itemIds = useMemo(() => ids(params.get('items')), [params]);
  const batchIds = useMemo(() => ids(params.get('batches')), [params]);
  const picked = itemIds.length + batchIds.length;

  const sizes = useApi('/api/labels/sizes');
  const files = useApi('/api/labels/files', { keepPrevious: true });
  const jars = useApi(`/api/items?today=${todayString()}`);
  const batches = useApi('/api/batches');
  const dataQuery = new URLSearchParams();
  if (itemIds.length) dataQuery.set('items', itemIds.join(','));
  if (batchIds.length) dataQuery.set('batches', batchIds.join(','));
  const data = useApi(picked ? `/api/labels/data?${dataQuery.toString().replaceAll('%2C', ',')}` : null, { keepPrevious: true });

  const [jarFilter, setJarFilter] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const [edits, setEdits] = useState({});
  const [start, setStart] = useState('1');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [saveError, setSaveError] = useState(null);

  const sizeKey = params.get('size');
  const size = sizes.data ? (sizes.data.find(s => s.key === sizeKey) ?? sizes.data.find(s => s.key === DEFAULT_SIZE) ?? sizes.data[0]) : null;

  const startNum = size ? startSlot(size, start) + 1 : 1;
  const startClamped = size && String(startNum) !== String(start).trim();

  // With keepPrevious the old reply lingers while the new one loads, so only labels that are still picked count.
  const labels = useMemo(() => (picked && data.data ? data.data : []).filter(d => (d.source.kind === 'item' ? itemIds : batchIds).includes(d.source.id)).map(d => {
    const e = edits[keyOf(d.source)] ?? {};
    const text = f => e[f] ?? d[f] ?? '';
    const copiesText = e.copies ?? '1';
    return {
      key: keyOf(d.source), base: d, name: text('name'), latin_name: text('latin_name'), ingredients: text('ingredients'),
      caution: text('caution'), made_on: d.made_on, expires_on: d.expires_on, phase: d.phase,
      copiesText, copies: copiesOf(copiesText), show_moon: e.show_moon ?? true,
    };
  }), [picked, data.data, edits, itemIds, batchIds]);

  const dirty = Object.keys(edits).length > 0;
  const printed = labels.reduce((n, l) => n + l.copies, 0);
  const tooMany = printed > MAX_PRINTED;
  const waiting = data.loading;
  const canUse = labels.length > 0 && !waiting && !tooMany;
  useLeaveGuard(dirty, { sameScreenFree: true });

  const setParam = useCallback((key, value) => {
    setParams(prev => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value); else next.delete(key);
      return next;
    }, { replace: true });
  }, [setParams]);
  const toggle = (param, current, id) => {
    const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
    // Edits belong to a label only while it is picked.
    if (current.includes(id)) reset(`${param === 'items' ? 'item' : 'batch'}:${id}`);
    setParam(param, next.join(','));
  };
  const edit = (key, patch) => setEdits(all => ({ ...all, [key]: { ...all[key], ...patch } }));
  const reset = key => setEdits(all => { const { [key]: _gone, ...rest } = all; return rest; });

  async function savePdf() {
    if (savingRef.current || !canUse) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await api.post('/api/labels/pdf', {
        size: size.key,
        start: startNum,
        labels: labels.map(l => ({
          name: l.name, latin_name: l.latin_name, made_on: l.made_on, expires_on: l.expires_on,
          ingredients: l.ingredients, caution: l.caution, show_moon: l.show_moon, copies: Number(l.copiesText),
        })),
      });
      toast.show({ message: `Saved ${res.file} in your labels folder.`, duration: 8000 });
      files.reload();
    } catch (err) {
      setSaveError(err);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const header = <PageHeader title="Labels" subtitle="Jars and batches, ready for the shelf" />;
  const loadError = sizes.error || data.error;
  if (loadError) {
    return (
      <>{header}
        <p role="alert">{loadError.message}</p>
        <Button onClick={() => { if (sizes.error) sizes.reload(); if (data.error) data.reload(); }}>Try again</Button>
      </>
    );
  }
  if (!size) return <>{header}<p role="status">Opening the label maker…</p></>;

  const details = saveError?.details ?? {};
  const loose = Object.entries(details).filter(([k]) => k !== 'start' && !/^labels\.\d+\.(name|latin_name|ingredients|caution|copies)$/.test(k));
  const perSheet = size.perSheet;

  const jarList = (jars.data || []).filter(j => j.name.toLowerCase().includes(jarFilter.trim().toLowerCase()));
  const jarSections = [];
  jarList.forEach(j => {
    const last = jarSections[jarSections.length - 1];
    if (last && last.name === j.section_name) last.jars.push(j); else jarSections.push({ name: j.section_name, jars: [j] });
  });
  const batchList = [...(batches.data || [])]
    .sort((a, b) => b.start_date.localeCompare(a.start_date) || b.id - a.id)
    .filter(b => b.name.toLowerCase().includes(batchFilter.trim().toLowerCase()));
  const full = picked >= MAX_PICKED;

  return (
    <>
      <div className="no-print">{header}</div>
      <div className="card-grid no-print">
        <ParchmentCard title="Jars">
          <Field label="Find a jar"><TextInput type="search" value={jarFilter} onChange={e => setJarFilter(e.target.value)} /></Field>
          <div role="group" aria-label="Jars" className="label-picks">
            {jars.error ? <><p role="alert">{jars.error.message}</p><Button onClick={jars.reload}>Try again</Button></>
              : !jars.data ? <p role="status">Opening the cabinet…</p>
                : jars.data.length === 0 ? <p className="muted">No jars in the cabinet yet.</p>
                  : jarList.length === 0 ? <p className="muted">No jars match.</p>
                    : jarSections.map(s => (
                      <div key={s.name}>
                        <h3>{s.name}</h3>
                        <ul className="label-pick-list">
                          {s.jars.map(j => (
                            <li key={j.id}>
                              <PickBox checked={itemIds.includes(j.id)} disabled={full && !itemIds.includes(j.id)} onChange={() => toggle('items', itemIds, j.id)}>{j.name}</PickBox>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
          </div>
        </ParchmentCard>
        <ParchmentCard title="Batches">
          <Field label="Find a batch"><TextInput type="search" value={batchFilter} onChange={e => setBatchFilter(e.target.value)} /></Field>
          <div role="group" aria-label="Batches" className="label-picks">
            {batches.error ? <><p role="alert">{batches.error.message}</p><Button onClick={batches.reload}>Try again</Button></>
              : !batches.data ? <p role="status">Opening the journal…</p>
                : batches.data.length === 0 ? <p className="muted">No batches yet.</p>
                  : batchList.length === 0 ? <p className="muted">No batches match.</p>
                    : (
                      <ul className="label-pick-list">
                        {batchList.map(b => (
                          <li key={b.id}>
                            <PickBox checked={batchIds.includes(b.id)} disabled={full && !batchIds.includes(b.id)} onChange={() => toggle('batches', batchIds, b.id)}>{b.name}</PickBox>
                          </li>
                        ))}
                      </ul>
                    )}
          </div>
        </ParchmentCard>
      </div>

      {picked === 0 ? (
        <div className="no-print"><ParchmentCard botanical="calendula"><p className="muted">Pick jars or batches to make labels.</p></ParchmentCard></div>
      ) : (
        <div className="no-print">
          <ParchmentCard title="Set up">
            <div className="label-options">
              <Field label="Size">
                <Select value={size.key} onChange={e => setParam('size', e.target.value)}
                  options={sizes.data.map(s => ({ value: s.key, label: `${s.name}, ${s.perSheet} per sheet` }))} />
              </Field>
              <Field label="Start at label" error={details.start}
                hint={startClamped ? `Using label ${startNum}, the closest this size has (1 to ${perSheet}).` : `A number from 1 to ${perSheet}. Skips labels already used on a sheet.`}>
                <NumberInput min={1} max={perSheet} step={1} value={start} onChange={e => setStart(e.target.value)} />
              </Field>
            </div>
            {(!data.data || waiting) && <p role="status">Opening the labels…</p>}
            {labels.map((l, i) => (
              <LabelSetup key={l.key} label={l} index={i} errors={details} onEdit={patch => edit(l.key, patch)} onReset={() => reset(l.key)} />
            ))}
            <div className="label-actions">
              <Button onClick={() => window.print()} disabled={!canUse}>Print</Button>
              <Button variant="secondary" onClick={savePdf} disabled={!canUse || saving}>Save as PDF</Button>
            </div>
            {tooMany && <p role="alert">At most {MAX_PRINTED} printed labels at a time. You have {printed}. Lower some of the copies.</p>}
            {saveError && (
              <div className="label-save-error">
                <p role="alert">{saveError.message}</p>
                {loose.map(([k, v]) => <p key={k} role="alert">{v}</p>)}
              </div>
            )}
          </ParchmentCard>
        </div>
      )}

      {labels.length > 0 && !tooMany && (
        <section className="label-preview" aria-label="Preview">
          <h2 className="no-print">Preview</h2>
          <p className="muted no-print">Sheets are drawn smaller here. Your labels print at full size on letter paper, starting at label {startNum}.</p>
          <LabelSheet size={size} start={start} labels={labels} />
        </section>
      )}

      <div className="no-print">
        <ParchmentCard title="Saved PDFs">
          {files.error ? <><p role="alert">{files.error.message}</p><Button onClick={files.reload}>Try again</Button></>
            : !files.data ? <p role="status">Looking in the labels folder…</p>
              : files.data.length === 0 ? <p className="muted">No saved label sheets yet.</p>
                : (
                  <ul className="label-files">
                    {files.data.map(f => (
                      <li key={f.name}>
                        <a href={`/api/labels/files/${f.name}`} target="_blank" rel="noopener noreferrer">{f.name}</a>
                        <span className="muted"> {savedDay(f.saved_at)}, {kb(f.size)}</span>
                      </li>
                    ))}
                  </ul>
                )}
        </ParchmentCard>
      </div>
    </>
  );
}
