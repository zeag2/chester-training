/* Reads the text of pet paperwork (from OCR or a PDF) with plain rules, page by page. No AI, no network.
   Finds: what kind of paperwork each page is (vet record, ESA/housing, adoption), the pet's profile details
   (birthday, microchip, sex, neutered, adoption date), weigh-ins, every vaccine / flea / dewormer / medicine dose
   with its next-due date, tests with results, and surgeries. Only what's written; unknown stays empty. */
import type { MedWhat } from '../engine/care';

export type DocCategory = 'vet' | 'esa' | 'adoption' | 'other';
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
/** Vial lots and their expiry dates are not due dates. */
const LOT = /\b(lot|exp\.?\s*date|vial|serial)\b/i;
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

function pageDate(lines: string[]): string | null {
  const labelled = lines.find((l) => /\b(date|visit|invoice|service|exam|given)\b/i.test(l) && !DUE.test(l) && !NOT_A_VISIT_DATE.test(l) && datesIn(l).length);
  if (labelled) return datesIn(labelled)[0].day;
  return lines.filter((l) => !NOT_A_VISIT_DATE.test(l) && !LOT.test(l)).flatMap((l) => datesIn(l))[0]?.day ?? null;
}

function parsePage(text: string, out: DocFindings) {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (!lines.length) return;
  const cat = classify(text);
  if (!out.categories.includes(cat)) out.categories.push(cat);
  const date = pageDate(lines);
  if (cat === 'vet') out.docDate ??= date;
  const clinicLine = lines.find((l) => CLINIC.test(l) && l.length <= 60);
  const clinic = clinicLine ? clinicLine.replace(/^(test\s+by|clinic|hospital)\s*:?\s*/i, '').replace(/[|•·].*$/, '').trim() : null;
  if (clinic && cat === 'vet') out.clinic ??= clinic;
  const joined = lines.join(' ');

  // the pet's own details: only on pages about the pet, never from the people on ESA/housing forms
  if (cat !== 'esa' && /\b(species|breed|patient|feline|canine|microchip)\b/i.test(text)) {
    const dobLine = lines.find((l) => /\b(dob|birth\s*date|date\s+of\s+birth|birthdate|born)\b/i.test(l) && datesIn(l).length);
    if (dobLine) out.profile.birthday ??= datesIn(dobLine)[0].day;
    const chip = joined.match(/\b(?:micro\s*chip(?:\s*(?:#|no\.?|number))?|chip)\s*:?\s*(\d{9,15})\b/i) ?? joined.match(/\b(9\d{14})\b/);
    if (chip) out.profile.microchip ??= chip[1];
    const sex = joined.match(/\bsex\s*:?\s*(male|female|m|f)\b/i);
    if (sex) out.profile.sex ??= /^f/i.test(sex[1]) ? 'f' : 'm';
    if (/\baltered\s*:?\s*yes\b|\((neutered|spayed)\)|\bwas\s+(spayed|neutered)/i.test(joined)) out.profile.altered = true;
  }
  if (cat === 'adoption') {
    const adopted = lines.find((l) => /adoption\s+(contract|agreement)|transaction\s+receipt/i.test(l) && datesIn(l).length);
    if (adopted) out.profile.adopted ??= datesIn(adopted)[0].day;
    const from = lines.find((l) => RESCUE.test(l));
    if (from) out.profile.adoptedFrom ??= (from.match(/^(.*?\b(?:inc\.?|rescue|shelter|society|spca)\b\.?)/i)?.[1] ?? from).trim();
  }
  if (cat !== 'vet') return; // nothing medical is taken from ESA or adoption wording

  // weigh-ins: lines labelled weight, or rows under a "Weight" table header; never a product's size range
  for (const [i, l] of lines.entries()) {
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
    const hit = productOf(l); if (!hit || LOT.test(l)) continue;
    const [kind, name] = hit;
    const win = [l];
    for (let j = i + 1; j < Math.min(lines.length, i + 7); j++) {
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
    if (!/\b(felv|fiv)\b.*\btest\b|\btest\b.*\b(felv|fiv)\b|heartworm\s+test|fecal\s+(exam|test)/i.test(l)) continue;
    const win = lines.slice(i, i + 6);
    const d = win.flatMap((w) => (LOT.test(w) ? [] : datesIn(w)))[0]?.day ?? date;
    const reason = /felv|fiv/i.test(l) ? 'FeLV/FIV test' : /heartworm/i.test(l) ? 'Heartworm test' : 'Fecal test';
    if (out.visits.some((v) => v.reason === reason && v.date === d)) continue;
    const res = win.find((w) => /\bresults?\b/i.test(w))?.replace(/^.*?results?\s*:?\s*/i, '') ?? null;
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
  // a visit reason written on an invoice
  const reasonLine = lines.find((l) => /^(reason(?:\s+for\s+visit)?|chief\s+complaint|presenting\s+(?:complaint|problem)|visit\s+type)\s*[:\-]/i.test(l));
  if (reasonLine) {
    const reason = reasonLine.replace(/^[^:\-]*[:\-]\s*/, '').trim().slice(0, 80);
    if (reason && !out.visits.some((v) => v.reason === reason)) out.visits.push({ reason, date, clinic, notes: null });
  } else if (/\b(exam|wellness|check-?up|office\s+visit)\b/i.test(text) && /\b(invoice|receipt|statement)\b/i.test(text) && !out.visits.length) {
    out.visits.push({ reason: out.items.some((x) => x.kind === 'vaccine') ? 'Exam and vaccines' : 'Exam', date, clinic, notes: null });
  }
}

const TITLES: Record<DocCategory, string> = { vet: 'Medical records', esa: 'ESA & housing forms', adoption: 'Adoption papers', other: 'Document' };

/** Read every page of a document. */
export function parseVetPages(pages: string[]): DocFindings {
  const out: DocFindings = { title: '', categories: [], docDate: null, clinic: null, profile: {}, weights: [], items: [], visits: [], summary: '' };
  for (const p of pages) parsePage(p, out);
  const all = pages.join('\n');
  const used = pages.filter((p) => p.trim()).length;
  const ORDER: DocCategory[] = ['vet', 'adoption', 'esa'];
  const cats = ORDER.filter((c) => out.categories.includes(c));
  out.categories = cats.length ? cats : ['other'];
  out.title = cats.length === 1 && cats[0] === 'vet'
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
  return out;
}

/** One page of text (a photo, or older callers). */
export const parseVetText = (text: string) => parseVetPages([text]);
