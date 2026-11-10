import { useMemo, useState } from 'react';
import { store, useStore } from '../db/store';
import { localDay } from '../engine/day';
import { usePetText } from '../lib/pet';
import {
  dueText, entryTime, GROOM, lastOf, MED_LABEL, nextDueLike, recentMeds, RED_FLAGS, reminders, SYMPTOMS, VERDICT_LABEL, typicalKittenWeight, weights,
  type CareData, type CareItem, type CareKind, type FoodType, type GroomWhat, type MedWhat, type Verdict,
} from '../engine/care';
import { Icon } from '../ui/icons';
import { kittenPlan } from '../engine/kittenplan';
import { downloadIcs, googleCalendarUrl, type CalEvent } from '../lib/calendar';
import { go } from '../ui/router';
import * as audio from '../lib/audio';
import { byBarcode, sameCode, search, type FoodHit } from '../lib/petfood';
import { Scanner } from './Scanner';
import { PetSwitcher } from '../ui/PetSwitcher';
import { CareTreatNote } from '../ui/CareTreatNote';
import { VetCard, VisitsCard, visitEvent } from '../ui/VetCards';
import { findDocs, guessDocType, visitOfDoc } from '../engine/docs';
import { isBooked } from '../engine/vets';
import { DocRow, openDoc } from '../ui/DocRow';

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
  const due = useMemo(() => reminders(care), [care]);
  const foods = care.filter((c): c is CareItem<'food'> => c.kind === 'food');
  // one-tap daily logs (meals, litter, play, checks) are summed up on Home, not listed here; symptoms from a check are
  const log = care.filter((c) => c.kind !== 'food' && c.kind !== 'doc' && c.kind !== 'daily').slice(0, 40);
  const docs = useMemo(() => findDocs(care), [care]);
  const ws = weights(care);
  const plan = useMemo(() => (cat ? kittenPlan(cat, care) : null), [cat, care]);
  const nameOf = (uid?: string) => (uid && uid !== account?.userId ? household?.members.find((m) => m.userId === uid)?.name : '') || '';
  if (!cat) return null;

  return <div className="screen">
    <h1 style={{ marginTop: 18 }}>{cat.name}’s health</h1>
    <PetSwitcher />
    <CareTreatNote />
    <p className="m" style={{ marginTop: 4 }}>{pt('Food he likes, his health log and what’s coming up')}{household && household.members.length > 1 ? ', shared with your household' : ''}.</p>
    {account && careSync === 'missing' && <div className="card butter"><b>One setup step left</b><p className="s" style={{ marginTop: 4, color: 'var(--butter-ink)' }}>Care is saved on this phone. To share it, run the care setup in Supabase (docs/sharing-setup.md, step 5).</p></div>}

    {/* vet first: who to call (and the warning signs), then visits; docs/plans/2026-11-09-vet-redesign.md */}
    <VetCard />
    <VisitsCard onOpen={(v) => go('health/visit/' + v.id)} />
    <button className="btn2" style={{ marginTop: 4, background: 'var(--sky)', display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => go('vet-summary')}><Icon name="box" size={18} />Summary for the vet</button>

    {due.length > 0 && <><h2 style={{ marginTop: 22 }}>Coming up</h2>
      {due.map((r) => <div key={r.id} className="row" style={{ gap: 8, marginTop: 10, alignItems: 'stretch' }}><button className={`card ${r.daysLeft < 0 ? 'peach' : 'sky'} row sp`} style={{ margin: 0 }}
        onClick={() => { const booked = r.kind === 'visit' ? care.find((c) => c.id === r.id.slice(6)) : undefined;
          if (booked) { go('health/visit/' + booked.id); return; }
          setEditing(r.kind === 'groom' ? { kind: 'groom', preset: { what: r.id.split(':')[1] as GroomWhat } } : r.kind === 'vet' ? { kind: 'vet', preset: { reason: 'Yearly checkup' } } : { kind: 'med', preset: { name: r.title } }); }}>
        <div className="ico"><Icon name={r.kind === 'groom' ? 'hand' : r.kind === 'vet' || r.kind === 'visit' ? 'box' : 'check'} /></div>
        <div className="sp"><b>{r.title}</b><p className="s">{r.detail}</p></div><span className="chip">{dueText(r.daysLeft)}</span></button>
        {r.daysLeft >= 0 && <button className="card grey" style={{ margin: 0, width: 56, padding: 0, display: 'grid', placeItems: 'center' }} aria-label={`Add ${r.title} to your calendar`}
          onClick={() => { const booked = r.kind === 'visit' ? care.find((c): c is CareItem<'vet'> => c.id === r.id.slice(6) && c.kind === 'vet') : undefined;
            downloadIcs(booked ? visitEvent(cat.name, booked, vets.find((v) => v.id === booked.data.vetId)) : { title: `${cat.name}: ${r.title}`, day: r.dueDay, notes: r.detail }); }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4M12 13v5M9.5 15.5h5" /></svg></button>}</div>)}</>}
    {plan && <><h2 style={{ marginTop: 22 }}>{pt('Kitten vaccines and checkups')}</h2>
      <div className="card white">
        {plan.map((st) => <button key={st.key} className="row" style={{ width: '100%', border: 0, background: 'none', padding: '8px 0', textAlign: 'left', color: 'inherit', font: 'inherit', alignItems: 'flex-start', gap: 10, minHeight: 44 }}
          onClick={() => setEditing('reason' in st.preset ? { kind: 'vet', preset: st.preset } : { kind: 'med', preset: st.preset })} aria-label={`${st.title}: ${st.done ? 'done' : 'not logged yet'}. Tap to log it.`}>
          <span aria-hidden="true" style={{ width: 22, height: 22, borderRadius: 11, flex: 'none', display: 'grid', placeItems: 'center', marginTop: 1, background: st.done ? 'var(--teal)' : 'transparent', color: 'var(--on-ink, #fff)', boxShadow: st.done ? 'none' : 'inset 0 0 0 2px var(--faint, #bbb)' }}>{st.done && <Icon name="check" size={14} />}</span>
          <span className="sp"><b style={{ fontSize: 15 }}>{st.title}</b><span className="s" style={{ display: 'block' }}>{st.done ? 'Done' : st.when}{!st.done && st.progress && !st.progress.startsWith('0') ? ` · ${st.progress}` : ''}</span></span></button>)}
        <p className="s" style={{ marginTop: 6 }}>The usual schedule, as a guide. Your vet sets the real one. Tap a row to log it.</p></div></>}

    <h2 style={{ marginTop: 22 }}>Log something</h2>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 10 }}>
      {(['weight', 'symptom', 'groom', 'vet', 'med'] as const).map((k) => <button key={k} className="chipbtn" style={{ height: 'auto', minHeight: 64, borderRadius: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, whiteSpace: 'normal', lineHeight: 1.15 }} onClick={() => { audio.chirp(); setEditing({ kind: k }); }}>
        <Icon name={ICON[k]} size={20} /><span style={{ fontSize: 12 }}>{k === 'med' ? 'Medicine' : TITLE[k]}</span></button>)}
      <button className="chipbtn" style={{ height: 'auto', minHeight: 64, borderRadius: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }} onClick={() => { audio.chirp(); setEditing({ kind: 'food' }); }}><Icon name="leaf" size={20} /><span style={{ fontSize: 12 }}>Food or treat</span></button>
    </div>

    {ws.length > 0 && <div className="card mint"><div className="row"><b className="sp">Weight</b><span className="chip num">{ws[ws.length - 1].data.lb} lb</span></div>
      {ws.length > 1 && <Spark values={ws.map((w) => w.data.lb)} />}
      <p className="s" style={{ marginTop: 6 }}>{ws.length} weigh-in{ws.length === 1 ? '' : 's'} · last {fmt(ws[ws.length - 1].at)}</p>
      {(() => { const g = typicalKittenWeight(cat.birthday); return g && <p className="s" style={{ marginTop: 4 }}>Typical at about {g.months} months: roughly {g.low}–{g.high} lb. A rough guide only; ask your vet.</p>; })()}</div>}

    <h2 style={{ marginTop: 22 }}>Food and treats</h2>
    {foods.length === 0 && <p className="s" style={{ marginTop: 8 }}>{pt('Add the food and treats you use, and whether he loves them. Handy at the store and for the vet.')}</p>}
    {(['love', 'ok', 'no'] as Verdict[]).map((v) => { const list = foods.filter((f) => f.data.verdict === v); if (!list.length) return null;
      return <div key={v} style={{ marginTop: 12 }}><p className="s" style={{ fontWeight: 800 }}>{VERDICT_LABEL[v]}</p>
        {list.map((f) => <button key={f.id} className="item" onClick={() => setEditing({ kind: 'food', item: f })}>
          <div className="sp"><b>{f.data.name}</b><p className="s">{[f.data.brand, f.data.type === 'treat' ? 'Treat' : f.data.type === 'wet' ? 'Wet food' : f.data.type === 'dry' ? 'Dry food' : 'Other', f.data.notes].filter(Boolean).join(' · ')}</p></div>
          {f.data.current && <span className="chip" style={{ background: 'var(--mint)' }}>Using now</span>}</button>)}</div>; })}

    <div className="row" style={{ marginTop: 22, alignItems: 'baseline' }}><h2 className="sp" style={{ margin: 0 }}>Documents</h2>
      {docs.length > 0 && <a href="#/health/docs" className="s" style={{ fontWeight: 800, color: 'var(--ink)' }}>All documents ({docs.length}) ›</a>}</div>
    {docs.slice(0, 3).map((d) => <DocRow key={d.id} doc={d} visit={visitOfDoc(care, d)} onMore={() => setEditing({ kind: 'doc', item: d })} />)}
    <DocAdder signedIn={!!account} compact={docs.length > 0} />

    <h2 style={{ marginTop: 22 }}>Health log</h2>
    {log.length === 0 && <p className="s" style={{ marginTop: 8 }}>Weigh-ins, symptoms, grooming, vet visits and medicine show up here, newest first. A timeline like this is gold at the vet.</p>}
    {log.map((i) => <button key={i.id} className="item" onClick={() => (i.kind === 'vet' ? go('health/visit/' + i.id) : setEditing({ kind: i.kind, item: i }))}>
      <div className="ico grey"><Icon name={ICON[i.kind]} /></div>
      <div className="sp"><b>{i.kind === 'vet' && isBooked(i) ? 'Vet visit (booked)' : TITLE[i.kind as Exclude<CareKind, 'food'>]}</b><p className="s">{summary(i)}</p></div>
      <span className="s" style={{ textAlign: 'right' }}>{fmt(i.at)}{nameOf(i.by) && <><br />{nameOf(i.by)}</>}</span></button>)}

    {editing && <CareSheet key={editing.item?.id ?? editing.kind} editing={editing} onClose={() => setEditing(null)} />}
  </div>;
}

function Spark({ values }: { values: number[] }) {
  const w = 300, h = 60, min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 6 - ((v - min) / span) * (h - 12)]);
  return <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} style={{ marginTop: 8 }} aria-label={`Weight from ${values[0]} to ${values[values.length - 1]} pounds`}>
    <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.5" fill="var(--ink)" />)}</svg>;
}

