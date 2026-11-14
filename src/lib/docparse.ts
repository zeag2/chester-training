/* Reads the text of pet paperwork (from OCR or a PDF) with plain rules, page by page. No AI, no network.
   Finds: what kind of paperwork each page is (vet record, ESA/housing, adoption), the pet's profile details
   (birthday, microchip, sex, neutered, adoption date), weigh-ins, every vaccine / flea / dewormer / medicine dose
   with its next-due date, tests with results, and surgeries. Only what's written; unknown stays empty. */
import type { MedWhat } from '../engine/care';

export type DocCategory = 'vet' | 'esa' | 'adoption' | 'other';
export type Confidence = 'high' | 'medium' | 'low';
/** A priced line on an invoice. `care: false` for things like waste disposal (kept in the total, not logged). */
export interface ChargeLine { code: string | null; description: string; qty: number | null; price: number; care: boolean }
/** What was given or done at this visit (from the invoice lines). */
export interface GivenItem { name: string; kind: MedWhat | 'test' | 'exam'; notes: string | null }
/** A follow-up the papers imply but don't date (e.g. a vaccine's 2nd dose 3–4 weeks later). */
export interface FollowUp { name: string; from: string; to: string; estimated: boolean }
/** Fields the "After the visit" review can flag for a second look. */
export type ConfidenceKey = 'docDate' | 'clinic' | 'clinicPhone' | 'vet' | 'weight' | 'bodyCondition' | 'pain' | 'given' | 'followUps' | 'reminders' | 'lastDone' | 'cost' | 'pet' | 'history';
export interface DocFindings {
  title: string;
  categories: DocCategory[];
  docDate: string | null;
  clinic: string | null;
  profile: { birthday?: string; microchip?: string; sex?: 'm' | 'f'; altered?: boolean; adopted?: string; adoptedFrom?: string };
  weights: { lb: number; date: string | null }[];
  items: { name: string; kind: MedWhat; date: string | null; nextDue: string | null; notes: string | null }[];
  visits: { reason: string; date: string | null; clinic: string | null; notes: string | null }[];
  summary: string;
  /** The clinic's own phone (never the owner's) and the vet's name. */
  clinicPhone: string | null;
  vet: string | null;
  /** The pet as written on the papers. The microchip stays in `profile` (the pet's record), never in shared summaries. */
  pet: { name?: string; species?: string; breed?: string; color?: string };
  exam: { bodyCondition?: string; pain?: string };
  given: GivenItem[];
  followUps: FollowUp[];
  /** Next due, from the papers' reminder lists (only rows with a date). */
  reminders: { name: string; due: string }[];
  lastDone: { name: string; date: string }[];
  history: { problems: string[]; notes: string[]; diet: string | null; meds: string | null };
  cost: { total: number | null; lines: ChargeLine[] };
  confidence: Partial<Record<ConfidenceKey, Confidence>>;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => (m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${pad(m)}-${pad(d)}` : null);
const year = (y: number) => (y < 100 ? 2000 + y : y);
export const niceDay = (day: string) => { const [y, m, d] = day.split('-').map(Number); return `${MONTHS[m - 1][0].toUpperCase()}${MONTHS[m - 1].slice(1)} ${d}, ${y}`; };

interface Found { day: string; at: number; end: number }
/** Every date in a line, in order: 11/02/2026, 11-2-26, 2026-11-02, Nov 2, 2026, 2 Nov 2026, and ranges like 8/22-26/26 (start day). */
export function datesIn(line: string): Found[] {
  const out: Found[] = [];
  const push = (day: string | null, m: RegExpMatchArray) => { if (day && +day.slice(0, 4) >= 2000 && +day.slice(0, 4) <= 2100) out.push({ day, at: m.index!, end: m.index! + m[0].length }); };
  for (const m of line.matchAll(/\b(\d{1,2})\/(\d{1,2})-\d{1,2}\/(\d{2}|\d{4})\b/g)) push(iso(year(+m[3]), +m[1], +m[2]), m);
  for (const m of line.matchAll(/\b(\d{4})([-/.])(\d{1,2})\2(\d{1,2})\b/g)) push(iso(+m[1], +m[3], +m[4]), m);
  for (const m of line.matchAll(/\b(\d{1,2})([-/.])(\d{1,2})\2(\d{2}|\d{4})\b/g)) push(iso(year(+m[4]), +m[1], +m[3]), m); // US month/day, same separator twice
  for (const m of line.matchAll(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/gi)) push(iso(+m[3], MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1, +m[2]), m);
  for (const m of line.matchAll(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?,?\s+(\d{4})\b/gi)) push(iso(+m[3], MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1, +m[1]), m);
  return out.sort((a, b) => a.at - b.at).filter((d, i, a) => !i || d.at >= a[i - 1].end);
}

/** Known products by kind. Names are shown as written here. */
const PRODUCTS: [MedWhat, string, RegExp][] = [
  ['vaccine', 'FVRCP', /\bF\s?V\s?R\s?C\s?P\b|\bFVR[\s-]?C[\s-]?P\b|\bRCP\b|distemper|panleuk/i],
  ['vaccine', 'Rabies', /\brabies\b|purevax\s*r/i],
  ['vaccine', 'FeLV', /\bfelv\b|feline\s+leuk|leukemia/i],
  ['flea', 'Revolution', /revolution/i], ['flea', 'Bravecto', /bravecto/i], ['flea', 'Frontline', /frontline/i],
  ['flea', 'Advantage', /advantage/i], ['flea', 'Credelio', /credelio/i], ['flea', 'Cheristin', /cheristin/i],
  ['flea', 'Capstar', /capstar/i], ['flea', 'Seresto', /seresto/i], ['flea', 'NexGard', /nexgard/i], ['flea', 'Selarid', /selarid/i],
  ['flea', 'Flea treatment', /flea\s*(?:&|and)?\s*(?:tick)?\s*(?:prevent|treat|control|med)/i],
  ['worm', 'Pyrantel', /pyrantel|strongid/i], ['worm', 'Drontal', /drontal/i], ['worm', 'Profender', /profender/i],
  ['worm', 'Panacur', /panacur|fenbendazole/i], ['worm', 'Praziquantel', /praziquantel|droncit/i], ['worm', 'Centragard', /centragard/i],
  ['worm', 'Dewormer', /de-?worm/i],
  ['medicine', 'Clavamox', /clavamox|amoxi(?:cillin)?[\s-]*clav/i], ['medicine', 'Amoxicillin', /amoxicillin/i],
  ['medicine', 'Convenia', /convenia/i], ['medicine', 'Metronidazole', /metronidazole/i], ['medicine', 'Gabapentin', /gabapentin/i],
  ['medicine', 'Onsior', /onsior|robenacoxib/i], ['medicine', 'Meloxicam', /meloxicam|metacam/i], ['medicine', 'Cerenia', /cerenia|maropitant/i],
  ['medicine', 'Buprenorphine', /buprenorphine|simbadol/i], ['medicine', 'Prednisolone', /prednisolone/i], ['medicine', 'Famciclovir', /famciclovir/i],
];
const TEST = /\b(test|snap|combo|result|negative|positive|panel|fecal|bloodwork|cbc)\b/i;
const productOf = (l: string) => (TEST.test(l) ? undefined : PRODUCTS.find(([, , re]) => re.test(l)));
/** Vial lots and their expiry dates are not due dates; tag and brand fields are not doses. */
const LOT = /\b(lot|exp\.?\s*date|vial|serial|tag|brand\s+name)\b/i; // also the empty "Rabies Tag:" fields on charts
const DUE = /\b(next|due|booster|recheck|repeat|revaccinat|valid\s+until|expir\w*)/i;
const NOT_A_VISIT_DATE = /\b(dob|birth\w*|born|age|issued|exp|lot)\b/i;
const CLINIC = /(veterinary|animal\s+hospital|animal\s+clinic|vet\s+clinic|pet\s+hospital|cat\s+(?:clinic|hospital)|feline\s+(?:clinic|hospital)|animal\s+care|\bvca\b|banfield|vet\s+center)/i;
const RESCUE = /\b(rescue|shelter|humane\s+society|spca|adoption\s+center)\b|paws\s+on\s+my\s+heart/i;

function classify(page: string): DocCategory {
  if (/emotional\s+support|assistance\s+animal|reasonable\s+accommodation|accommodation\s+(request|application)|fair\s+housing|service\s+animal|healthcare\s+provider\s+form/i.test(page)) return 'esa';
  if (/adoption\s+(contract|agreement)|adoptee|transaction\s+receipt|adoption\s+fee/i.test(page)) return 'adoption';
  if (/vaccin|rabies|treatment|medical|veterinar|exam|neuter|spay|weight|\bdvm\b|patient/i.test(page)) return 'vet';
  return 'other';
}

function pageDate(lines: string[]): { day: string | null; labelled: boolean } {
  const labelled = lines.find((l) => /\b(date|visit|invoice|service|exam|given)\b/i.test(l) && !DUE.test(l) && !NOT_A_VISIT_DATE.test(l) && datesIn(l).length);
  if (labelled) return { day: datesIn(labelled)[0].day, labelled: true };
  return { day: lines.filter((l) => !NOT_A_VISIT_DATE.test(l) && !LOT.test(l)).flatMap((l) => datesIn(l))[0]?.day ?? null, labelled: false };
}

/** Names used in reminder lists, as shown. */
const REMINDER_NAMES: [string, RegExp][] = [['Rabies', /rabies/i], ['FVRCP', /fvrcp|distemper/i], ['FeLV', /felv|leuk/i], ['Physical exam', /physical\s+exam|wellness/i],
  ['Fecal test', /fecal/i], ['Medical release', /medical\s+release/i], ['Solensia', /solensia/i], ['Dental', /dental/i], ['Heartworm test', /heartworm/i]];
const reminderName = (s: string) => REMINDER_NAMES.find(([, re]) => re.test(s))?.[0] ?? s.replace(/\s+/g, ' ').trim();
const addDays = (day: string, n: number) => { const d = new Date(day + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const PHONE = /\(\d{3}\)\s*\d{3}-\d{4}|\b\d{3}[-.]\d{3}[-.]\d{4}\b/;
const PERSONAL = /\b[hwc]\s*:|phone|cell|mobile|fax|e-?mail|client|owner|address/i;
const NOT_CARE = /\b(osha|waste|disposal|tax|discount|fee|surcharge|biohazard)\b/i;
/** Which reminder-list rows on an invoice are "Name: date" next to other fields (Species: Feline Physical Exam : 11/14/2027). */
const INLINE_REMINDER = /([A-Za-z][A-Za-z ]*?(?:vaccine|exam|fvrcp|felv|rabies|fecal|dental|heartworm)[A-Za-z ]*?)\s*:\s*(\d{1,2}\/\d{1,2}\/\d{4})/gi;

function parsePage(text: string, out: DocFindings) {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (!lines.length) return;
  const cat = classify(text);
  if (!out.categories.includes(cat)) out.categories.push(cat);
  // lines that belong to a reminder list are never doses or the visit's date
  const skip = new Set<number>();
  const reminders: { name: string; due: string }[] = [];
  const remStart = lines.findIndex((l) => /^reminders?\s+(for\b|list\b|due\b)/i.test(l));
  if (remStart >= 0) {
    skip.add(remStart);
    for (let i = remStart + 1; i < lines.length && !/^(medical\s+history|history|problems?|exam|assessment|plan|vaccines?\s+given)\b/i.test(lines[i]); i++) {
      skip.add(i);
      const l = lines[i], ds = datesIn(l);
      const lead = /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/.test(l) ? ds[0] : undefined;
      const tail = ds.find((d) => d !== lead && d.end === l.length);
      const name = reminderName(l.slice(lead ? lead.end : 0, tail ? tail.at : l.length));
      if (lead) reminders.push({ name, due: lead.day }); // the date column belongs to the item on its row
      if (tail && !out.lastDone.some((x) => x.name === name && x.date === tail.day)) out.lastDone.push({ name, date: tail.day });
    }
  }
  const inline: { i: number; name: string; due: string }[] = [];
  for (const [i, l] of lines.entries()) for (const m of l.matchAll(INLINE_REMINDER)) {
    if (m.index! > 0) inline.push({ i, name: reminderName(m[1]), due: datesIn(m[2])[0]?.day ?? '' }); // only beside other fields, never a line of its own
  }
  const pd = pageDate(lines.filter((_, i) => !skip.has(i) && !inline.some((x) => x.i === i)));
  const date = pd.day;
  for (const r of inline) if (r.due && (!date || r.due > date)) { skip.add(r.i); reminders.push({ name: r.name, due: r.due }); }
  if (cat === 'vet') {
    for (const r of reminders) if (!out.reminders.some((x) => x.name === r.name && x.due === r.due)) out.reminders.push(r);
    if (date) (out as Internal)._dates.push({ day: date, labelled: pd.labelled });
    out.docDate ??= date;
  }
  const clinicLine = lines.find((l) => CLINIC.test(l) && l.length <= 60);
  let clinic = clinicLine ? clinicLine.replace(/^(test\s+by|clinic|hospital)\s*:?\s*/i, '').replace(/[|•·].*$/, '').trim() : null;
  // a name split over two lines ("Hazel Dell" / "Animal Hospital")
  if (clinic && clinicLine && new RegExp('^' + CLINIC.source + '$', 'i').test(clinic)) {
    const prev = lines[lines.indexOf(clinicLine) - 1];
    if (prev && prev.length <= 30 && !/\d|:/.test(prev)) clinic = prev + ' ' + clinic;
  }
  if (clinic && cat === 'vet') out.clinic ??= clinic;
  const joined = lines.join(' ');
  if (cat === 'vet') {
    // the clinic's phone: in the letterhead, never a labelled (owner's) phone line
    const stop = lines.findIndex((l) => /client|owner|bill\s+to|\bname\s*:/i.test(l));
    const ph = lines.slice(0, Math.min(stop < 0 ? 10 : stop, 10)).find((l) => PHONE.test(l) && !PERSONAL.test(l));
    if (ph) out.clinicPhone ??= ph.match(PHONE)![0].replace(/\)\s*/, ') ');
    const dr = joined.match(/\b(?:Dr\.?|Doctor)\s+([A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){0,2})/);
    if (dr) out.vet ??= 'Dr. ' + dr[1].replace(/\s+(Total|Invoice|Date|Signature|DVM)\b.*$/, '');
  }

  // the pet's own details: only on pages about the pet, never from the people on ESA/housing forms
  if (cat !== 'esa' && /\b(species|breed|patient|feline|canine|microchip)\b/i.test(text)) {
    const dobLine = lines.find((l) => /\b(dob|birth\s*date|date\s+of\s+birth|birthdate|birthday|born)\b/i.test(l) && datesIn(l).length);
    if (dobLine) out.profile.birthday ??= datesIn(dobLine)[0].day;
    const chip = joined.match(/\b(?:micro\s*chip(?:\s*(?:#|no\.?|number))?|chip)\s*:?\s*(\d{9,15})\b/i) ?? joined.match(/\b(9\d{14})\b/);
    if (chip) out.profile.microchip ??= chip[1];
    const sex = joined.match(/\bsex\s*:?\s*(male|female|mn|mc|fs|m|f)\b/i);
    if (sex) out.profile.sex ??= /^f/i.test(sex[1]) ? 'f' : 'm';
    if (/\baltered\s*:?\s*yes\b|\((neutered|spayed)\)|\bwas\s+(spayed|neutered)|\bsex\s*:?\s*(mn|mc|fs|male\s+neutered|female\s+spayed)\b/i.test(joined)) out.profile.altered = true;
    if (cat === 'vet') {
      const name = joined.match(/\bname\s*:\s*([A-Z][\w'’-]*)\s+species\b/i)?.[1] ?? text.match(/^([A-Z][\w'’-]+)\s+\(#\s*\w+\)/m)?.[1];
      if (name) out.pet.name ??= name;
      const species = joined.match(/\bspecies\s*:\s*([A-Za-z]+)/i)?.[1]; if (species) out.pet.species ??= species;
      const breed = text.match(/\bbreed\s*:\s*([A-Za-z][A-Za-z -]*?)\s*(?=$|\b[A-Za-z]+\s*:)/im)?.[1]; if (breed) out.pet.breed ??= breed.trim();
      const color = text.match(/\b(?:coat\s+)?colou?r\s*:?\s*([A-Za-z]+(?:\s*\/\s*[A-Za-z]+)?)/i)?.[1]; if (color && !/weight/i.test(color)) out.pet.color ??= color;
    }
  }
  if (cat === 'adoption') {
    const adopted = lines.find((l) => /adoption\s+(contract|agreement)|transaction\s+receipt/i.test(l) && datesIn(l).length);
    if (adopted) out.profile.adopted ??= datesIn(adopted)[0].day;
    const from = lines.find((l) => RESCUE.test(l));
    if (from) out.profile.adoptedFrom ??= (from.match(/^(.*?\b(?:inc\.?|rescue|shelter|society|spca)\b\.?)/i)?.[1] ?? from).trim();
  }
  if (cat !== 'vet') return; // nothing medical is taken from ESA or adoption wording

  // weigh-ins: lines labelled weight, or rows under a "Weight" table header; never a product's size range
  // the exam: body condition and pain scores
  const bcs = joined.match(/\b(?:BCS|body\s+condition(?:\s+score)?)\s*[-:]?\s*(\d)\s*\/\s*(9|5)\b/i); if (bcs) out.exam.bodyCondition ??= `${bcs[1]}/${bcs[2]}`;
  const pain = joined.match(/\bpain(?:\s+(?:assessment|score))?\s*[-:]?\s*(\d)\s*\/\s*(\d{1,2})\b/i); if (pain) out.exam.pain ??= `${pain[1]}/${pain[2]}`;

  // "Previous Vaccines:" FVRCP: 8/19/26, 9/26/26 → one dose per date
  const prevAt = lines.findIndex((l) => /^previous\s+vaccin\w*\s*:?$/i.test(l));
  if (prevAt >= 0) for (let i = prevAt + 1; i < lines.length && /^[^:]{2,40}:\s*\S/.test(lines[i]) && datesIn(lines[i]).length; i++) {
    const hit = productOf(lines[i]); if (!hit) continue;
    skip.add(i);
    for (const d of datesIn(lines[i])) if (!out.items.some((x) => x.name === hit[1] && x.date === d.day)) out.items.push({ name: hit[1], kind: hit[0], date: d.day, nextDue: null, notes: 'From history' });
  }

  for (const [i, l] of lines.entries()) {
    if (skip.has(i)) continue;
    const m = l.match(/(\d{1,2}(?:\.\d{1,2})?)\s*(lbs?|pounds?|kg|kilograms?)\b/i); if (!m) continue;
    if (productOf(l) || /\d\s*-\s*\d/.test(l) || /\bper\b/i.test(l)) continue;
    const header = /\bweight\b/i.test(lines[i - 1] ?? '') && !/\d/.test(lines[i - 1] ?? '');
    if (!/\b(weight|wt)\b/i.test(l) && !header) continue;
    const lb = Math.round(Number(m[1]) * (/^k/i.test(m[2]) ? 2.20462 : 1) * 100) / 100;
    if (lb > 0.2 && lb < 40) { const d = datesIn(l)[0]?.day ?? date; if (!out.weights.some((w) => w.date === d)) out.weights.push({ lb, date: d }); }
  }

  // doses: each product line, then the next few lines (until another product) for its given and due dates
  const undated = new Set<string>();
  for (const [i, l] of lines.entries()) {
    if (skip.has(i)) continue;
    const hit = productOf(l); if (!hit || LOT.test(l)) continue;
    const [kind, name] = hit;
    const win = [l];
    for (let j = i + 1; j < Math.min(lines.length, i + 7) && !skip.has(j); j++) {
      const p = productOf(lines[j]);
      if (p && (p[1] !== name || datesIn(lines[j]).length || datesIn(win.join(' ')).length)) break;
      win.push(lines[j]);
    }
    let given: string | null = null, due: string | null = null;
    for (const w of win) {
      if (LOT.test(w)) continue;
      const ds = datesIn(w); if (!ds.length) continue;
      const k = w.search(DUE);
      if (k >= 0) { due ??= ds.find((d) => d.at > k)?.day ?? ds[ds.length - 1].day; given ??= ds.find((d) => d.at < k)?.day ?? null; }
      else if (!NOT_A_VISIT_DATE.test(w)) { given ??= ds[0].day; if (ds.length >= 2 && w === l) due ??= ds[1].day; }
      if (given && due) break;
    }
    if (due && given && due <= given) due = null;
    if (!given && !due) { undated.add(name + '|' + kind); continue; }
    const reminder = !given && !!due;
    const text = win.join(' ');
    const course = /x\s*\d+\s*days?|\d+\s*-\s*day/i.test(lines.slice(i, i + 4).join(' ')) || /\/\d{1,2}-\d{1,2}\//.test(l) ? 'Multi-day course' : null;
    const dose = text.match(/\b\d+(?:\.\d+)?\s*(?:mg|ml|mL)\b[^,;]{0,30}/)?.[0]?.trim() ?? null;
    const item = { name, kind, date: reminder ? null : given, nextDue: due, notes: reminder ? 'Reminder: not given on this visit' : course ?? (kind === 'medicine' ? dose : null) };
    const same = out.items.find((x) => x.name === item.name && x.date === item.date && (item.date !== null || x.nextDue === item.nextDue));
    if (same) same.nextDue ??= item.nextDue; else out.items.push(item);
  }
  // a product named with no date anywhere near it: log it on the page's date, if the page has one
  for (const u of undated) {
    const [name, kind] = u.split('|') as [string, MedWhat];
    if (!out.items.some((x) => x.name === name) && date) out.items.push({ name, kind, date, nextDue: null, notes: null });
  }

  // tests with their results
  for (const [i, l] of lines.entries()) {
    if (skip.has(i) || !/\b(felv|fiv)\b.*\btest\b|\btest\b.*\b(felv|fiv)\b|heartworm\s+test|fecal\s+(exam|test|profile|panel)/i.test(l)) continue;
    const win = lines.slice(i, i + 6);
    const d = win.flatMap((w) => (LOT.test(w) ? [] : datesIn(w)))[0]?.day ?? date;
    const reason = /felv|fiv/i.test(l) ? 'FeLV/FIV test' : /heartworm/i.test(l) ? 'Heartworm test' : 'Fecal test';
    if (out.visits.some((v) => v.reason === reason && v.date === d)) continue;
    // charged today with no result written: the result comes later
    const res = win.find((w) => /\bresults?\b/i.test(w))?.replace(/^.*?results?\s*:?\s*/i, '') ?? (/\$\s*\d/.test(l) ? 'Result pending' : null);
    const by = win.find((w) => CLINIC.test(w))?.replace(/^(test\s+by)\s*:?\s*/i, '') ?? clinic;
    out.visits.push({ reason, date: d, clinic: by, notes: res });
  }
  // surgeries: "was spayed/neutered ... on 08/19/2026"
  const surg = joined.match(/\b(spayed\s*\/\s*neutered|neutered|spayed|castrat\w*)\b(.{0,160}?)\bon\s+([^.]*?\d{4})/i);
  if (surg) {
    const d = datesIn(surg[3])[0]?.day ?? null;
    const where = surg[2].match(/at\s+([^,.]*?(?:clinic|hospital|veterinary)[^,.]*)/i)?.[1]?.trim() ?? clinic;
    const reason = out.profile.sex === 'f' || /^spayed$/i.test(surg[1]) ? 'Spay surgery' : 'Neuter surgery';
    if (d && !out.visits.some((v) => v.reason === reason)) out.visits.push({ reason, date: d, clinic: where, notes: null });
  }
  // invoice lines with prices, and the total
  for (const l of lines) {
    const tot = l.match(/\btotal\b[^$]*\$\s*([\d,]+\.\d{2})/i);
    if (tot) { const t = Number(tot[1].replace(/,/g, '')); if (/invoice|due|amount/i.test(l) || out.cost.total === null) out.cost.total = t; continue; }
    if (/\b(balance|paid|payment|change|deposit)\b/i.test(l)) continue;
    const m = l.match(/^(?:\d{1,2}\/\d{1,2}\/\d{2,4}\s+)?(?:([A-Z][A-Z0-9]{1,8})\s+)?(.+?)\s+(\d+(?:\.\d+)?)\s*(?:[A-Za-z()]+\s*)?\$\s*([\d,]+\.\d{2})$/);
    if (!m) continue;
    const description = m[2].trim(), price = Number(m[4].replace(/,/g, ''));
    if (out.cost.lines.some((x) => x.description === description && x.price === price)) continue;
    const care = !NOT_CARE.test(description);
    out.cost.lines.push({ code: m[1] ?? null, description, qty: Number(m[3]), price, care });
    if (!care) continue;
    const hit = productOf(description);
    const nth = description.match(/\b(\d)(?:st|nd|rd|th)?\s+of\s+(\d)\b/i);
    if (hit) {
      const [kind, name] = hit;
      const notes = nth ? `Dose ${nth[1]} of ${nth[2]}` : kind === 'flea' ? `Parasite prevention${/single/i.test(description) ? ', single dose' : ''}` : null;
      out.given.push({ name: kind === 'vaccine' ? `${name} vaccine` : /revolution\s*plus/i.test(description) ? 'Revolution Plus' : name, kind, notes });
      const item = out.items.find((x) => x.name === name && x.date === date) ?? (date ? out.items[out.items.push({ name, kind, date, nextDue: null, notes: null }) - 1] : undefined);
      if (item) {
        item.notes ??= notes;
        if (nth && +nth[1] < +nth[2] && date) {
          // the next dose of a series: about 3–4 weeks later (an estimate; the clinic sets the day)
          const f: FollowUp = { name: `${name} dose ${+nth[1] + 1}`, from: addDays(date, 21), to: addDays(date, 28), estimated: true };
          if (!out.followUps.some((x) => x.name === f.name)) out.followUps.push(f);
          item.nextDue ??= f.from;
          item.notes = `${notes}; dose ${+nth[1] + 1} due about ${niceDay(f.from).replace(/, \d{4}$/, '')}–${+f.to.slice(8)} (estimated)`;
        }
      }
    } else if (TEST.test(description)) {
      const name = /fecal/i.test(description) ? (/pediatric|puppy|kitten/i.test(description) ? 'Pediatric fecal test' : 'Fecal test') : description;
      out.given.push({ name, kind: 'test', notes: 'Result pending' });
    } else if (/\b(exam|examination|consult|wellness)\b/i.test(description)) {
      out.given.push({ name: /comprehensive/i.test(description) ? 'Comprehensive exam' : 'Exam', kind: 'exam', notes: null });
    } else out.given.push({ name: description, kind: 'medicine', notes: null });
  }

  // the history: why they came, what the vet noted, diet, medicines, problem list
  const histAt = lines.findIndex((l) => /^(problem\s*\/\s*history|history|subjective)\s*:/i.test(l));
  if (histAt >= 0) {
    let para = lines[histAt].replace(/^[^:]*:\s*/, '');
    for (let i = histAt + 1; i < lines.length && !/^[A-Z][A-Za-z /]{2,30}:/.test(lines[i]); i++) para += ' ' + lines[i];
    const notes: string[] = [];
    const sneeze = /sneez/i.test(para), cough = /cough/i.test(para);
    if (sneeze || cough) notes.push(sneeze && cough ? 'Sneezing/coughing' : sneeze ? 'Sneezing' : 'Coughing');
    if (/soft\s+stool/i.test(para)) notes.push('Soft stools');
    if (/diarrh/i.test(para)) notes.push('Diarrhea');
    if (/(?<!no\s)vomit/i.test(para)) notes.push('Vomiting');
    for (const n of notes) if (!out.history.notes.includes(n)) out.history.notes.push(n);
    const reason = lines[histAt - 1];
    if (reason && reason.length <= 40 && !/[:\d]/.test(reason) && !/^date\b/i.test(reason)) {
      const r = reason[0].toUpperCase() + reason.slice(1).toLowerCase();
      if (!out.visits.some((v) => v.reason === r)) out.visits.push({ reason: r, date, clinic, notes: notes.join(', ') || null });
    }
  }
  const diet = joined.match(/\b(?:current\s+)?diet\s*:\s*(.+?)(?=\s+(?:previous|current|physical|vaccin)\w*\b|$)/i)?.[1]; if (diet) out.history.diet ??= diet.trim();
  const meds = joined.match(/\bcurrent\s+medications?\s*:\s*(.+?)(?=\s+(?:current|previous|physical|diet)\b|$)/i)?.[1]; if (meds) out.history.meds ??= meds.trim();
  const probAt = lines.findIndex((l) => /^problems?\s*(list)?\s*:?$/i.test(l));
  if (probAt >= 0) for (let i = probAt + 1; i < lines.length && /^\d+[.)]\s*\S/.test(lines[i]); i++) {
    const p = lines[i].replace(/^\d+[.)]\s*/, '').replace(/^occ\.?\s+/i, 'Occasional ').replace(/\s+(\w)/g, (_m, c: string) => ' ' + c.toLowerCase());
    if (!out.history.problems.includes(p)) out.history.problems.push(p);
  }

  // a visit reason written on an invoice
  const reasonLine = lines.find((l) => /^(reason(?:\s+for\s+visit)?|chief\s+complaint|presenting\s+(?:complaint|problem)|visit\s+type)\s*[:\-]/i.test(l));
  if (reasonLine) {
    const reason = reasonLine.replace(/^[^:\-]*[:\-]\s*/, '').trim().slice(0, 80);
    if (reason && !out.visits.some((v) => v.reason === reason)) out.visits.push({ reason, date, clinic, notes: null });
  } else if (/\b(exam|wellness|check-?up|office\s+visit)\b/i.test(text) && /\b(invoice|receipt|statement)\b/i.test(text) && !out.visits.length) {
    out.visits.push({ reason: out.items.some((x) => x.kind === 'vaccine') ? 'Exam and vaccines' : 'Exam', date, clinic, notes: null });
  }
}

interface Internal extends DocFindings { _dates: { day: string; labelled: boolean }[] }
const empty = (): Internal => ({ title: '', categories: [], docDate: null, clinic: null, profile: {}, weights: [], items: [], visits: [], summary: '',
  clinicPhone: null, vet: null, pet: {}, exam: {}, given: [], followUps: [], reminders: [], lastDone: [], history: { problems: [], notes: [], diet: null, meds: null },
  cost: { total: null, lines: [] }, confidence: {}, _dates: [] });

const TITLES: Record<DocCategory, string> = { vet: 'Medical records', esa: 'ESA & housing forms', adoption: 'Adoption papers', other: 'Document' };

/** Read every page of a document. */
export function parseVetPages(pages: string[]): DocFindings {
  const out = empty();
  for (const p of pages) parsePage(p, out);
  return finish(out, pages.join('\n'), pages.filter((p) => p.trim()).length);
}

/** Two documents scanned for the same visit (a chart and its invoice) as one result; lists are deduped. */
export function mergeFindings(a: DocFindings, b: DocFindings): DocFindings {
  const out = empty();
  const both = [a, b];
  out.categories = [...new Set(both.flatMap((x) => x.categories))].filter((c) => c !== 'other');
  out.docDate = a.docDate ?? b.docDate; out.clinic = a.clinic ?? b.clinic; out.clinicPhone = a.clinicPhone ?? b.clinicPhone; out.vet = a.vet ?? b.vet;
  out._dates = both.flatMap((x) => (x.docDate ? [{ day: x.docDate, labelled: x.confidence.docDate === 'high' }] : []));
  out.profile = { ...b.profile, ...a.profile }; out.pet = { ...b.pet, ...a.pet }; out.exam = { ...b.exam, ...a.exam };
  const uniq = <T,>(xs: T[], key: (x: T) => string) => xs.filter((x, i) => xs.findIndex((y) => key(y) === key(x)) === i);
  out.weights = uniq(both.flatMap((x) => x.weights), (w) => String(w.date) + w.lb);
  out.items = both.flatMap((x) => x.items).reduce<DocFindings['items']>((acc, it) => {
    const same = acc.find((x) => x.name === it.name && x.date === it.date && (it.date !== null || x.nextDue === it.nextDue));
    if (same) { same.nextDue ??= it.nextDue; same.notes ??= it.notes; } else acc.push({ ...it });
    return acc;
  }, []);
  out.visits = uniq(both.flatMap((x) => x.visits), (v) => v.reason + '|' + v.date);
  out.given = uniq(both.flatMap((x) => x.given), (g) => g.name);
  out.followUps = uniq(both.flatMap((x) => x.followUps), (f) => f.name);
  out.reminders = uniq(both.flatMap((x) => x.reminders), (r) => r.name + '|' + r.due);
  out.lastDone = uniq(both.flatMap((x) => x.lastDone), (r) => r.name + '|' + r.date);
  out.history = { problems: uniq(both.flatMap((x) => x.history.problems), (p) => p), notes: uniq(both.flatMap((x) => x.history.notes), (p) => p),
    diet: a.history.diet ?? b.history.diet, meds: a.history.meds ?? b.history.meds };
  out.cost = a.cost.lines.length || a.cost.total !== null ? a.cost : b.cost;
  return finish(out, '', 0, [a.title, b.title]);
}

function finish(out: Internal, all: string, used: number, titles?: string[]): DocFindings {
  const ORDER: DocCategory[] = ['vet', 'adoption', 'esa'];
  const cats = ORDER.filter((c) => out.categories.includes(c));
  out.categories = cats.length ? cats : ['other'];
  out.title = titles ? [...new Set(titles)].map((t, i) => (i ? t.toLowerCase() : t)).join(' and ') : cats.length === 1 && cats[0] === 'vet'
    ? (/rabies\s+certificate/i.test(all) && used === 1 ? 'Rabies certificate' : /certificate/i.test(all) && used === 1 ? 'Vaccine certificate'
      : /\b(invoice|receipt|statement)\b/i.test(all) ? 'Vet invoice' : /medical\s+history/i.test(all) ? 'Medical history' : 'Vet record')
    : cats.length ? cats.map((c, i) => (i ? TITLES[c].replace(/^[A-Z][a-z]/, (m) => m.toLowerCase()) : TITLES[c])).join(', ').replace(/, ([^,]*)$/, ' and $1') : 'Document';
  out.items.sort((a, b) => (a.date ?? a.nextDue ?? '').localeCompare(b.date ?? b.nextDue ?? ''));
  out.weights.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  out.visits.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  const n = (k: number, w: string) => (k ? `${k} ${w}${k === 1 ? '' : 's'}` : '');
  const bits = [n(out.items.length, 'dose'), n(out.visits.length, 'visit or test'), n(out.weights.length, 'weigh-in')].filter(Boolean)
    .map((b) => b.replace('visit or tests', 'visits or tests'));
  out.summary = `${out.title}${out.docDate ? ` · ${niceDay(out.docDate)}` : ''} · ${bits.length ? bits.join(', ') + ' found' : 'nothing medical to log'}.`;
  out.reminders.sort((a, b) => a.due.localeCompare(b.due));
  out.confidence = confidenceOf(out);
  const { _dates: _, ...result } = out;
  return result;
}

/** How sure the reader is of each field: high = labelled and consistent, medium = inferred, low = conflicting. */
function confidenceOf(out: Internal): DocFindings['confidence'] {
  const c: DocFindings['confidence'] = {};
  if (out.docDate) c.docDate = new Set(out._dates.map((d) => d.day)).size > 1 ? 'low' : out._dates.some((d) => d.labelled) ? 'high' : 'medium';
  if (out.clinic) c.clinic = 'high';
  if (out.clinicPhone) c.clinicPhone = 'medium';
  if (out.vet) c.vet = 'high';
  if (out.weights.length) c.weight = new Set(out.weights.filter((w) => w.date === out.docDate).map((w) => w.lb)).size > 1 ? 'low' : 'high';
  if (out.exam.bodyCondition) c.bodyCondition = 'high';
  if (out.exam.pain) c.pain = 'high';
  if (out.given.length) c.given = 'high';
  if (out.followUps.length) c.followUps = 'medium'; // estimated
  if (out.reminders.length) c.reminders = new Set(out.reminders.map((r) => r.name)).size < out.reminders.length ? 'low' : 'high';
  if (out.lastDone.length) c.lastDone = 'high';
  if (out.cost.total !== null || out.cost.lines.length) {
    const sum = Math.round(out.cost.lines.reduce((s, l) => s + l.price, 0) * 100) / 100;
    c.cost = out.cost.total !== null && out.cost.lines.length && Math.abs(sum - out.cost.total) < 0.01 ? 'high' : out.cost.total !== null ? 'medium' : 'low';
  }
  if (Object.keys(out.pet).length) c.pet = 'high';
  if (out.history.notes.length || out.history.problems.length || out.history.diet || out.history.meds) c.history = 'medium'; // summarised from free text
  return c;
}

/** One page of text (a photo, or older callers). */
export const parseVetText = (text: string) => parseVetPages([text]);
