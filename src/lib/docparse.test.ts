import { describe, it, expect } from 'vitest';
import { datesIn, mergeFindings, parseVetPages, parseVetText, type DocFindings } from './docparse';
// A new clinic's chart and invoice (OCR text of real papers; the owner's details are replaced with fakes).
import CHART from './fixtures/hazeldell-chart.txt?raw';
import HZ_INVOICE from './fixtures/hazeldell-invoice.txt?raw';

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

// Shapes taken from a real rescue export (Shelterluv) and clinic certificates, with personal details removed.
const ESA = `Accommodation Request Form
Animal(s) Only
If you or a member of your household has a disability and needs a reasonable accommodation for an animal to
Date of Birth 07/01/1999
The Animal has received all local/state required inoculations. Yes No`;
const ADOPTION = `Paws on my Heart, Inc. Pat Example
Adoption Contract - 11/01/2026
Species Cat
Sex Male
DOB 05/13/2026
Microchip # 941000000000001 (24Petwatch / Pethealth)
- I understand that listed here are some services that are recommended but may NOT be included in the adoption fee:
heartworm prevention, de-worming for tapeworms, flea and tick prevention, any additional vaccinations`;
const HISTORY = `Complete Medical History
Species Cat
Sex Male
Altered Yes
DOB 05/13/2026
Microchip Number Issued Date Microchip Issuer
941000000000001 08/19/2026 24Petwatch / Pethealth
Weight
Weight Date
3 lbs 08/22/2026
Medical Memos
09/25/2026 by A Volunteer
Panacur 8/22-26/26
Panacur 9/5-9/26
0.5ml 1 x day x 5 days
Vaccination History`;
const HISTORY2 = `FVRCP, Chlamydophila
Vanguard Feline RCP+Ch (Zoetis)
09/26/2026 – Completed
Lot # 872568 Route SQ (subcutaneous)
Exp. Date 02/02/2027 Site Interscapular
FVRCP, Chlamydophila
Vanguard Feline RCP+Ch (Zoetis)
08/19/2026 – Completed
Lot # 872568 Route SQ (subcutaneous)
Exp. Date 02/02/2027 Site Interscapular
Treatments
Revolution for cats 5.1-15 lbs
6 % Selamectin topical
0.3 mL Topically once
09/26/2026 – Complete
Capstar Liquid
5.7 mg/mL Capstar oral suspension
Notes: 1ml per 5lbs
08/19/2026 – Complete
Revolution for cats 5.1-15 lbs
0.2 mL Topically once
08/18/2026 – Complete
Diagnostic Tests History
FeLV/FIV test
SNAP FIV/FeLV Combo (IDEXX)
08/19/2026 – Completed
Results FeLV: Negative, FIV: Negative
Test By Cor-Vet Veterinary Clinic`;
const RABIES = `Cor-Vet Veterinary Clinic Fortville
RABIES CERTIFICATE
Patient: Johnny
Sex: Male (neutered)
Birthdate: May 13, 2026 (est.)
Weight: 2.87 Lbs (1.30 kg)
Chip: 941000000000001
Rabies Information
Product: Rescue Rabies
Date Given: Aug 19, 2026
Date Due: Aug 19, 2027
Lot: 849181; Zoetis; Expires Dec 22, 2026
Date: Aug 19, 2026`;
const NEUTER = `Spay/Neuter Certificate
Species Cat
Sex Male
This is to certify that the animal described above was spayed/neutered by Dr. A Vet,
DVM at Cor-Vet Veterinary Clinic on 08/19/2026.`;

