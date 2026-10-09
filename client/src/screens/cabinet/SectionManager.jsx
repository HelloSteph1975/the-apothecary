import { useEffect, useRef, useState } from 'react';
import { ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { Dialog } from '../../components/Dialog.jsx';
import { Button } from '../../components/Button.jsx';
import { Field, TextInput, Select } from '../../components/Field.jsx';
import { useToast } from '../../components/ToastProvider.jsx';
import { api } from '../../lib/api.js';

export function SectionManager({ open, onClose, sections, onChange }) {
  const toast = useToast();
  const [drafts, setDrafts] = useState({});
  const [newName, setNewName] = useState('');
  const [moving, setMoving] = useState(null); // { section, items, to }
  const panel = useRef();
  const askingFor = moving?.section.id;
  useEffect(() => { if (askingFor) panel.current?.querySelector('select')?.focus(); }, [askingFor]);

  const fail = err => toast.show({ message: err.message, duration: 6000 });
  const run = async fn => { try { await fn(); onChange(); } catch (err) { fail(err); } };

  const rename = (s, name) => {
    setDrafts(d => { const rest = { ...d }; delete rest[s.id]; return rest; });
    const trimmed = name.trim();
    if (!trimmed || trimmed === s.name) return;
    run(() => api.patch(`/api/sections/${s.id}`, { name: trimmed }));
  };
  const shift = (i, by) => {
    const ids = sections.map(s => s.id);
    [ids[i], ids[i + by]] = [ids[i + by], ids[i]];
    run(() => api.put('/api/sections/order', { ids }));
  };
  const add = () => {
    const name = newName.trim();
    if (!name) return;
    run(async () => { await api.post('/api/sections', { name }); setNewName(''); });
  };
  const offerUndo = (name, restore) => toast.show({
    message: `Deleted ${name}`,
    duration: 8000,
    action: { label: 'Undo', onClick: () => run(async () => { await api.post(restore); toast.show({ message: `Brought back ${name}` }); }) },
  });
  const remove = async s => {
    try {
      const res = await api.del(`/api/sections/${s.id}`);
      onChange();
      offerUndo(s.name, res.restore);
    } catch (err) {
      const n = err.details?.items;
      if (err.status === 409 && n) {
        const other = sections.find(x => x.id !== s.id);
        setMoving({ section: s, items: n, to: other ? String(other.id) : '' });
      } else fail(err);
    }
  };
  const confirmMove = async () => {
    const { section, to } = moving;
    try {
      const res = await api.del(`/api/sections/${section.id}?move_to=${to}`);
      setMoving(null);
      onChange();
      offerUndo(section.name, res.restore);
    } catch (err) { fail(err); }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Manage sections" footer={<Button variant="secondary" onClick={onClose}>Done</Button>}>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {sections.map((s, i) => (
          <li key={s.id} className="toolbar">
            <Field label={`Name of ${s.name}`}>
              <TextInput value={drafts[s.id] ?? s.name} onChange={e => setDrafts(d => ({ ...d, [s.id]: e.target.value }))} onBlur={e => rename(s, e.target.value)} />
            </Field>
            <Button variant="secondary" size="sm" icon={ArrowUp} aria-label={`Move ${s.name} up`} disabled={i === 0} onClick={() => shift(i, -1)} />
            <Button variant="secondary" size="sm" icon={ArrowDown} aria-label={`Move ${s.name} down`} disabled={i === sections.length - 1} onClick={() => shift(i, 1)} />
            <Button variant="secondary" size="sm" icon={Trash2} aria-label={`Delete ${s.name}`} onClick={() => remove(s)} />
          </li>
        ))}
      </ul>
      {moving && (
        <div ref={panel} role="group" aria-label={`Deleting ${moving.section.name}`} className="toolbar">
          <Field label={`Move its ${moving.items} items to:`}>
            <Select value={moving.to} onChange={e => setMoving(m => ({ ...m, to: e.target.value }))}
              options={sections.filter(s => s.id !== moving.section.id).map(s => ({ value: String(s.id), label: s.name }))} />
          </Field>
          <Button onClick={confirmMove} disabled={!moving.to}>Move and delete</Button>
          <Button variant="secondary" onClick={() => setMoving(null)}>Cancel</Button>
        </div>
      )}
      <div className="toolbar">
        <Field label="Add a section"><TextInput value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} /></Field>
        <Button onClick={add}>Add</Button>
      </div>
    </Dialog>
  );
}
