import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { store } from '../db/store';
import type { CareItem } from '../engine/care';
import { yourVets } from '../engine/vets';

const cal = vi.hoisted(() => ({ downloadIcs: vi.fn() }));
vi.mock('../lib/calendar', async (orig) => ({ ...(await orig<typeof import('../lib/calendar')>()), downloadIcs: cal.downloadIcs }));

import { BookSheet, VisitsCard } from './VetCards';

const tab = { location: { href: '' }, close: vi.fn() };
const flush = () => new Promise((r) => setTimeout(r, 50));
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('book a visit', () => {
  beforeEach(() => { cleanup(); cal.downloadIcs.mockReset(); tab.location.href = ''; vi.stubGlobal('open', vi.fn(() => tab)); });

  it('adds the vet inline (spaces and all), saves it as the household vet, and books with Google', async () => {
    await store.load();
    await store.saveCat({ name: 'Chester', birthday: '2026-04', homeDate: '2026-05-01', breed: 'American Shorthair', coat: 'black', eyes: 'gold', rewards: ['treats'], outfit: '' });
    localStorage.removeItem('paldex-calendar');
    render(<BookSheet onClose={() => {}} />);
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
    expect(screen.getByRole('button', { name: 'Pick a calendar above' }).hasAttribute('disabled')).toBe(true);
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
  });

  it('shows the saved vet instead of "+ Add vet", and preselects the last calendar', async () => {
    render(<BookSheet onClose={() => {}} />);
    expect(screen.getByRole('button', { name: /Maple Street Vet/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByRole('button', { name: 'Add vet' })).toBeNull();
    expect(screen.getByRole('radio', { name: 'Google Calendar' }).getAttribute('aria-checked')).toBe('true');
    // switch to Apple: the .ics, not a Google tab
    await act(async () => { fireEvent.click(screen.getByRole('radio', { name: 'Apple Calendar' })); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save and add to Apple Calendar' })); await flush(); });
    expect(cal.downloadIcs).toHaveBeenCalledTimes(1);
    expect(cal.downloadIcs.mock.calls[0][0]).toMatchObject({ place: '12 Maple St, Springfield' });
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
});
