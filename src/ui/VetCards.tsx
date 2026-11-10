import { useState } from 'react';
import { store, useStore } from '../db/store';
import { RED_FLAGS, type CareItem } from '../engine/care';
import { localDay } from '../engine/day';
import { mapsHref, suggestClinic, telHref, visits, VISIT_REASONS, yourVets, type Vet, type VetData, type VetKind } from '../engine/vets';
import { downloadIcs, googleCalendarUrl, type CalEvent } from '../lib/calendar';
import { usePetText } from '../lib/pet';
import * as audio from '../lib/audio';
import { Icon } from './icons';

/* The vet part of Health (docs/plans/2026-11-09-vet-redesign.md, steps 1 and 2): who your vet is with one-tap Call
   and Directions, the emergency vet and the warning signs together, and visits: next, last, and Book a visit with one
   "Save and add to calendar". */

const fmtDay = (day: string) => new Date(day + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const fmtTime = (t?: string) => (t ? new Date(`2000-01-01T${t}:00`).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '');
const CAL_KEY = 'paldex-calendar';
/** Apple (.ics) unless this phone chose Google before. */
const calPref = (): 'apple' | 'google' => { try { return localStorage.getItem(CAL_KEY) === 'google' ? 'google' : 'apple'; } catch { return 'apple'; } };
const setCalPref = (c: 'apple' | 'google') => { try { localStorage.setItem(CAL_KEY, c); } catch { /* private mode */ } };

/** The calendar event for a visit: the clinic's address as the place, its phone in the notes, a stable id. */
export function visitEvent(catName: string, v: CareItem<'vet'>, vet?: Vet): CalEvent {
  const d = vet?.data;
  return { title: `${catName}: vet (${v.data.reason})`, day: localDay(v.at), time: v.data.time || undefined, uid: 'visit-' + v.id,
    place: d?.address || v.data.clinic || d?.clinic || undefined,
    notes: [v.data.clinic || d?.clinic, d?.phone && `Phone: ${d.phone}`, v.data.notes].filter(Boolean).join('\n') || undefined };
}

function CallButton({ vet, label, primary }: { vet: Vet; label: string; primary?: boolean }) {
  const tel = telHref(vet.data.phone);
  if (!tel) return null;
  return <a className={primary ? 'btn' : 'btn2'} href={tel} style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none', ...(primary ? {} : { background: 'var(--surface)', color: 'inherit' }) }}
    onClick={() => audio.chirp()}><Icon name="phone" size={18} />{label}</a>;
}

/** Top of Health: your vet, Call, Directions, the emergency vet and "Is this an emergency?". */
export function VetCard() {
  const { vets, care, cat } = useStore();
  const pt = usePetText();
  const { primary, emergency } = yourVets(vets);
  const [edit, setEdit] = useState<{ kind: VetKind; vet?: Vet; clinic?: string } | null>(null);
  const [sos, setSos] = useState(false);
  if (!cat) return null;
  const suggestion = !primary ? suggestClinic(care) : null;
  return <>
    <div className="card white vetcard" aria-label="Your vet">
      <div className="row"><span className="s sp" style={{ fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase' }}>Your vet</span>
        {primary && <button className="btn2" style={{ minHeight: 36, background: 'var(--grey)' }} onClick={() => setEdit({ kind: 'primary', vet: primary })}>Edit</button>}</div>
      {primary ? <>
        <b style={{ fontSize: 19, display: 'block', marginTop: 4 }}>{primary.data.clinic}</b>
        {(primary.data.vetName || primary.data.address) && <p className="s">{[primary.data.vetName, primary.data.address].filter(Boolean).join(' · ')}</p>}
        <div className="row" style={{ gap: 8, marginTop: 12 }}>
          {telHref(primary.data.phone) ? <CallButton vet={primary} label="Call" primary /> : <button className="btn" style={{ flex: 1 }} onClick={() => setEdit({ kind: 'primary', vet: primary })}>Add their phone</button>}
          {mapsHref(primary.data) && <a className="btn2" href={mapsHref(primary.data)!} target="_blank" rel="noreferrer" style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none', color: 'inherit', background: 'var(--grey)' }}><Icon name="pin" size={18} />Directions</a>}
        </div>
      </> : <>
        <b style={{ fontSize: 17, display: 'block', marginTop: 4 }}>Add your vet</b>
        <p className="s" style={{ marginTop: 2 }}>One tap to call them, or get directions, when you need to.</p>
        {suggestion
          ? <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}><button className="btn" style={{ flex: 1, minWidth: 180 }} onClick={() => setEdit({ kind: 'primary', clinic: suggestion })}>Is {suggestion} your vet?</button>
              <button className="btn2" style={{ background: 'var(--grey)' }} onClick={() => setEdit({ kind: 'primary' })}>Someone else</button></div>
          : <button className="btn" style={{ marginTop: 12 }} onClick={() => setEdit({ kind: 'primary' })}>Add your vet</button>}
      </>}
      <div className="row" style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--grey)', gap: 8 }}>
        <span className="sp s">{emergency ? <>Emergency: <b style={{ color: 'var(--ink)' }}>{emergency.data.clinic}</b></> : 'No emergency vet saved'}</span>
        {emergency && telHref(emergency.data.phone) ? <a className="btn2" href={telHref(emergency.data.phone)!} style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', color: 'var(--peach-ink)', background: 'var(--peach)' }}><Icon name="phone" size={16} />Call</a>
          : <button className="btn2" style={{ minHeight: 44, background: 'var(--grey)' }} onClick={() => setEdit({ kind: 'emergency', vet: emergency })}>{emergency ? 'Add phone' : 'Add'}</button>}
      </div>
      <button className="btn2" style={{ width: '100%', marginTop: 10, background: 'var(--peach)', color: 'var(--peach-ink)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={() => setSos(true)}>
        <Icon name="ear" size={18} />Is this an emergency?</button>
    </div>
    {sos && <div className="overlay sheetbg" onClick={() => setSos(false)}><div className="sheet" role="dialog" aria-modal="true" aria-label="Is this an emergency?" onClick={(e) => e.stopPropagation()}>
      <div className="row"><b className="sp" style={{ fontSize: 18 }}>Call now if {cat.name}…</b><button className="iconbtn" aria-label="Close" onClick={() => setSos(false)}><Icon name="close" /></button></div>
      <ul className="s" style={{ margin: '10px 0 0', paddingLeft: 18 }}>{RED_FLAGS.map((f) => <li key={f} style={{ marginTop: 5 }}>{pt(f)}</li>)}</ul>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
        {primary && <CallButton vet={primary} label={`Call ${primary.data.clinic}`} primary />}
        {emergency && <CallButton vet={emergency} label={`Call ${emergency.data.clinic} (emergency)`} />}
        {!primary && !emergency && <p className="s">Save your vet and an emergency vet on the Health page so their numbers are right here.</p>}
      </div>
      <p className="s" style={{ marginTop: 10 }}>This app can’t diagnose anything. If you’re unsure, call.</p>
    </div></div>}
    {edit && <VetSheet kind={edit.kind} vet={edit.vet} clinic={edit.clinic} onClose={() => setEdit(null)} />}
  </>;
}

/** Add or edit a vet: clinic, vet's name, phone, address, website, notes. */
function VetSheet({ kind, vet, clinic, onClose }: { kind: VetKind; vet?: Vet; clinic?: string; onClose: () => void }) {
  const [f, setF] = useState<VetData>(() => vet?.data ?? { kind, clinic: clinic ?? '' });
  const set = (k: keyof VetData, v: string) => setF((x) => ({ ...x, [k]: v }));
  const field = (k: keyof VetData, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => <><label className="field" htmlFor={'vet-' + k}>{label}</label>
    <input id={'vet-' + k} className="in" value={(f[k] as string) ?? ''} onChange={(e) => set(k, e.target.value)} {...props} /></>;
  const save = async () => {
    const clean = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]).filter(([, v]) => v !== '')) as unknown as VetData;
    await store.saveVet({ ...clean, kind: f.kind }, vet?.id); audio.sparkle(); onClose();
  };
  return <div className="overlay sheetbg" onClick={onClose}><div className="sheet" role="dialog" aria-modal="true" aria-label={kind === 'emergency' ? 'Emergency vet' : 'Your vet'} onClick={(e) => e.stopPropagation()}>
    <div className="row"><b className="sp" style={{ fontSize: 18 }}>{vet ? 'Edit ' : 'Add '}{kind === 'emergency' ? 'emergency vet' : 'your vet'}</b><button className="iconbtn" aria-label="Close" onClick={onClose}><Icon name="close" /></button></div>
    {kind === 'emergency' && !vet && <p className="s" style={{ marginTop: 4 }}>A 24-hour or after-hours clinic, for when your vet is closed.</p>}
    {field('clinic', 'Clinic', { placeholder: kind === 'emergency' ? 'e.g. CityPets 24h Emergency' : 'e.g. Maple Street Vet', autoFocus: !f.clinic })}
    {field('phone', 'Phone', { type: 'tel', inputMode: 'tel', autoComplete: 'tel', placeholder: '(555) 010-0100' })}
    {field('address', 'Address (for directions)', { autoComplete: 'street-address' })}
    {kind === 'primary' && field('vetName', 'Vet’s name (optional)', { placeholder: 'e.g. Dr. Patel' })}
    {field('website', 'Website (optional)', { type: 'url', inputMode: 'url' })}
    {field('notes', 'Notes (optional)', { placeholder: 'Hours, parking, who to ask for…' })}
    <button className="btn" style={{ marginTop: 18 }} disabled={!f.clinic?.trim()} onClick={save}>Save</button>
    {vet && <button className="btn2" style={{ marginTop: 10, width: '100%', background: 'transparent', color: 'var(--rose)' }} onClick={async () => { if (confirm('Remove this vet for everyone in your household?')) { await store.deleteVet(vet.id); onClose(); } }}>Remove</button>}
  </div></div>;
}

/** Visits: the next one (Add to calendar), "How did the visit go?" after a booked day, the last one, Book a visit. */
export function VisitsCard({ onOpen }: { onOpen: (v: CareItem<'vet'>) => void }) {
  const { care, cat, vets } = useStore();
  const [book, setBook] = useState(false);
  if (!cat) return null;
  const { next, last, due } = visits(care);
  const { primary } = yourVets(vets);
  const vetOf = (v: CareItem<'vet'>) => vets.find((x) => x.id === v.data.vetId) ?? primary;
  const line = (v: CareItem<'vet'>, withTime = false) => [fmtDay(localDay(v.at)), withTime && fmtTime(v.data.time), v.data.reason].filter(Boolean).join(' · ');
  const nDocs = (v: CareItem<'vet'>) => care.filter((c) => c.kind === 'doc' && !c.deleted && localDay(c.at) === localDay(v.at)).length + (v.data.doc ? 1 : 0);
  return <>
    <div className="card white" aria-label="Visits">
      <span className="s" style={{ fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase' }}>Visits</span>
      {due && <button className="row visitrow" style={{ background: 'var(--butter)', borderRadius: 16, padding: '10px 12px', marginTop: 8 }} onClick={() => onOpen(due)}>
        <span className="sp"><b>How did {cat.name}’s visit go?</b><span className="s" style={{ display: 'block', color: 'var(--butter-ink)' }}>{line(due)} · add what the vet said</span></span><span className="chip">Add notes</span></button>}
      <div className="row visitrow" style={{ marginTop: 8 }}>
        <span className="s" style={{ width: 44, fontWeight: 800 }}>Next</span>
        {next ? <><button className="sp" style={{ border: 0, background: 'none', padding: 0, textAlign: 'left', color: 'inherit', font: 'inherit' }} onClick={() => onOpen(next)}><b>{line(next, true)}</b>{next.data.clinic && <span className="s" style={{ display: 'block' }}>{next.data.clinic}</span>}</button>
          <button className="iconbtn" style={{ background: 'var(--grey)' }} aria-label="Add to calendar" onClick={() => { const ev = visitEvent(cat.name, next, vetOf(next)); if (calPref() === 'google') window.open(googleCalendarUrl(ev), '_blank'); else downloadIcs(ev); }}><Icon name="cal" size={20} /></button></>
          : <span className="sp s">Nothing booked</span>}
      </div>
      <div className="row visitrow" style={{ marginTop: 6 }}>
        <span className="s" style={{ width: 44, fontWeight: 800 }}>Last</span>
        {last ? <button className="sp" style={{ border: 0, background: 'none', padding: 0, textAlign: 'left', color: 'inherit', font: 'inherit' }} onClick={() => onOpen(last)}><b>{line(last)}</b>
          <span className="s" style={{ display: 'block' }}>{[last.data.clinic, nDocs(last) ? `${nDocs(last)} document${nDocs(last) === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ') || 'Tap to see notes'}</span></button>
          : <span className="sp s">No visits logged yet</span>}
      </div>
      <button className="btn" style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={() => { audio.chirp(); setBook(true); }}><Icon name="plus" size={18} />Book a visit</button>
    </div>
    {book && <BookSheet onClose={() => setBook(false)} />}
  </>;
}

/** Book a visit: one screen, then one action that saves it and adds it to the calendar (Apple unless you chose Google). */
function BookSheet({ onClose }: { onClose: () => void }) {
  const { cat, vets } = useStore();
  const { primary, emergency } = yourVets(vets);
  const choices = [primary, emergency].filter(Boolean) as Vet[];
  const [vetId, setVetId] = useState(primary?.id ?? emergency?.id ?? '');
  const [other, setOther] = useState(choices.length ? '' : ' ');
  const [reason, setReason] = useState<string>('Checkup');
  const [custom, setCustom] = useState('');
  const tomorrow = localDay(Date.now() + 864e5);
  const [day, setDay] = useState(tomorrow);
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  if (!cat) return null;
  const vet = other ? undefined : vets.find((v) => v.id === vetId);
  const clinic = (other ? other.trim() : vet?.data.clinic) ?? '';
  const why = reason === 'Other' ? custom.trim() : reason;
  const ok = !!why && !!day && !busy;
  const save = async (cal: 'apple' | 'google' | null) => {
    if (!ok) return;
    // Google opens in a new tab, which the browser only allows straight from the tap, so open it first
    const tab = cal === 'google' ? window.open('', '_blank') : null;
    setBusy(true);
    const data = { reason: why, ...(clinic ? { clinic } : {}), ...(time ? { time } : {}), ...(notes.trim() ? { notes: notes.trim() } : {}), ...(vet ? { vetId: vet.id } : {}), status: 'booked' as const };
    const item = await store.saveCare('vet', data, { at: Date.parse(day + 'T12:00:00') }) as CareItem<'vet'> | null;
    setBusy(false);
    if (item && cal) { setCalPref(cal); const ev = visitEvent(cat.name, item, vet); if (cal === 'google' && tab) tab.location.href = googleCalendarUrl(ev); else downloadIcs(ev); }
    else tab?.close();
    audio.sparkle(); onClose();
  };
  const pref = calPref();
  return <div className="overlay sheetbg" onClick={onClose}><div className="sheet" role="dialog" aria-modal="true" aria-label="Book a visit" onClick={(e) => e.stopPropagation()}>
    <div className="row"><b className="sp" style={{ fontSize: 18 }}>Book a visit for {cat.name}</b><button className="iconbtn" aria-label="Close" onClick={onClose}><Icon name="close" /></button></div>
    <span className="field">Clinic</span>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {choices.map((v) => <button key={v.id} className={`chipbtn ${!other && vetId === v.id ? 'on' : ''}`} onClick={() => { setVetId(v.id); setOther(''); }}>{v.data.clinic}{v.data.kind === 'emergency' ? ' (emergency)' : ''}</button>)}
      <button className={`chipbtn ${other ? 'on' : ''}`} onClick={() => setOther(other || ' ')}>Somewhere else</button>
    </div>
    {other && <input className="in" value={other.trim()} onChange={(e) => setOther(e.target.value || ' ')} placeholder="Clinic name" aria-label="Clinic name" />}
    <span className="field">For</span>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{[...VISIT_REASONS, 'Other'].map((r) => <button key={r} className={`chipbtn ${reason === r ? 'on' : ''}`} onClick={() => setReason(r)}>{r === 'Other' ? 'Other…' : r}</button>)}</div>
    {reason === 'Other' && <input className="in" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="What’s it for?" aria-label="What the visit is for" autoFocus />}
    <div className="row" style={{ gap: 8 }}>
      <div className="sp"><label className="field" htmlFor="bk-day">Date</label><input id="bk-day" className="in" type="date" value={day} min={localDay(Date.now())} onChange={(e) => setDay(e.target.value)} /></div>
      <div className="sp"><label className="field" htmlFor="bk-time">Time</label><input id="bk-time" className="in" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
    </div>
    <label className="field" htmlFor="bk-notes">Notes (optional)</label><input id="bk-notes" className="in" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Bring the vaccine card, fasting from midnight…" />
    <button className="btn" style={{ marginTop: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} disabled={!ok} onClick={() => void save(pref)}><Icon name="cal" size={18} />Save and add to calendar</button>
    <button className="btn2" style={{ width: '100%', marginTop: 8, background: 'transparent' }} disabled={!ok} onClick={() => void save(pref === 'apple' ? 'google' : 'apple')}>{pref === 'apple' ? 'Add to Google Calendar instead' : 'Add to Apple Calendar instead'}</button>
    <button className="btn2" style={{ width: '100%', marginTop: 4, background: 'transparent' }} disabled={!ok} onClick={() => void save(null)}>Just save</button>
    <p className="s" style={{ marginTop: 6 }}>The calendar event has the clinic’s address and phone, with reminders the day before{time ? ' and 2 hours before' : ''}.</p>
  </div></div>;
}
