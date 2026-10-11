import { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { X } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader.jsx';
import { ParchmentCard } from '../../components/ParchmentCard.jsx';
import { Field, TextInput, TextArea, DateInput, Select } from '../../components/Field.jsx';
import { WaxSeal } from '../../components/WaxSeal.jsx';
import { Button } from '../../components/Button.jsx';
import { useToast } from '../../components/ToastProvider.jsx';
import { api } from '../../lib/api.js';
import { useApi } from '../../lib/useApi.js';
import { useLeaveGuard } from '../../lib/useLeaveGuard.js';
import { isDay } from '../../lib/calendar.js';
import { todayString } from '../../lib/today.js';
import { MOODS } from '../../lib/journal.jsx';

const LINK_TYPES = [
  { value: 'herb', label: 'Herb' },
  { value: 'recipe', label: 'Recipe' },
  { value: 'batch', label: 'Batch' },
  { value: 'garden_entry', label: 'Garden entry' },
];
const s = v => (v == null ? '' : String(v));
const orNull = v => (v.trim() === '' ? null : v.trim());
const cleanTag = t => t.trim().toLowerCase();
const nameOf = (type, r) => (type === 'herb' ? r.common_name : type === 'garden_entry' ? r.title : r.name);
const linkKey = l => `${l.type}:${l.id}`;

export function EntryForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const entry = useApi(editing ? `/api/journal/${id}` : null);
  const types = useApi('/api/journal-types');
  const herbs = useApi('/api/herbs');
  const recipes = useApi('/api/recipes');
  const batches = useApi('/api/batches');
  const gardenEntries = useApi('/api/garden/entries/options');
  const records = { herb: herbs, recipe: recipes, batch: batches, garden_entry: gardenEntries };
  const tagList = useApi('/api/journal/tags');
  const listId = useId();
  const tagInput = useRef(null);
  const recordSelect = useRef(null);
  const [form, setForm] = useState(null);
  const [tags, setTags] = useState([]);
  const [tagDraft, setTagDraft] = useState('');
  const [links, setLinks] = useState([]);
  const [linkType, setLinkType] = useState('herb');
  const [linkId, setLinkId] = useState('');
  const [initial, setInitial] = useState('');
  const [errors, setErrors] = useState({});
  const [typeGone, setTypeGone] = useState(false);
  const [droppedLinks, setDroppedLinks] = useState(false);

  const apis = [types, herbs, recipes, batches, gardenEntries];
  const ready = apis.every(a => a.data) && (!editing || entry.data);
  useEffect(() => {
    if (form || !ready) return;
    const liveType = v => (types.data.some(t => String(t.id) === s(v)) ? s(v) : '');
    const startLinks = [];
    let start;
    let startTags = [];
    if (editing) {
      const e = entry.data;
      start = {
        title: s(e.title), type_id: liveType(e.type_id), entry_date: s(e.entry_date), entry_time: s(e.entry_time), mood: s(e.mood), body: s(e.body),
      };
      const live = e.links.filter(l => l.live);
      startLinks.push(...live.map(l => ({ type: l.type, id: l.id, name: l.name })));
      setDroppedLinks(live.length < e.links.length);
      setTypeGone(e.type_id != null && start.type_id === '');
      startTags = e.tags;
    } else {
      const date = params.get('date');
      start = { title: '', type_id: liveType(params.get('type')), entry_date: isDay(date) ? date : todayString(), entry_time: '', mood: '', body: '' };
      const herb = herbs.data.find(h => String(h.id) === params.get('herb'));
      if (herb) startLinks.push({ type: 'herb', id: herb.id, name: herb.common_name });
      const batch = batches.data.find(b => String(b.id) === params.get('batch'));
      if (batch) startLinks.push({ type: 'batch', id: batch.id, name: batch.name });
    }
    setForm(start);
    setTags(startTags);
    setLinks(startLinks);
    setInitial(JSON.stringify([start, startTags, startLinks.map(linkKey), '']));
  }, [form, ready, editing, entry.data, types.data, herbs.data, batches.data, params]);

  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const dirty = Boolean(form) && JSON.stringify([form, tags, links.map(linkKey), tagDraft]) !== initial;
  const markSaved = useLeaveGuard(dirty);
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: undefined })); };

  const addTags = list => {
    const fresh = list.map(cleanTag).filter(Boolean);
    if (fresh.length) setTags(t => [...t, ...fresh.filter((x, i) => !t.includes(x) && fresh.indexOf(x) === i)]);
    setErrors(e => Object.fromEntries(Object.entries(e).filter(([k]) => k !== 'tags' && !k.startsWith('tags.'))));
  };
  const onTagChange = value => {
    if (!value.includes(',')) { setTagDraft(value); return; }
    const parts = value.split(',');
    setTagDraft(parts.pop());
    addTags(parts);
  };
  const onTagKey = e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    addTags([tagDraft]);
    setTagDraft('');
  };
  const removeTag = tag => {
    setTags(t => t.filter(x => x !== tag));
    tagInput.current?.focus();
    setErrors(e => Object.fromEntries(Object.entries(e).filter(([k]) => k !== 'tags' && !k.startsWith('tags.'))));
  };

  // Link errors are keyed by position, so any change to the list makes them stale.
  const removeLink = i => {
    changeLinks(links.filter((_, n) => n !== i));
    recordSelect.current?.focus();
  };
  const changeLinks = next => {
    setLinks(next);
    setErrors(e => Object.fromEntries(Object.entries(e).filter(([k]) => k !== 'links' && !k.startsWith('links.'))));
  };
  const addLink = () => {
    const rec = records[linkType].data?.find(r => String(r.id) === linkId);
    if (!rec) return;
    if (!links.some(l => l.type === linkType && l.id === rec.id)) changeLinks([...links, { type: linkType, id: rec.id, name: nameOf(linkType, rec) }]);
    setLinkId('');
  };

  async function save(e) {
    e.preventDefault();
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    const pending = cleanTag(tagDraft);
    const body = {
      title: form.title.trim(),
      type_id: form.type_id === '' ? null : Number(form.type_id),
      entry_date: form.entry_date,
      entry_time: orNull(form.entry_time),
      mood: form.mood === '' ? null : form.mood,
      body: form.body.trim() === '' ? null : form.body,
      tags: pending && !tags.includes(pending) ? [...tags, pending] : tags,
      links: links.map(l => ({ type: l.type, id: l.id })),
    };
    try {
      const result = editing ? await api.patch(`/api/journal/${id}`, body) : await api.post('/api/journal', body);
      markSaved();
      toast.show({ message: 'Saved' });
      navigate(`/journal/${result?.id ?? id}`);
    } catch (ex) {
      setErrors(ex.details ?? {});
      toast.show({ message: ex.message, duration: 6000 });
      savingRef.current = false;
      setSaving(false);
    }
  }

  const heading = editing ? 'Edit journal entry' : 'Add a journal entry';
  const loadError = (editing && entry.error) || apis.map(a => a.error).find(Boolean);
  if (loadError) {
    const retry = () => { [entry, ...apis].forEach(a => { if (a.error) a.reload(); }); };
    return (
      <>
        <PageHeader title={heading} />
        <p role="alert">{loadError.message}</p>
        <Button onClick={retry}>Try again</Button>
      </>
    );
  }
  if (!form) return <PageHeader title={heading} />;

  const typeOptions = types.data.map(t => ({ value: String(t.id), label: t.name }));
  const recordOptions = (records[linkType].data ?? []).map(r => ({ value: String(r.id), label: nameOf(linkType, r) }));
  const tagError = errors.tags ?? Object.entries(errors).find(([k, v]) => k.startsWith('tags.') && v)?.[1];

  return (
    <>
      <PageHeader title={editing ? `Edit ${entry.data.title}` : heading} />
      <form onSubmit={save} noValidate>
        <ParchmentCard title="The entry">
          <Field label="Title (required)" error={errors.title}>
            <TextInput required aria-required="true" value={form.title} onChange={e => set('title', e.target.value)} />
          </Field>
          <Field label="Type (required)" error={errors.type_id}
            hint={typeGone && form.type_id === '' ? 'The type this entry used was deleted. Pick a new one.' : undefined}>
            <Select required aria-required="true" value={form.type_id} onChange={e => set('type_id', e.target.value)} placeholder="Pick a type" options={typeOptions} />
          </Field>
          <Field label="Date" error={errors.entry_date}>
            <DateInput value={form.entry_date} onChange={e => set('entry_date', e.target.value)} />
          </Field>
          <Field label="Time" hint="Optional" error={errors.entry_time}>
            <input type="time" className="input" value={form.entry_time} onChange={e => set('entry_time', e.target.value)} />
          </Field>
          <Field label="Mood" error={errors.mood}>
            <Select value={form.mood} onChange={e => set('mood', e.target.value)} placeholder="No mood" options={MOODS} />
          </Field>
          <Field label="Body" error={errors.body}>
            <TextArea rows={14} value={form.body} onChange={e => set('body', e.target.value)} />
          </Field>
        </ParchmentCard>
        <ParchmentCard title="Tags to find it again">
          <Field label="Tags" hint="Press Enter or type a comma to add one. Up to 20 tags, 40 characters each." error={tagError}>
            <TextInput ref={tagInput} maxLength={40} list={listId} value={tagDraft} onChange={e => onTagChange(e.target.value)} onKeyDown={onTagKey} />
          </Field>
          <datalist id={listId}>
            {(tagList.data ?? []).map(t => <option key={t.tag} value={t.tag} />)}
          </datalist>
          {tags.length > 0 && (
            <ul className="chip-row" aria-label="Tags added">
              {tags.map(t => (
                <li key={t} className="badge badge-brass entry-chip">
                  {t}
                  <button type="button" className="icon-btn" aria-label={`Remove tag ${t}`} onClick={() => removeTag(t)}><X size={14} aria-hidden="true" /></button>
                </li>
              ))}
            </ul>
          )}
        </ParchmentCard>
        <ParchmentCard title="Linked records">
          <div className="entry-link-add">
            <Field label="Link to">
              <Select value={linkType} onChange={e => { setLinkType(e.target.value); setLinkId(''); }} options={LINK_TYPES} />
            </Field>
            <Field label="Record">
              <Select ref={recordSelect} value={linkId} onChange={e => setLinkId(e.target.value)} placeholder="Pick one" options={recordOptions} />
            </Field>
            <Button type="button" variant="secondary" onClick={addLink} disabled={linkId === ''}>Add</Button>
          </div>
          {errors.links && <p className="field-error" role="alert">{errors.links}</p>}
          {droppedLinks && <p className="muted">A record this entry linked to is gone, so it was left out.</p>}
          {links.length > 0 && (
            <ul className="chip-row" aria-label="Linked records">
              {links.map((l, i) => (
                <li key={linkKey(l)} className="entry-link">
                  <span className="badge badge-brass entry-chip">
                    <span className="muted">{LINK_TYPES.find(t => t.value === l.type).label}:</span> {l.name}
                    <button type="button" className="icon-btn" aria-label={`Remove link to ${l.name}`} onClick={() => removeLink(i)}>
                      <X size={14} aria-hidden="true" />
                    </button>
                  </span>
                  {errors[`links.${i}`] && <small className="field-error" role="alert"> {errors[`links.${i}`]}</small>}
                </li>
              ))}
            </ul>
          )}
        </ParchmentCard>
        <p className="page-actions">
          <WaxSeal type="submit" disabled={saving}>Save</WaxSeal>
          <Link to={editing ? `/journal/${id}` : '/journal'}>Cancel</Link>
        </p>
      </form>
    </>
  );
}
