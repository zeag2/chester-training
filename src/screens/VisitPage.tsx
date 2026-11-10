import { useState } from 'react';
import { store, useStore } from '../db/store';
import { MED_LABEL, type CareItem } from '../engine/care';
import { localDay } from '../engine/day';
import { visitLinks } from '../engine/docs';
import { bookingDay, fmtTime, isBooked, mapsHref, nextVaccines, telHref, yourVets } from '../engine/vets';
import type { CalEvent } from '../lib/calendar';
import { Icon } from '../ui/icons';
import { back as goBack } from '../ui/router';
import { DocRow } from '../ui/DocRow';
import { BookSheet, visitEvent, type BookPreset } from '../ui/VetCards';
import { CalendarSheet } from '../ui/CalendarChoice';
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
  const visit = care.find((c): c is CareItem<'vet'> => c.id === id && c.kind === 'vet');
  if (!cat) return null;
  const back = <div className="top"><button className="iconbtn" aria-label="Back to Health" onClick={() => goBack('health')}><Icon name="back" /></button>
    <b className="sp" style={{ fontSize: 17, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{visit ? visit.data.reason : 'Visit'}</b></div>;
  if (!visit) return <div className="screen">{back}<p className="m" style={{ marginTop: 16 }}>This visit was deleted, or hasn’t reached this phone yet.</p>
    <button className="btn2" style={{ marginTop: 12 }} onClick={() => goBack('health')}>Back to Health</button></div>;

  const { primary } = yourVets(vets);
  // the clinic it was booked with, else your usual vet when it's the same clinic (or none was typed)
  const vet = vets.find((v) => v.id === visit.data.vetId && !v.deleted)
    ?? (primary && (!visit.data.clinic || visit.data.clinic.trim().toLowerCase() === primary.data.clinic.trim().toLowerCase()) ? primary : undefined);
  const clinic = visit.data.clinic || vet?.data.clinic;
  const booked = isBooked(visit);
  const day = localDay(visit.at);
  const passed = day < localDay(Date.now());
  const { docs, doses, weight } = visitLinks(care, visit);
  // a saved vet's phone and address, or a one-off clinic's kept on the visit
  const tel = telHref(vet?.data.phone ?? visit.data.phone);
  const maps = vet ? mapsHref(vet.data) : visit.data.address ? mapsHref({ kind: 'primary', clinic: visit.data.clinic ?? '', address: visit.data.address }) : null;
  // after the visit: the vaccines it gave that are due again, for "Book the next one?"
  const again = !booked || passed ? nextVaccines(doses, care) : null;
  const log = (kind: 'med' | 'weight') => setEditing({ kind, preset: { visitId: visit.id } as never, day: passed || !booked ? day : localDay(Date.now()) });
  const h = (t: string) => <h2 style={{ marginTop: 20, fontSize: 17 }}>{t}</h2>;

  return <div className="screen">
    {back}
    <div className="stag">
      <h1 style={{ marginTop: 4 }}>{visit.data.reason}</h1>
      <p className="m">{[fmtDay(visit.at), fmtTime(visit.data.time), clinic].filter(Boolean).join(' · ')}</p>
      {booked && <span className="chip" style={{ marginTop: 8, background: 'var(--teal)', color: 'var(--on-ink)' }}>Booked</span>}
      {(tel || maps) && <div className="row" style={{ gap: 8, marginTop: 12 }}>
        {tel && <a className="btn2" href={tel} style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none', color: 'inherit', background: 'var(--grey)' }}><Icon name="phone" size={18} />Call</a>}
        {maps && <a className="btn2" href={maps} target="_blank" rel="noreferrer" style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none', color: 'inherit', background: 'var(--grey)' }}><Icon name="pin" size={18} />Directions</a>}
      </div>}
      {booked && passed && <button className="card butter row" style={{ width: '100%', textAlign: 'left', border: 0, marginTop: 12 }} onClick={() => setEditing({ kind: 'vet', item: visit })}>
        <span className="sp"><b>How did {cat.name}’s visit go?</b><span className="s" style={{ display: 'block', color: 'var(--butter-ink)' }}>Add what the vet said. Saving marks it done.</span></span><span className="chip">Add notes</span></button>}
      {booked && !passed && <button className="btn2" style={{ width: '100%', marginTop: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={() => setCalFor(visitEvent(cat.name, visit, vet))}><Icon name="cal" size={18} />Add to calendar</button>}

      {/* a passed booking with no notes yet already asks "How did it go?" above: one prompt, not two */}
      {(visit.data.notes || !(booked && passed)) && h(booked && !passed ? 'Notes' : 'What the vet said')}
      {visit.data.notes ? <p style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{visit.data.notes}</p>
        : !(booked && passed) && <button className="btn2" style={{ marginTop: 6, background: 'var(--grey)' }} onClick={() => setEditing({ kind: 'vet', item: visit })}>{booked && !passed ? 'Add notes' : 'Add what the vet said'}</button>}

      {(!booked || passed) && <>
        {h('Given')}
        {doses.length === 0 && !weight && <p className="s">No doses or weight logged for this visit yet.</p>}
        {doses.map((m) => <button key={m.id} className="item" onClick={() => setEditing({ kind: 'med', item: m })}>
          <div className="ico grey"><Icon name="check" /></div>
          <div className="sp"><b>{m.data.name}</b><p className="s">{MED_LABEL[m.data.what]}{m.data.nextDue ? ` · next ${fmtShort(m.data.nextDue)}` : ''}</p></div></button>)}
        {weight && <button className="item" onClick={() => setEditing({ kind: 'weight', item: weight })}>
          <div className="ico grey"><Icon name="target" /></div><div className="sp"><b>Weight</b><p className="s">{weight.data.lb} lb</p></div></button>}
        <div className="row" style={{ gap: 8, marginTop: 10 }}>
          <button className="btn2" style={{ flex: 1, background: 'var(--grey)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={() => log('med')}><Icon name="plus" size={16} />Dose or vaccine</button>
          {!weight && <button className="btn2" style={{ flex: 1, background: 'var(--grey)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={() => log('weight')}><Icon name="plus" size={16} />Weight</button>}
        </div>
      </>}

      {again && <button className="card sky row" style={{ width: '100%', textAlign: 'left', border: 0, marginTop: 12 }}
        onClick={() => setBook({ reason: 'Vaccines', day: bookingDay(again.due), notes: `${again.names.join(', ')} due ${fmtShortDay(again.due)}` })}>
        <span className="sp"><b>Book the next one?</b><span className="s" style={{ display: 'block' }}>{again.names.join(', ')} due again {fmtShortDay(again.due)}</span></span><span className="chip">Book</span></button>}

      {h('Documents')}
      {docs.map((d) => <DocRow key={d.id} doc={d} onMore={() => setEditing({ kind: 'doc', item: d })} />)}
      {docs.length === 0 && <p className="s">{booked && !passed ? 'After the visit, add a photo of the invoice or certificate here.' : 'A photo of the invoice, certificate or discharge notes goes here.'}</p>}
      <DocAdder signedIn={!!account} visit={visit} compact />

      <div className="row" style={{ gap: 8, marginTop: 24 }}>
        <button className="btn2 sp" style={{ background: 'var(--grey)' }} onClick={() => setEditing({ kind: 'vet', item: visit })}>Edit visit</button>
        <button className="btn2 sp" style={{ background: 'transparent', color: 'var(--rose)' }} onClick={async () => { if (confirm('Delete this visit for everyone? Its documents and doses stay in the log.')) { await store.deleteCare(visit.id); goBack('health', { replace: true }); } }}>Delete</button>
      </div>
    </div>
    {editing && <CareSheet key={editing.item?.id ?? editing.kind} editing={editing} onClose={() => setEditing(null)} />}
    {calFor && <CalendarSheet event={calFor} onClose={() => setCalFor(null)} />}
    {book && <BookSheet preset={book} onClose={() => setBook(null)} />}
  </div>;
}
