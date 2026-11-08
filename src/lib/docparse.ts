/* Reads the text of a vet record (from OCR or a PDF) with plain rules: dates, weight, clinic,
   and known vaccine / flea / dewormer / medicine names with their next-due dates. No AI, no network. */
import type { DocReading, MedWhat } from '../engine/care';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const pad = (n: number) => String(n).padStart(2, '0');
const nice = (day: string) => { const [y, m, d] = day.split('-').map(Number); return `${MONTHS[m - 1][0].toUpperCase()}${MONTHS[m - 1].slice(1)} ${d}, ${y}`; };
const iso = (y: number, m: number, d: number) => (m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${pad(m)}-${pad(d)}` : null);
const year = (y: number) => (y < 100 ? 2000 + y : y);

interface Found { day: string; at: number; end: number }
/** Every date in a line, in order: 11/02/2026, 11-2-26, 2026-11-02, Nov 2, 2026, 2 Nov 2026. */
export function datesIn(line: string): Found[] {
  const out: Found[] = [];
  const push = (day: string | null, m: RegExpExecArray) => { if (day && Number(day.slice(0, 4)) >= 2000 && Number(day.slice(0, 4)) <= 2100) out.push({ day, at: m.index, end: m.index + m[0].length }); };
  for (const m of line.matchAll(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/g)) push(iso(+m[1], +m[2], +m[3]), m as RegExpExecArray);
  for (const m of line.matchAll(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})\b/g)) push(iso(year(+m[3]), +m[1], +m[2]), m as RegExpExecArray); // US month/day
  for (const m of line.matchAll(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/gi)) push(iso(+m[3], MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1, +m[2]), m as RegExpExecArray);
  for (const m of line.matchAll(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?,?\s+(\d{4})\b/gi)) push(iso(+m[3], MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1, +m[1]), m as RegExpExecArray);
  return out.sort((a, b) => a.at - b.at).filter((d, i, a) => !i || d.at >= a[i - 1].end);
}

/** Known products by kind. The first matching name on a line wins; names are shown as written here. */
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
const DUE = /\b(next|due|booster|recheck|repeat|revaccinat|expires?|valid\s+until)/i;
const CLINIC = /(veterinary|animal\s+hospital|animal\s+clinic|vet\s+clinic|pet\s+hospital|cat\s+(?:clinic|hospital)|feline\s+(?:clinic|hospital)|animal\s+care|vca\b|banfield|vet\s+center)/i;

/** Pull suggested log entries out of a vet document's text. Only what's written; unknown = null. */
export function parseVetText(text: string): DocReading {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const all = lines.flatMap((l) => datesIn(l).map((d) => ({ ...d, line: l })));

  // the document's date: one labelled as the visit/invoice/service date, else the first date
  const labelled = lines.find((l) => /\b(date|visit|invoice|service|exam)\b/i.test(l) && !DUE.test(l) && datesIn(l).length);
  const docDate = labelled ? datesIn(labelled)[0].day : all[0]?.day ?? null;

  const clinicLine = lines.find((l) => CLINIC.test(l) && l.length <= 60);
  const clinic = clinicLine ? clinicLine.replace(/[|•·].*$/, '').trim() : null;

  let weightLb: number | null = null;
  for (const l of lines) {
    const m = l.match(/(\d{1,2}(?:\.\d{1,2})?)\s*(lbs?|pounds?|kg|kilograms?)\b/i);
    if (m && (/\b(weight|wt|body\s*weight)\b/i.test(l) || !weightLb)) {
      const v = Number(m[1]) * (/^k/i.test(m[2]) ? 2.20462 : 1);
      if (v > 0.2 && v < 40) { weightLb = Math.round(v * 100) / 100; if (/\b(weight|wt)\b/i.test(l)) break; }
    }
  }

  const items: DocReading['items'] = [];
  for (const [i, l] of lines.entries()) {
    const hit = PRODUCTS.find(([, , re]) => re.test(l)); if (!hit) continue;
    const [kind, name] = hit;
    if (items.some((x) => x.name === name)) {
      // a later "Rabies due 11/02/2027" style line fills in the next due date
      const it = items.find((x) => x.name === name)!;
      if (!it.nextDue && DUE.test(l)) it.nextDue = datesIn(l)[0]?.day ?? null;
      continue;
    }
    // dates usually sit on the product's line; on certificates they can be on the next few lines
    let src = l;
    if (!datesIn(l).length) for (let j = i + 1; j < Math.min(lines.length, i + 4) && !PRODUCTS.some(([, , re]) => re.test(lines[j])); j++) if (datesIn(lines[j]).length) { src = lines[j]; break; }
    const ds = datesIn(src);
    const dueAt = src.search(DUE);
    let date: string | null = null, nextDue: string | null = null;
    if (dueAt >= 0) { nextDue = ds.find((d) => d.at > dueAt)?.day ?? ds[ds.length - 1]?.day ?? null; date = ds.find((d) => d.at < dueAt)?.day ?? null; }
    else if (ds.length >= 2) { date = ds[0].day; nextDue = ds[1].day; }
    else { date = ds[0]?.day ?? null; const nl = lines[i + 1]; if (src === l && nl && DUE.test(nl) && !PRODUCTS.some(([, , re]) => re.test(nl))) nextDue = datesIn(nl)[0]?.day ?? null; }
    if (nextDue && date && nextDue <= date) nextDue = null;
    const dose = l.match(/\b\d+(?:\.\d+)?\s*(?:mg|ml|mL|tabs?|tablets?|caps?|capsules?)\b[^,;]*/)?.[0] ?? null;
    // a line that only says when it's due (a reminder) isn't a dose given on this visit
    const reminderOnly = !date && !!nextDue;
    items.push({ name, kind, date: reminderOnly ? null : date ?? docDate, nextDue, notes: reminderOnly ? 'Reminder: not given on this visit' : kind === 'medicine' ? dose : null });
  }

  const reasonLine = lines.find((l) => /\b(reason|chief\s+complaint|presenting|visit\s+type|purpose)\b/i.test(l));
  const reasonText = reasonLine?.replace(/^.*?(reason(?:\s+for\s+visit)?|chief\s+complaint|presenting\s+(?:complaint|problem)|visit\s+type|purpose)\s*[:\-]?\s*/i, '').trim();
  const visitReason = reasonText ? reasonText.slice(0, 80)
    : /\b(exam|wellness|check-?up|consult|office\s+visit)\b/i.test(text) ? (items.some((x) => x.kind === 'vaccine') ? 'Exam and vaccines' : 'Exam')
    : items.some((x) => x.kind === 'vaccine') ? 'Vaccines' : null;

  const kinds = items.length ? `${items.length} item${items.length === 1 ? '' : 's'} found` : 'no vaccines or medicines found';
  const isInvoice = /\binvoice|receipt|statement\b/i.test(text);
  return {
    title: isInvoice ? 'Vet invoice' : /certificate/i.test(text) ? 'Vaccine certificate' : visitReason ? 'Vet visit' : 'Vet document',
    docDate, clinic, visitReason, vetNotes: null, weightLb, items,
    summary: `${clinic ?? 'Vet record'}${docDate ? ` · ${nice(docDate)}` : ''} · ${kinds}${weightLb ? ` · ${weightLb} lb` : ''}.`,
  };
}
