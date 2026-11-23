import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { store } from '../db/store';
import type { CareItem } from '../engine/care';
import { VisitPage } from './VisitPage';
import { Documents } from './Documents';

const noon = (day: string) => Date.parse(day + 'T12:00:00');

describe('visit page and all documents', () => {
  it('shows a visit with its notes, doses, weight and documents, and logs a dose to it', async () => {
    await store.load();
    await store.saveCat({ name: 'Chester', birthday: '2026-04', homeDate: '2026-05-01', breed: 'American Shorthair', coat: 'black', eyes: 'gold', rewards: ['treats'], outfit: '' });
    const v = (await store.saveCare('vet', { reason: 'Checkup + rabies', clinic: 'Maple Street Vet', notes: 'Healthy, 7.0 lb.', status: 'done' }, { at: noon('2026-10-20') })) as CareItem<'vet'>;
    await store.saveCare('med', { name: 'Rabies', what: 'vaccine', nextDue: '2027-10-20', visitId: v.id }, { at: noon('2026-10-20') });
    await store.saveCare('weight', { lb: 7, visitId: v.id }, { at: noon('2026-10-20') });
    await store.saveCare('doc', { title: 'Visit invoice', path: 'c/inv.pdf', mime: 'application/pdf', bytes: 1, visitId: v.id }, { at: noon('2026-10-20') });
    await store.saveCare('doc', { title: 'ESA letter', path: 'c/esa.pdf', mime: 'application/pdf', bytes: 1, categories: ['esa'] }, { at: noon('2026-08-01') });
    render(<VisitPage id={v.id} />);
    expect(screen.getByRole('heading', { name: 'Checkup + rabies' })).toBeTruthy();
    expect(screen.getByText('Healthy, 7.0 lb.')).toBeTruthy();
    expect(screen.getByText('Rabies')).toBeTruthy();
    expect(screen.getByText('7 lb')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open Visit invoice' })).toBeTruthy();
    expect(screen.queryByText('ESA letter')).toBeNull();
    // a dose logged from here is linked to the visit and dated on its day
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Dose or vaccine' })); });
    expect((screen.getByLabelText('Date') as HTMLInputElement).value).toBe('2026-10-20');
    await act(async () => { fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'FVRCP' } }); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })); await store.settled(); });
    expect(store.get().care.find((c) => c.kind === 'med' && (c.data as { name: string }).name === 'FVRCP')?.data).toMatchObject({ visitId: v.id });
    expect(screen.getByText('FVRCP')).toBeTruthy();
  });
  it('a booking whose day has passed asks once how it went, not twice', async () => {
    cleanup();
    const v = (await store.saveCare('vet', { reason: 'Checkup', status: 'booked' }, { at: Date.now() - 3 * 864e5 })) as CareItem<'vet'>;
    render(<VisitPage id={v.id} />);
    expect(screen.getByText(/How did Chester’s visit go\?/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add what the vet said' })).toBeNull();
    expect(screen.getByText('Booked')).toBeTruthy();
  });
  it('shows two panes at 1100 px and up (details and actions left; doses, weight and documents right), one column on phones', async () => {
    const v = store.get().care.find((c) => c.kind === 'vet' && (c.data as { reason: string }).reason === 'Checkup + rabies')!;
    const real = window.matchMedia;
    const media = (w: number) => { window.matchMedia = ((q: string) => ({ matches: w >= Number(/min-width:\s*(\d+)px/.exec(q)?.[1] ?? 0), media: q, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia; };
    try {
      cleanup(); media(390);
      const phone = render(<VisitPage id={v.id} />);
      expect(phone.container.querySelector('.healthcols')).toBeNull();
      cleanup(); media(1440);
      const desk = render(<VisitPage id={v.id} />);
      const [left, right] = [...desk.container.querySelectorAll('.healthcols > .healthcol')] as HTMLElement[];
      expect(left.querySelector('h1')?.textContent).toBe('Checkup + rabies');
      expect(left.textContent).toContain('Healthy, 7.0 lb.');
      expect(left.textContent).toContain('Edit visit');
      expect(right.textContent).toContain('Rabies');
      expect(right.textContent).toContain('7 lb');
      expect(right.querySelector('[aria-label="Open Visit invoice"]')).toBeTruthy();
      expect(left.textContent).not.toContain('Documents');
    } finally { window.matchMedia = real; cleanup(); }
  });
  it('searches and filters all documents', async () => {
    cleanup();
    render(<Documents />);
    expect(screen.getByRole('button', { name: 'Open Visit invoice' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open ESA letter' })).toBeTruthy();
    await act(async () => { fireEvent.change(screen.getByLabelText('Search documents'), { target: { value: 'maple' } }); });
    expect(screen.getByRole('button', { name: 'Open Visit invoice' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Open ESA letter' })).toBeNull();
    await act(async () => { fireEvent.change(screen.getByLabelText('Search documents'), { target: { value: '' } }); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'ESA' })); });
    expect(screen.queryByRole('button', { name: 'Open Visit invoice' })).toBeNull();
    expect(screen.getByText('1 of 2')).toBeTruthy();
  });
});
