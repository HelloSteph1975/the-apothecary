import { useEffect, useId, useRef } from 'react';
import { Field, TextInput, Checkbox } from '../../components/Field.jsx';
import { SOURCE_COVERS } from '../../lib/grimoire.js';

let nextKey = 1;
export const newSource = (src = {}) => ({
  key: nextKey++,
  title: src.title ?? '',
  author: src.author ?? '',
  year: src.year == null ? '' : String(src.year),
  url: src.url ?? '',
  covers: Array.isArray(src.covers) ? src.covers : [],
});

// Rows of {key, title, author, year, url, covers}. `errors` is the server's details object
// (keys like "sources.0.url"). Focus is moved after add/remove so keyboard users aren't dropped.
export function SourcesEditor({ sources, onChange, errors = {} }) {
  const baseId = useId();
  const focusRef = useRef(null);
  const addRef = useRef(null);
  const rowRefs = useRef({});
  const removeRefs = useRef({});
  const upRefs = useRef({});
  const downRefs = useRef({});

  useEffect(() => {
    const f = focusRef.current;
    if (!f) return;
    focusRef.current = null;
    if (f.type === 'title') rowRefs.current[f.key]?.focus();
    else if (f.type === 'remove') (removeRefs.current[f.key] ?? addRef.current)?.focus();
    else if (f.type === 'add') addRef.current?.focus();
    else if (f.type === 'move') {
      const up = upRefs.current[f.key], down = downRefs.current[f.key];
      const first = f.dir < 0 ? up : down, second = f.dir < 0 ? down : up;
      (first && !first.disabled ? first : second)?.focus();
    }
  }, [sources]);

  const update = (i, patch) => onChange(sources.map((s, n) => (n === i ? { ...s, ...patch } : s)));
  const toggle = (i, cover, on) => {
    const set = new Set(sources[i].covers);
    if (on) set.add(cover); else set.delete(cover);
    update(i, { covers: SOURCE_COVERS.map(c => c.value).filter(c => set.has(c)) });
  };
  const add = () => {
    const row = newSource();
    focusRef.current = { type: 'title', key: row.key };
    onChange([...sources, row]);
  };
  const remove = i => {
    const prev = sources[i - 1] ?? null;
    focusRef.current = prev ? { type: 'remove', key: prev.key } : { type: 'add' };
    onChange(sources.filter((_, n) => n !== i));
  };
  const move = (i, d) => {
    const next = [...sources];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    focusRef.current = { type: 'move', key: sources[i].key, dir: d };
    onChange(next);
  };

  return (
    <div className="sources-editor">
      {errors.sources && <p className="field-error" role="alert">{errors.sources}</p>}
      {sources.length === 0 && <p className="muted">No sources yet.</p>}
      {sources.map((s, i) => {
        const n = i + 1;
        const err = f => errors[`sources.${i}.${f}`];
        const coversErrorId = `${baseId}-${s.key}-covers-error`;
        return (
          <fieldset key={s.key} className="source-row">
            <legend>Source {n}</legend>
            <Field label={`Title (required)`} error={err('title')}>
              <TextInput ref={el => { rowRefs.current[s.key] = el; }} required aria-required="true" value={s.title}
                onChange={e => update(i, { title: e.target.value })} />
            </Field>
            <Field label="Author" error={err('author')}>
              <TextInput value={s.author} onChange={e => update(i, { author: e.target.value })} />
            </Field>
            <Field label="Year" error={err('year')}>
              <TextInput inputMode="numeric" value={s.year} onChange={e => update(i, { year: e.target.value })} />
            </Field>
            <Field label="Web address" hint="Starts with https://" error={err('url')}>
              <TextInput inputMode="url" value={s.url} onChange={e => update(i, { url: e.target.value })} />
            </Field>
            <fieldset className="check-group" aria-label={`Source ${n} covers`} aria-describedby={err('covers') ? coversErrorId : undefined}>
              <legend className="field-hint">Covers</legend>
              {SOURCE_COVERS.map(c => (
                <Checkbox key={c.value} label={c.label} checked={s.covers.includes(c.value)}
                  onChange={e => toggle(i, c.value, e.target.checked)} />
              ))}
              {err('covers') && <small id={coversErrorId} className="field-error" role="alert">{err('covers')}</small>}
            </fieldset>
            <p className="page-actions">
              <button type="button" className="btn btn-secondary" ref={el => { upRefs.current[s.key] = el; }} disabled={i === 0} onClick={() => move(i, -1)}>{`Move source ${n} up`}</button>
              <button type="button" className="btn btn-secondary" ref={el => { downRefs.current[s.key] = el; }} disabled={i === sources.length - 1} onClick={() => move(i, 1)}>{`Move source ${n} down`}</button>
              <button type="button" className="btn btn-secondary" ref={el => { removeRefs.current[s.key] = el; }} onClick={() => remove(i)}>{`Remove source ${n}`}</button>
            </p>
          </fieldset>
        );
      })}
      <p><button type="button" className="btn btn-secondary" ref={addRef} onClick={add}>Add source</button></p>
    </div>
  );
}
