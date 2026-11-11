import { useEffect, useState } from 'react';
import { store, useStore } from '../db/store';
import { RED_FLAGS, type CareItem } from '../engine/care';
import { localDay } from '../engine/day';
import { fmtTime, mapsHref, suggestClinic, telHref, visits, VISIT_REASONS, yourVets, type Vet, type VetData, type VetKind } from '../engine/vets';
import { visitLinks } from '../engine/docs';
import { weekBefore, type CalEvent } from '../lib/calendar';
import { showToast } from './Toast';
import { addToCalendar, CalendarSheet, lastCalendar, rememberCalendar, type CalChoice } from './CalendarChoice';
import { usePetText } from '../lib/pet';
import * as audio from '../lib/audio';
import { Icon } from './icons';
import { Sheet } from './Sheet';

/* The vet part of Health (docs/plans/2026-11-09-vet-redesign.md, steps 1 and 2): who your vet is with one-tap Call
   and Directions, the emergency vet and the warning signs together, and visits: next, last, and Book a visit with one
   "Save and add to calendar" (Apple or Google, asked). */

const fmtDay = (day: string) => new Date(day + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

/** The calendar event for a visit: the clinic's address as the place (else its name), its phone in the notes, a
    stable id. The clinic's name goes in the notes only when the place is an address, so it isn't said twice. */
export function visitEvent(catName: string, v: CareItem<'vet'>, vet?: Vet): CalEvent {
  const d = vet?.data;
  const clinic = v.data.clinic || d?.clinic;
  const address = d?.address || v.data.address;
  const phone = d?.phone || v.data.phone;
  return { title: `${catName}: vet (${v.data.reason})`, day: localDay(v.at), time: v.data.time || undefined, uid: 'visit-' + v.id,
    place: address || clinic || undefined,
    notes: [address && clinic, phone && `Phone: ${phone}`, v.data.notes].filter(Boolean).join('\n') || undefined };
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
    {sos && <Sheet label="Is this an emergency?" onClose={() => setSos(false)}>
      <div className="row"><b className="sp" style={{ fontSize: 18 }}>Call now if {cat.name}…</b><button className="iconbtn" aria-label="Close" onClick={() => setSos(false)}><Icon name="close" /></button></div>
      <ul className="s" style={{ margin: '10px 0 0', paddingLeft: 18 }}>{RED_FLAGS.map((f) => <li key={f} style={{ marginTop: 5 }}>{pt(f)}</li>)}</ul>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
        {primary && <CallButton vet={primary} label={`Call ${primary.data.clinic}`} primary />}
        {emergency && <CallButton vet={emergency} label={`Call ${emergency.data.clinic} (emergency)`} />}
        {!primary && !emergency && <p className="s">Save your vet and an emergency vet on the Health page so their numbers are right here.</p>}
      </div>
      <p className="s" style={{ marginTop: 10 }}>This app can’t diagnose anything. If you’re unsure, call.</p>
    </Sheet>}
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
  return <Sheet label={kind === 'emergency' ? 'Emergency vet' : 'Your vet'} onClose={onClose}>
    <div className="row"><b className="sp" style={{ fontSize: 18 }}>{vet ? 'Edit ' : 'Add '}{kind === 'emergency' ? 'emergency vet' : 'your vet'}</b><button className="iconbtn" aria-label="Close" onClick={onClose}><Icon name="close" /></button></div>
    {kind === 'emergency' && !vet && <p className="s" style={{ marginTop: 4 }}>A 24-hour or after-hours clinic, for when your vet is closed.</p>}
    {field('clinic', 'Clinic', { placeholder: kind === 'emergency' ? 'e.g. CityPets 24h Emergency' : 'e.g. Maple Street Vet', autoFocus: !f.clinic })}
    {field('phone', 'Phone', { type: 'tel', inputMode: 'tel', autoComplete: 'tel', placeholder: '(555) 010-0100' })}
    {field('address', 'Address (for directions)', { autoComplete: 'street-address' })}
    {kind === 'primary' && field('vetName', 'Vet’s name (optional)', { placeholder: 'e.g. Dr. Patel' })}
    {field('website', 'Website (optional)', { type: 'url', inputMode: 'url' })}
    {field('notes', 'Notes (optional)', { placeholder: 'Hours, parking, who to ask for…' })}
    <button className="btn sheetsave" style={{ marginTop: 18 }} disabled={!f.clinic?.trim()} onClick={save}>Save</button>
    {vet && <button className="btn2" style={{ marginTop: 10, width: '100%', background: 'transparent', color: 'var(--rose)' }} onClick={async () => { if (confirm('Remove this vet for everyone in your household?')) { await store.deleteVet(vet.id); onClose(); } }}>Remove</button>}
  </Sheet>;
}

/** Visits: the next one (Add to calendar), "How did the visit go?" after a booked day, the last one, Book a visit. */
export function VisitsCard({ onOpen }: { onOpen: (v: CareItem<'vet'>) => void }) {
  const { care, cat, vets } = useStore();
  const [book, setBook] = useState(false);
  const [calFor, setCalFor] = useState<CalEvent | null>(null);
  if (!cat) return null;
  const { next, last, due } = visits(care);
  const { primary } = yourVets(vets);
  const vetOf = (v: CareItem<'vet'>) => vets.find((x) => x.id === v.data.vetId) ?? primary;
  const line = (v: CareItem<'vet'>, withTime = false) => [fmtDay(localDay(v.at)), withTime && fmtTime(v.data.time), v.data.reason].filter(Boolean).join(' · ');
  const nDocs = (v: CareItem<'vet'>) => visitLinks(care, v).docs.length;
  return <>
    <div className="card white" aria-label="Visits">
      <span className="s" style={{ fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase' }}>Visits</span>
      {due && <button className="row visitrow" style={{ background: 'var(--butter)', borderRadius: 16, padding: '10px 12px', marginTop: 8 }} onClick={() => onOpen(due)}>
        <span className="sp"><b>How did {cat.name}’s visit go?</b><span className="s" style={{ display: 'block', color: 'var(--butter-ink)' }}>{line(due)} · add what the vet said</span></span><span className="chip">Add notes</span></button>}
      <div className="row visitrow" style={{ marginTop: 8 }}>
        <span className="s" style={{ width: 44, fontWeight: 800 }}>Next</span>
        {next ? <><button className="sp" style={{ border: 0, background: 'none', padding: 0, textAlign: 'left', color: 'inherit', font: 'inherit' }} onClick={() => onOpen(next)}><b>{line(next, true)}</b>{next.data.clinic && <span className="s" style={{ display: 'block' }}>{next.data.clinic}</span>}</button>
          <button className="iconbtn" style={{ background: 'var(--grey)' }} aria-label="Add to calendar" onClick={() => setCalFor(visitEvent(cat.name, next, vetOf(next)))}><Icon name="cal" size={20} /></button></>
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
    {calFor && <CalendarSheet event={calFor} onClose={() => setCalFor(null)} />}
  </>;
}


/** What Book a visit starts with when opened from something that's due (Coming up, or "Book the next one?"). */
export interface BookPreset { reason?: string; day?: string; notes?: string }

/** Quick times most clinics offer; "Other…" opens the phone's own time picker. */
const TIMES = [['09:00', '9:00'], ['10:30', '10:30'], ['14:00', '2:00'], ['16:30', '4:30']] as const;

function useOnline() {
  const [on, setOn] = useState(() => typeof navigator === 'undefined' || navigator.onLine !== false);
  useEffect(() => {
    const f = () => setOn(navigator.onLine !== false);
    window.addEventListener('online', f); window.addEventListener('offline', f);
    return () => { window.removeEventListener('online', f); window.removeEventListener('offline', f); };
  }, []);
  return on;
}

type Clinic = { clinic: string; phone: string; address: string };
const trimmed = (c: Clinic) => ({ clinic: c.clinic.trim(), ...(c.phone.trim() ? { phone: c.phone.trim() } : {}), ...(c.address.trim() ? { address: c.address.trim() } : {}) });

/** Book a visit: the household vet (or "+ Add vet", which opens the vet's details right here and saves them as your
    vet, or "+ Other clinic" for a one-off visit somewhere else), Call the clinic at the top, what it's for, date and a
    quick time, then which calendar: Apple or Google, asked each time with the last choice preselected. Saving closes
    the sheet and says so in a toast with Undo. One sheet, no dead ends. */
export function BookSheet({ onClose, preset }: { onClose: () => void; preset?: BookPreset }) {
  const { cat, vets, care } = useStore();
  const { primary, emergency } = yourVets(vets);
  const [vetId, setVetId] = useState(primary?.id ?? emergency?.id ?? '');
  // 'add': "+ Add vet", saved as the household vet with the visit; 'other': a one-off clinic, kept on the visit only
  const [mode, setMode] = useState<'saved' | 'add' | 'other'>('saved');
  const [nv, setNv] = useState<Clinic>(() => ({ clinic: suggestClinic(care) ?? '', phone: '', address: '' }));
  const [ov, setOv] = useState<Clinic>({ clinic: '', phone: '', address: '' });
  const known = (VISIT_REASONS as readonly string[]).includes(preset?.reason ?? '');
  const [reason, setReason] = useState<string>(preset?.reason ? (known ? preset.reason : 'Other') : 'Checkup');
  const [custom, setCustom] = useState(preset?.reason && !known ? preset.reason : '');
  const [day, setDay] = useState(preset?.day ?? localDay(Date.now() + 864e5));
  const [time, setTime] = useState('');
  const [otherTime, setOtherTime] = useState(false);
  const [notes, setNotes] = useState(preset?.notes ?? '');
  const [cal, setCal] = useState<CalChoice | null>(lastCalendar);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const online = useOnline();
  if (!cat) return null;
  const choices = [primary, emergency].filter(Boolean) as Vet[];
  const saved = mode === 'saved' ? vets.find((v) => v.id === vetId && !v.deleted) : undefined;
  const typed = mode === 'add' ? nv : mode === 'other' ? ov : null;
  const call = typed ? { name: typed.clinic.trim(), tel: telHref(typed.phone) } : { name: saved?.data.clinic ?? '', tel: telHref(saved?.data.phone) };
  const why = reason === 'Other' ? custom.trim() : reason;
  // why Save can't be tapped yet, said under it (and read out with it)
  const blocker = typed && !typed.clinic.trim() ? 'Add the clinic’s name to save.' : !why ? 'Say what the visit is for to save.'
    : !day ? 'Pick a date to save.' : !cal ? 'Pick a calendar above (or Don’t add) to save.' : '';
  const ok = !blocker && !busy;
  // Google is a web link: offline it would open a dead tab, so the visit saves without it (Apple's .ics works offline)
  const googleOffline = cal === 'google' && !online;

  const save = async () => {
    if (!ok || !cal) return;
    // Google opens in a new tab, which the browser only allows straight from the tap, so open it first
    const tab = cal === 'google' && !googleOffline ? window.open('', '_blank') : null;
    setBusy(true); setErr('');
    try {
      let vet = saved;
      if (mode === 'add') {
        vet = (await store.saveVet({ kind: 'primary', ...trimmed(nv) })) ?? undefined;
        // saved: a retry after a failed visit save uses it instead of adding the vet twice
        if (vet) { setVetId(vet.id); setMode('saved'); }
      }
      const where = mode === 'other' ? trimmed(ov) : vet ? { clinic: vet.data.clinic } : {};
      const data = { reason: why, ...where, ...(time ? { time } : {}), ...(notes.trim() ? { notes: notes.trim() } : {}), ...(vet ? { vetId: vet.id } : {}), status: 'booked' as const };
      const item = await store.saveCare('vet', data, { at: Date.parse(day + 'T12:00:00') }) as CareItem<'vet'> | null;
      if (!item) throw new Error('The visit wasn’t saved');
      rememberCalendar(cal);
      const added = cal !== 'none' && !googleOffline;
      if (added) addToCalendar(visitEvent(cat.name, item, vet), cal, tab); else tab?.close();
      audio.sparkle(); onClose();
      showToast({
        msg: `Booked ${fmtDay(day)}${time ? ', ' + fmtTime(time) : ''}${added ? ' · Added to calendar' : googleOffline ? ' · Add it to Google Calendar once you’re online' : ''}`,
        action: { label: 'Undo', run: () => { void store.deleteCare(item.id); showToast({ msg: added ? 'Visit removed. Delete it from your calendar too.' : 'Visit removed.' }); } },
      });
    } catch {
      tab?.close(); setBusy(false);
      setErr('Couldn’t save the visit. Check your connection and try again.');
    }
  };
  const clinicFields = (c: Clinic, set: (f: (x: Clinic) => Clinic) => void, id: string, nameLabel: string) => {
    const f = (k: keyof Clinic, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => <><label className="field" htmlFor={id + k}>{label}</label>
      <input id={id + k} className="in" value={c[k]} onChange={(e) => { const v = e.target.value; set((x) => ({ ...x, [k]: v })); }} {...props} /></>;
    return <>{f('clinic', nameLabel, { placeholder: 'e.g. Maple Street Vet', autoFocus: true, autoComplete: 'organization' })}
      {f('phone', id === 'bk-ov-' ? 'Phone (optional)' : 'Phone', { type: 'tel', inputMode: 'tel', autoComplete: 'tel', placeholder: '(555) 010-0100' })}
      {f('address', id === 'bk-ov-' ? 'Address (optional)' : 'Address (for directions)', { autoComplete: 'street-address' })}</>;
  };
  const vetCard = (v: Vet) => <button key={v.id} className={`bkvet ${mode === 'saved' && vetId === v.id ? 'on' : ''}`} aria-pressed={mode === 'saved' && vetId === v.id} onClick={() => { setVetId(v.id); setMode('saved'); }}>
    <b>{v.data.clinic}{v.data.kind === 'emergency' ? ' (emergency)' : ''}</b>
    {(v.data.vetName || v.data.address || v.data.phone) && <span className="s" style={{ display: 'block' }}>{[v.data.vetName, v.data.address || v.data.phone].filter(Boolean).join(' · ')}</span>}</button>;
  const calLabel = googleOffline || cal === 'none' ? 'Save visit' : cal === 'apple' ? 'Save and add to Apple Calendar' : cal === 'google' ? 'Save and add to Google Calendar' : 'Save and add to calendar';
  return <Sheet label="Book a visit" onClose={onClose}>
    <div className="row"><b className="sp" style={{ fontSize: 18 }}>Book a visit for {cat.name}</b><button className="iconbtn" aria-label="Close" onClick={onClose}><Icon name="close" /></button></div>
    {call.tel && <div className="row bkcall">
      <span className="sp s">Call the clinic, then record what they gave you.</span>
      <a className="btn2" href={call.tel} aria-label={`Call ${call.name || 'the clinic'}`} onClick={() => audio.chirp()}><Icon name="phone" size={18} />Call</a></div>}
    <span className="field">Vet</span>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {choices.map(vetCard)}
      {!primary && mode !== 'add' && <button className="btn2 bkadd" onClick={() => setMode('add')}><Icon name="plus" size={18} />Add vet</button>}
      {mode !== 'other' && <button className="btn2 bkadd" onClick={() => setMode('other')}><Icon name="plus" size={18} />Other clinic</button>}
    </div>
    {mode === 'add' && <div className="bkvetform" aria-label="New vet">
      <div className="row"><b className="sp">Your vet</b><button className="btn2" style={{ minHeight: 36, background: 'transparent' }} onClick={() => setMode('saved')}>Cancel</button></div>
      {clinicFields(nv, setNv, 'bk-vet-', 'Vet or clinic name')}
      <p className="s" style={{ marginTop: 6 }}>Saved as your household’s vet, with Call and Directions on Health.</p>
    </div>}
    {mode === 'other' && <div className="bkvetform" aria-label="Other clinic">
      <div className="row"><b className="sp">Other clinic</b><button className="btn2" style={{ minHeight: 36, background: 'transparent' }} onClick={() => setMode('saved')}>Cancel</button></div>
      {clinicFields(ov, setOv, 'bk-ov-', 'Clinic name')}
      <p className="s" style={{ marginTop: 6 }}>Just for this visit{primary ? `: ${primary.data.clinic} stays your vet` : ''}.</p>
    </div>}
    <span className="field" id="bk-for">For</span>
    <div role="group" aria-labelledby="bk-for" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{[...VISIT_REASONS, 'Other'].map((r) => <button key={r} className={`chipbtn ${reason === r ? 'on' : ''}`} aria-pressed={reason === r} onClick={() => setReason(r)}>{r === 'Other' ? 'Other…' : r}</button>)}</div>
    {reason === 'Other' && <input className="in" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="What’s it for?" aria-label="What the visit is for" autoFocus={!preset?.reason} />}
    <label className="field" htmlFor="bk-day">Date</label><input id="bk-day" className="in" type="date" value={day} min={localDay(Date.now())} onChange={(e) => setDay(e.target.value)} />
    <span className="field" id="bk-time-l">Time</span>
    <div role="group" aria-labelledby="bk-time-l" className="bktimes">
      {TIMES.map(([v, label]) => { const on = !otherTime && time === v;
        return <button key={v} className={`chipbtn ${on ? 'on' : ''}`} aria-pressed={on} aria-label={fmtTime(v)} onClick={() => { setOtherTime(false); setTime(on ? '' : v); }}>{label}</button>; })}
      <button className={`chipbtn ${otherTime ? 'on' : ''}`} aria-pressed={otherTime} onClick={() => setOtherTime(true)}>Other…</button>
    </div>
    {otherTime && <input id="bk-time" className="in" type="time" aria-label="Time" value={time} onChange={(e) => setTime(e.target.value)} autoFocus />}
    {!time && <p className="s" style={{ marginTop: 6 }}>No time picked: it’s added as an all-day event.</p>}
    <label className="field" htmlFor="bk-notes">Notes (optional)</label><input id="bk-notes" className="in" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Bring the vaccine card, fasting from midnight…" />
    <span className="field" id="bk-cal">Add to calendar</span>
    <div role="radiogroup" aria-labelledby="bk-cal" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {([['apple', 'Apple Calendar'], ['google', 'Google Calendar'], ['none', 'Don’t add']] as const).map(([c, label]) =>
        <button key={c} role="radio" aria-checked={cal === c} className={`chipbtn ${cal === c ? 'on' : ''}`} onClick={() => setCal(c)}>{label}</button>)}
    </div>
    {googleOffline && <p className="s bkoffline" role="status">You’re offline. The Google Calendar link will work once you’re online; the visit still saves now. (Apple Calendar works offline.)</p>}
    <button className="btn sheetsave" style={{ marginTop: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} disabled={!ok} aria-describedby={blocker ? 'bk-why' : undefined} onClick={() => void save()}>{cal && cal !== 'none' && !googleOffline && <Icon name="cal" size={18} />}{busy ? 'Saving…' : calLabel}</button>
    {blocker && <p className="s" id="bk-why" style={{ marginTop: 6 }}>{blocker}</p>}
    {err && <p className="s" role="alert" style={{ marginTop: 6, color: 'var(--rose)', fontWeight: 700 }}>{err}</p>}
    {!blocker && cal && cal !== 'none' && !googleOffline && <p className="s" style={{ marginTop: 6 }}>The event has the clinic’s address and phone, with reminders {weekBefore({ title: '', day }) ? 'a week before, ' : ''}the day before{time ? ' and 2 hours before' : ''}.</p>}
  </Sheet>;
}
