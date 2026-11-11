import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { store } from '../db/store';
import { reminders, type CareItem } from '../engine/care';
import { localDay } from '../engine/day';
import { visits } from '../engine/vets';
import { icsFor, type CalEvent } from '../lib/calendar';
import { ToastHost } from '../ui/Toast';

const cal = vi.hoisted(() => ({ downloadIcs: vi.fn() }));
vi.mock('../lib/calendar', async (orig) => ({ ...(await orig<typeof import('../lib/calendar')>()), downloadIcs: cal.downloadIcs }));

import { VisitPage } from './VisitPage';

const inDays = (n: number) => localDay(Date.now() + n * 864e5);
const sent = (): CalEvent => cal.downloadIcs.mock.calls.at(-1)![0];
const visit = (id: string) => store.get().care.find((c) => c.id === id) as CareItem<'vet'>;

describe('reschedule and cancel a booked visit', () => {
  beforeEach(() => { cleanup(); cal.downloadIcs.mockReset(); localStorage.setItem('paldex-calendar', 'apple'); vi.stubGlobal('confirm', () => true); });

  it('reschedules: new day and time saved, the .ics re-sent with the same UID and SEQUENCE+1', async () => {
    await store.load();
    await store.saveCat({ name: 'Chester', birthday: '2026-04', homeDate: '2026-05-01', breed: 'American Shorthair', coat: 'black', eyes: 'gold', rewards: ['treats'], outfit: '' });
    const v = (await store.saveCare('vet', { reason: 'Checkup', clinic: 'Maple Street Vet', time: '10:30', status: 'booked' }, { at: Date.parse(inDays(5) + 'T12:00:00') })) as CareItem<'vet'>;
    render(<><VisitPage id={v.id} /><ToastHost /></>);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Reschedule' })); });
    const save = screen.getByRole('button', { name: 'Save new time' });
    expect(save.hasAttribute('disabled')).toBe(true); // nothing changed yet
    await act(async () => { fireEvent.change(screen.getByLabelText('New day'), { target: { value: inDays(9) } }); fireEvent.change(screen.getByLabelText('Time'), { target: { value: '14:00' } }); });
    await act(async () => { fireEvent.click(save); await store.settled(); });
    expect(localDay(visit(v.id).at)).toBe(inDays(9));
    expect(visit(v.id).data).toMatchObject({ time: '14:00', status: 'booked', calSeq: 1 });
    // the calendar is asked, Apple last used first
    expect(screen.getByText('Move it in your calendar?')).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Apple Calendar/ })); });
    const ics = icsFor(sent());
    expect(ics).toContain(`UID:visit-${v.id}@paldex`); expect(ics).toContain('SEQUENCE:1'); expect(ics).toContain('STATUS:CONFIRMED');
    expect(ics).toContain(`DTSTART:${inDays(9).replace(/-/g, '')}T140000`);
    // a second reschedule goes to SEQUENCE:2; clearing the time makes it all-day
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Reschedule' })); });
    await act(async () => { fireEvent.change(screen.getByLabelText('Time'), { target: { value: '' } }); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save new time' })); await store.settled(); });
    expect(visit(v.id).data.time).toBeUndefined();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Apple Calendar/ })); });
    expect(icsFor(sent())).toContain('SEQUENCE:2'); expect(icsFor(sent())).toContain('DTSTART;VALUE=DATE:');
  });

  it('cancels: marked cancelled, STATUS:CANCELLED with no reminders, gone from Coming up; Google says to delete it there', async () => {
    const v = (await store.saveCare('vet', { reason: 'Vaccines', status: 'booked' }, { at: Date.parse(inDays(3) + 'T12:00:00') })) as CareItem<'vet'>;
    expect(reminders(store.get().care).some((r) => r.id === 'visit:' + v.id)).toBe(true);
    render(<><VisitPage id={v.id} /><ToastHost /></>);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cancel visit' })); await store.settled(); });
    expect(visit(v.id).data).toMatchObject({ status: 'cancelled', calSeq: 1 });
    expect(screen.getByText('Cancelled')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Reschedule' })).toBeNull();
    expect(reminders(store.get().care).some((r) => r.id === 'visit:' + v.id)).toBe(false);
    expect(visits(store.get().care).next?.id).not.toBe(v.id);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Apple Calendar/ })); });
    const ics = icsFor(sent());
    expect(ics).toContain(`UID:visit-${v.id}@paldex`); expect(ics).toContain('SEQUENCE:1'); expect(ics).toContain('STATUS:CANCELLED');
    expect(ics).toContain('SUMMARY:Cancelled: Chester: vet (Vaccines)'); expect(ics).not.toContain('VALARM');
    // later, from the page: Remove from calendar, with Google this time (a link can't remove an event)
    vi.stubGlobal('open', vi.fn());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Remove from calendar' })); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Google Calendar/ })); });
    expect(window.open).not.toHaveBeenCalled();
    expect(document.querySelector('.toast')?.textContent).toMatch(/Delete it in Google Calendar/);
    expect(screen.getByRole('button', { name: 'Book again' })).toBeTruthy();
  });
});
