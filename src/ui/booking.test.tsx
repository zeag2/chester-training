import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { store } from '../db/store';
import type { CareItem } from '../engine/care';
import { yourVets } from '../engine/vets';
import { localDay } from '../engine/day';
import { ToastHost } from './Toast';

const cal = vi.hoisted(() => ({ downloadIcs: vi.fn() }));
vi.mock('../lib/calendar', async (orig) => ({ ...(await orig<typeof import('../lib/calendar')>()), downloadIcs: cal.downloadIcs }));

import { BookSheet, VisitsCard } from './VetCards';

const tab = { location: { href: '' }, close: vi.fn() };
const flush = () => store.settled(); // the save's writes, not a fixed time (see HANDOFF, Gotchas)
const toast = () => document.querySelector('.toast')?.textContent ?? '';
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('book a visit', () => {
  beforeEach(() => { cleanup(); cal.downloadIcs.mockReset(); tab.location.href = ''; vi.stubGlobal('open', vi.fn(() => tab)); });

  it('adds the vet inline (spaces and all), saves it as the household vet, and books with Google', async () => {
    await store.load();
    await store.saveCat({ name: 'Chester', birthday: '2026-04', homeDate: '2026-05-01', breed: 'American Shorthair', coat: 'black', eyes: 'gold', rewards: ['treats'], outfit: '' });
    localStorage.removeItem('paldex-calendar');
    render(<><BookSheet onClose={() => {}} /><ToastHost /></>);
    // no vet saved: no free-typed clinic, just "+ Add vet"
    expect(screen.queryByLabelText('Clinic name')).toBeNull();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Add vet' })); });
    // the bug: typing a space was swallowed (the input showed a trimmed value). Every keystroke keeps it now.
    for (const v of ['Maple', 'Maple ', 'Maple S', 'Maple Street ', 'Maple Street Vet']) {
      await act(async () => { type('Vet or clinic name', v); });
      expect((screen.getByLabelText('Vet or clinic name') as HTMLInputElement).value).toBe(v);
    }
    await act(async () => { type('Address (for directions)', '12 Maple St, Springfield '); });
    expect((screen.getByLabelText('Address (for directions)') as HTMLInputElement).value).toBe('12 Maple St, Springfield ');
    await act(async () => { type('Phone', '(555) 010-0100'); });
    // the calendar is asked, not assumed: nothing picked yet, so it can't save
    const save = screen.getByRole('button', { name: 'Save and add to calendar' });
    expect(save.hasAttribute('disabled')).toBe(true);
    // …and says why, read out with the button
    expect(document.getElementById(save.getAttribute('aria-describedby')!)?.textContent).toBe('Pick a calendar above (or Don’t add) to save.');
    await act(async () => { fireEvent.click(screen.getByRole('radio', { name: 'Google Calendar' })); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save and add to Google Calendar' })); await flush(); });

    const { primary } = yourVets(store.get().vets);
    expect(primary?.data).toMatchObject({ kind: 'primary', clinic: 'Maple Street Vet', phone: '(555) 010-0100', address: '12 Maple St, Springfield' });
    const visit = store.get().care.find((c): c is CareItem<'vet'> => c.kind === 'vet' && (c.data as { status?: string }).status === 'booked');
    expect(visit?.data).toMatchObject({ reason: 'Checkup', clinic: 'Maple Street Vet', vetId: primary!.id });
    const u = new URL(tab.location.href);
    expect(u.host).toBe('calendar.google.com');
    expect(u.searchParams.get('action')).toBe('TEMPLATE');
    expect(u.searchParams.get('text')).toBe('Chester: vet (Checkup)');
    expect(u.searchParams.get('location')).toBe('12 Maple St, Springfield');
    expect(u.searchParams.get('details')).toContain('Phone: (555) 010-0100');
    expect(u.searchParams.get('dates')).toMatch(/^\d{8}\/\d{8}$/);
    expect(cal.downloadIcs).not.toHaveBeenCalled();
    expect(localStorage.getItem('paldex-calendar')).toBe('google');
    // the sheet has closed: a toast says what happened
    expect(toast()).toMatch(/^Booked \w{3}, \w{3} \d{1,2} · Added to calendar/);
  });

  it('shows the saved vet instead of "+ Add vet", and preselects the last calendar', async () => {
    render(<BookSheet onClose={() => {}} />);
    expect(screen.getByRole('button', { name: /Maple Street Vet/ }).getAttribute('aria-pressed')).toBe('true');
    // the vet has a phone: Call it at the top
    expect(screen.getByRole('link', { name: 'Call Maple Street Vet' }).getAttribute('href')).toBe('tel:5550100100');
    // a quick time instead of all-day
    expect(screen.getByText('No time picked: it’s added as an all-day event.')).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '10:30 AM' })); });
    expect(screen.getByRole('button', { name: '10:30 AM' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByText('No time picked: it’s added as an all-day event.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Checkup' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByRole('button', { name: 'Add vet' })).toBeNull();
    expect(screen.getByRole('radio', { name: 'Google Calendar' }).getAttribute('aria-checked')).toBe('true');
    // switch to Apple: the .ics, not a Google tab
    await act(async () => { fireEvent.click(screen.getByRole('radio', { name: 'Apple Calendar' })); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save and add to Apple Calendar' })); await flush(); });
    expect(cal.downloadIcs).toHaveBeenCalledTimes(1);
    expect(cal.downloadIcs.mock.calls[0][0]).toMatchObject({ place: '12 Maple St, Springfield', time: '10:30' });
    expect(window.open).not.toHaveBeenCalled();
    expect(localStorage.getItem('paldex-calendar')).toBe('apple');
  });

  it('Add to calendar on the next visit asks Apple or Google, last used first', async () => {
    render(<VisitsCard onOpen={() => {}} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Add to calendar' })); });
    const sheet = screen.getByRole('dialog', { name: 'Add to which calendar?' });
    const buttons = sheet.querySelectorAll('button.btn, button.btn2');
    expect(buttons[0].textContent).toContain('Apple Calendar');
    expect(buttons[0].textContent).toContain('last used');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Google Calendar/ })); });
    expect(window.open).toHaveBeenCalledWith(expect.stringContaining('https://calendar.google.com/calendar/render?action=TEMPLATE'), '_blank');
    expect(screen.queryByRole('dialog', { name: 'Add to which calendar?' })).toBeNull();
    expect(localStorage.getItem('paldex-calendar')).toBe('google');
  });

  it('books a one-off visit at another clinic without changing your vet; no address, no repeated name', async () => {
    render(<BookSheet onClose={() => {}} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Other clinic' })); });
    expect(screen.getByRole('button', { name: /^Save and add to/ }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('Add the clinic’s name to save.')).toBeTruthy();
    await act(async () => { type('Clinic name', 'Night Owl Vet'); type('Phone (optional)', '555 222 3333'); });
    // its phone is the one to call now
    expect(screen.getByRole('link', { name: 'Call Night Owl Vet' }).getAttribute('href')).toBe('tel:5552223333');
    await act(async () => { fireEvent.click(screen.getByRole('radio', { name: 'Google Calendar' })); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save and add to Google Calendar' })); await flush(); });
    expect(yourVets(store.get().vets).primary?.data.clinic).toBe('Maple Street Vet');
    const visit = store.get().care.find((c): c is CareItem<'vet'> => c.kind === 'vet' && (c.data as { clinic?: string }).clinic === 'Night Owl Vet');
    expect(visit?.data).toMatchObject({ phone: '555 222 3333', status: 'booked' });
    expect(visit?.data.vetId).toBeUndefined();
    const u = new URL(tab.location.href);
    expect(u.searchParams.get('location')).toBe('Night Owl Vet');
    expect(u.searchParams.get('details')).toBe('Phone: 555 222 3333');
  });

  it('starts from what is due: reason and date filled in', () => {
    const day = localDay(Date.now() + 20 * 864e5);
    render(<BookSheet onClose={() => {}} preset={{ reason: 'Vaccines', day, notes: 'FVRCP due' }} />);
    expect(screen.getByRole('button', { name: 'Vaccines' }).getAttribute('aria-pressed')).toBe('true');
    expect((screen.getByLabelText('Date') as HTMLInputElement).value).toBe(day);
    expect((screen.getByLabelText('Notes (optional)') as HTMLInputElement).value).toBe('FVRCP due');
    // more than a week out: a reminder a week before as well
    expect(screen.getByText(/reminders a week before, the day before/)).toBeTruthy();
  });

  it('offline with Google: says the link will work once online, saves without a dead tab', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    try {
      render(<><BookSheet onClose={() => {}} /><ToastHost /></>);
      await act(async () => { fireEvent.click(screen.getByRole('radio', { name: 'Google Calendar' })); });
      expect(screen.getByText(/Google Calendar link will work once you’re online/)).toBeTruthy();
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save visit' })); await flush(); });
      expect(window.open).not.toHaveBeenCalled();
      expect(toast()).toContain('Add it to Google Calendar once you’re online');
    } finally { delete (navigator as { onLine?: boolean }).onLine; }
  });

  it('Undo in the toast removes the visit', async () => {
    render(<><BookSheet onClose={() => {}} /><ToastHost /></>);
    await act(async () => { fireEvent.click(screen.getByRole('radio', { name: 'Don’t add' })); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save visit' })); await flush(); });
    const n = () => store.get().care.filter((c) => c.kind === 'vet' && !c.deleted).length;
    const before = n();
    expect(toast()).not.toContain('calendar');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Undo' })); await flush(); });
    expect(n()).toBe(before - 1);
    expect(toast()).toBe('Visit removed.');
  });

  it('a failed save closes the Google tab, shows an error and can be tried again', async () => {
    const spy = vi.spyOn(store, 'saveCare').mockRejectedValueOnce(new Error('disk full'));
    const closed = vi.fn();
    render(<BookSheet onClose={closed} />);
    await act(async () => { fireEvent.click(screen.getByRole('radio', { name: 'Google Calendar' })); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save and add to Google Calendar' })); await flush(); });
    expect(tab.close).toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('Couldn’t save the visit');
    expect(closed).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Save and add to Google Calendar' }).hasAttribute('disabled')).toBe(false);
    spy.mockRestore();
  });
});
