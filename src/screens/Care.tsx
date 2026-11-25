import { useEffect, useMemo, useRef, useState } from 'react';
import { store, useStore } from '../db/store';
import { Chester } from '../chester/Chester';
import { daysBetween, localDay } from '../engine/day';
import { usePetText } from '../lib/pet';
import { Sheet } from '../ui/Sheet';
import {
  dueText, entryTime, GROOM, lastOf, MED_LABEL, medsDue, nextDueLike, recentMeds, RED_FLAGS, reminders, SYMPTOMS, VERDICT_LABEL, typicalKittenWeight, weights,
  type CareData, type CareItem, type CareKind, type DailyWhat, type FoodType, type GroomWhat, type MedDue, type MedWhat, type Verdict,
  dailyDetail,
} from '../engine/care';
import { Icon, Paw } from '../ui/icons';
import { kittenPlan } from '../engine/kittenplan';
import type { CalEvent } from '../lib/calendar';
import { addToCalendar, CalendarSheet } from '../ui/CalendarChoice';
import { go } from '../ui/router';
import * as audio from '../lib/audio';
import { byBarcode, sameCode, search, type FoodHit } from '../lib/petfood';
import { Scanner } from './Scanner';
import { PetSwitcher } from '../ui/PetSwitcher';
import { CareTreatNote } from '../ui/CareTreatNote';
import { BookSheet, VetCard, VisitsCard, visitEvent, type BookPreset } from '../ui/VetCards';
import { NO_VISIT, docVisitId, findDocs, guessDocType, visitOfDoc } from '../engine/docs';
import { bookingDay, isBooked } from '../engine/vets';
import { DocRow, openDoc } from '../ui/DocRow';
import { DailyLogSheet } from '../ui/DailyLogSheet';
import { useLayout } from '../ui/layout';
import { showToast } from '../ui/Toast';
import { DropNote, isDocFile, useDocDrop, type Dropped } from '../ui/DocDrop';
import { dailyLogDays } from '../engine/dailylog';
import { useSettle } from '../ui/settle';

const noon = (day: string) => Date.parse(day + 'T12:00:00');
const fmt = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: new Date(ms).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
const TITLE: Record<Exclude<CareKind, 'food'>, string> = { weight: 'Weight', symptom: 'Symptom', groom: 'Grooming', vet: 'Vet visit', med: 'Medicine or vaccine', doc: 'Document', daily: 'Daily' };
const ICON: Record<CareKind, string> = { food: 'leaf', weight: 'target', symptom: 'ear', groom: 'hand', vet: 'box', med: 'check', doc: 'book', daily: 'paw' };

function summary(i: CareItem): string {
  const d = i.data as any;
  switch (i.kind) {
    case 'weight': return `${d.lb} lb`;
    case 'symptom': return d.what + (d.worried ? ' · worried' : '');
    case 'groom': return GROOM[d.what as GroomWhat].label;
    case 'vet': return d.reason + (d.clinic ? ` · ${d.clinic}` : '');
    case 'med': return `${d.name} · ${MED_LABEL[d.what as MedWhat]}` + (d.nextDue ? ` · next ${fmt(noon(d.nextDue))}` : '');
    default: return d.name;
  }
}

/** `day`: the date a new entry starts on (e.g. the visit's day, when logging a dose from the visit page). */
export type Editing = { kind: CareKind; item?: CareItem; preset?: Partial<CareData[CareKind]>; day?: string } | null;

