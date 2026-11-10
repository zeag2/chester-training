import { describe, it, expect } from 'vitest';
import { NO_VISIT, docTags, docVisitId, findDocs, guessDocType, visitLinks, visitOfDoc } from './docs';
import type { CareItem } from './care';

const day = (s: string) => Date.parse(s + 'T12:00:00');
const item = (id: string, kind: CareItem['kind'], at: string, data: object, deleted = false): CareItem => ({ id, catId: 'c', kind, at: day(at), updatedAt: 1, deleted, data } as CareItem);
const doc = (id: string, at: string, data: object = {}, deleted = false) => item(id, 'doc', at, { title: id, path: `c/${id}.pdf`, mime: 'application/pdf', bytes: 1, ...data }, deleted) as CareItem<'doc'>;

// a checkup with a linked invoice, a dose and a weight; an older visit saved by the reader from a certificate
const checkup = item('v1', 'vet', '2026-10-20', { reason: 'Checkup + rabies', clinic: 'Maple Street Vet', status: 'done' }) as CareItem<'vet'>;
const neuter = item('v2', 'vet', '2026-09-12', { reason: 'Neuter', doc: 'cert', notes: 'Stitches out in 10 days' }) as CareItem<'vet'>;
const care: CareItem[] = [
  checkup, neuter,
  doc('invoice', '2026-10-20', { visitId: 'v1', summary: 'Exam and nail trim', categories: ['vet'] }),
  doc('cert', '2026-09-12', { title: 'Discharge notes', categories: ['vet'] }),
  doc('esa', '2026-08-01', { title: 'ESA letter', categories: ['esa'] }),
  doc('gone', '2026-10-21', { visitId: 'v1' }, true),
  item('m1', 'med', '2026-10-20', { name: 'Rabies', what: 'vaccine', nextDue: '2027-10-20', visitId: 'v1' }),
  item('m2', 'med', '2026-09-12', { name: 'Meloxicam', what: 'medicine', doc: 'cert' }),
  item('m3', 'med', '2026-09-12', { name: 'FVRCP', what: 'vaccine', doc: 'cert', visitId: 'v1' }), // its visitId wins over the doc
  item('w1', 'weight', '2026-10-20', { lb: 7, visitId: 'v1' }),
  item('w2', 'weight', '2026-09-12', { lb: 6.2, doc: 'cert' }),
];

describe('visit links', () => {
  it('finds the documents, doses and weight of a visit by visitId', () => {
    const l = visitLinks(care, checkup);
    expect(l.docs.map((d) => d.id)).toEqual(['invoice']);
    expect(l.doses.map((d) => d.id)).toEqual(['m3', 'm1']);
    expect(l.weight?.id).toBe('w1');
  });
  it('reads older entries the other way round: the visit’s doc, and entries saved from the same document', () => {
    const l = visitLinks(care, neuter);
    expect(l.docs.map((d) => d.id)).toEqual(['cert']);
    expect(l.doses.map((d) => d.id)).toEqual(['m2']);
    expect(l.weight?.id).toBe('w2');
    expect(visitOfDoc(care, care[3] as CareItem<'doc'>)?.id).toBe('v2');
    expect(visitOfDoc(care, care[4] as CareItem<'doc'>)).toBeUndefined();
  });
});

describe('unlinking a document from its visit ("Not from a visit")', () => {
  const cert = care[3] as CareItem<'doc'>, invoice = care[2] as CareItem<'doc'>, esa = care[4] as CareItem<'doc'>;
  it('works for a document linked only the old way (the visit’s doc)', () => {
    expect(docVisitId(care, cert, '')).toBe(NO_VISIT);
    const unlinked = { ...cert, data: { ...cert.data, visitId: NO_VISIT } };
    const after = care.map((c) => (c.id === cert.id ? unlinked : c));
    expect(visitOfDoc(after, unlinked)).toBeUndefined();
    expect(visitLinks(after, neuter).docs).toEqual([]);
    expect(visitLinks(after, neuter).doses.map((d) => d.id)).toEqual(['m2']); // doses read from it stay with the visit
    expect(docVisitId(after, unlinked, NO_VISIT)).toBe(NO_VISIT); // saved again untouched: stays unlinked
    expect(docVisitId(after, unlinked, 'v1')).toBe('v1'); // and can be linked again
  });
  it('works for a document linked by visitId, and leaves an untouched picker alone', () => {
    expect(docVisitId(care, invoice, '')).toBeUndefined();
    expect(docVisitId(care, invoice, undefined)).toBe('v1');
    expect(docVisitId(care, esa, undefined)).toBeUndefined();
  });
});

describe('all documents', () => {
  it('lists live documents newest first', () => {
    expect(findDocs(care).map((d) => d.id)).toEqual(['invoice', 'cert', 'esa']);
  });
  it('searches the title, the summary and the linked visit', () => {
    expect(findDocs(care, 'nail').map((d) => d.id)).toEqual(['invoice']);
    expect(findDocs(care, 'neuter').map((d) => d.id)).toEqual(['cert']); // the visit's reason
    expect(findDocs(care, 'maple exam').map((d) => d.id)).toEqual(['invoice']);
    expect(findDocs(care, 'letter ESA').map((d) => d.id)).toEqual(['esa']);
    expect(findDocs(care, 'zzz')).toEqual([]);
  });
  it('filters by kind: vaccines from the type, the title or a vaccine read from it', () => {
    expect(findDocs(care, '', 'esa').map((d) => d.id)).toEqual(['esa']);
    expect(findDocs(care, '', 'vet').map((d) => d.id)).toEqual(['invoice', 'cert']);
    expect(findDocs(care, '', 'vaccine').map((d) => d.id)).toEqual(['cert']); // FVRCP was read from it
    expect(docTags(care, doc('x', '2026-01-01', { title: 'Rabies certificate' })).has('vaccine')).toBe(true);
    expect(docTags(care, doc('y', '2026-01-01', { type: 'vaccine' })).has('vet')).toBe(true);
  });
  it('guesses what kind of paper it is', () => {
    expect(guessDocType('Rabies Vaccination Certificate')).toBe('vaccine');
    expect(guessDocType('Discharge instructions after neuter')).toBe('discharge');
    expect(guessDocType('Blood panel results')).toBe('lab');
    expect(guessDocType('Invoice #1234 total due')).toBe('invoice');
    expect(guessDocType('ESA letter')).toBe('other');
  });
});
