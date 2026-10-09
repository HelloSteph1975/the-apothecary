import { it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PhotoGallery } from '../../client/src/components/PhotoGallery.jsx';
import { ToastProvider } from '../../client/src/components/ToastProvider.jsx';
import { ConfirmProvider } from '../../client/src/components/ConfirmProvider.jsx';

const photos = [
  { id: 1, filename: '1-aaaaaaaa.jpg', caption: 'Shelf', is_cover: 1 },
  { id: 2, filename: '2-bbbbbbbb.jpg', caption: null, is_cover: 0 },
];

it('marks the cover and makes another photo the cover', async () => {
  const calls = [];
  global.fetch = vi.fn(async (url, opts = {}) => { calls.push([opts.method, url, opts.body]); return new Response('{}', { status: 200 }); });
  const onChange = vi.fn();
  render(<ToastProvider><ConfirmProvider><PhotoGallery ownerType="item" ownerId={5} photos={photos} onChange={onChange} /></ConfirmProvider></ToastProvider>);
  expect(screen.getByText('Cover')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Make this the cover photo' }));
  expect(calls[0]).toEqual(['PATCH', '/api/photos/2', JSON.stringify({ is_cover: true })]);
  expect(onChange).toHaveBeenCalled();
});
