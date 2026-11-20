import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { Store, store } from './store';
import { FakeServer } from '../sync/fake';
import { Care } from '../screens/Care';
import { ToastHost } from '../ui/Toast';
import type { CareData, CareItem } from '../engine/care';

const noon = (d: string) => Date.parse(d + 'T12:00:00');
const cat = { name: 'Chester', birthday: '2026-04', homeDate: '2026-11-01', breed: '', coat: 'black', eyes: 'gold', rewards: ['treats'], outfit: '' };
let n = 0;
const fresh = async (remote: FakeServer | null = null) => { const s = new Store('weights' + ++n, remote?.device() ?? null); await s.load(); await s.saveCat(cat); return s; };
const live = (s: Store) => s.get().care.filter((c): c is CareItem<'weight'> => c.kind === 'weight').map((w) => [new Date(w.at).toISOString().slice(0, 10), w.data.lb, w.data.visitId ?? null]).sort();

afterEach(() => { cleanup(); location.hash = ''; });

describe('weigh-ins', () => {
  it('saving the same weigh-in again updates it: same visit, or same day and value', async () => {
    const s = await fresh();
    // the document reader, then a re-scan of the same document, then the Health form, all for Nov 14
    await s.saveCare('weight', { lb: 6.98, doc: 'd1' }, { at: noon('2026-11-14') });
    await s.saveCare('weight', { lb: 6.98, doc: 'd1' }, { at: noon('2026-11-14') });
    await s.saveCare('weight', { lb: 6.98 }, { at: noon('2026-11-14') + 3600e3 });
    expect(live(s)).toEqual([['2026-11-14', 6.98, null]]);
    // the visit's "+ Weight" with a corrected value: still one, now linked to the visit
    await s.saveCare('weight', { lb: 6.98, visitId: 'v1' }, { at: noon('2026-11-14') });
    await s.saveCare('weight', { lb: 7.02, visitId: 'v1' }, { at: noon('2026-11-14') });
    expect(live(s)).toEqual([['2026-11-14', 7.02, 'v1']]);
    // another day, or another value that day, is a new weigh-in
    await s.saveCare('weight', { lb: 7.02 }, { at: noon('2026-11-20') });
    await s.saveCare('weight', { lb: 7.1 }, { at: noon('2026-11-20') });
    expect(live(s)).toHaveLength(3);
  });

  it('cleans up duplicates saved before the fix, keeping the visit’s one, and the deletes reach the other phone', async () => {
    const server = new FakeServer();
    const a = await fresh(server);
    await a.signIn('josh@example.com', 'catnip1', 'Josh', true, true);
    const catId = a.get().cat!.id;
    // five copies of one weigh-in, as older versions saved them (straight into this phone's database)
    const row = (id: string, data: CareData['weight'], h = 0) => ({ id, catId, kind: 'weight' as const, at: noon('2026-11-14') + h * 60e3, updatedAt: 1, data, dirty: 1 });
    await a.db.care.bulkPut([row('w1', { lb: 6.98 }), row('w2', { lb: 6.98, doc: 'd1' }, 1), row('w3', { lb: 6.98, visitId: 'v1' }, 2), row('w4', { lb: 6.98 }, 3), row('w5', { lb: 6.98, doc: 'd1' }, 4),
      row('w6', { lb: 6.5 }, 5)]);
    await a.load(); await a.settled();
    expect(live(a)).toEqual([['2026-11-14', 6.5, null], ['2026-11-14', 6.98, 'v1']]);
    await a.sync();
    expect(server.care.get('w1')?.deleted).toBe(true);
    expect(server.care.get('w3')?.deleted).toBeFalsy();

    // a second phone gets one weigh-in, and a phone that pulls old duplicates from the server cleans them too
    const b = new Store('weights' + ++n, server.device()); await b.load();
    await b.signIn('josh@example.com', 'catnip1', 'Josh', false); await b.sync();
    expect(live(b)).toEqual([['2026-11-14', 6.5, null], ['2026-11-14', 6.98, 'v1']]);
    server.care.set('w7', { id: 'w7', catId, kind: 'weight', at: noon('2026-11-14'), updatedAt: 2, data: { lb: 6.5 } });
    await b.sync();
    expect(live(b)).toHaveLength(2);
    expect(server.care.get('w6')?.deleted || server.care.get('w7')?.deleted).toBe(true);
  });

  it('tapping a weigh-in on Health opens it to edit; delete has Undo', async () => {
    await store.load();
    await store.saveCat(cat);
    await store.saveCare('weight', { lb: 6.1 }, { at: noon('2026-11-01') });
    await store.saveCare('weight', { lb: 6.98 }, { at: noon('2026-11-14') });
    await store.settled();
    render(<><Care /><ToastHost /></>);
    fireEvent.click(await screen.findByRole('button', { name: /Edit weight 6\.98 lb/ }));
    expect(await screen.findByText('· Edit Weight')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByText('Delete this weight for everyone?')).toBeTruthy(); // asked once, in the sheet
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('Deleted · 6.98 lb')).toBeTruthy();
    await store.settled();
    expect(store.get().care.filter((c) => c.kind === 'weight')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await store.settled();
    await new Promise((r) => setTimeout(r, 0));
    expect(store.get().care.filter((c) => c.kind === 'weight').map((w) => (w.data as CareData['weight']).lb).sort()).toEqual([6.1, 6.98]);
  });
});
