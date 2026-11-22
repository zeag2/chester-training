import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen, act, waitFor } from '@testing-library/react';
import CHART from '../lib/fixtures/hazeldell-chart.txt?raw';
import INVOICE from '../lib/fixtures/hazeldell-invoice.txt?raw';
import { store } from '../db/store';
import { Care, DocAdder } from './Care';
import { ToastHost } from '../ui/Toast';
import type { CareData, CareItem } from '../engine/care';

// the phone's OCR, stubbed: the two pages of Josh's papers (owner details faked)
vi.mock('../lib/ocr', () => ({ textFromFile: async () => [CHART, INVOICE] }));
const noon = (d: string) => Date.parse(d + 'T12:00:00');
const of = <K extends CareItem['kind']>(k: K) => store.get().care.filter((c) => c.kind === k) as CareItem<K>[];
afterEach(() => { cleanup(); location.hash = ''; });

describe('after the visit, part 2', () => {
  it('reads the papers into the visit already logged that day, grouped, with one Undo for the batch', async () => {
    await store.load();
    await store.saveCat({ name: 'Chester', birthday: '2026-04', homeDate: '2026-11-01', breed: '', coat: 'black', eyes: 'gold', rewards: [], outfit: '' });
    const visit = (await store.saveCare('vet', { reason: 'Establish care', status: 'done' }, { at: noon('2026-11-14') }))!;
    await store.saveCare('med', { name: 'FVRCP', what: 'vaccine' }, { at: noon('2026-08-19') });
    await store.settled();
    const before = store.get().care.length;
    const { container } = render(<><DocAdder signedIn={false} /><ToastHost /></>);
    const input = container.querySelector('input[type=file]') as HTMLInputElement;
    await act(async () => { fireEvent.change(input, { target: { files: [new File(['x'], 'papers.pdf', { type: 'application/pdf' })] } }); });
    await screen.findByText('Here’s what it found');
    const text = container.textContent!;
    for (const g of ['Weight', 'Given today · linked to the visit', 'Reminders', 'Past vaccines', 'For next time', 'Details']) expect(text).toContain(g);
    expect(text).not.toContain('Vet visit:'); // it links to the visit, never makes a second one
    // a dose already in the log starts unticked
    const rows = screen.getAllByText('FVRCP · vaccine', { selector: 'b' }).map((b) => b.closest('label')!);
    expect(rows).toHaveLength(2);
    const row = rows.find((r) => r.textContent!.includes('Aug 19'))!;
    expect((rows.find((r) => r.textContent!.includes('Sep 26'))!.querySelector('input') as HTMLInputElement).checked).toBe(true);
    expect(row.textContent).toContain('already logged');
    expect((row.querySelector('input') as HTMLInputElement).checked).toBe(false);
    expect(text).toContain('Cost $273.41 · Dr. Greg McDaniel · Body condition 4/9');

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^Save \d+ things$/ })); });
    expect(await screen.findByText(/Saved \d+ things to Nov 14’s visit/)).toBeTruthy();
    await store.settled();
    const v = of('vet').find((x) => x.id === visit.id)!;
    expect(v.data).toMatchObject({ cost: 273.41, vetName: 'Dr. Greg McDaniel', bcs: '4/9' });
    expect((v.data as CareData['vet']).notes).toMatch(/Sneezing/);
    const felv = of('med').find((m) => m.data.name === 'FeLV')!;
    expect(felv.data).toMatchObject({ visitId: visit.id, nextDue: '2026-12-05' });
    expect(of('weight').map((w) => [w.data.lb, w.data.visitId])).toEqual([[6.98, visit.id]]);
    expect(of('vet').some((x) => x.data.reason === 'Yearly exam' && (x.data as CareData['vet']).status === 'booked')).toBe(true);

    // one Undo takes the whole batch back, and the visit as it was
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Undo' })); });
    await waitFor(() => expect(store.get().care.length).toBe(before));
    expect(of('vet').find((x) => x.id === visit.id)!.data).toEqual({ reason: 'Establish care', status: 'done' });
  });

  it('kitten timeline: a row opens what’s logged; Log it is a separate button', async () => {
    window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia;
    await store.load();
    render(<Care />);
    const felvRow = await screen.findByRole('button', { name: /FeLV \(feline leukemia\): not logged yet/ });
    expect(screen.getByRole('button', { name: 'Log FeLV (feline leukemia)' })).toBeTruthy();
    expect((screen.getByRole('button', { name: /Core vaccine series \(FVRCP\)/ }) as HTMLButtonElement).disabled).toBe(false); // FVRCP is logged
    expect((felvRow as HTMLButtonElement).disabled).toBe(true); // nothing logged: nothing to open
    fireEvent.click(screen.getByRole('button', { name: /Core vaccine series \(FVRCP\).*Open the last one logged/ }));
    expect(await screen.findByText('· Edit Medicine or vaccine')).toBeTruthy();
  });
});
