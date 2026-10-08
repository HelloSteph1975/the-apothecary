import { useEffect, useState } from 'react';
import { PageHeader } from '../components/PageHeader.jsx';
import { ParchmentCard } from '../components/ParchmentCard.jsx';
import { Field, TextInput, Select } from '../components/Field.jsx';
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
              <Field key={f.key} label={f.label} hint={f.hint} error={errors[f.key]}>
                <TextInput value={form[f.key]} onChange={e => set(f.key, e.target.value)}
                  inputMode={f.key === 'latitude' || f.key === 'longitude' ? 'decimal' : undefined} />
              </Field>
            ))}
            <Field label="Hemisphere" hint="Turns the Wheel of the Year for where you live." error={errors.hemisphere}>
              <Select value={form.hemisphere} onChange={e => set('hemisphere', e.target.value)}
                options={[{ value: 'north', label: 'Northern' }, { value: 'south', label: 'Southern' }]} />
            </Field>
            <Field label="Units" error={errors.units}>
              <Select value={form.units} onChange={e => set('units', e.target.value)}
                options={[{ value: 'metric', label: 'Metric (g, ml)' }, { value: 'us', label: 'US (oz, fl oz)' }]} />
            </Field>
            <WaxSeal type="submit">Save settings</WaxSeal>
          </form>
        </ParchmentCard>

        <ParchmentCard title="Backups">
          <p>With the Windows schedule installed, your cabinet is backed up every night at 9:30 PM. It also backs up when it starts if the last backup is more than a day old. Backups are kept for 30 days, and the newest 5 are always kept.</p>
          <p className="muted">Data folder: {folder.data?.path ?? '…'}</p>
          <p><button type="button" className="btn" onClick={backUp}>Back up now</button></p>
          {backups.error && (
            <p role="alert">
              Couldn't load your backups. {backups.error.message}{' '}
              <button type="button" className="btn" onClick={backups.reload}>Try again</button>
            </p>
          )}
          {!backups.error && !backups.loading && (backups.data ?? []).length === 0 && <p className="muted">No backups yet.</p>}
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
