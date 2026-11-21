import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { render, cleanup, fireEvent, screen, act, waitFor } from '@testing-library/react';
import { store } from '../db/store';
import { CareSheet } from './Care';
import { ToastHost } from '../ui/Toast';
import { localDay } from '../engine/day';
import type { CareData, CareItem } from '../engine/care';

const today = localDay(Date.now());
const noonToday = Date.parse(today + 'T12:00:00');
const of = <K extends CareItem['kind']>(k: K) => store.get().care.filter((c) => c.kind === k) as CareItem<K>[];
let lunaId = '';
beforeAll(async () => {
  await store.load();
  const luna = await store.saveCat({ name: 'Luna', birthday: '2026-04', homeDate: '2026-11-01', breed: '', coat: 'grey', eyes: 'green', rewards: [], outfit: '' });
  lunaId = luna.id;
  await store.saveCat({ name: 'Chester', birthday: '2026-04', homeDate: '2026-11-01', breed: '', coat: 'black', eyes: 'gold', rewards: [], outfit: '' });
  await store.saveCare('vet', { reason: 'Kitten shots', status: 'done' }, { at: noonToday });
  await store.settled();
});
afterEach(() => { cleanup(); });
const sheet = (e: Parameters<typeof CareSheet>[0]['editing']) => render(<><CareSheet editing={e} onClose={() => {}} /><ToastHost /></>);

describe('one pattern for every entry (after-the-visit, steps 1–3)', () => {
  it('shows the cat in the header and links a dose to that day’s visit by default; Saved · Undo removes it', async () => {
    sheet({ kind: 'med' });
    expect(screen.getByRole('button', { name: /For Chester, tap to change/ })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'FeLV' } });
    expect(screen.getByRole('button', { name: /Kitten shots/ }).getAttribute('aria-pressed')).toBe('true');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })); });
    await waitFor(() => expect(of('med')).toHaveLength(1));
    const visit = of('vet')[0];
    expect(of('med')[0].data.visitId).toBe(visit.id);
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(of('med')).toHaveLength(0));
  });

  it('asks before adding the same dose twice on one day', async () => {
    await store.saveCare('med', { name: 'Revolution', what: 'flea' }, { at: noonToday }); await store.settled();
    sheet({ kind: 'med' });
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'revolution' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert').textContent).toMatch(/Already logged at .*Add another\?/);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(of('med')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Add another' })); });
    await waitFor(() => expect(of('med')).toHaveLength(2));
  });

  it('an edit’s Undo puts the old version back; a new entry can go to another cat', async () => {
    const s = (await store.saveCare('symptom', { what: 'Sneezing' }, { at: noonToday }))!; await store.settled();
    sheet({ kind: 'symptom', item: s });
    fireEvent.change(screen.getByLabelText('Notes (optional)'), { target: { value: 'twice' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save changes' })); });
    await waitFor(() => expect((of('symptom')[0].data as CareData['symptom']).notes).toBe('twice'));
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(() => expect((of('symptom')[0].data as CareData['symptom']).notes).toBeUndefined());
    cleanup();

    sheet({ kind: 'weight' });
    fireEvent.click(screen.getByRole('button', { name: /For Chester/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Luna' }));
    expect(screen.getByRole('button', { name: /For Luna/ })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Weight in pounds'), { target: { value: '5.5' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })); });
    expect(await screen.findByText('Saved · 5.5 lb for Luna')).toBeTruthy();
    const lunaRows = (await store.db.care.where('catId').equals(lunaId).toArray()).filter((c) => c.kind === 'weight' && !c.deleted);
    expect(lunaRows).toHaveLength(1);
    expect(of('weight')).toHaveLength(0); // not on Chester's log
  });
});
