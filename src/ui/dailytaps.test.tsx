import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { store } from '../db/store';
import type { CareItem } from '../engine/care';
import { DailyTaps } from './DailyTaps';

const cat = (name: string) => ({ name, birthday: '2026-04', homeDate: '2026-05-01', breed: 'American Shorthair', coat: 'black', eyes: 'gold', rewards: ['treats'], outfit: '' });
const tap = async (name: string | RegExp) => { await act(async () => { fireEvent.click(screen.getByRole('button', { name })); await store.settled(); }); };
const all = async () => (await store.db.care.toArray()) as CareItem[];
const live = async (what: string, catId: string) => (await all()).filter((c) => c.kind === 'daily' && (c.data as { what: string }).what === what && c.catId === catId && !c.deleted) as CareItem<'daily'>[];

// no auto-cleanup without vitest globals: unmount after every test, so one failure can't cascade into the next
afterEach(cleanup);

describe('Quick log taps', () => {
  it('the toast stays about the cat it logged for after switching cats', async () => {
    await store.load();
    const chester = await store.saveCat(cat('Chester'));
    const mochi = await store.saveCat(cat('Mochi'));
    await act(async () => { await store.switchPet(chester.id); });
    render(<DailyTaps />);
    await tap(/^Fed\./);
    await act(async () => { await store.switchPet(mochi.id); });
    expect(screen.getByRole('status').textContent).toContain('Chester: Fed');
    await tap('Mochi too');
    const fed = (await all()).filter((c) => c.kind === 'daily' && (c.data as { what: string }).what === 'fed' && !c.deleted);
    expect(fed.filter((c) => c.catId === chester.id)).toHaveLength(1);
    expect(fed.filter((c) => c.catId === mochi.id)).toHaveLength(1);
    cleanup();
  });
  it('hides the toast while picking what’s off, and Undo after Save takes back the check and the symptoms', async () => {
    render(<DailyTaps />);
    await tap('Something’s off');
    expect(screen.getByText('What’s off?')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
    await tap('Threw up');
    await tap(/^Save/);
    expect(screen.getByRole('status')).toBeTruthy();
    await tap('Undo');
    const live = (await all()).filter((c) => c.catId === store.get().cat!.id && !c.deleted && (c.kind === 'symptom' || (c.kind === 'daily' && (c.data as { what: string }).what === 'check')));
    expect(live).toEqual([]);
    cleanup();
  });
  it('reopens the picker from the status line when the check was closed without saving', async () => {
    render(<DailyTaps />);
    await tap('Something’s off');
    await act(async () => { await store.switchPet(store.get().pets.find((p) => p.id !== store.get().cat!.id)!.id); });
    await act(async () => { await store.switchPet(store.get().pets.find((p) => p.name === 'Mochi')!.id); });
    expect(screen.queryByText('What’s off?')).toBeNull();
    await tap(/What was it\?/);
    expect(screen.getByText('What’s off?')).toBeTruthy();
    cleanup();
  });

  it('Played asks how long and with what, saves it with Saved · Undo, and preselects it next time', async () => {
    const id = store.get().cat!.id;
    render(<DailyTaps />);
    await tap(/^Played\./);
    expect(screen.getByRole('group', { name: 'Playtime' })).toBeTruthy();
    expect(await live('play', id)).toHaveLength(0); // nothing logged until Save
    await tap('10 min'); await tap('Laser dot'); await tap('Save');
    const [p] = await live('play', id);
    expect(p.data).toMatchObject({ what: 'play', minutes: 10, toy: 'laser' });
    expect(screen.getByRole('status').textContent).toContain('Saved · Played 10 min with the laser dot');
    await tap('Undo');
    expect(await live('play', id)).toHaveLength(0);
    // an undone playtime isn't preselected next time; a saved one is (Save is then one tap)
    await tap(/^Played\./);
    expect(screen.getByRole('button', { name: '10 min' }).getAttribute('aria-pressed')).toBe('false');
    await tap('15 min'); await tap('Feather wand'); await tap('Save');
    await tap(/^Played\..*fix today/); await tap('Played again');
    expect(screen.getByRole('button', { name: '15 min' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Feather wand' }).getAttribute('aria-pressed')).toBe('true');
    await tap('Not now');
    expect(screen.queryByRole('group', { name: 'Playtime' })).toBeNull();
    cleanup();
  });
  it('the daily check saves the optional water and appetite chips and shows them once done', async () => {
    const id = store.get().cat!.id;
    for (const c of await live('check', id)) await store.deleteCare(c.id);
    render(<DailyTaps />);
    await tap('More'); await tap('Picky'); await tap('Picky'); await tap('Didn’t eat');
    await tap('All normal');
    const [c] = await live('check', id);
    expect(c.data).toMatchObject({ what: 'check', ok: true, water: 'more', appetite: 'none' });
    expect(screen.getByText(/Water: more · Appetite: didn’t eat/)).toBeTruthy();
    cleanup();
  });
});
