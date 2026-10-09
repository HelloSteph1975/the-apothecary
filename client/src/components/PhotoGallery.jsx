import { useState } from 'react';
import { ImagePlus, Trash2, Star } from 'lucide-react';
import { api } from '../lib/api.js';
import { resizeImage } from '../lib/image.js';
import { useDeleteWithUndo } from './useDeleteWithUndo.jsx';
import { useToast } from './ToastProvider.jsx';

export async function uploadPhoto(ownerType, ownerId, file, caption = '') {
  const blob = await resizeImage(file);
  const fd = new FormData();
  fd.append('owner_type', ownerType);
  fd.append('owner_id', String(ownerId));
  fd.append('caption', caption);
  fd.append('file', blob, 'photo.jpg');
  return api.upload('/api/photos', fd);
}

export function PhotoGallery({ ownerType, ownerId, photos, onChange }) {
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const del = useDeleteWithUndo();
  const toast = useToast();
  async function add(files) {
    const images = files.filter(f => f.type.startsWith('image/'));
    const skipped = files.length - images.length;
    setBusy(true);
    try { for (const f of images) await uploadPhoto(ownerType, ownerId, f); }
    catch (err) { toast.show({ message: err.message, duration: 6000 }); }
    finally { setBusy(false); onChange(); }
    if (skipped) toast.show({ message: `${skipped} file${skipped > 1 ? 's were' : ' was'} not a photo, so I left ${skipped > 1 ? 'them' : 'it'} out.`, duration: 6000 });
  }
  async function patch(p, body) {
    try { await api.patch(`/api/photos/${p.id}`, body); onChange(); }
    catch (err) { toast.show({ message: err.message, duration: 6000 }); }
  }
  return (
    <div className="gallery">
      {photos.map(p => (
        <figure key={p.id} className="gallery-item">
          <img src={`/photos/${p.filename}`} alt={p.caption || 'Photo'} loading="lazy" />
          <figcaption>
            <input className="caption-input" defaultValue={p.caption ?? ''} placeholder="Add a caption" aria-label="Photo caption"
              onBlur={e => { if (e.target.value !== (p.caption ?? '')) patch(p, { caption: e.target.value }); }} />
            {p.is_cover
              ? <span className="cover-tag">Cover</span>
              : <button type="button" className="icon-btn" aria-label="Make this the cover photo" onClick={() => patch(p, { is_cover: true })}><Star size={16} /></button>}
            <button type="button" className="icon-btn" aria-label="Delete photo" onClick={() => del({ url: `/api/photos/${p.id}`, label: 'photo', onChange })}>
              <Trash2 size={16} />
            </button>
          </figcaption>
        </figure>
      ))}
      <label className={`gallery-drop ${over ? 'is-over' : ''}`}
        onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={e => { e.preventDefault(); setOver(false); add([...e.dataTransfer.files]); }}>
        <ImagePlus size={28} aria-hidden="true" />
        <span>{busy ? 'Adding…' : 'Drop photos here or click to choose'}</span>
        <input type="file" accept="image/*" multiple className="visually-hidden"
          onChange={e => { const files = [...e.target.files]; e.target.value = ''; add(files); }} />
      </label>
    </div>
  );
}