describe('reading pet paperwork with rules', () => {
  it('finds dates in the usual formats, but not product size ranges', () => {
    expect(datesIn('Seen 11/2/26, due Nov 30, 2026 or 2026-12-01; 3 Jan 2027; Panacur 8/22-26/26').map((d) => d.day))
      .toEqual(['2026-11-02', '2026-11-30', '2026-12-01', '2027-01-03', '2026-08-22']);
    expect(datesIn('Revolution for cats 5.1-15 lbs, $65.00')).toEqual([]);
  });

  it('reads a vet invoice: visit, weight, doses and a reminder that is not a dose', () => {
    const r = parseVetText(INVOICE);
    expect(r).toMatchObject({ title: 'Vet invoice', docDate: '2026-11-02', clinic: 'Northside Animal Hospital', categories: ['vet'] });
    expect(r.weights).toEqual([{ lb: 3.2, date: '2026-11-02' }]);
    expect(r.visits.map((v) => v.reason)).toEqual(['Kitten vaccines and wellness exam']);
    expect(r.items.map((i) => [i.name, i.date, i.nextDue])).toEqual([
      ['FVRCP', '2026-11-02', '2026-11-30'], ['Revolution', '2026-11-02', null], ['Pyrantel', '2026-11-02', null], ['Rabies', null, '2027-02-15'],
    ]);
    expect(r.summary).toBe('Vet invoice · Nov 2, 2026 · 4 doses, 1 visit or test, 1 weigh-in found.');
  });

  it('reads a mixed packet: sorts the pages, keeps every dose, separates tests and surgery, and finds his profile', () => {
    const r = parseVetPages([ESA, ADOPTION, HISTORY, HISTORY2, RABIES, NEUTER]);
    expect(r.categories).toEqual(['vet', 'adoption', 'esa']);
    expect(r.title).toBe('Medical records, adoption papers and ESA & housing forms');
    expect(r.profile).toEqual({ birthday: '2026-05-13', microchip: '941000000000001', sex: 'm', altered: true, adopted: '2026-11-01', adoptedFrom: 'Paws on my Heart, Inc.' });
    expect(r.weights).toEqual([{ lb: 2.87, date: '2026-08-19' }, { lb: 3, date: '2026-08-22' }]);
    expect(r.items.map((i) => [i.name, i.date, i.nextDue])).toEqual([
      ['Revolution', '2026-08-18', null], ['FVRCP', '2026-08-19', null], ['Capstar', '2026-08-19', null], ['Rabies', '2026-08-19', '2027-08-19'],
      ['Panacur', '2026-08-22', null], ['Panacur', '2026-09-05', null], ['FVRCP', '2026-09-26', null], ['Revolution', '2026-09-26', null],
    ]);
    expect(r.visits).toEqual([
      { reason: 'FeLV/FIV test', date: '2026-08-19', clinic: 'Cor-Vet Veterinary Clinic', notes: 'FeLV: Negative, FIV: Negative' },
      { reason: 'Neuter surgery', date: '2026-08-19', clinic: 'Cor-Vet Veterinary Clinic', notes: null },
    ]);
  });

  it('takes nothing medical or personal from ESA/housing forms alone', () => {
    const r = parseVetPages([ESA]);
    expect(r).toMatchObject({ categories: ['esa'], title: 'ESA & housing forms', profile: {}, items: [], weights: [], visits: [] });
    expect(r.summary).toMatch(/nothing medical to log/);
  });

  it('converts kilograms and reads a certificate with dates on the next lines', () => {
    const r = parseVetText('Rabies Vaccination Certificate\nCat Clinic of Carmel\nPatient: Luna\nBody weight 1.8 kg\nVaccinated 03/01/2026 Expires 03/01/2027');
    expect(r.weights[0].lb).toBeCloseTo(3.97, 1);
    expect(r.items[0]).toMatchObject({ name: 'Rabies', date: '2026-03-01', nextDue: '2027-03-01' });
  });

  describe('Hazel Dell chart and invoice', () => {
    const OWNER = /Sam|Alex|Owner|123 Example|46280|555|owner@example/;
    const visit = (r: DocFindings) => {
      expect(r).toMatchObject({ docDate: '2026-11-14', clinic: 'Hazel Dell Animal Hospital', clinicPhone: '(317) 846-8710' });
      expect(r.categories).toEqual(['vet']);
    };
    it('reads the chart: reminders only from dated rows, last done, history, exam and the pet', () => {
      const r = parseVetText(CHART);
      visit(r);
      expect(r.weights).toEqual([{ lb: 6.98, date: '2026-11-14' }]); // not the blank "Weight: 0lbs." header field
      expect(r.exam).toEqual({ bodyCondition: '4/9', pain: '0/4' });
      expect(r.reminders).toEqual([{ name: 'Rabies', due: '2027-08-19' }, { name: 'FVRCP', due: '2027-09-26' }, { name: 'Physical exam', due: '2027-11-14' }]);
      expect(r.lastDone).toEqual([{ name: 'Physical exam', date: '2026-11-14' }]);
      expect(r.items.map((i) => [i.name, i.date, i.nextDue])).toEqual([['FVRCP', '2026-08-19', null], ['FVRCP', '2026-09-26', null]]);
      expect(r.visits.map((v) => [v.reason, v.date, v.notes])).toEqual([['FeLV/FIV test', '2026-08-19', null], ['Establish care', '2026-11-14', 'Sneezing/coughing, Soft stools']]);
      expect(r.history).toEqual({ problems: ['Vaccinations', 'Occasional sneezing'], notes: ['Sneezing/coughing', 'Soft stools'], diet: 'Fancy Feast Wet and Kitten Dry', meds: 'none' });
      expect(r.pet).toEqual({ name: 'Chester', species: 'Feline', breed: 'American Shorthair', color: 'Black' });
      expect(r.profile).toEqual({ birthday: '2026-04-11', sex: 'm', altered: true });
    });
    it('reads the invoice: what was given, the FeLV follow-up, cost, reminders beside the pet details', () => {
      const r = parseVetText(HZ_INVOICE);
      visit(r);
      expect(r.vet).toBe('Dr. Greg McDaniel');
      expect(r.given).toEqual([
        { name: 'Comprehensive exam', kind: 'exam', notes: null },
        { name: 'Revolution Plus', kind: 'flea', notes: 'Parasite prevention, single dose' },
        { name: 'Pediatric fecal test', kind: 'test', notes: 'Result pending' },
        { name: 'FeLV vaccine', kind: 'vaccine', notes: 'Dose 1 of 2' },
      ]);
      expect(r.followUps).toEqual([{ name: 'FeLV dose 2', from: '2026-12-05', to: '2026-12-12', estimated: true }]);
      expect(r.items.map((i) => [i.name, i.date, i.nextDue])).toEqual([['Revolution', '2026-11-14', null], ['FeLV', '2026-11-14', '2026-12-05']]);
      expect(r.items[1].notes).toBe('Dose 1 of 2; dose 2 due about Dec 5–12 (estimated)');
      expect(r.visits.map((v) => [v.reason, v.notes])).toEqual([['Fecal test', 'Result pending']]);
      expect(r.cost.total).toBe(273.41);
      expect(r.cost.lines.map((l) => [l.code, l.description, l.price, l.care])).toEqual([
        ['E301', 'Examination - Comprehensive', 92.57, true], ['OSHA1', 'OSHA Medical Waste Disposal', 9, false],
        ['M4542', 'Revolution Plus Feline 5.6-11# single', 35.9, true], ['PUPPYF', 'Pediatric Fecal Profile, <1 yr', 75.99, true],
        ['V517', 'Feline Leukemia Vaccine 1st of 2', 59.95, true],
      ]);
      expect(r.reminders).toEqual([{ name: 'Rabies', due: '2027-08-19' }, { name: 'FVRCP', due: '2027-09-26' }, { name: 'Physical exam', due: '2027-11-14' }]);
      expect(r.profile).toEqual({ microchip: '900000000000000', sex: 'm', altered: true });
      expect(r.weights).toEqual([]);
      expect(r.confidence).toMatchObject({ docDate: 'medium', cost: 'high', followUps: 'medium', reminders: 'high' });
    });
    it('merges the two for one visit, dedupes the reminders, and keeps the owner out of everything', () => {
      for (const r of [parseVetPages([CHART, HZ_INVOICE]), mergeFindings(parseVetText(CHART), parseVetText(HZ_INVOICE))]) {
        visit(r);
        expect(r.reminders).toEqual([{ name: 'Rabies', due: '2027-08-19' }, { name: 'FVRCP', due: '2027-09-26' }, { name: 'Physical exam', due: '2027-11-14' }]);
        expect(r.weights).toEqual([{ lb: 6.98, date: '2026-11-14' }]);
        expect(r.given.map((g) => g.name)).toEqual(['Comprehensive exam', 'Revolution Plus', 'Pediatric fecal test', 'FeLV vaccine']);
        expect(r.followUps).toHaveLength(1);
        expect(r.cost.total).toBe(273.41);
        expect(r.profile).toEqual({ birthday: '2026-04-11', microchip: '900000000000000', sex: 'm', altered: true });
        expect(r.items.map((i) => [i.name, i.date])).toEqual([['FVRCP', '2026-08-19'], ['FVRCP', '2026-09-26'], ['Revolution', '2026-11-14'], ['FeLV', '2026-11-14']]);
        expect(r.confidence).toMatchObject({ docDate: 'high', clinic: 'high', vet: 'high', weight: 'high', bodyCondition: 'high', pain: 'high', cost: 'high' });
        // the microchip lives on the pet only; nothing of the owner's anywhere
        const { profile: _p, ...shared } = r;
        expect(JSON.stringify(shared)).not.toMatch(/900000000000000/);
        expect(JSON.stringify(r)).not.toMatch(OWNER);
      }
    });
  });
});
