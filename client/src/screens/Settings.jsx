import { useEffect, useState } from 'react';
import { PageHeader } from '../components/PageHeader.jsx';
import { ParchmentCard } from '../components/ParchmentCard.jsx';
import { WaxSeal } from '../components/WaxSeal.jsx';
import { useSettings } from '../components/SettingsProvider.jsx';
import { useConfirm } from '../components/ConfirmProvider.jsx';
import { useToast } from '../components/ToastProvider.jsx';
import { useApi } from '../lib/useApi.js';
import { api } from '../lib/api.js';

const FIELDS = [
  { key: 'keeper_name', label: 'Your name', hint: 'Used in the greeting on Today.' },
  { key: 'location_name', label: 'Place name' },
  { key: 'latitude', label: 'Latitude', hint: 'For moon and sky timing. Mexico City is 19.4326.' },
  { key: 'longitude', label: 'Longitude', hint: 'West is negative. Mexico City is -99.1332.' },
];

function Field({ id, label, hint, error, children }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <small className="muted">{hint}</small>}
      {error && <span className="error" role="alert">{error}</span>}
    </div>
  );
}

export function Settings() {
  const { settings, reload } = useSettings();
  const confirm = useConfirm();
  const toast = useToast();
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const backups = useApi('/api/backups');
  const folder = useApi('/api/data-folder');

  useEffect(() => { if (settings && !form) setForm(settings); }, [settings, form]);
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: undefined })); };

  async function save(e) {
    e.preventDefault();
    try {
      await api.put('/api/settings', form);
      setErrors({});
      reload();
      toast.show({ message: 'Settings saved' });
    } catch (err) {
      setErrors(err.details ?? {});
      toast.show({ message: err.message, duration: 6000 });
    }
  }

  async function backUp() {
    try {
      await api.post('/api/backups');
      backups.reload();
      toast.show({ message: 'Backed up' });
    } catch (err) { toast.show({ message: err.message, duration: 6000 }); }
  }

  async function restore(name) {
    const ok = await confirm({
      title: `Restore ${name}?`,
      body: 'Everything goes back to how it was on that day. A safety copy of how things are now is saved first, so you can undo this.',
      confirmLabel: 'Restore',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.post('/api/backups/restore', { name });
      window.location.reload();
    } catch (err) { toast.show({ message: err.message, duration: 8000 }); }
  }

  if (!form) return <PageHeader title="Settings" />;
  return (
    <>
      <PageHeader title="Settings" subtitle="The key to the cabinet" />
      <div className="card-grid">
        <ParchmentCard title="You and your sky">
          <form onSubmit={save} noValidate>
            {FIELDS.map(f => (
              <Field key={f.key} id={`s-${f.key}`} label={f.label} hint={f.hint} error={errors[f.key]}>
                <input id={`s-${f.key}`} value={form[f.key]} onChange={e => set(f.key, e.target.value)} />
              </Field>
            ))}
            <Field id="s-hemisphere" label="Hemisphere" hint="Turns the Wheel of the Year for where you live." error={errors.hemisphere}>
              <select id="s-hemisphere" value={form.hemisphere} onChange={e => set('hemisphere', e.target.value)}>
                <option value="north">Northern</option>
                <option value="south">Southern</option>
              </select>
            </Field>
            <Field id="s-units" label="Units" error={errors.units}>
              <select id="s-units" value={form.units} onChange={e => set('units', e.target.value)}>
                <option value="metric">Metric (g, ml)</option>
                <option value="us">US (oz, fl oz)</option>
              </select>
            </Field>
            <WaxSeal type="submit">Save settings</WaxSeal>
          </form>
        </ParchmentCard>

        <ParchmentCard title="Backups">
          <p>Your cabinet is backed up every night at 9:30 PM and kept for 30 days.</p>
          <p className="muted">Data folder: {folder.data?.path ?? '…'}</p>
          <p><button type="button" className="btn" onClick={backUp}>Back up now</button></p>
          <ul className="backup-list">
            {(backups.data ?? []).map(b => (
              <li key={b.name}>
                <span>{b.name}</span>{' '}
                <button type="button" className="btn btn-ghost" aria-label={`Restore ${b.name}`} onClick={() => restore(b.name)}>Restore</button>
              </li>
            ))}
          </ul>
        </ParchmentCard>
      </div>
    </>
  );
}
