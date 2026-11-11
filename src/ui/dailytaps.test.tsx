import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { store } from '../db/store';
import type { CareItem } from '../engine/care';
import { DailyTaps } from './DailyTaps';

const cat = (name: string) => ({ name, birthday: '2026-04', homeDate: '2026-05-01', breed: 'American Shorthair', coat: 'black', eyes: 'gold', rewards: ['treats'], outfit: '' });
const tap = async (name: string | RegExp) => { await act(async () => { fireEvent.click(screen.getByRole('button', { name })); await store.settled(); }); };
const all = async () => (await store.db.care.toArray()) as CareItem[];

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
});