export function Care({ open }: { open?: CareKind } = {}) {
  const { cat, care, careSync, account, household, vets } = useStore();
  const pt = usePetText();
  // opened from the + sheet: go straight to that log form
  const [editing, setEditing] = useState<Editing>(() => (open && open !== 'doc' ? { kind: open } : null));
  const [allWeights, setAllWeights] = useState(false);
  const [calFor, setCalFor] = useState<CalEvent | null>(null);
  const [book, setBook] = useState<BookPreset | null>(null);
  const due = useMemo(() => reminders(care), [care]);
  const foods = care.filter((c): c is CareItem<'food'> => c.kind === 'food');
  // one-tap daily logs (meals, litter, play, checks) are summed up on Home, not listed here; symptoms from a check are
  const log = care.filter((c) => c.kind !== 'food' && c.kind !== 'doc' && c.kind !== 'daily').slice(0, 40);
  const docs = useMemo(() => findDocs(care), [care]);
  const ws = weights(care);
  const plan = useMemo(() => (cat ? kittenPlan(cat, care) : null), [cat, care]);
  const logRef = useSettle<HTMLDivElement>(log.map((i) => i.id)); // a new entry settles into place (phone list)
  const [quickLogs, setQuickLogs] = useState(false);
  const nameOf = (uid?: string) => (uid && uid !== account?.userId ? household?.members.find((m) => m.userId === uid)?.name : '') || '';
  const big = useLayout() === 'desktop';
  // a document dropped anywhere on Health goes to the "Add a document" reader, as if picked
  const [dropped, setDropped] = useState<Dropped>();
  const drop = useDocDrop(setDropped);
  // desktop's log table also lists the quick logs (Fed, Scooped, Played, daily checks) from the last 7 days
  const quick = useMemo(() => (big ? dailyLogDays(care, 7).flatMap((g) => g.items) : []), [big, care]);
  const shared = !!household && household.members.length > 1;
  const whoOf = (uid?: string) => nameOf(uid) || (shared && uid && uid === account?.userId ? 'You' : '');
  const openEntry = (i: CareItem) => (i.kind === 'vet' ? go('health/visit/' + i.id) : setEditing({ kind: i.kind, item: i }));
  if (!cat) return null;

  const vetTop = <>
    {/* vet first: who to call (and the warning signs), then visits; docs/plans/2026-11-09-vet-redesign.md */}
    <VetCard />
    <VisitsCard onOpen={(v) => go('health/visit/' + v.id)} />
    <button className="btn2" style={{ marginTop: 'var(--sp-1)', background: 'var(--sky)', display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => go('vet-summary')}><Icon name="box" size={18} />Summary for the vet</button>
  </>;
  const comingUp = due.length > 0 && <><h2 style={{ marginTop: 22 }}>Coming up</h2>
      {due.map((r) => <div key={r.id} className="row" style={{ gap: 'var(--sp-2)', marginTop: 10, alignItems: 'stretch' }}><button className={`card ${r.daysLeft < 0 ? 'peach' : 'sky'} row sp`} style={{ margin: 0 }}
        onClick={() => { const booked = r.kind === 'visit' ? care.find((c) => c.id === r.id.slice(6)) : undefined;
          if (booked) { go('health/visit/' + booked.id); return; }
          setEditing(r.kind === 'groom' ? { kind: 'groom', preset: { what: r.id.split(':')[1] as GroomWhat } } : r.kind === 'vet' ? { kind: 'vet', preset: { reason: 'Yearly checkup' } } : { kind: 'med', preset: { name: r.title } }); }}>
        <div className="ico"><Icon name={r.kind === 'groom' ? 'hand' : r.kind === 'vet' || r.kind === 'visit' ? 'box' : 'check'} /></div>
        <div className="sp"><b>{r.title}</b><p className="s">{r.detail}</p></div><span className="chip">{dueText(r.daysLeft)}</span></button>
        {/* the yearly checkup and vaccine boosters: Book, with the reason and a day near the due date filled in */}
        {(r.kind === 'vet' || r.what === 'vaccine') ? <button className="card grey bookdue" style={{ margin: 0, width: 64, flex: 'none', padding: 0 }} aria-label={`Book a visit: ${r.title}`}
          onClick={() => { audio.chirp(); setBook(r.kind === 'vet' ? { reason: 'Checkup', day: bookingDay(r.dueDay), notes: 'Yearly checkup' } : { reason: 'Vaccines', day: bookingDay(r.dueDay), notes: `${r.title} due ${fmt(noon(r.dueDay))}` }); }}>
          <Icon name="cal" size={20} /><span>Book</span></button>
        : r.daysLeft >= 0 && <button className="card grey" style={{ margin: 0, width: 56, padding: 0, display: 'grid', placeItems: 'center' }} aria-label={`Add ${r.title} to your calendar`}
          onClick={() => { const booked = r.kind === 'visit' ? care.find((c): c is CareItem<'vet'> => c.id === r.id.slice(6) && c.kind === 'vet') : undefined;
            setCalFor(booked ? visitEvent(cat.name, booked, vets.find((v) => v.id === booked.data.vetId)) : { title: `${cat.name}: ${r.title}`, day: r.dueDay, notes: r.detail }); }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4M12 13v5M9.5 15.5h5" /></svg></button>}</div>)}</>;
  const logSomething = <>
    <h2 style={{ marginTop: 22 }}>Log something</h2>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--sp-2)', marginTop: 10 }}>
      {(['weight', 'symptom', 'groom', 'vet', 'med'] as const).map((k) => <button key={k} className="chipbtn" style={{ height: 'auto', minHeight: 64, borderRadius: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--sp-1)', whiteSpace: 'normal', lineHeight: 1.15 }} onClick={() => { audio.chirp(); setEditing({ kind: k }); }}>
        <Icon name={ICON[k]} size={20} /><span style={{ fontSize: 'var(--fs-label)' }}>{k === 'med' ? 'Medicine' : TITLE[k]}</span></button>)}
      <button className="chipbtn" style={{ height: 'auto', minHeight: 64, borderRadius: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--sp-1)' }} onClick={() => { audio.chirp(); setEditing({ kind: 'food' }); }}><Icon name="leaf" size={20} /><span style={{ fontSize: 'var(--fs-label)' }}>Food or treat</span></button>
    </div>
  </>;
  const kitten = plan && <><h2 style={{ marginTop: 22 }}>{pt('Kitten vaccines and checkups')}</h2>
      <div className="card white">
        {/* a row opens what's logged (the dose, or the visit); "Log it" is its own button, so reading a row never adds an entry */}
        {plan.map((st) => { const log = () => setEditing('reason' in st.preset ? { kind: 'vet', preset: st.preset } : { kind: 'med', preset: st.preset });
          const open = st.entry ? () => (st.entry!.kind === 'vet' ? go('health/visit/' + st.entry!.id) : setEditing({ kind: st.entry!.kind, item: st.entry })) : undefined;
          return <div key={st.key} className="row" style={{ gap: 10, alignItems: 'center' }}>
          <button className="row sp" style={{ border: 0, background: 'none', padding: 'var(--sp-2) 0', textAlign: 'left', color: 'inherit', font: 'inherit', alignItems: 'flex-start', gap: 10, minHeight: 44 }}
            disabled={!open} onClick={open} aria-label={`${st.title}: ${st.done ? 'done' : 'not logged yet'}${open ? '. Open the last one logged.' : ''}`}>
          <span aria-hidden="true" style={{ width: 22, height: 22, borderRadius: 11, flex: 'none', display: 'grid', placeItems: 'center', marginTop: 1, background: st.done ? 'var(--teal)' : 'transparent', color: 'var(--on-ink, #fff)', boxShadow: st.done ? 'none' : 'inset 0 0 0 2px var(--faint, #bbb)' }}>{st.done && <Icon name="check" size={14} />}</span>
          <span className="sp"><b style={{ fontSize: 15 }}>{st.title}</b><span className="s" style={{ display: 'block' }}>{st.done ? 'Done' : st.when}{!st.done && st.progress && !st.progress.startsWith('0') ? ` · ${st.progress}` : ''}</span></span></button>
          {!st.done && <button className="chipbtn" style={{ flex: 'none' }} onClick={log} aria-label={`Log ${st.title}`}>Log it</button>}</div>; })}
        <p className="s" style={{ marginTop: 6 }}>The usual schedule, as a guide. Your vet sets the real one. Tap a row to see what’s logged.</p></div></>;
  const weightCard = ws.length > 0 && <div className="card mint"><div className="row"><b className="sp">Weight</b><span className="chip num">{ws[ws.length - 1].data.lb} lb</span></div>
      {ws.length > 1 && <Spark values={ws.map((w) => w.data.lb)} />}
      <p className="s" style={{ marginTop: 6 }}>{ws.length} weigh-in{ws.length === 1 ? '' : 's'} · last {fmt(ws[ws.length - 1].at)}</p>
      {/* tap a weigh-in to change its value or date, or delete it */}
      <div style={{ marginTop: 'var(--sp-2)' }} role="group" aria-label="Weigh-ins">
        {[...ws].reverse().slice(0, allWeights ? undefined : 3).map((w) => <button key={w.id} className="item" style={{ background: 'var(--surface)', padding: 'var(--sp-2) var(--sp-4)', marginTop: 'var(--sp-2)', borderRadius: 'var(--r-row)', borderBottom: 0 }} onClick={() => setEditing({ kind: 'weight', item: w })}
          aria-label={`Edit weight ${w.data.lb} lb on ${fmt(w.at)}`}>
          <div className="sp"><b className="num">{w.data.lb} lb</b><p className="s">{fmt(w.at)}</p></div><span className="s">Edit</span></button>)}
        {ws.length > 3 && <button className="s" style={{ background: 'none', border: 0, padding: 'var(--sp-2) 0', minHeight: 44, fontWeight: 800, color: 'var(--ink)' }} onClick={() => setAllWeights(!allWeights)}>{allWeights ? 'Show fewer' : `Show all ${ws.length}`}</button>}
      </div>
      {(() => { const g = typicalKittenWeight(cat.birthday); return g && <p className="s" style={{ marginTop: 'var(--sp-1)' }}>Typical at about {g.months} months: roughly {g.low}–{g.high} lb. A rough guide only; ask your vet.</p>; })()}</div>;
  const foodSection = <>
    <h2 style={{ marginTop: 22 }}>Food and treats</h2>
    {foods.length === 0 && <p className="s" style={{ marginTop: 'var(--sp-2)' }}>{pt('Add the food and treats you use, and whether he loves them. Handy at the store and for the vet.')}</p>}
    {(['love', 'ok', 'no'] as Verdict[]).map((v) => { const list = foods.filter((f) => f.data.verdict === v); if (!list.length) return null;
      return <div key={v} style={{ marginTop: 'var(--sp-3)' }}><p className="s" style={{ fontWeight: 800 }}>{VERDICT_LABEL[v]}</p>
        {list.map((f) => <button key={f.id} className="item" onClick={() => setEditing({ kind: 'food', item: f })}>
          <div className="sp"><b>{f.data.name}</b><p className="s">{[f.data.brand, f.data.type === 'treat' ? 'Treat' : f.data.type === 'wet' ? 'Wet food' : f.data.type === 'dry' ? 'Dry food' : 'Other', f.data.notes].filter(Boolean).join(' · ')}</p></div>
          {f.data.current && <span className="chip" style={{ background: 'var(--mint)' }}>Using now</span>}</button>)}</div>; })}
  </>;
  const documents = <>
    <div className="row" style={{ marginTop: 22, alignItems: 'baseline' }}><h2 className="sp" style={{ margin: 0 }}>Documents</h2>
      {docs.length > 0 && <a href="#/health/docs" className="s" style={{ fontWeight: 800, color: 'var(--ink)' }}>All documents ({docs.length}) ›</a>}</div>
    {docs.slice(0, 3).map((d) => <DocRow key={d.id} doc={d} visit={visitOfDoc(care, d)} onMore={() => setEditing({ kind: 'doc', item: d })} />)}
    <DocAdder signedIn={!!account} compact={docs.length > 0} dropped={dropped} />
  </>;

  return <div className={big ? 'screen wide' : 'screen'} {...drop.bind}>
    <h1 style={{ marginTop: 18 }}>{cat.name}’s health</h1>
    <PetSwitcher />
    <CareTreatNote />
    <p className="m" style={{ marginTop: 'var(--sp-1)' }}>{pt('Food he likes, his health log and what’s coming up')}{household && household.members.length > 1 ? ', shared with your household' : ''}.</p>
    {account && careSync === 'missing' && <div className="card butter"><b>One setup step left</b><p className="s" style={{ marginTop: 'var(--sp-1)', color: 'var(--butter-ink)' }}>Care is saved on this phone. To share it, run the care setup in Supabase (docs/sharing-setup.md, step 5).</p></div>}

    {/* desktop (1100 px and up): two columns, then the log as a table across both (docs/plans/2026-11-11-desktop-layout.md, step 5) */}
    {big ? <>
      <div className="healthcols">
        <div className="healthcol">{vetTop}{comingUp}{logSomething}{kitten}</div>
        <div className="healthcol">{documents}{weightCard}{foodSection}</div>
      </div>
      <HealthLogTable log={log} quick={quick} who={whoOf} onOpen={openEntry} onQuickLogs={() => setQuickLogs(true)} />
      {quickLogs && <DailyLogSheet days={7} onClose={() => setQuickLogs(false)} />}
    </> : <>{vetTop}{comingUp}{logSomething}{kitten}{weightCard}{foodSection}{documents}
    <h2 style={{ marginTop: 22 }}>Health log</h2>
    {/* the one-tap logs from Home aren't listed one by one here; this opens them (last 7 days) to delete or retime */}
    <button className="item" onClick={() => setQuickLogs(true)}>
      <div className="ico grey"><Paw size={22} /></div>
      <div className="sp"><b>Quick logs</b><p className="s">Fed, scooped, played and daily checks from the last 7 days. Tap to fix a mistake.</p></div>
      <span className="s" aria-hidden="true">›</span></button>
    {quickLogs && <DailyLogSheet days={7} onClose={() => setQuickLogs(false)} />}
    {log.length === 0 && <p className="s" style={{ marginTop: 'var(--sp-2)' }}>Weigh-ins, symptoms, grooming, vet visits and medicine show up here, newest first. A timeline like this is gold at the vet.</p>}
    <div ref={logRef}>{log.map((i) => <button key={i.id} data-settle-key={i.id} className="item" onClick={() => (i.kind === 'vet' ? go('health/visit/' + i.id) : setEditing({ kind: i.kind, item: i }))}>
      <div className="ico grey"><Icon name={ICON[i.kind]} /></div>
      <div className="sp"><b>{i.kind === 'vet' && isBooked(i) ? 'Vet visit (booked)' : TITLE[i.kind as Exclude<CareKind, 'food'>]}</b><p className="s">{summary(i)}</p></div>
      <span className="s" style={{ textAlign: 'right' }}>{fmt(i.at)}{nameOf(i.by) && <><br />{nameOf(i.by)}</>}</span></button>)}</div>
    </>}

    {drop.dragging && <DropNote />}
    {editing && <CareSheet key={editing.item?.id ?? editing.kind} editing={editing} onClose={() => setEditing(null)} />}
    {calFor && <CalendarSheet event={calFor} onClose={() => setCalFor(null)} />}
    {book && <BookSheet preset={book} onClose={() => setBook(null)} />}
  </div>;
}

const QUICK: Record<DailyWhat, string> = { fed: 'Fed', scoop: 'Scooped', play: 'Played', check: 'Daily check' };
const QUICK_ICON: Record<DailyWhat, string> = { fed: 'leaf', scoop: 'box', play: 'yarn', check: 'check' };
const clock = (at: number) => new Date(at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const quickDetail = (i: CareItem<'daily'>) => dailyDetail(i.data);

/** Desktop's Health log: one table across both columns (date · what · details · who, "who" once the household shares it), newest first, with the last 7 days'
    quick logs mixed in. A row opens what the list opens on phones: the visit page, the entry's form, or (quick logs)
    the 7-day quick-log sheet to fix a mistaken tap. The row's "what" is a real button, for the keyboard. */
export function HealthLogTable({ log, quick, who, onOpen, onQuickLogs }: { log: CareItem[]; quick: CareItem<'daily'>[]; who: (uid?: string) => string; onOpen: (i: CareItem) => void; onQuickLogs: () => void }) {
  const rows = [...log, ...quick].sort((a, b) => b.at - a.at);
  // "Who" only once someone else shares the cat (a column of blanks otherwise)
  const showWho = rows.some((i) => who(i.by));
  const settleRef = useSettle<HTMLTableSectionElement>(rows.map((i) => i.id)); // a new entry settles into place
  return <section className="healthlog" aria-labelledby="healthlog-h">
    <div className="row" style={{ marginTop: 22, alignItems: 'baseline' }}><h2 id="healthlog-h" className="sp" style={{ margin: 0 }}>Health log</h2>
      <button className="linkbtn s" onClick={onQuickLogs}>Quick logs, last 7 days ›</button></div>
    {rows.length === 0
      ? <p className="s" style={{ marginTop: 'var(--sp-2)' }}>Weigh-ins, symptoms, grooming, vet visits, medicine and the quick logs show up here, newest first. A timeline like this is gold at the vet.</p>
      : <div className="logtable-wrap"><table className="logtable">
        <thead><tr><th scope="col">Date</th><th scope="col">What</th><th scope="col">Details</th>{showWho && <th scope="col">Who</th>}</tr></thead>
        <tbody ref={settleRef}>{rows.map((i) => { const q = i.kind === 'daily' ? (i as CareItem<'daily'>) : null;
          return <tr key={i.id} data-settle-key={i.id} className={q ? 'quick' : undefined} onClick={() => (q ? onQuickLogs() : onOpen(i))}>
            <td className="num">{fmt(i.at)}{q && <span className="s"> · {clock(i.at)}</span>}</td>
            <td><button className="logopen" aria-label={q ? `${QUICK[q.data.what]} at ${clock(i.at)}: open the quick logs to fix it` : undefined}>
              <span className="ico grey" aria-hidden="true"><Icon name={q ? QUICK_ICON[q.data.what] : ICON[i.kind]} size={18} /></span>
              {q ? QUICK[q.data.what] : i.kind === 'vet' && isBooked(i) ? 'Vet visit (booked)' : TITLE[i.kind as Exclude<CareKind, 'food'>]}</button></td>
            <td>{q ? quickDetail(q) : summary(i)}</td>
            {showWho && <td>{who(i.by)}</td>}</tr>; })}</tbody></table></div>}
  </section>;
}

function Spark({ values }: { values: number[] }) {
  const w = 300, h = 60, min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 6 - ((v - min) / span) * (h - 12)]);
  return <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} style={{ marginTop: 'var(--sp-2)' }} aria-label={`Weight from ${values[0]} to ${values[values.length - 1]} pounds`}>
    <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.5" fill="var(--ink)" />)}</svg>;
}

/** The medicine form's Repeat + until as the entry's `course` (a repeating medicine has no single next-due date). */
function withCourse(f: any) {
  const { times, until, ...rest } = f;
  const n = Number(times) || 0;
  return n > 0 && until ? { ...rest, nextDue: undefined, course: { times: n, until } } : rest;
}

const DEFAULTS: Record<CareKind, Record<string, unknown>> = {
  food: { name: '', brand: '', type: 'wet', verdict: 'love', current: true, notes: '' },
  weight: { lb: '' }, symptom: { what: '', worried: false, notes: '' }, groom: { what: 'brush', notes: '' },
  vet: { reason: '', clinic: '', notes: '' }, med: { name: '', what: 'flea', nextDue: '', notes: '', times: '', until: '' }, doc: { title: '' }, daily: { what: 'fed' },
};

/** Bottom sheet with the form for one kind of entry; also edits and deletes. */
export function CareSheet({ editing, onClose }: { editing: NonNullable<Editing>; onClose: () => void }) {
  const { kind, item } = editing;
  const pt = usePetText();
  const { care, cat, pets } = useStore();
  // which cat (the chip in the header; switchable on a new entry when there are several), and an in-sheet question
  const [catId, setCatId] = useState(item?.catId ?? cat?.id ?? '');
  const [pickCat, setPickCat] = useState(false);
  const [asking, setAsking] = useState<'' | 'delete' | 'dup'>('');
  const shown = pets.find((p) => p.id === catId) ?? cat;
  const d0 = { ...(item?.data ?? {}), ...(editing.preset ?? {}) } as any;
  // a medicine's daily course shows as Repeat + until in the form
  if (d0.course) { d0.times = String(d0.course.times); d0.until = d0.course.until; delete d0.course; }
  const [day, setDay] = useState(editing.day ?? localDay(item?.at ?? Date.now()));
  // smart defaults for a new entry: the clinic from the last visit, the grooming you did last
  const [f, setF] = useState<any>(() => {
    const smart: Record<string, unknown> = {};
    if (!item && kind === 'vet') { const v = lastOf(care, 'vet'); if (v?.data.clinic) smart.clinic = v.data.clinic; }
    if (!item && kind === 'groom') { const g = lastOf(care, 'groom'); if (g) smart.what = g.data.what; }
    return { ...DEFAULTS[kind], ...smart, ...d0 };
  });
  const lastWeight = kind === 'weight' && !item ? lastOf(care, 'weight') : undefined;
  const presetName = !!editing.preset && 'name' in editing.preset;
  const repeats = kind === 'med' && !item && !presetName ? recentMeds(care) : [];
  const set = (k: string, v: unknown) => setF((x: any) => ({ ...x, [k]: v }));
  const ok = kind === 'doc' ? !!f.title?.trim() : kind === 'food' ? !!f.name.trim() : kind === 'weight' ? Number(f.lb) > 0 && Number(f.lb) < 40 : kind === 'symptom' ? !!f.what.trim() : kind === 'vet' ? !!f.reason.trim() : kind === 'med' ? !!f.name.trim() && (!f.times || !!f.until) : true;
  // a dose, weigh-in or symptom can belong to a visit: recent visits as chips, a visit that day picked by default
  const linkable = (kind === 'med' || kind === 'weight' || kind === 'symptom') && catId === cat?.id;
  const nearVisits = linkable ? care.filter((c): c is CareItem<'vet'> => c.kind === 'vet' && (c.data as CareData['vet']).status !== 'cancelled' && Math.abs(daysBetween(localDay(c.at), day)) <= 7)
    .sort((a, b) => Math.abs(daysBetween(localDay(a.at), day)) - Math.abs(daysBetween(localDay(b.at), day))).slice(0, 3) : [];
  const visitId: string | undefined = f.visitId === undefined ? (item ? undefined : nearVisits.find((v) => localDay(v.at) === day)?.id) : f.visitId || undefined;
  // the same dose or a weigh-in already logged that day: ask before adding another
  const dup = !item && catId === cat?.id && (kind === 'med' || kind === 'weight')
    ? care.find((c) => c.kind === kind && localDay(c.at) === day && (kind === 'weight' || (c.data as CareData['med']).name.trim().toLowerCase() === String(f.name ?? '').trim().toLowerCase())) : undefined;
  const label = (k: CareKind, d: any) => (k === 'weight' ? `${d.lb} lb` : k === 'med' || k === 'food' ? d.name : k === 'symptom' || k === 'groom' ? d.what : k === 'vet' ? d.reason : k === 'doc' ? d.title : TITLE[k as Exclude<CareKind, 'food'>]);
  const save = async (force = false) => {
    if (dup && !force) { setAsking('dup'); return; }
    const clean = (o: any) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v !== undefined));
    // a visit dated after today is booked; saving one on or after its day (e.g. adding what the vet said) makes it done
    const data = kind === 'weight' ? { lb: Math.round(Number(f.lb) * 100) / 100, ...(f.doc ? { doc: f.doc } : {}), ...(f.visitId ? { visitId: f.visitId } : {}) } : clean({ ...(kind === 'med' ? withCourse(f) : f), name: f.name?.trim?.() ?? f.name, ...(kind === 'vet' ? { status: f.status === 'cancelled' ? 'cancelled' : day > localDay(Date.now()) ? 'booked' : 'done' } : {}) });
    const linked = linkable ? { ...data, visitId } : data;
    const saved = await store.saveCare(kind, (kind === 'doc' ? { ...item!.data, title: f.title.trim(), visitId: docVisitId(care, item as CareItem<'doc'>, f.visitId) } : clean(linked)) as never,
      { id: item?.id, catId, at: (kind === 'food' || kind === 'doc') && item ? item.at : entryTime(day, Date.now(), item?.at) });
    onClose();
    // the same toast for every save: new → Undo removes it; an edit → Undo puts the old version back
    if (saved) showToast({ msg: `Saved · ${label(kind, saved.data)}${shown ? ` for ${shown.name}` : ''}`, action: { label: 'Undo', run: () => void (item
      ? store.saveCare(kind, item.data as never, { id: item.id, at: item.at, catId: item.catId }) : store.deleteCare(saved.id)) } });
    audio.sparkle();
  };
  const seg = <T extends string>(label: string, key: string, opts: [T, string][]) => <><span className="field">{label}</span>
    <div className="seg" role="group" aria-label={label}>{opts.map(([v, l]) => <button key={v} className={f[key] === v ? 'on' : ''} aria-pressed={f[key] === v} onClick={() => set(key, v)}>{l}</button>)}</div></>;
  const text = (label: string, key: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => <><label className="field" htmlFor={'c-' + key}>{label}</label>
    <input id={'c-' + key} className="in" value={f[key] ?? ''} onChange={(e) => set(key, e.target.value)} {...props} /></>;
  const when = kind !== 'food' && kind !== 'doc' && <><label className="field" htmlFor="c-day">Date</label><input id="c-day" className="in" type="date" value={day} max={kind === 'vet' ? undefined : localDay(Date.now())} onChange={(e) => setDay(e.target.value)} /></>;

  return <Sheet label={item ? 'Edit entry' : 'New entry'} onClose={onClose}>
      <div className="row" style={{ gap: 'var(--sp-2)' }}>
        {/* the cat this is for, always in the header; tap to switch on a new entry when there are several */}
        {shown && <button className="chipbtn" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, paddingLeft: 'var(--sp-2)', flex: 'none' }} disabled={!!item || pets.length < 2}
          aria-label={`For ${shown.name}${!item && pets.length > 1 ? ', tap to change' : ''}`} aria-expanded={!item && pets.length > 1 ? pickCat : undefined} onClick={() => setPickCat(!pickCat)}>
          <span aria-hidden="true" style={{ width: 26, height: 26, overflow: 'hidden', display: 'inline-flex', alignItems: 'flex-start', justifyContent: 'center' }}><Chester coat={shown.coat} eyes={shown.eyes} mood="happy" width={36} /></span>{shown.name}</button>}
        <b className="sp" style={{ fontSize: 18 }}>· {kind === 'food' ? (item ? 'Edit food or treat' : 'Add food or treat') : (item ? 'Edit ' : '') + TITLE[kind]}</b>
        <button className="iconbtn" aria-label="Close" onClick={onClose}><Icon name="close" /></button></div>
      {pickCat && !item && pets.length > 1 && <div className="row chiprow" role="group" aria-label="Which cat" style={{ gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
        {pets.map((p) => <button key={p.id} className={'chipbtn' + (p.id === catId ? ' on' : '')} aria-pressed={p.id === catId} onClick={() => { setCatId(p.id); setPickCat(false); }}>{p.name}</button>)}</div>}
      {kind === 'food' && !item && <FoodFinder known={care.filter((c): c is CareItem<'food'> => c.kind === 'food')} onCode={(code) => setF((x: any) => ({ ...x, code }))}
        onPick={(h) => setF((x: any) => ({ ...x, name: h.name, brand: h.brand ?? '', type: h.type, code: h.code, ingredients: h.ingredients, image: h.image }))} />}
      {kind === 'food' && <>{f.image && <img src={f.image} alt="" style={{ width: 72, height: 72, objectFit: 'contain', borderRadius: 12, background: 'var(--paper)', marginTop: 'var(--sp-3)' }} />}
        {text('Name', 'name', { placeholder: 'e.g. Chicken pâté' })}{text('Brand (optional)', 'brand')}
        {seg<FoodType>('Type', 'type', [['dry', 'Dry'], ['wet', 'Wet'], ['treat', 'Treat'], ['other', 'Other']])}
        {seg<Verdict>(pt('What he thinks'), 'verdict', [['love', 'Loves it'], ['ok', 'It’s OK'], ['no', 'Won’t eat it']])}
        <label className="row" style={{ marginTop: 14, gap: 10 }}><input type="checkbox" checked={!!f.current} onChange={(e) => set('current', e.target.checked)} style={{ width: 22, height: 22 }} /><span>We’re using this now</span></label>
        {text('Notes (optional)', 'notes', { placeholder: 'Flavor, where to buy, tummy trouble…' })}
        {f.ingredients && <details style={{ marginTop: 'var(--sp-3)' }}><summary className="s" style={{ fontWeight: 700 }}>Ingredients</summary><p className="s" style={{ marginTop: 6 }}>{f.ingredients}</p></details>}</>}
      {kind === 'doc' && item && <>{text('Name', 'title')}
        <DocVisitPicker care={care} doc={item as CareItem<'doc'>} value={f.visitId} onChange={(v) => set('visitId', v)} />
        <div className="row" style={{ gap: 'var(--sp-2)', marginTop: 'var(--sp-3)' }}>
          <button className="btn2" style={{ flex: 1 }} onClick={() => void openDoc((item as CareItem<'doc'>).data.path)}>Open document</button>
          {visitOfDoc(care, item as CareItem<'doc'>) && <button className="btn2" style={{ flex: 1 }} onClick={() => { onClose(); go('health/visit/' + visitOfDoc(care, item as CareItem<'doc'>)!.id); }}>Go to the visit</button>}</div>
        {(item.data as CareData['doc']).summary && <p className="s" style={{ marginTop: 10 }}>{(item.data as CareData['doc']).summary}</p>}</>}
      {kind === 'weight' && <>{text('Weight in pounds', 'lb', { inputMode: 'decimal', placeholder: lastWeight ? String(lastWeight.data.lb) : 'e.g. 3.4', autoFocus: !item })}
        {lastWeight && <p className="s" style={{ marginTop: 6 }}>Last time: {lastWeight.data.lb} lb on {fmt(lastWeight.at)}</p>}{when}</>}
      {kind === 'symptom' && <><span className="field">What did you notice?</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{SYMPTOMS.map((s) => <button key={s} className={`chipbtn ${f.what === s ? 'on' : ''}`} onClick={() => set('what', s === 'Other' ? '' : s)}>{s}</button>)}</div>
        {(!SYMPTOMS.includes(f.what) || f.what === '') && text('Describe it', 'what', { placeholder: 'What happened?' })}
        <label className="row" style={{ marginTop: 14, gap: 10 }}><input type="checkbox" checked={!!f.worried} onChange={(e) => set('worried', e.target.checked)} style={{ width: 22, height: 22 }} /><span>We’re worried about this</span></label>
        {text('Notes (optional)', 'notes')}{when}
        <p className="s" style={{ marginTop: 10, color: 'var(--peach-ink)' }}>If it’s on the “call the vet now” list, call now rather than waiting.</p></>}
      {kind === 'groom' && <>{seg<GroomWhat>('What', 'what', [['brush', 'Brush'], ['nails', 'Nails'], ['bath', 'Bath'], ['teeth', 'Teeth'], ['ears', 'Ears']])}{text('Notes (optional)', 'notes')}{when}
        {f.what === 'bath' && <p className="s" style={{ marginTop: 10 }}>{pt('Most cats don’t need baths: only when he gets into something, or the vet says so.')}</p>}</>}
      {kind === 'vet' && <>{text('Why you went', 'reason', { placeholder: 'e.g. Kitten shots, checkup', autoFocus: !item })}{text('Clinic (optional)', 'clinic')}{text('What the vet said (optional)', 'notes')}{when}{day > localDay(Date.now()) && text('Time (optional)', 'time', { type: 'time' })}</>}
      {kind === 'med' && <>{repeats.length > 0 && <><span className="field">Same as last time</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{repeats.map((m) => <button key={m.id} className={`chipbtn ${f.name === m.data.name ? 'on' : ''}`}
          onClick={() => setF((x: any) => ({ ...x, name: m.data.name, what: m.data.what, notes: m.data.notes ?? '', nextDue: nextDueLike(m, day) }))}>{m.data.name}</button>)}</div></>}
        {text('Name', 'name', { placeholder: 'e.g. FVRCP booster, Revolution', autoFocus: !item && !presetName })}
        {seg<MedWhat>('Kind', 'what', [['vaccine', 'Vaccine'], ['flea', 'Flea'], ['worm', 'Worms'], ['medicine', 'Other']])}{when}
        {seg<string>('Repeat', 'times', [['', 'Once'], ['1', 'Daily'], ['2', 'Twice a day'], ['3', '3× a day']])}
        {f.times ? <><label className="field" htmlFor="c-until">Every day until</label><input id="c-until" className="in" type="date" value={f.until ?? ''} min={day} onChange={(e) => set('until', e.target.value)} />
          <p className="s" style={{ marginTop: 6 }}>Home shows what’s left to give each day, with a one-tap Given.</p></>
          : <><label className="field" htmlFor="c-next">Next due (optional)</label><input id="c-next" className="in" type="date" value={f.nextDue ?? ''} min={day} onChange={(e) => set('nextDue', e.target.value)} /></>}
        {text('Notes (optional)', 'notes', { placeholder: 'Dose, which leg, reactions…' })}</>}
      {nearVisits.length > 0 && <><span className="field">Part of a visit?</span>
        <div className="row chiprow" role="group" aria-label="Part of a visit" style={{ gap: 6, flexWrap: 'wrap' }}>
          <button className={'chipbtn' + (!visitId ? ' on' : '')} aria-pressed={!visitId} onClick={() => set('visitId', '')}>No</button>
          {nearVisits.map((v) => <button key={v.id} className={'chipbtn' + (visitId === v.id ? ' on' : '')} aria-pressed={visitId === v.id} onClick={() => set('visitId', v.id)}>
            {(v.data as CareData['vet']).reason} · {fmt(v.at)}</button>)}</div></>}
      {asking === 'dup' && dup ? <div className="card butter" role="alert" style={{ marginTop: 'var(--sp-4)' }}>
          <b style={{ color: 'var(--butter-ink)' }}>Already logged at {new Date(dup.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}{kind === 'weight' ? ` (${(dup.data as CareData['weight']).lb} lb)` : ''}. Add another?</b>
          <div className="row" style={{ gap: 'var(--sp-2)', marginTop: 10 }}><button className="btn" style={{ flex: 1, marginTop: 0 }} onClick={() => void save(true)}>Add another</button>
            <button className="btn2" style={{ flex: 1 }} onClick={() => setAsking('')}>Cancel</button></div></div>
        : <button className="btn sheetsave" style={{ marginTop: 'var(--sp-5)' }} disabled={!ok} onClick={() => void save()}>{item ? 'Save changes' : 'Save'}</button>}
      {kind === 'vet' && ok && day > localDay(Date.now()) && (() => {
        const ev: CalEvent = { title: `${cat?.name ?? 'Pet'}: vet (${f.reason.trim()})`, day, time: f.time || undefined, place: f.clinic?.trim() || undefined, notes: f.notes?.trim() || undefined };
        return <div style={{ marginTop: 'var(--sp-3)' }}><span className="field">Add to calendar</span>
          <div className="row" style={{ gap: 'var(--sp-2)', marginTop: 6 }}>
            <button className="btn2" style={{ flex: 1 }} onClick={() => addToCalendar(ev, 'apple')}>Apple Calendar</button>
            <button className="btn2" style={{ flex: 1 }} onClick={() => addToCalendar(ev, 'google')}>Google Calendar</button></div>
          <p className="s" style={{ marginTop: 6 }}>Adds a reminder the day before.</p></div>;
      })()}
      {/* delete asks once, here in the sheet, then the same toast with Undo (a document's file can't come back) */}
      {item && (asking === 'delete' ? <div className="card peach" role="alert" style={{ marginTop: 'var(--sp-3)' }}>
          <b style={{ color: 'var(--peach-ink)' }}>Delete this {kind === 'doc' ? 'document' : TITLE[kind as Exclude<CareKind, 'food'>]?.toLowerCase() ?? 'entry'} for everyone?</b>
          <p className="s" style={{ color: 'var(--peach-ink)', marginTop: 2 }}>{kind === 'doc' ? 'The file is removed too.' : 'You can undo for a few seconds after.'}</p>
          <div className="row" style={{ gap: 'var(--sp-2)', marginTop: 10 }}>
            <button className="btn" style={{ flex: 1, marginTop: 0, background: 'var(--rose)' }} onClick={async () => {
              if (item.kind === 'doc') { await store.removeDoc(item as CareItem<'doc'>); onClose(); showToast({ msg: `Deleted · ${label('doc', item.data)}` }); return; }
              await store.deleteCare(item.id); onClose();
              showToast({ msg: `Deleted · ${label(item.kind, item.data)}`, action: { label: 'Undo', run: () => void store.saveCare(item.kind, item.data as never, { id: item.id, at: item.at, catId: item.catId }) } });
            }}>Delete</button>
            <button className="btn2" style={{ flex: 1 }} onClick={() => setAsking('')}>Keep it</button></div></div>
        : <button className="btn2" style={{ marginTop: 10, width: '100%', background: 'transparent', color: 'var(--rose)' }} onClick={() => setAsking('delete')}>Delete</button>)}
    </Sheet>;
}

/** Home: today at a glance. What's due (up to three), the last weight, and one-tap logging. */
export function TodayCard() {
  const { cat, care } = useStore();
  const due = useMemo(() => reminders(care).slice(0, 3), [care]);
  const ws = useMemo(() => weights(care), [care]);
  if (!cat) return null;
  const last = ws[ws.length - 1];
  const prev = ws[ws.length - 2];
  const delta = last && prev ? Math.round((last.data.lb - prev.data.lb) * 10) / 10 : null;
  return <div className="card sky">
    <div className="row"><b className="sp" style={{ fontSize: 'var(--fs-body)' }}>Today</b>
      {last && <a href="#/health" className="chip num" style={{ textDecoration: 'none' }}>{last.data.lb} lb{delta ? ` (${delta > 0 ? '+' : ''}${delta})` : ''}</a>}</div>
    {due.length ? due.map((r) => <a key={r.id} href="#/health" className="row" style={{ marginTop: 10, color: 'inherit', textDecoration: 'none', gap: 10 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', flex: 'none', background: r.daysLeft < 0 ? 'var(--rose)' : r.daysLeft <= 3 ? 'var(--butter-strong)' : 'var(--teal)' }} />
        <span className="sp" style={{ fontSize: 15 }}>{r.title}</span><span className="s">{dueText(r.daysLeft)}</span></a>)
      : <p className="s" style={{ marginTop: 6 }}>{care.length ? 'All caught up. Nothing due.' : `Start ${cat.name}’s health log: a weigh-in is a great first entry.`}</p>}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginTop: 'var(--sp-3)' }}>
      {([['weight', 'Weight', 'target'], ['symptom', 'Symptom', 'ear'], ['food', 'Food', 'leaf'], ['vet', 'Vet', 'box']] as const).map(([k, label, icon]) =>
        <button key={k} className="chipbtn" style={{ height: 'auto', minHeight: 58, borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--sp-1)', background: 'var(--surface)' }} onClick={() => { audio.chirp(); go('health/log/' + k); }}>
          <Icon name={icon} size={20} /><span style={{ fontSize: 'var(--fs-label)' }}>{label}</span></button>)}
    </div>
  </div>;
}

/** Home: medicine to give today (in-app reminders), with the cat's name on top and a one-tap Given that logs the dose
    ("Saved · Undo"). A course keeps its schedule on each dose; a next-due dose rolls on by the same gap as last time. */
export function MedsDueCard() {
  const { cat, care } = useStore();
  const due = useMemo(() => medsDue(care), [care]);
  const [busy, setBusy] = useState('');
  if (!cat || !due.length) return null;
  const give = async (d: MedDue) => {
    setBusy(d.key);
    try {
      const today = localDay(Date.now());
      const data: CareData['med'] = { name: d.last.data.name, what: d.last.data.what, ...(d.kind === 'course' ? { course: d.last.data.course } : (() => { const n = nextDueLike(d.last, today); return n ? { nextDue: n } : {}; })()) };
      const it = await store.saveCare('med', data, { at: Date.now() });
      if (it) showToast({ msg: `Saved · ${d.name} for ${cat.name}`, action: { label: 'Undo', run: () => void store.deleteCare(it.id) } });
      audio.sparkle();
    } finally { setBusy(''); }
  };
  return <div className="card peach" role="region" aria-label={`${cat.name}’s medicine today`}>
    <div className="row" style={{ gap: 'var(--sp-2)' }}><span aria-hidden="true" style={{ width: 28, height: 28, flex: 'none', overflow: 'hidden', display: 'inline-flex', alignItems: 'flex-start', justifyContent: 'center' }}><Chester coat={cat.coat} eyes={cat.eyes} mood="happy" width={38} /></span>
      <b className="sp" style={{ fontSize: 'var(--fs-body)', color: 'var(--peach-ink)' }}>{cat.name} · Medicine</b></div>
    {due.map((d) => <div key={d.key} className="row" style={{ marginTop: 10, gap: 10 }}>
      <div className="sp"><b style={{ fontSize: 15 }}>{d.name}</b>
        <p className="s" style={{ color: 'var(--peach-ink)' }}>{d.kind === 'course' ? `${d.given} of ${d.times} today · until ${fmt(noon(d.until!))}` : d.daysLeft < 0 ? `Overdue by ${-d.daysLeft} day${d.daysLeft === -1 ? '' : 's'}` : 'Due today'}</p></div>
      <button className="chipbtn" disabled={busy === d.key} onClick={() => void give(d)} aria-label={`Given: ${d.name}`}><Icon name="check" size={16} /> Given</button>
    </div>)}
  </div>;
}

/** Find a food by name or barcode in Open Pet Food Facts, and fill in the form from the pick. */
function FoodFinder({ onPick, onCode, known }: { onPick: (h: FoodHit) => void; onCode: (code: string) => void; known: CareItem<'food'>[] }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<FoodHit[] | null>(null);
  const [scan, setScan] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const run = async (fn: () => Promise<FoodHit[]>, notFound = 'Nothing matched. Fill it in below; it only takes a moment.') => {
    setBusy(true); setMsg(''); setHits(null);
    try { const h = await fn(); setHits(h); if (!h.length) setMsg(notFound); }
    catch { setMsg('Can’t reach the food databases right now (no signal?). Fill it in below.'); }
    finally { setBusy(false); }
  };
  /** A barcode: your own saved foods first (instant, works offline), then the open databases. */
  const lookup = (raw: string) => {
    const code = raw.replace(/\D/g, '');
    const mine = known.find((k) => k.data.code && sameCode(k.data.code, code));
    if (mine) {
      const d = mine.data; audio.chirp(true);
      onPick({ code: d.code!, name: d.name, brand: d.brand, type: d.type, ingredients: d.ingredients, image: d.image, forCats: true });
      setHits(null); setMsg(`You’ve added this one before: ${d.name}${d.verdict ? ` (${VERDICT_LABEL[d.verdict]})` : ''}.`); return;
    }
    onCode(code); // kept on the food even if the databases don't know it, so the next scan finds it in your list
    return run(async () => { const h = await byBarcode(code); if (h) { onPick(h); audio.chirp(true); } return h ? [h] : []; },
      'This one isn’t in the open food databases yet. Type its name below; the barcode is saved with it, so next time a scan fills it in.');
  };
  const isCode = /^[\d\s]{8,14}$/.test(q.trim());
  return <div className="card grey" style={{ marginTop: 'var(--sp-3)' }}>
    <b>Find it</b><p className="s" style={{ marginTop: 2 }}>Scan the barcode or search by name, and we’ll fill it in.</p>
    {scan ? <Scanner onCode={(c) => { setScan(false); setQ(c); void lookup(c); }} onClose={() => setScan(false)} />
      : <button className="btn2" style={{ marginTop: 10, width: '100%', background: 'var(--surface)' }} onClick={() => setScan(true)}>Scan barcode</button>}
    <div className="row" style={{ gap: 'var(--sp-2)', marginTop: 'var(--sp-2)' }}>
      <input className="in" style={{ background: 'var(--surface)' }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, brand or barcode numbers" aria-label="Search for a food or treat" enterKeyHint="search"
        onKeyDown={(e) => { if (e.key === 'Enter' && q.trim()) void (isCode ? lookup(q) : run(() => search(q))); }} />
      <button className="btn2" style={{ background: 'var(--surface)' }} disabled={busy || q.trim().length < 2} onClick={() => void (isCode ? lookup(q) : run(() => search(q)))}>{busy ? '…' : 'Find'}</button>
    </div>
    {msg && <p className="s" style={{ marginTop: 'var(--sp-2)' }} role="status">{msg}</p>}
    {hits && hits.length > 1 && hits.map((h) => <button key={h.code} className="hit" onClick={() => { onPick(h); setHits([h]); audio.chirp(true); }}>
      {h.image ? <img src={h.image} alt="" /> : <span className="ico grey" style={{ width: 44, height: 44 }} />}
      <span className="sp"><b style={{ fontSize: 'var(--fs-small)' }}>{h.name}</b><span className="s" style={{ display: 'block' }}>{[h.brand, h.quantity, h.forCats ? '' : 'not marked for cats'].filter(Boolean).join(' · ')}</span></span></button>)}
    {hits && hits.length === 1 && <p className="s" style={{ marginTop: 'var(--sp-2)' }} role="status">Filled in: <b>{hits[0].name}</b>. Check it below.</p>}
    <p className="s" style={{ marginTop: 'var(--sp-2)', fontSize: 11 }}>Product data from Open Pet Food Facts and Open Food Facts (open databases, ODbL).</p>
  </div>;
}

/** Which visit a document came from (newest visits first). */
function DocVisitPicker({ care, doc, value, onChange }: { care: CareItem[]; doc: CareItem<'doc'>; value?: string; onChange: (id: string) => void }) {
  const vs = care.filter((c): c is CareItem<'vet'> => c.kind === 'vet' && !c.deleted).sort((a, b) => b.at - a.at).slice(0, 30);
  const current = value === NO_VISIT ? '' : value ?? visitOfDoc(care, doc)?.id ?? '';
  if (!vs.length) return null;
  return <><label className="field" htmlFor="c-visit">From the visit</label>
    <select id="c-visit" className="in" value={current} onChange={(e) => onChange(e.target.value)}>
      <option value="">Not from a visit</option>
      {vs.map((v) => <option key={v.id} value={v.id}>{fmt(v.at)} · {v.data.reason}</option>)}
    </select></>;
}

/** One row of the reader's review. `save` says what it created or changed, so the whole batch can be undone. */
type Pick = { key: string; group: string; label: string; detail: string; on: boolean; already?: boolean; visit?: boolean;
  save: (ctx: { doc?: string; visitId?: string }) => Promise<{ created?: CareItem | null; before?: CareItem }> };
const GROUPS = ['Visit', 'Weight', 'Given today', 'Reminders', 'Past vaccines', 'For next time', 'Details'];

/** Add a vet document: read it on the phone, store it (when sharing is set up), then confirm which entries to add.
    `visit`: added from a visit's page, so the document, doses and weight it finds are linked to that visit (and what
    the vet said goes into its notes instead of making a new visit). `compact`: once there are documents, just the button. */
export function DocAdder({ signedIn, visit, compact, dropped }: { signedIn: boolean; visit?: CareItem<'vet'>; compact?: boolean; dropped?: Dropped }) {
  const [stage, setStage] = useState<'idle' | 'read' | 'review' | 'error'>('idle');
  const [msg, setMsg] = useState('');
  const [note, setNote] = useState('');
  const [progress, setProgress] = useState(0);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [doc, setDoc] = useState<CareItem<'doc'> | null>(null);
  const [target, setTarget] = useState<CareItem<'vet'> | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setStage('read'); setMsg(''); setNote(''); setProgress(0); setDoc(null);
    let r;
    try {
      const { textFromFile } = await import('../lib/ocr');
      const { parseVetPages } = await import('../lib/docparse');
      r = parseVetPages(await textFromFile(file, setProgress));
    } catch {
      setStage('error'); setMsg('Couldn’t read that file. Try a clear, flat photo in good light, or a PDF.'); return;
    }
    // keep the file too, when sharing is set up
    let d: CareItem<'doc'> | null = null;
    if (signedIn) {
      try { d = await store.addDoc(file); d = (await store.saveCare('doc', { ...d.data, title: r.title, docDate: r.docDate ?? (visit ? localDay(visit.at) : undefined), summary: r.summary, categories: r.categories, type: guessDocType(`${r.title} ${r.summary}`), ...(visit ? { visitId: visit.id } : {}) }, { id: d.id, at: d.at })) as CareItem<'doc'> | null ?? d; setDoc(d); }
      catch (e) { setNote(/bucket|not found|404|row-level|policy/i.test(String((e as Error).message)) ? 'The file itself wasn’t saved: document storage isn’t set up in Supabase yet. Your log entries still save.' : 'The file itself wasn’t saved (' + (e as Error).message + '). Your log entries still save.'); }
    } else setNote('Only the details are saved. Sign in (Settings, from the gear on Home) to keep the document itself.');
    const at = (day: string | null) => (day ? noon(day) : r.docDate ? noon(r.docDate) : Date.now());
    const list: Pick[] = [];
    const careNow = store.get().care;
    // which visit this belongs to: the page it was added from, or a visit already logged on the papers' date
    const target = visit ?? (r.docDate ? careNow.find((c): c is CareItem<'vet'> => c.kind === 'vet' && localDay(c.at) === r.docDate && (c.data as CareData['vet']).status !== 'cancelled') : undefined);
    setTarget(target ?? null);
    const created = (x: CareItem | null) => ({ created: x });
    // profile details the pet doesn't have yet (birthday, microchip, neutered, home since)
    const cat = store.get().cat; const pr = r.profile;
    if (cat) {
      const changes: string[] = []; const patch: Partial<typeof cat> = {};
      if (pr.birthday && cat.birthday !== pr.birthday.slice(0, 7)) { patch.birthday = pr.birthday.slice(0, 7); changes.push('born ' + fmt(noon(pr.birthday))); }
      if (pr.microchip && cat.microchip !== pr.microchip) { patch.microchip = pr.microchip; changes.push('microchip ' + pr.microchip); }
      if (pr.altered && !cat.altered) { patch.altered = true; changes.push(cat.sex === 'f' ? 'spayed' : 'neutered'); }
      if (pr.adopted && cat.homeDate !== pr.adopted) { patch.homeDate = pr.adopted; changes.push('home since ' + fmt(noon(pr.adopted)) + (pr.adoptedFrom ? ` (from ${pr.adoptedFrom})` : '')); }
      if (changes.length) list.push({ key: 'profile', group: 'Details', label: `Update ${cat.name}’s profile`, detail: changes.join(' · '), on: true, save: async () => { await store.saveCat({ ...cat, ...patch }); return {}; } });
    }
    if (target) {
      // what the vet said goes into the visit's notes, not a new visit
      const parts = [...r.visits.map((v) => [v.reason, v.notes].filter(Boolean).join(': ')), ...r.history.problems].filter(Boolean);
      for (const n of r.history.notes) if (!parts.some((x) => x.includes(n))) parts.push(n); // the history's notes, unless a visit line already says it
      const said = parts.filter((x, i, a) => a.indexOf(x) === i).join('. ');
      if (said) list.push({ key: 'notes', group: 'For next time', label: 'Add to the visit’s notes', detail: said, on: !target.data.notes,
        save: async () => ({ before: target, created: null, ...(await store.saveCare('vet', { ...target.data, notes: [target.data.notes, said].filter(Boolean).join('\n') }, { id: target.id, at: target.at }), {}) }) });
    } else r.visits.forEach((v, i) => list.push({ key: 'v' + i, group: 'Visit', label: (/test/i.test(v.reason) ? 'Test: ' : 'Vet visit: ') + v.reason, detail: [v.notes, v.clinic, v.date && fmt(noon(v.date))].filter(Boolean).join(' · '), on: true, visit: true,
      save: async ({ doc }) => created(await store.saveCare('vet', { reason: v.reason, clinic: v.clinic ?? undefined, notes: v.notes ?? undefined, doc, status: 'done' }, { at: at(v.date) })) }));
    const atV = (day: string | null) => (target && !day ? target.at : at(day));
    const linked = (ctx: { visitId?: string }) => (ctx.visitId ? { visitId: ctx.visitId } : {});
    r.weights.forEach((w, i) => list.push({ key: 'w' + i, group: 'Weight', label: `${w.lb} lb`, detail: w.date ? fmt(noon(w.date)) : '', on: true,
      save: async (ctx) => created(await store.saveCare('weight', { lb: w.lb, doc: ctx.doc, ...linked(ctx) }, { at: atV(w.date) })) }));
    // doses: given that day (linked to the visit), earlier ones from the history, and reminders; one already logged starts unticked
    const logged = (name: string, day: string | null) => !!day && careNow.some((c) => c.kind === 'med' && localDay(c.at) === day && (c.data as CareData['med']).name.trim().toLowerCase() === name.toLowerCase());
    r.items.forEach((it, i) => {
      const already = logged(it.name, it.date);
      const group = !it.date ? 'Reminders' : it.date === r.docDate ? 'Given today' : 'Past vaccines';
      list.push({ key: 'm' + i, group, label: `${it.name} · ${MED_LABEL[it.kind].toLowerCase()}`, detail: [it.date && group !== 'Given today' && fmt(noon(it.date)), it.nextDue && 'next due ' + fmt(noon(it.nextDue)), it.notes, already && '✓ already logged'].filter(Boolean).join(' · '), on: !already, already,
        save: async (ctx) => created(await store.saveCare('med', { name: it.name, what: it.kind, nextDue: it.nextDue ?? undefined, notes: it.notes ?? undefined, doc: ctx.doc, ...(group === 'Given today' ? linked(ctx) : {}) }, { at: atV(it.date) })) });
    });
    // next-due dates from the papers' reminder list: on the latest dose of that name, a booked yearly exam, or a new reminder
    for (const [i, rm] of r.reminders.entries()) {
      if (r.items.some((it) => it.name === rm.name && it.nextDue === rm.due)) continue;
      const last = careNow.filter((c): c is CareItem<'med'> => c.kind === 'med' && (c.data as CareData['med']).name.trim().toLowerCase() === rm.name.toLowerCase()).sort((a, b) => b.at - a.at)[0];
      const exam = /exam/i.test(rm.name);
      if (exam && careNow.some((c) => c.kind === 'vet' && localDay(c.at) === rm.due)) continue;
      const already = !!last && last.data.nextDue === rm.due;
      list.push({ key: 'r' + i, group: 'Reminders', label: exam ? 'Book the yearly exam' : rm.name, detail: [fmt(noon(rm.due)), already && '✓ already set'].filter(Boolean).join(' · '), on: !already, already,
        save: async () => exam ? created(await store.saveCare('vet', { reason: 'Yearly exam', clinic: r.clinic ?? undefined, status: 'booked' }, { at: noon(rm.due) }))
          : last ? { before: last, ...(await store.saveCare('med', { ...last.data, nextDue: rm.due }, { id: last.id, at: last.at }), {}) }
          : created(await store.saveCare('med', { name: rm.name, what: /rabies|fvrcp|felv|vaccin/i.test(rm.name) ? 'vaccine' : 'medicine', nextDue: rm.due, notes: 'Reminder from the vet' }, { at: at(r.docDate) })) });
    }
    // details for the visit: the invoice total, the vet's name, body condition
    const details: Partial<CareData['vet']> = { ...(r.cost.total !== null ? { cost: r.cost.total } : {}), ...(r.vet ? { vetName: r.vet } : {}), ...(r.exam.bodyCondition ? { bcs: r.exam.bodyCondition } : {}) };
    if (Object.keys(details).length) list.push({ key: 'details', group: 'Details', label: 'Save on the visit', on: true,
      detail: [details.cost !== undefined && `Cost $${details.cost.toFixed(2)}`, details.vetName, details.bcs && `Body condition ${details.bcs}`].filter(Boolean).join(' · '),
      save: async (ctx) => { const id = target?.id ?? ctx.visitId; const v = id ? store.get().care.find((c): c is CareItem<'vet'> => c.id === id) : undefined; if (!v) return {};
        await store.saveCare('vet', { ...v.data, ...details }, { id: v.id, at: v.at }); return { before: v }; } });
    setPicks(list); setMsg(r.summary); setStage('review');
  };

  // a file dropped on the screen (desktop plan step 5): read it as if picked, and bring the reader into view
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!dropped) return;
    if (isDocFile(dropped.file)) void onFile(dropped.file);
    else { setStage('error'); setMsg('That file can’t be read. Drop a photo or a PDF.'); }
    const t = setTimeout(() => box.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' }), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dropped?.n]);

  // once there are documents, just the button (the explanation is for the first one)
  if (stage === 'idle' && compact) return <label className="btn2" style={{ cursor: 'pointer', width: '100%', marginTop: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'var(--grey)' }}><Icon name="plus" size={18} />Add a document
    <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} /></label>;
  return <div ref={box} className="card grey" style={{ marginTop: 10 }}>
    {stage === 'idle' && <><p className="s">Vet records, vaccine certificates, adoption papers or ESA/housing forms: snap a photo or pick a PDF (several pages is fine). It’s read right on your phone, free, and you check what it found before anything is saved.</p>
      <label className="btn" style={{ marginTop: 'var(--sp-3)', cursor: 'pointer' }}>Add a document
        <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} /></label></>}
    {stage === 'read' && <><p className="s" aria-live="polite">Reading the document on your phone… {progress > 0 ? Math.round(progress * 100) + '%' : 'getting ready (the first time takes a little longer)'}</p>
      <div className="bar" style={{ marginTop: 'var(--sp-2)' }}><i style={{ width: Math.max(4, progress * 100) + '%', animation: 'none' }} /></div></>}
    {stage === 'error' && <><p className="s" role="alert">{msg}</p><button className="btn2" style={{ marginTop: 10, background: 'var(--surface)' }} onClick={() => setStage('idle')}>OK</button></>}
    {stage === 'review' && <>
      <b>Here’s what it found</b>{msg && <p className="s" style={{ marginTop: 'var(--sp-1)' }}>{msg}</p>}
      {note && <p className="s" style={{ marginTop: 6, color: 'var(--peach-ink)' }}>{note}</p>}
      {picks.length === 0 && <p className="s" style={{ marginTop: 'var(--sp-2)' }}>Nothing to add to the log. The document is saved.</p>}
      {/* grouped like the papers: what was given that day, reminders, the history; anything already in the log starts unticked */}
      {GROUPS.filter((g) => picks.some((p) => p.group === g)).map((g) => <div key={g}>
        <p className="s" style={{ marginTop: 14, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase' }}>{g}{g === 'Given today' && (target || picks.some((p) => p.visit)) ? ' · linked to the visit' : ''}</p>
        {picks.map((p, i) => p.group !== g ? null : <label key={p.key} className="row" style={{ marginTop: 'var(--sp-2)', gap: 10, alignItems: 'flex-start', opacity: p.already && !p.on ? 0.6 : 1 }}>
          <input type="checkbox" checked={p.on} style={{ width: 22, height: 22, flex: 'none' }} onChange={(e) => setPicks(picks.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)))} />
          <span><b style={{ fontSize: 'var(--fs-small)' }}>{p.label}</b>{p.detail && <span className="s" style={{ display: 'block' }}>{p.detail}</span>}</span></label>)}
      </div>)}
      <p className="s" style={{ marginTop: 'var(--sp-3)' }}>Read on your phone, so check it against the paper. Anything it missed, you can add by hand afterwards.</p>
      <button className="btn" style={{ marginTop: 'var(--sp-3)' }} onClick={async () => {
        // the visit first (if the papers make one), so everything else links to it; then one Undo for the whole batch
        const chosen = picks.filter((p) => p.on).sort((x, y) => Number(!!y.visit) - Number(!!x.visit));
        const ctx: { doc?: string; visitId?: string } = { doc: doc?.id, visitId: target?.id };
        const made: CareItem[] = [], before: CareItem[] = [];
        for (const p of chosen) {
          const res = await p.save(ctx);
          if (res.created) { made.push(res.created); if (p.visit && !ctx.visitId) ctx.visitId = res.created.id; }
          if (res.before) before.push(res.before);
        }
        // the document belongs to the visit it was read as
        const docBefore = doc; if (doc && ctx.visitId && !visit) await store.saveCare('doc', { ...doc.data, visitId: ctx.visitId }, { id: doc.id, at: doc.at });
        audio.sparkle(); setStage('idle');
        const n = chosen.length; const where = target ? ` to ${fmt(target.at)}’s visit` : '';
        if (n) showToast({ msg: `Saved ${n} thing${n === 1 ? '' : 's'}${where}`, action: { label: 'Undo', run: () => void (async () => {
          for (const m of made) await store.deleteCare(m.id);
          for (const b of [...before].reverse()) await store.saveCare(b.kind, b.data as never, { id: b.id, at: b.at }); // newest change first, so the oldest version wins
          if (docBefore && ctx.visitId && !visit) await store.saveCare('doc', docBefore.data, { id: docBefore.id, at: docBefore.at });
        })() } });
      }}>{picks.some((p) => p.on) ? `Save ${picks.filter((p) => p.on).length} thing${picks.filter((p) => p.on).length === 1 ? '' : 's'}` : 'Done'}</button>
    </>}
  </div>;
}
