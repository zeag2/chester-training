import { useState } from 'react';
import { store, useStore } from '../db/store';
import { MED_LABEL, type CareItem } from '../engine/care';
import { localDay } from '../engine/day';
import { visitLinks } from '../engine/docs';
import { bookingDay, fmtTime, isBooked, mapsHref, nextVaccines, telHref, yourVets } from '../engine/vets';
import type { CalEvent } from '../lib/calendar';
import { Icon } from '../ui/icons';
import { back as goBack } from '../ui/router';
import { useLayout } from '../ui/layout';
import { DocRow } from '../ui/DocRow';
import { BookSheet, visitCats, visitEvent, type BookPreset } from '../ui/VetCards';
import { CalendarSheet } from '../ui/CalendarChoice';
import { Sheet } from '../ui/Sheet';
import { CareSheet, DocAdder, type Editing } from './Care';

/* One visit (`#/health/visit/<id>`, step 3 of docs/plans/2026-11-09-vet-redesign.md): when and where, what the vet
   said, the doses given and the weight, and its documents, all linked by `visitId`. A booked visit offers the
   calendar, and once its day has passed asks how it went. */

const fmtDay = (ms: number) => new Date(ms).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
const fmtShortDay = (day: string) => new Date(day + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const fmtShort = (day: string) => new Date(day + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

export function VisitPage({ id }: { id: string }) {
  const { cat, care, vets, account } = useStore();
  const [editing, setEditing] = useState<Editing>(null);
  const [calFor, setCalFor] = useState<CalEvent | null>(null);
  const [book, setBook] = useState<BookPreset | null>(null);
  // after a reschedule or cancel: the changed event, to send to the calendar it was added to
  const [calChange, setCalChange] = useState<{ event: CalEvent; change: 'moved' | 'cancelled' } | null>(null);
  const [moving, setMoving] = useState(false);
  const big = useLayout() === 'desktop';
  const visit = care.find((c): c is CareItem<'vet'> => c.id === id && c.kind === 'vet');
  if (!cat) return null;
  const back = <div className="top"><button className="iconbtn" aria-label="Back to Health" onClick={() => goBack('health')}><Icon name="back" /></button>
    <b className="sp" style={{ fontSize: 17, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Vet visit</b></div>;
  if (!visit) return <div className="screen">{back}<p className="m" style={{ marginTop: 'var(--sp-4)' }}>This visit was deleted, or hasn’t reached this phone yet.</p>
    <button className="btn2" style={{ marginTop: 'var(--sp-3)' }} onClick={() => goBack('health')}>Back to Health</button></div>;

  const { primary } = yourVets(vets);
  // the clinic it was booked with, else your usual vet when it's the same clinic (or none was typed)
  const vet = vets.find((v) => v.id === visit.data.vetId && !v.deleted)
    ?? (primary && (!visit.data.clinic || visit.data.clinic.trim().toLowerCase() === primary.data.clinic.trim().toLowerCase()) ? primary : undefined);
  const clinic = visit.data.clinic || vet?.data.clinic;
  const booked = isBooked(visit);
  const cancelled = visit.data.status === 'cancelled';
  const seq = (visit.data.calSeq ?? 0) + 1;
  const who = visitCats(cat.name, visit);
  const together = who !== cat.name;
  // booked with other cats: the change goes to every cat's visit (one calendar event for them all); this one last,
  // so its saved copy carries the event
  const applyAll = async (change: (v: CareItem<'vet'>) => { data: CareItem<'vet'>['data']; at: number }) => {
    const all = await store.visitGroup(visit);
    for (const v of all.filter((x) => x.id !== visit.id)) { const c = change(v); await store.saveCare('vet', c.data, { id: v.id, at: c.at, catId: v.catId }); }
    const c = change(visit);
    return await store.saveCare('vet', c.data, { id: visit.id, at: c.at }) as CareItem<'vet'> | null;
  };
  const cancel = async () => {
    if (!confirm(together ? `Cancel the visit for ${who}? It stays on each cat’s page, marked cancelled.` : `Cancel ${cat.name}’s visit? It stays here, marked cancelled.`)) return;
    const item = await applyAll((v) => ({ data: { ...v.data, status: 'cancelled', calSeq: seq }, at: v.at }));
    if (item) setCalChange({ event: visitEvent(cat.name, item, vet), change: 'cancelled' });
  };
  const reschedule = async (newDay: string, time: string) => {
    const item = await applyAll((v) => { const { time: _old, ...rest } = v.data;
      return { data: { ...rest, ...(time ? { time } : {}), status: 'booked', calSeq: seq }, at: Date.parse(newDay + 'T12:00:00') }; });
    setMoving(false);
    if (item) setCalChange({ event: visitEvent(cat.name, item, vet), change: 'moved' });
  };
  const day = localDay(visit.at);
  const passed = day < localDay(Date.now());
  const { docs, doses, weight } = visitLinks(care, visit);
  // a saved vet's phone and address, or a one-off clinic's kept on the visit
  const tel = telHref(vet?.data.phone ?? visit.data.phone);
  const maps = vet ? mapsHref(vet.data) : visit.data.address ? mapsHref({ kind: 'primary', clinic: visit.data.clinic ?? '', address: visit.data.address }) : null;
  // after the visit: the vaccines it gave that are due again, for "Book the next one?"
  const again = !cancelled && (!booked || passed) ? nextVaccines(doses, care) : null;
  const log = (kind: 'med' | 'weight') => setEditing({ kind, preset: { visitId: visit.id } as never, day: passed || !booked ? day : localDay(Date.now()) });
  const h = (t: string) => <h2 style={{ marginTop: 'var(--sp-5)', fontSize: 17 }}>{t}</h2>;

  const details = <>
      <h1 style={{ marginTop: 'var(--sp-1)' }}>{visit.data.reason}</h1>
      <p className="m">{[fmtDay(visit.at), fmtTime(visit.data.time), clinic].filter(Boolean).join(' · ')}</p>
      {together && <p className="s" style={{ marginTop: 2 }}>Booked together with {visit.data.group!.names.filter((n) => n !== cat.name).join(' and ')}. Rescheduling or cancelling changes it for {visit.data.group!.names.length > 2 ? 'all of them' : 'both'}.</p>}
      {booked && <span className="chip" style={{ marginTop: 'var(--sp-2)', background: 'var(--teal)', color: 'var(--on-ink)' }}>Booked</span>}
      {cancelled && <span className="chip" style={{ marginTop: 'var(--sp-2)', background: 'var(--rose)', color: 'var(--on-ink)' }}>Cancelled</span>}
      {(tel || maps) && !cancelled && <div className="row" style={{ gap: 'var(--sp-2)', marginTop: 'var(--sp-3)' }}>
        {tel && <a className="btn2" href={tel} style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--sp-2)', textDecoration: 'none', color: 'inherit', background: 'var(--grey)' }}><Icon name="phone" size={18} />Call</a>}
        {maps && <a className="btn2" href={maps} target="_blank" rel="noreferrer" style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--sp-2)', textDecoration: 'none', color: 'inherit', background: 'var(--grey)' }}><Icon name="pin" size={18} />Directions</a>}
      </div>}
      {booked && passed && <button className="card butter row" style={{ width: '100%', textAlign: 'left', border: 0, marginTop: 'var(--sp-3)' }} onClick={() => setEditing({ kind: 'vet', item: visit })}>
        <span className="sp"><b>How did {cat.name}’s visit go?</b><span className="s" style={{ display: 'block', color: 'var(--butter-ink)' }}>Add what the vet said. Saving marks it done.</span></span><span className="chip">Add notes</span></button>}
      {booked && !passed && <button className="btn2" style={{ width: '100%', marginTop: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--sp-2)' }} onClick={() => setCalFor(visitEvent(cat.name, visit, vet))}><Icon name="cal" size={18} />Add to calendar</button>}
      {booked && !passed && <div className="row" style={{ gap: 'var(--sp-2)', marginTop: 'var(--sp-2)' }}>
        <button className="btn2 sp" style={{ background: 'var(--grey)' }} onClick={() => setMoving(true)}>Reschedule</button>
        <button className="btn2 sp" style={{ background: 'var(--grey)', color: 'var(--rose)' }} onClick={cancel}>Cancel visit</button></div>}
      {cancelled && <div className="row" style={{ gap: 'var(--sp-2)', marginTop: 'var(--sp-3)' }}>
        <button className="btn sp" onClick={() => setBook({ reason: visit.data.reason, notes: visit.data.notes })}>Book again</button>
        <button className="btn2 sp" style={{ background: 'var(--grey)' }} onClick={() => setCalChange({ event: visitEvent(cat.name, visit, vet), change: 'cancelled' })}>Remove from calendar</button></div>}

      {/* a passed booking with no notes yet already asks "How did it go?" above: one prompt, not two */}
      {/* from the papers: the vet's name, body condition and what it cost */}
      {(visit.data.vetName || visit.data.bcs || visit.data.cost !== undefined) && <p className="s" style={{ marginTop: 'var(--sp-2)' }}>
        {[visit.data.vetName, visit.data.bcs && `Body condition ${visit.data.bcs}`, visit.data.cost !== undefined && `Cost $${visit.data.cost.toFixed(2)}`].filter(Boolean).join(' · ')}</p>}
      {(visit.data.notes || !(booked && passed)) && h((booked && !passed) || cancelled ? 'Notes' : 'What the vet said')}
      {visit.data.notes ? <p style={{ marginTop: 'var(--sp-1)', whiteSpace: 'pre-wrap' }}>{visit.data.notes}</p>
        : !(booked && passed) && !cancelled && <button className="btn2" style={{ marginTop: 6, background: 'var(--grey)' }} onClick={() => setEditing({ kind: 'vet', item: visit })}>{booked && !passed ? 'Add notes' : 'Add what the vet said'}</button>}

  </>;
  const given = <>
      {(!booked || passed) && !cancelled && <>
        {h('Given')}
        {doses.length === 0 && !weight && <p className="s">No doses or weight logged for this visit yet.</p>}
        {doses.map((m) => <button key={m.id} className="item" onClick={() => setEditing({ kind: 'med', item: m })}>
          <div className="ico grey"><Icon name="check" /></div>
          <div className="sp"><b>{m.data.name}</b><p className="s">{MED_LABEL[m.data.what]}{m.data.nextDue ? ` · next ${fmtShort(m.data.nextDue)}` : ''}</p></div></button>)}
        {weight && <button className="item" onClick={() => setEditing({ kind: 'weight', item: weight })}>
          <div className="ico grey"><Icon name="target" /></div><div className="sp"><b>Weight</b><p className="s">{weight.data.lb} lb</p></div></button>}
        <div className="row" style={{ gap: 'var(--sp-2)', marginTop: 10 }}>
          <button className="btn2" style={{ flex: 1, background: 'var(--grey)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={() => log('med')}><Icon name="plus" size={16} />Dose or vaccine</button>
          {!weight && <button className="btn2" style={{ flex: 1, background: 'var(--grey)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={() => log('weight')}><Icon name="plus" size={16} />Weight</button>}
        </div>
      </>}

  </>;
  const bookNext = <>
      {again && <button className="card sky row" style={{ width: '100%', textAlign: 'left', border: 0, marginTop: 'var(--sp-3)' }}
        onClick={() => setBook({ reason: 'Vaccines', day: bookingDay(again.due), notes: `${again.names.join(', ')} due ${fmtShortDay(again.due)}` })}>
        <span className="sp"><b>Book the next one?</b><span className="s" style={{ display: 'block' }}>{again.names.join(', ')} due again {fmtShortDay(again.due)}</span></span><span className="chip">Book</span></button>}

  </>;
  const documents = <>
      {h('Documents')}
      {docs.map((d) => <DocRow key={d.id} doc={d} onMore={() => setEditing({ kind: 'doc', item: d })} />)}
      {docs.length === 0 && <p className="s">{booked && !passed ? 'After the visit, add a photo of the invoice or certificate here.' : 'A photo of the invoice, certificate or discharge notes goes here.'}</p>}
      <DocAdder signedIn={!!account} visit={visit} compact />
  </>;
  const actions = <>
      <div className="row" style={{ gap: 'var(--sp-2)', marginTop: 'var(--sp-6)' }}>
        <button className="btn2 sp" style={{ background: 'var(--grey)' }} onClick={() => setEditing({ kind: 'vet', item: visit })}>Edit visit</button>
        <button className="btn2 sp" style={{ background: 'transparent', color: 'var(--rose)' }} onClick={async () => { if (confirm('Delete this visit for everyone? Its documents and doses stay in the log.')) { await store.deleteCare(visit.id); goBack('health', { replace: true }); } }}>Delete</button>
      </div>
  </>;

  return <div className={big ? 'screen wide' : 'screen'}>
    {back}
    {/* desktop (1100 px and up): details and actions on the left, documents, doses and weight on the right; phones
       keep the one column in the same order */}
    <div className="stag">
      {big ? <div className="healthcols">
        <div className="healthcol">{details}{bookNext}{actions}</div>
        <div className="healthcol">{given}{documents}</div>
      </div> : <>{details}{given}{bookNext}{documents}{actions}</>}
    </div>
    {editing && <CareSheet key={editing.item?.id ?? editing.kind} editing={editing} onClose={() => setEditing(null)} />}
    {calFor && <CalendarSheet event={calFor} onClose={() => setCalFor(null)} />}
    {book && <BookSheet preset={book} onClose={() => setBook(null)} />}
    {calChange && <CalendarSheet event={calChange.event} change={calChange.change} onClose={() => setCalChange(null)} />}
    {moving && <MoveSheet day={day} time={visit.data.time ?? ''} onSave={reschedule} onClose={() => setMoving(false)} />}
  </div>;
}

/** Reschedule: a new day and time (no time = all day). The calendar is asked about next. */
function MoveSheet({ day: day0, time: time0, onSave, onClose }: { day: string; time: string; onSave: (day: string, time: string) => Promise<void>; onClose: () => void }) {
  const [day, setDay] = useState(day0 < localDay(Date.now()) ? localDay(Date.now()) : day0);
  const [time, setTime] = useState(time0);
  const [busy, setBusy] = useState(false);
  const ok = !!day && day >= localDay(Date.now()) && (day !== day0 || time !== time0);
  return <Sheet label="Reschedule" onClose={onClose}>
    <div className="row"><b className="sp" style={{ fontSize: 18 }}>Reschedule</b><button className="iconbtn" aria-label="Close" onClick={onClose}><Icon name="close" /></button></div>
    <label className="field" htmlFor="mv-day">New day</label>
    <input id="mv-day" className="in" type="date" value={day} min={localDay(Date.now())} onChange={(e) => setDay(e.target.value)} />
    <label className="field" htmlFor="mv-time">Time</label>
    <input id="mv-time" className="in" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
    <p className="s" style={{ marginTop: 6 }}>{time ? 'Clear the time for an all-day visit.' : 'No time: an all-day visit.'}</p>
    <button className="btn" style={{ width: '100%', marginTop: 14 }} disabled={!ok || busy} onClick={async () => { setBusy(true); await onSave(day, time); }}>Save new time</button>
  </Sheet>;
}
