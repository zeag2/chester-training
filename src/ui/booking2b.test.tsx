import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react';
import { store } from '../db/store';
import type { CareItem } from '../engine/care';
import { localDay } from '../engine/day';
import { icsFor, type CalEvent } from '../lib/calendar';
import { ToastHost } from './Toast';

const cal = vi.hoisted(() => ({ downloadIcs: vi.fn() }));
vi.mock('../lib/calendar', async (orig) => ({ ...(await orig<typeof import('../lib/calendar')>()), downloadIcs: cal.downloadIcs }));

import { BookSheet } from './VetCards';
import { VisitPage } from '../screens/VisitPage';

/* Booking part 2b: several cats at once. One visit per cat (each on its own Health), one calendar event
   "Vet: Chester + Luna" keyed by the group, and the visit page's reschedule and cancel change them all. */

const sent = (): CalEvent => cal.downloadIcs.mock.calls.at(-1)![0];
const toast = () => document.querySelector('.toast')?.textContent ?? '';
const booked = async () => (await store.visitGroup(store.get().care.find((c): c is CareItem<'vet'> => c.kind === 'vet' && !c.deleted && (c.data as { status?: string }).status === 'booked')!));
let chester = '', luna = '';

beforeAll(async () => {
  await store.load();
  await store.saveCat({ name: 'Luna', birthday: '2025-09', homeDate: '2025-11-01', breed: 'Tabby', coat: 'tabby', eyes: 'green', rewards: ['treats'], outfit: '' });
  luna = store.get().cat!.id;
  await store.saveCat({ name: 'Chester', birthday: '2026-04', homeDate: '2026-05-01', breed: 'American Shorthair', coat: 'black', eyes: 'gold', rewards: ['treats'], outfit: '' });
  chester = store.get().cat!.id;
  await store.settled();
});
beforeEach(() => { cleanup(); cal.downloadIcs.mockReset(); localStorage.setItem('paldex-calendar', 'apple'); vi.stubGlobal('confirm', () => true); });

describe('book several cats at once', () => {
  it('the header chip is the shown cat; tap it to bring Luna along; one visit each, one event, Undo takes both back', async () => {
    expect(store.get().cat!.name).toBe('Chester');
    render(<><BookSheet onClose={() => {}} /><ToastHost /></>);
    const chip = screen.getByRole('button', { name: /^For Chester, tap to add or remove cats/ });
    await act(async () => { fireEvent.click(chip); });
    const group = screen.getByRole('group', { name: 'Which cats' });
    await act(async () => { fireEvent.click(within(group).getByRole('button', { name: 'Luna' })); });
    expect(screen.getByRole('button', { name: /^For Luna \+ Chester/ })).toBeTruthy();
    expect(screen.getByText('One visit for each cat, one event in your calendar.')).toBeTruthy();
    // the last cat can't be taken off: at least one is always going
    await act(async () => { fireEvent.click(within(group).getByRole('button', { name: 'Luna' })); fireEvent.click(within(group).getByRole('button', { name: 'Chester' })); });
    expect(within(group).getByRole('button', { name: 'Chester' }).getAttribute('aria-pressed')).toBe('true');
    await act(async () => { fireEvent.click(within(group).getByRole('button', { name: 'Luna' })); });

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Other clinic' })); });
    await act(async () => { fireEvent.change(screen.getByLabelText('Clinic name'), { target: { value: 'Maple Street Vet' } }); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '10:30 AM' })); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save and add to Apple Calendar' })); await store.settled(); });

    const visits = await booked();
    expect(visits.map((v) => v.catId).sort()).toEqual([chester, luna].sort());
    const g = visits[0].data.group!;
    expect(g.names).toEqual(['Luna', 'Chester']);
    expect(visits.every((v) => v.data.group?.id === g.id && v.data.time === '10:30' && v.data.reason === 'Checkup')).toBe(true);
    // one .ics for both, keyed by the group
    expect(cal.downloadIcs).toHaveBeenCalledTimes(1);
    const ics = icsFor(sent());
    expect(ics).toContain(`UID:visit-${g.id}@paldex`);
    expect(ics).toContain('SUMMARY:Vet: Luna + Chester');
    expect(ics).toContain('DESCRIPTION:Checkup');
    expect(toast()).toMatch(/^Booked \w{3}, \w{3} \d{1,2}, 10:30 AM · Luna \+ Chester · Added to calendar/);

    // Undo removes both cats' visits
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Undo' })); await store.settled(); });
    expect(toast()).toBe('Visits removed. Delete it from your calendar too.');
    const left = (await store.visitGroup({ ...visits[0] })).length;
    expect(left).toBe(0);
  });

  it('with one cat nothing changes: the event is "Chester: vet (…)" keyed by the visit, no group saved', async () => {
    render(<><BookSheet onClose={() => {}} /><ToastHost /></>);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Other clinic' })); });
    await act(async () => { fireEvent.change(screen.getByLabelText('Clinic name'), { target: { value: 'Maple Street Vet' } }); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save and add to Apple Calendar' })); await store.settled(); });
    const [v] = await booked();
    expect(v.data.group).toBeUndefined();
    const ics = icsFor(sent());
    expect(ics).toContain(`UID:visit-${v.id}@paldex`); expect(ics).toContain('SUMMARY:Chester: vet (Checkup)');
    await store.deleteCare(v.id);
  });
});

describe('a visit booked together reschedules and cancels together', () => {
  it('moves and then cancels both cats’ visits, and re-sends the one event with SEQUENCE+1', async () => {
    const at = Date.parse(localDay(Date.now() + 5 * 864e5) + 'T12:00:00');
    const group = { id: 'grp1', names: ['Chester', 'Luna'] };
    const mine = (await store.saveCare('vet', { reason: 'Vaccines', clinic: 'Maple Street Vet', time: '09:00', status: 'booked', group }, { at })) as CareItem<'vet'>;
    const hers = (await store.saveCare('vet', { reason: 'Vaccines', clinic: 'Maple Street Vet', time: '09:00', status: 'booked', group }, { at, catId: luna })) as CareItem<'vet'>;
    render(<><VisitPage id={mine.id} /><ToastHost /></>);
    expect(screen.getByText(/Booked together with Luna\. Rescheduling or cancelling changes it for both\./)).toBeTruthy();

    const day = localDay(Date.now() + 9 * 864e5);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Reschedule' })); });
    await act(async () => { fireEvent.change(screen.getByLabelText('New day'), { target: { value: day } }); fireEvent.change(screen.getByLabelText('Time'), { target: { value: '14:00' } }); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save new time' })); await store.settled(); });
    let both = await store.visitGroup(mine);
    expect(both).toHaveLength(2);
    for (const v of both) { expect(localDay(v.at)).toBe(day); expect(v.data).toMatchObject({ time: '14:00', status: 'booked', calSeq: 1 }); }
    expect(both.find((v) => v.id === hers.id)!.catId).toBe(luna);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Apple Calendar/ })); });
    let ics = icsFor(sent());
    expect(ics).toContain('UID:visit-grp1@paldex'); expect(ics).toContain('SEQUENCE:1'); expect(ics).toContain('SUMMARY:Vet: Chester + Luna');

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cancel visit' })); await store.settled(); });
    both = await store.visitGroup(mine);
    for (const v of both) expect(v.data).toMatchObject({ status: 'cancelled', calSeq: 2 });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Apple Calendar/ })); });
    ics = icsFor(sent());
    expect(ics).toContain('UID:visit-grp1@paldex'); expect(ics).toContain('SEQUENCE:2'); expect(ics).toContain('STATUS:CANCELLED');
  });
});
