import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader.jsx';
import { ParchmentCard } from '../../components/ParchmentCard.jsx';
import { Button } from '../../components/Button.jsx';
import { Dialog } from '../../components/Dialog.jsx';
import { Field, Select, DateInput } from '../../components/Field.jsx';
import { useApi } from '../../lib/useApi.js';
import { api } from '../../lib/api.js';

const KIND_LABELS = {
  item: { plural: 'Jars', one: 'Jar' },
  supplier: { plural: 'Suppliers', one: 'Supplier' },
  herb: { plural: 'Herbs', one: 'Herb' },
  recipe: { plural: 'Recipes', one: 'Recipe' },
  batch: { plural: 'Batches', one: 'Batch' },
  task: { plural: 'Tasks', one: 'Task' },
  journal: { plural: 'Journal entries', one: 'Journal entry' },
};

const queryOf = pairs => {
  const qs = new URLSearchParams();
  Object.entries(pairs).forEach(([k, v]) => { if (v) qs.set(k, v); });
  return qs.toString();
};

// Photos are stamped in UTC; show the local day.
const photoDay = createdAt => new Date(`${createdAt.replace(' ', 'T')}Z`)
  .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const altOf = p => p.caption || `${p.owner.name} photo`;

// Photos for one query, a page at a time: the first page comes from useApi, "Load more" appends the rest.
function usePhotos(base) {
  const first = useApi(base, { keepPrevious: true });
  const fresh = { base, pages: [], page: 1, error: null, busy: false };
  const [more, setMore] = useState(fresh);
  const current = more.base === base ? more : fresh;
  useEffect(() => { setMore({ base, pages: [], page: 1, error: null, busy: false }); }, [base, first.data]);
  const photos = first.data ? [...first.data.photos, ...current.pages] : [];
  const total = first.data?.total ?? 0;
  const loadMore = async () => {
    if (first.loading) return;
    const page = current.page + 1;
    setMore({ ...current, busy: true, error: null });
    try {
      const res = await api.get(`${base}${base.endsWith('?') ? '' : '&'}page=${page}`);
      setMore(m => (m.base === base ? { ...m, pages: [...m.pages, ...res.photos], page, busy: false } : m));
    } catch (err) {
      setMore(m => (m.base === base ? { ...m, busy: false, error: err } : m));
    }
  };
  const settled = Boolean(first.data) && !first.loading;
  return { first, photos, hasMore: settled && photos.length < total, loadMore, busy: current.busy, moreError: current.error };
}

export function Gallery() {
  const [params, setParams] = useSearchParams();
  const kind = params.get('kind') || '';
  const from = params.get('from') || '';
  const to = params.get('to') || '';
  const filtered = Boolean(kind || from || to);
  const setParam = useCallback((key, value) => {
    setParams(prev => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value); else next.delete(key);
      return next;
    }, { replace: true });
  }, [setParams]);

  const kinds = useApi('/api/gallery/kinds');
  const state = usePhotos(`/api/gallery?${queryOf({ kind, from, to })}`);
  const { first, photos } = state;

  const [viewing, setViewing] = useState(null); // photo id
  const tiles = useRef(new Map());
  const index = viewing === null ? -1 : photos.findIndex(p => p.id === viewing);
  const current = index >= 0 ? photos[index] : null;
  const step = d => { const p = photos[index + d]; if (p) setViewing(p.id); };
  const close = () => {
    const id = viewing;
    setViewing(null);
    // Land on the tile for the photo being shown, which may not be the one that was opened.
    setTimeout(() => tiles.current.get(id)?.focus(), 0);
  };
  // The dialog is modal, so arrow keys anywhere in it (buttons included) move between photos.
  const stepRef = useRef(step);
  stepRef.current = step;
  const isOpen = current !== null;
  // If the photo being viewed leaves the list (a refresh, a new filter), close the viewer.
  useEffect(() => { if (viewing !== null && index < 0) setViewing(null); }, [viewing, index]);
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = e => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); stepRef.current(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); stepRef.current(1); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen]);

  const options = (kinds.data ?? []).map(k => ({ value: k.kind, label: `${KIND_LABELS[k.kind]?.plural ?? k.kind} (${k.count})` }));
  if (kind && !options.some(o => o.value === kind)) options.push({ value: kind, label: KIND_LABELS[kind]?.plural ?? kind });

  let body;
  if (first.error) body = <><p role="alert">{first.error.message}</p><Button onClick={first.reload}>Try again</Button></>;
  else if (!first.data) body = <p>Opening the photos…</p>;
  else if (photos.length === 0) {
    body = filtered
      ? <ParchmentCard title="No photos match."><p className="muted">Try different dates or another kind.</p></ParchmentCard>
      : <ParchmentCard title="Nothing here yet." botanical="calendula"><p>No photos yet. Add them to jars, herbs, recipes, batches, tasks or journal entries.</p></ParchmentCard>;
  } else {
    body = (
      <>
        <ul className="photo-grid">
          {photos.map(p => (
            <li key={p.id} className="photo-tile">
              <button type="button" className="photo-open" ref={el => { if (el) tiles.current.set(p.id, el); else tiles.current.delete(p.id); }}
                aria-label={`View larger: ${altOf(p)}`} onClick={() => setViewing(p.id)}>
                <img src={`/photos/${p.filename}`} alt={altOf(p)} loading="lazy" />
              </button>
              {p.caption && <p className="photo-caption">{p.caption}</p>}
              <Link className="photo-owner muted" to={p.owner.link}>{KIND_LABELS[p.owner.kind]?.one ?? p.owner.kind}: {p.owner.name}</Link>
            </li>
          ))}
        </ul>
        {state.moreError && <p role="alert">{state.moreError.message}</p>}
        {state.hasMore && <p><Button variant="secondary" onClick={state.loadMore} disabled={state.busy}>Load more</Button></p>}
      </>
    );
  }

  return (
    <>
      <PageHeader title="Photos" subtitle="Everything you've photographed" actions={<Link to="/journal">Journal</Link>} />
      <div className="toolbar" role="search">
        <Field label="Kind"><Select placeholder="All kinds" options={options} value={kind} onChange={e => setParam('kind', e.target.value)} /></Field>
        <Field label="From"><DateInput value={from} max={to || undefined} onChange={e => setParam('from', e.target.value)} /></Field>
        <Field label="To"><DateInput value={to} min={from || undefined} onChange={e => setParam('to', e.target.value)} /></Field>
      </div>
      {body}
      <Dialog open={Boolean(current)} onClose={close} title={current ? current.owner.name : 'Photo'} wide
        footer={current && (
          <>
            <Button variant="secondary" onClick={() => step(-1)} disabled={index <= 0}>Previous</Button>
            <Button variant="secondary" onClick={() => step(1)} disabled={index >= photos.length - 1}>Next</Button>
          </>
        )}>
        {current && (
          <div className="photo-large">
            <img src={`/photos/${current.filename}`} alt={current.caption ? '' : altOf(current)} />
            {current.caption && <p>{current.caption}</p>}
            <p className="muted">
              <Link to={current.owner.link}>{KIND_LABELS[current.owner.kind]?.one ?? current.owner.kind}: {current.owner.name}</Link>
              {' · '}<span>{photoDay(current.created_at)}</span>
            </p>
          </div>
        )}
      </Dialog>
    </>
  );
}
