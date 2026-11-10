/* Visits and their paperwork (docs/plans/2026-11-09-vet-redesign.md, steps 3–5): what belongs to a visit (documents,
   doses given, the weight), which visit a document came from, and searching and filtering all documents.
   Links are `visitId` on the doc / med / weight. Older entries have none, so they're also read the other way round:
   a visit's `doc`, and entries saved from the same document as the visit (the document reader puts its id on each). */
import { localDay } from './day';
import type { CareData, CareItem } from './care';

export type DocType = NonNullable<CareData['doc']['type']>;
export type DocFilter = 'all' | 'vet' | 'vaccine' | 'adoption' | 'esa';
export const DOC_FILTERS: [DocFilter, string][] = [['all', 'All'], ['vet', 'Vet'], ['vaccine', 'Vaccines'], ['adoption', 'Adoption'], ['esa', 'ESA']];

const live = <K extends CareItem['kind']>(care: CareItem[], k: K) => care.filter((i): i is CareItem<K> => i.kind === k && !i.deleted);

/** The day a document is about: its own date when the reader found one, else when it was added. */
export const docDay = (d: CareItem<'doc'>) => d.data.docDate ?? localDay(d.at);

/** What kind of paper it is, guessed from its title and the reader's summary (for the Vaccines filter and the summary). */
export function guessDocType(text: string): DocType {
  const t = text.toLowerCase();
  if (/vaccin|rabies|fvrcp|felv vacc|certificate/.test(t)) return 'vaccine';
  if (/discharge|after.?care|post.?op|surgery|neuter|spay/.test(t)) return 'discharge';
  if (/\blab\b|blood|test result|urinalysis|fecal|panel/.test(t)) return 'lab';
  if (/invoice|receipt|bill|statement|total due|amount/.test(t)) return 'invoice';
  return 'other';
}

/** The visit a document belongs to: its `visitId`, else a visit saved from it (`vet.doc`). */
export function visitOfDoc(care: CareItem[], doc: CareItem<'doc'>): CareItem<'vet'> | undefined {
  const vs = live(care, 'vet');
  return (doc.data.visitId ? vs.find((v) => v.id === doc.data.visitId) : undefined) ?? vs.find((v) => v.data.doc === doc.id);
}

/** Everything linked to a visit: its documents, the doses given and the weight (newest weigh-in if there are several). */
export function visitLinks(care: CareItem[], visit: CareItem<'vet'>): { docs: CareItem<'doc'>[]; doses: CareItem<'med'>[]; weight?: CareItem<'weight'> } {
  const fromDoc = visit.data.doc; // entries the reader saved from the same document as this visit
  const docs = live(care, 'doc').filter((d) => d.data.visitId === visit.id || (!d.data.visitId && d.id === fromDoc))
    .sort((a, b) => docDay(b).localeCompare(docDay(a)) || b.at - a.at);
  const mine = (i: CareItem<'med'> | CareItem<'weight'>) => i.data.visitId === visit.id || (!i.data.visitId && !!fromDoc && i.data.doc === fromDoc);
  const doses = live(care, 'med').filter(mine).sort((a, b) => a.data.name.localeCompare(b.data.name));
  const weight = live(care, 'weight').filter(mine).sort((a, b) => b.at - a.at)[0];
  return { docs, doses, weight };
}

/** The filters a document matches (besides All). */
export function docTags(care: CareItem[], doc: CareItem<'doc'>): Set<DocFilter> {
  const tags = new Set<DocFilter>(['all']);
  for (const c of doc.data.categories ?? []) if (c === 'vet' || c === 'esa' || c === 'adoption') tags.add(c);
  const type = doc.data.type ?? guessDocType(`${doc.data.title} ${doc.data.summary ?? ''}`);
  if (type === 'vaccine' || live(care, 'med').some((m) => m.data.what === 'vaccine' && m.data.doc === doc.id)) tags.add('vaccine');
  if (type !== 'other' || visitOfDoc(care, doc)) tags.add('vet');
  return tags;
}

/** All documents, newest first, narrowed by a filter and a search over the title, the reader's summary and the
    linked visit's reason and clinic. Everything stays on the phone. */
export function findDocs(care: CareItem[], q = '', filter: DocFilter = 'all'): CareItem<'doc'>[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  return live(care, 'doc').filter((d) => {
    if (filter !== 'all' && !docTags(care, d).has(filter)) return false;
    if (!words.length) return true;
    const v = visitOfDoc(care, d);
    const hay = [d.data.title, d.data.summary, v?.data.reason, v?.data.clinic, v?.data.notes].filter(Boolean).join(' ').toLowerCase();
    return words.every((w) => hay.includes(w));
  }).sort((a, b) => docDay(b).localeCompare(docDay(a)) || b.at - a.at);
}
