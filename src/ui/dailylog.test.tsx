import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react';
import { store } from '../db/store';
import type { CareItem } from '../engine/care';
import { hhmm } from '../engine/dailylog';
import { DailyTaps } from './DailyTaps';
import { DailyLogSheet } from './DailyLogSheet';

const cat = (name: string) => ({ name, birthday: '2026-04', homeDate: '2026-05-01', breed: 'American Shorthair', coat: 'black', eyes: 'gold', rewards: ['treats'], outfit: '' });
const settle = () => new Promise((r) => setTimeout(r, 30));
const tap = async (name: string | RegExp, root: HTMLElement = document.body) => { await act(async () => { fireEvent.click(within(root).getByRole('button', { name })); await settle(); }); };
const rows = async () => (await store.db.care.toArray()) as (CareItem & { dirty?: number })[];
const live = async (what: string, catId: string) => (await rows()).filter((c) => c.kind === 'daily' && (c.data as { what: string }).what === what && c.catId === catId && !c.deleted);

describe('Fixing a mistaken quick log', () => {
  it('a full Fed tile opens today’s meals; Delete asks, then removes one for everyone (synced like Undo)', async () => {
    await store.load();
    const chester = await store.saveCat(cat('Chester'));
    await act(async () => { await store.switchPet(chester.id); });
    render(<DailyTaps />);
    await tap(/^Fed\./); await tap(/^Fed\./);
    expect(await live('fed', chester.id)).toHaveLength(2);
    // the tile is full now: tapping it opens the list instead of logging a third meal
    await tap(/^Fed\..*fix today/);
    expect(await live('fed', chester.id)).toHaveLength(2);
    const sheet = screen.getByRole('dialog', { name: 'Chester: Fed today' });
    const dels = within(sheet).getAllByRole('button', { name: /^Delete fed at/ });
    expect(dels).toHaveLength(2);
    await act(async () => { fireEvent.click(dels[0]); await settle(); });
    await tap('Keep', sheet);
    expect(await live('fed', chester.id)).toHaveLength(2);
    await act(async () => { fireEvent.click(within(sheet).getAllByRole('button', { name: /^Delete fed at/ })[0]); await settle(); });
    await tap(/^Delete$/, sheet);
    expect(await live('fed', chester.id)).toHaveLength(1);
    // a soft delete marked for sync, the same path the Undo toast uses
    const gone = (await rows()).find((c) => c.kind === 'daily' && c.deleted)!;
    expect(gone.dirty).toBe(1);
    expect(within(sheet).getAllByRole('button', { name: /^Delete fed at/ })).toHaveLength(1);
    // a real third meal is still one more tap from the sheet
    await tap('Log another meal', sheet);
    expect(await live('fed', chester.id)).toHaveLength(2);
    cleanup();
  });

  it('changes an entry’s time on the same day', async () => {
    const id = store.get().cat!.id;
    render(<DailyTaps />);
    await tap(/Fix today’s entries/);
    const sheet = screen.getByRole('dialog');
    const input = within(sheet).getAllByLabelText(/^Change the time of fed/)[0] as HTMLInputElement;
    const before = (await live('fed', id)).sort((a, b) => b.at - a.at)[0];
    const day = new Date(before.at).toDateString();
    await act(async () => { fireEvent.change(input, { target: { value: '00:05' } }); await settle(); });
    const after = (await rows()).find((c) => c.id === before.id)!;
    expect(hhmm(after.at)).toBe('00:05');
    expect(new Date(after.at).toDateString()).toBe(day);
    expect(after.catId).toBe(id);
    expect(await live('fed', id)).toHaveLength(2);
    cleanup();
  });

  it('works for every kind and for the cat shown', async () => {
    const mochi = await store.saveCat(cat('Mochi'));
    await act(async () => { await store.switchPet(mochi.id); });
    render(<DailyTaps />);
    await tap(/^Scooped\./); await tap(/^Played\./); await tap('All normal');
    await tap(/Fix today’s entries/);
    const sheet = screen.getByRole('dialog', { name: 'Mochi: Today’s quick logs' });
    // only Mochi's entries, not Chester's meals
    expect(within(sheet).queryByRole('button', { name: /^Delete fed/ })).toBeNull();
    for (const name of [/^Delete scooped/, /^Delete played/, /^Delete daily check/]) {
      await act(async () => { fireEvent.click(within(sheet).getByRole('button', { name })); await settle(); });
      await tap(/^Delete$/, sheet);
    }
    for (const what of ['scoop', 'play', 'check']) expect(await live(what, mochi.id)).toEqual([]);
    expect(within(sheet).getByText('Nothing logged today.')).toBeTruthy();
    cleanup();
  });

  it('on Health, lists earlier days too', async () => {
    const id = store.get().cat!.id;
    const yesterday = Date.now() - 864e5;
    await act(async () => { await store.saveCare('daily', { what: 'fed' }, { at: yesterday }); });
    render(<DailyLogSheet days={7} onClose={() => {}} />);
    expect(screen.getByText('Yesterday')).toBeTruthy();
    await tap(/^Delete fed/);
    await tap(/^Delete$/);
    expect((await live('fed', id)).filter((c) => c.at === yesterday)).toEqual([]);
    cleanup();
  });
});