const DEFAULTS: Record<CareKind, Record<string, unknown>> = {
  food: { name: '', brand: '', type: 'wet', verdict: 'love', current: true, notes: '' },
  weight: { lb: '' }, symptom: { what: '', worried: false, notes: '' }, groom: { what: 'brush', notes: '' },
  vet: { reason: '', clinic: '', notes: '' }, med: { name: '', what: 'flea', nextDue: '', notes: '' }, doc: { title: '' }, daily: { what: 'fed' },
};

/** Bottom sheet with the form for one kind of entry; also edits and deletes. */
export function CareSheet({ editing, onClose }: { editing: NonNullable<Editing>; onClose: () => void }) {
  const { kind, item } = editing;
  const pt = usePetText();
  const { care, cat } = useStore();
  const d0 = { ...(item?.data ?? {}), ...(editing.preset ?? {}) } as any;
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
  const ok = kind === 'doc' ? !!f.title?.trim() : kind === 'food' ? !!f.name.trim() : kind === 'weight' ? Number(f.lb) > 0 && Number(f.lb) < 40 : kind === 'symptom' ? !!f.what.trim() : kind === 'vet' ? !!f.reason.trim() : kind === 'med' ? !!f.name.trim() : true;
  const save = async () => {
    const clean = (o: any) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v !== undefined));
    // a visit dated after today is booked; saving one on or after its day (e.g. adding what the vet said) makes it done
    const data = kind === 'weight' ? { lb: Math.round(Number(f.lb) * 100) / 100, ...(f.doc ? { doc: f.doc } : {}), ...(f.visitId ? { visitId: f.visitId } : {}) } : clean({ ...f, name: f.name?.trim?.() ?? f.name, ...(kind === 'vet' ? { status: day > localDay(Date.now()) ? 'booked' : 'done' } : {}) });
    await store.saveCare(kind, (kind === 'doc' ? { ...item!.data, title: f.title.trim(), visitId: f.visitId || undefined } : data) as never, { id: item?.id, at: (kind === 'food' || kind === 'doc') && item ? item.at : entryTime(day, Date.now(), item?.at) });
    audio.sparkle(); onClose();
  };
  const seg = <T extends string>(label: string, key: string, opts: [T, string][]) => <><span className="field">{label}</span>
    <div className="seg" role="group" aria-label={label}>{opts.map(([v, l]) => <button key={v} className={f[key] === v ? 'on' : ''} aria-pressed={f[key] === v} onClick={() => set(key, v)}>{l}</button>)}</div></>;
  const text = (label: string, key: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => <><label className="field" htmlFor={'c-' + key}>{label}</label>
    <input id={'c-' + key} className="in" value={f[key] ?? ''} onChange={(e) => set(key, e.target.value)} {...props} /></>;
  const when = kind !== 'food' && kind !== 'doc' && <><label className="field" htmlFor="c-day">Date</label><input id="c-day" className="in" type="date" value={day} max={kind === 'vet' ? undefined : localDay(Date.now())} onChange={(e) => setDay(e.target.value)} /></>;

  return <div className="overlay sheetbg" onClick={onClose}>
    <div className="sheet" role="dialog" aria-modal="true" aria-label={item ? 'Edit entry' : 'New entry'} onClick={(e) => e.stopPropagation()}>
      <div className="row"><b className="sp" style={{ fontSize: 18 }}>{kind === 'food' ? (item ? 'Edit food or treat' : 'Add food or treat') : (item ? 'Edit ' : '') + TITLE[kind]}</b>
        <button className="iconbtn" aria-label="Close" onClick={onClose}><Icon name="close" /></button></div>
      {kind === 'food' && !item && <FoodFinder known={care.filter((c): c is CareItem<'food'> => c.kind === 'food')} onCode={(code) => setF((x: any) => ({ ...x, code }))}
        onPick={(h) => setF((x: any) => ({ ...x, name: h.name, brand: h.brand ?? '', type: h.type, code: h.code, ingredients: h.ingredients, image: h.image }))} />}
      {kind === 'food' && <>{f.image && <img src={f.image} alt="" style={{ width: 72, height: 72, objectFit: 'contain', borderRadius: 12, background: '#fff', marginTop: 12 }} />}
        {text('Name', 'name', { placeholder: 'e.g. Chicken pâté' })}{text('Brand (optional)', 'brand')}
        {seg<FoodType>('Type', 'type', [['dry', 'Dry'], ['wet', 'Wet'], ['treat', 'Treat'], ['other', 'Other']])}
        {seg<Verdict>(pt('What he thinks'), 'verdict', [['love', 'Loves it'], ['ok', 'It’s OK'], ['no', 'Won’t eat it']])}
        <label className="row" style={{ marginTop: 14, gap: 10 }}><input type="checkbox" checked={!!f.current} onChange={(e) => set('current', e.target.checked)} style={{ width: 22, height: 22 }} /><span>We’re using this now</span></label>
        {text('Notes (optional)', 'notes', { placeholder: 'Flavor, where to buy, tummy trouble…' })}
        {f.ingredients && <details style={{ marginTop: 12 }}><summary className="s" style={{ fontWeight: 700 }}>Ingredients</summary><p className="s" style={{ marginTop: 6 }}>{f.ingredients}</p></details>}</>}
      {kind === 'doc' && item && <>{text('Name', 'title')}
        <DocVisitPicker care={care} doc={item as CareItem<'doc'>} value={f.visitId} onChange={(v) => set('visitId', v)} />
        <div className="row" style={{ gap: 8, marginTop: 12 }}>
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
        <label className="field" htmlFor="c-next">Next due (optional)</label><input id="c-next" className="in" type="date" value={f.nextDue ?? ''} min={day} onChange={(e) => set('nextDue', e.target.value)} />
        {text('Notes (optional)', 'notes', { placeholder: 'Dose, which leg, reactions…' })}</>}
      <button className="btn" style={{ marginTop: 20 }} disabled={!ok} onClick={save}>{item ? 'Save changes' : 'Save'}</button>
      {kind === 'vet' && ok && day > localDay(Date.now()) && (() => {
        const ev: CalEvent = { title: `${cat?.name ?? 'Pet'}: vet (${f.reason.trim()})`, day, time: f.time || undefined, place: f.clinic?.trim() || undefined, notes: f.notes?.trim() || undefined };
        return <div style={{ marginTop: 12 }}><span className="field">Add to calendar</span>
          <div className="row" style={{ gap: 8, marginTop: 6 }}>
            <button className="btn2" style={{ flex: 1 }} onClick={() => downloadIcs(ev)}>iPhone / Apple</button>
            <a className="btn2" style={{ flex: 1, textAlign: 'center', textDecoration: 'none', color: 'inherit' }} href={googleCalendarUrl(ev)} target="_blank" rel="noreferrer">Google</a></div>
          <p className="s" style={{ marginTop: 6 }}>Adds a reminder the day before.</p></div>;
      })()}
      {item && <button className="btn2" style={{ marginTop: 10, width: '100%', background: 'transparent', color: 'var(--rose)' }} onClick={async () => { if (confirm('Delete this for everyone?')) { if (item.kind === 'doc') await store.removeDoc(item as CareItem<'doc'>); else await store.deleteCare(item.id); onClose(); } }}>Delete</button>}
    </div>
  </div>;
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
    <div className="row"><b className="sp" style={{ fontSize: 16 }}>Today</b>
      {last && <a href="#/health" className="chip num" style={{ textDecoration: 'none' }}>{last.data.lb} lb{delta ? ` (${delta > 0 ? '+' : ''}${delta})` : ''}</a>}</div>
    {due.length ? due.map((r) => <a key={r.id} href="#/health" className="row" style={{ marginTop: 10, color: 'inherit', textDecoration: 'none', gap: 10 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', flex: 'none', background: r.daysLeft < 0 ? 'var(--rose)' : r.daysLeft <= 3 ? '#d4a23a' : 'var(--teal)' }} />
        <span className="sp" style={{ fontSize: 15 }}>{r.title}</span><span className="s">{dueText(r.daysLeft)}</span></a>)
      : <p className="s" style={{ marginTop: 6 }}>{care.length ? 'All caught up. Nothing due.' : `Start ${cat.name}’s health log: a weigh-in is a great first entry.`}</p>}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginTop: 12 }}>
      {([['weight', 'Weight', 'target'], ['symptom', 'Symptom', 'ear'], ['food', 'Food', 'leaf'], ['vet', 'Vet', 'box']] as const).map(([k, label, icon]) =>
        <button key={k} className="chipbtn" style={{ height: 'auto', minHeight: 58, borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, background: 'var(--surface)' }} onClick={() => { audio.chirp(); go('health/log/' + k); }}>
          <Icon name={icon} size={20} /><span style={{ fontSize: 12 }}>{label}</span></button>)}
    </div>
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
  return <div className="card grey" style={{ marginTop: 12 }}>
    <b>Find it</b><p className="s" style={{ marginTop: 2 }}>Scan the barcode or search by name, and we’ll fill it in.</p>
    {scan ? <Scanner onCode={(c) => { setScan(false); setQ(c); void lookup(c); }} onClose={() => setScan(false)} />
      : <button className="btn2" style={{ marginTop: 10, width: '100%', background: 'var(--surface)' }} onClick={() => setScan(true)}>Scan barcode</button>}
    <div className="row" style={{ gap: 8, marginTop: 8 }}>
      <input className="in" style={{ background: 'var(--surface)' }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, brand or barcode numbers" aria-label="Search for a food or treat" enterKeyHint="search"
        onKeyDown={(e) => { if (e.key === 'Enter' && q.trim()) void (isCode ? lookup(q) : run(() => search(q))); }} />
      <button className="btn2" style={{ background: 'var(--surface)' }} disabled={busy || q.trim().length < 2} onClick={() => void (isCode ? lookup(q) : run(() => search(q)))}>{busy ? '…' : 'Find'}</button>
    </div>
    {msg && <p className="s" style={{ marginTop: 8 }} role="status">{msg}</p>}
    {hits && hits.length > 1 && hits.map((h) => <button key={h.code} className="hit" onClick={() => { onPick(h); setHits([h]); audio.chirp(true); }}>
      {h.image ? <img src={h.image} alt="" /> : <span className="ico grey" style={{ width: 44, height: 44 }} />}
      <span className="sp"><b style={{ fontSize: 14 }}>{h.name}</b><span className="s" style={{ display: 'block' }}>{[h.brand, h.quantity, h.forCats ? '' : 'not marked for cats'].filter(Boolean).join(' · ')}</span></span></button>)}
    {hits && hits.length === 1 && <p className="s" style={{ marginTop: 8 }} role="status">Filled in: <b>{hits[0].name}</b>. Check it below.</p>}
    <p className="s" style={{ marginTop: 8, fontSize: 11 }}>Product data from Open Pet Food Facts and Open Food Facts (open databases, ODbL).</p>
  </div>;
}

/** Which visit a document came from (newest visits first). */
function DocVisitPicker({ care, doc, value, onChange }: { care: CareItem[]; doc: CareItem<'doc'>; value?: string; onChange: (id: string) => void }) {
  const vs = care.filter((c): c is CareItem<'vet'> => c.kind === 'vet' && !c.deleted).sort((a, b) => b.at - a.at).slice(0, 30);
  const current = value ?? visitOfDoc(care, doc)?.id ?? '';
  if (!vs.length) return null;
  return <><label className="field" htmlFor="c-visit">From the visit</label>
    <select id="c-visit" className="in" value={current} onChange={(e) => onChange(e.target.value)}>
      <option value="">Not from a visit</option>
      {vs.map((v) => <option key={v.id} value={v.id}>{fmt(v.at)} · {v.data.reason}</option>)}
    </select></>;
}

type Pick = { key: string; label: string; detail: string; on: boolean; save: (doc?: string) => Promise<unknown>; visit?: boolean };

/** Add a vet document: read it on the phone, store it (when sharing is set up), then confirm which entries to add.
    `visit`: added from a visit's page, so the document, doses and weight it finds are linked to that visit (and what
    the vet said goes into its notes instead of making a new visit). `compact`: once there are documents, just the button. */
export function DocAdder({ signedIn, visit, compact }: { signedIn: boolean; visit?: CareItem<'vet'>; compact?: boolean }) {
  const [stage, setStage] = useState<'idle' | 'read' | 'review' | 'error'>('idle');
  const [msg, setMsg] = useState('');
  const [note, setNote] = useState('');
  const [progress, setProgress] = useState(0);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [doc, setDoc] = useState<CareItem<'doc'> | null>(null);

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
    } else setNote('Only the details are saved. Sign in (Settings → Train together) to keep the document itself.');
    const at = (day: string | null) => (day ? noon(day) : r.docDate ? noon(r.docDate) : Date.now());
    const list: Pick[] = [];
    // profile details the pet doesn't have yet (birthday, microchip, neutered, home since)
    const cat = store.get().cat; const pr = r.profile;
    if (cat) {
      const changes: string[] = []; const patch: Partial<typeof cat> = {};
      if (pr.birthday && cat.birthday !== pr.birthday.slice(0, 7)) { patch.birthday = pr.birthday.slice(0, 7); changes.push('born ' + fmt(noon(pr.birthday))); }
      if (pr.microchip && cat.microchip !== pr.microchip) { patch.microchip = pr.microchip; changes.push('microchip ' + pr.microchip); }
      if (pr.altered && !cat.altered) { patch.altered = true; changes.push(cat.sex === 'f' ? 'spayed' : 'neutered'); }
      if (pr.adopted && cat.homeDate !== pr.adopted) { patch.homeDate = pr.adopted; changes.push('home since ' + fmt(noon(pr.adopted)) + (pr.adoptedFrom ? ` (from ${pr.adoptedFrom})` : '')); }
      if (changes.length) list.push({ key: 'profile', label: `Update ${cat.name}’s profile`, detail: changes.join(' · '), on: true, save: () => store.saveCat({ ...cat, ...patch }) });
    }
    if (visit) {
      // from a visit's page: what the vet said goes into this visit's notes, not a new visit
      const said = r.visits.map((v) => [v.reason, v.notes].filter(Boolean).join(': ')).filter(Boolean).join('. ');
      if (said) list.push({ key: 'notes', label: 'Add to this visit’s notes', detail: said, on: !visit.data.notes,
        save: () => store.saveCare('vet', { ...visit.data, notes: [visit.data.notes, said].filter(Boolean).join('\n') }, { id: visit.id, at: visit.at }) });
    } else r.visits.forEach((v, i) => list.push({ key: 'v' + i, label: (/test/i.test(v.reason) ? 'Test: ' : 'Vet visit: ') + v.reason, detail: [v.notes, v.clinic, v.date && fmt(noon(v.date))].filter(Boolean).join(' · '), on: true, visit: true,
      save: (doc) => store.saveCare('vet', { reason: v.reason, clinic: v.clinic ?? undefined, notes: v.notes ?? undefined, doc, status: 'done' }, { at: at(v.date) }) }));
    const vid = visit ? { visitId: visit.id } : {};
    const atV = (day: string | null) => (visit && !day ? visit.at : at(day));
    r.weights.forEach((w, i) => list.push({ key: 'w' + i, label: `Weight: ${w.lb} lb`, detail: w.date ? fmt(noon(w.date)) : '', on: true,
      save: (doc) => store.saveCare('weight', { lb: w.lb, doc, ...vid }, { at: atV(w.date) }) }));
    r.items.forEach((it, i) => list.push({ key: 'm' + i, label: `${MED_LABEL[it.kind]}: ${it.name}`, detail: [it.date && fmt(noon(it.date)), it.nextDue && 'next due ' + fmt(noon(it.nextDue)), it.notes].filter(Boolean).join(' · '), on: true,
      save: (doc) => store.saveCare('med', { name: it.name, what: it.kind, nextDue: it.nextDue ?? undefined, notes: it.notes ?? undefined, doc, ...vid }, { at: atV(it.date) }) }));
    setPicks(list); setMsg(r.summary); setStage('review');
  };

  // once there are documents, just the button (the explanation is for the first one)
  if (stage === 'idle' && compact) return <label className="btn2" style={{ cursor: 'pointer', width: '100%', marginTop: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'var(--grey)' }}><Icon name="plus" size={18} />Add a document
    <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} /></label>;
  return <div className="card grey" style={{ marginTop: 10 }}>
    {stage === 'idle' && <><p className="s">Vet records, vaccine certificates, adoption papers or ESA/housing forms: snap a photo or pick a PDF (several pages is fine). It’s read right on your phone, free, and you check what it found before anything is saved.</p>
      <label className="btn" style={{ marginTop: 12, cursor: 'pointer' }}>Add a document
        <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} /></label></>}
    {stage === 'read' && <><p className="s" aria-live="polite">Reading the document on your phone… {progress > 0 ? Math.round(progress * 100) + '%' : 'getting ready (the first time takes a little longer)'}</p>
      <div className="bar" style={{ marginTop: 8 }}><i style={{ width: Math.max(4, progress * 100) + '%', animation: 'none' }} /></div></>}
    {stage === 'error' && <><p className="s" role="alert">{msg}</p><button className="btn2" style={{ marginTop: 10, background: 'var(--surface)' }} onClick={() => setStage('idle')}>OK</button></>}
    {stage === 'review' && <>
      <b>Here’s what it found</b>{msg && <p className="s" style={{ marginTop: 4 }}>{msg}</p>}
      {note && <p className="s" style={{ marginTop: 6, color: 'var(--peach-ink)' }}>{note}</p>}
      {picks.length === 0 && <p className="s" style={{ marginTop: 8 }}>Nothing to add to the log. The document is saved.</p>}
      {picks.map((p, i) => <label key={p.key} className="row" style={{ marginTop: 10, gap: 10, alignItems: 'flex-start' }}>
        <input type="checkbox" checked={p.on} style={{ width: 22, height: 22, flex: 'none' }} onChange={(e) => setPicks(picks.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)))} />
        <span><b style={{ fontSize: 14 }}>{p.label}</b>{p.detail && <span className="s" style={{ display: 'block' }}>{p.detail}</span>}</span></label>)}
      <p className="s" style={{ marginTop: 10 }}>Read automatically, so check it against the document. Anything it missed, add with “Log something” above.</p>
      <button className="btn" style={{ marginTop: 12 }} onClick={async () => {
        let linked: CareItem | null = null;
        for (const p of picks) if (p.on) { const saved = await p.save(doc?.id); if (p.visit && !linked) linked = saved as CareItem | null; }
        // the document belongs to the (first) visit it was read as
        if (doc && linked && !visit) await store.saveCare('doc', { ...doc.data, visitId: linked.id }, { id: doc.id, at: doc.at });
        audio.sparkle(); setStage('idle'); }}>{picks.some((p) => p.on) ? `Add ${picks.filter((p) => p.on).length} to the log` : 'Done'}</button>
    </>}
  </div>;
}
