import { describe, it, expect } from 'vitest';
import { datesIn, parseVetText } from './docparse';

const INVOICE = `Northside Animal Hospital
1200 Main St, Indianapolis IN
INVOICE  #48213        Date: 11/02/2026
Patient: Chester   Species: Feline   Weight: 3.2 lbs
Reason for visit: Kitten vaccines and wellness exam
Exam - Wellness (Kitten)                         $65.00
FVRCP vaccine 11/02/2026  Next due 11/30/2026    $32.00
Revolution Plus 0.25 ml topical                  $24.00
Pyrantel pamoate 5 mg/ml 1 ml oral               $9.00
Reminders:
Rabies due 02/15/2027
Total $130.00`;

describe('reading a vet document with rules', () => {
  it('finds dates in the usual formats', () => {
    expect(datesIn('Seen 11/2/26, due Nov 30, 2026 or 2026-12-01; 3 Jan 2027').map((d) => d.day))
      .toEqual(['2026-11-02', '2026-11-30', '2026-12-01', '2027-01-03']);
    expect(datesIn('Weight 3.2 lbs, $65.00')).toEqual([]);
  });
  it('pulls the visit, weight, vaccines, flea and worm treatment from an invoice', () => {
    const r = parseVetText(INVOICE);
    expect(r.summary).toBe('Northside Animal Hospital · Nov 2, 2026 · 4 items found · 3.2 lb.');
    expect(r).toMatchObject({ title: 'Vet invoice', docDate: '2026-11-02', clinic: 'Northside Animal Hospital', weightLb: 3.2, visitReason: 'Kitten vaccines and wellness exam' });
    expect(r.items.map((i) => [i.kind, i.name, i.date, i.nextDue])).toEqual([
      ['vaccine', 'FVRCP', '2026-11-02', '2026-11-30'],
      ['flea', 'Revolution', '2026-11-02', null],
      ['worm', 'Pyrantel', '2026-11-02', null],
      ['vaccine', 'Rabies', null, '2027-02-15'],
    ]);
  });
  it('converts kilograms and reads a certificate', () => {
    const r = parseVetText('Rabies Vaccination Certificate\nCat Clinic of Carmel\nBody weight 1.8 kg\nVaccinated 03/01/2026 Expires 03/01/2027');
    expect(r.weightLb).toBeCloseTo(3.97, 1);
    expect(r.title).toBe('Vaccine certificate');
    expect(r.items[0]).toMatchObject({ name: 'Rabies', date: '2026-03-01', nextDue: '2027-03-01' });
  });
  it('says so when it finds nothing useful', () => {
    const r = parseVetText('grocery list: milk, eggs');
    expect(r.items).toEqual([]); expect(r.weightLb).toBeNull(); expect(r.summary).toMatch(/no vaccines or medicines found/);
  });
});
