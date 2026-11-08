import { describe, it, expect } from 'vitest';
import { datesIn, parseVetPages, parseVetText } from './docparse';

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
});
