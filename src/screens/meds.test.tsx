import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen, act, waitFor } from '@testing-library/react';
import { store } from '../db/store';
import { Care, MedsDueCard } from './Care';
import { ToastHost } from '../ui/Toast';
import type { CareItem } from '../engine/care';

afterEach(() => { cleanup(); location.hash = ''; });
const meds = () => store.get().care.filter((c): c is CareItem<'med'> => c.kind === 'med');
const inDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

describe('medicine reminders in the app', () => {
  it('logs a twice-a-day course from the form, then Home offers Given with Undo', async () => {
    window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia;
    await store.load();
    await store.saveCat({ name: 'Chester', birthday: '2026-04', homeDate: '2026-11-01', breed: '', coat: 'black', eyes: 'gold', rewards: [], outfit: '' });
    location.hash = '#/health/log/med';
    render(<Care open="med" />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Clavamox' } });
    fireEvent.click(screen.getByRole('button', { name: 'Other' }));
    fireEvent.click(screen.getByRole('button', { name: 'Twice a day' }));
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true); // needs an end day
    fireEvent.change(screen.getByLabelText('Every day until'), { target: { value: inDays(6) } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })); });
    await waitFor(() => expect(meds()).toHaveLength(1));
    expect(meds()[0].data.course).toEqual({ times: 2, until: inDays(6) });
    cleanup();

    render(<><MedsDueCard /><ToastHost /></>);
    expect(screen.getByRole('region', { name: 'Chester’s medicine today' }).textContent).toContain('1 of 2 today');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Given: Clavamox' })); });
    await waitFor(() => expect(meds()).toHaveLength(2));
    expect(meds().every((m) => m.data.course?.times === 2)).toBe(true);
    expect(screen.queryByRole('region', { name: 'Chester’s medicine today' })).toBeNull(); // both doses given today
    expect(await screen.findByText('Saved · Clavamox for Chester')).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Undo' })); });
    await waitFor(() => expect(meds()).toHaveLength(1));
    expect(screen.getByRole('region', { name: 'Chester’s medicine today' }).textContent).toContain('1 of 2 today');
  });
});
