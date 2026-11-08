import { useMemo, useState } from 'react';
import { store, useStore } from '../db/store';
import { localDay } from '../engine/day';
import {
  dueText, GROOM, MED_LABEL, RED_FLAGS, reminders, SYMPTOMS, VERDICT_LABEL, weights,
  type CareData, type CareItem, type CareKind, type FoodType, type GroomWhat, type MedWhat, type Verdict,
} from '../engine/care';
import { Icon } from '../ui/icons';
import { go } from '../ui/router';
import * as audio from '../lib/audio';
import { byBarcode, search, type FoodHit } from '../lib/petfood';
import { Scanner } from './Scanner';

const noon = (day: string) => Date.parse(day + 'T12:00:00');
const fmt = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: new Date(ms).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
const TITLE: Record<Exclude<CareKind, 'food'>, string> = { weight: 'Weight', symptom: 'Symptom', groom: 'Grooming', vet: 'Vet visit', med: 'Medicine or vaccine' };
const ICON: Record<CareKind, string> = { food: 'leaf', weight: 'target', symptom: 'ear', groom: 'hand', vet: 'box', med: 'check' };

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

type Editing = { kind: CareKind; item?: CareItem; preset?: Partial<CareData[CareKind]> } | null;

export function Care() {
  const { cat, care, careSync, account, household } = useStore();
  const [editing, setEditing] = useState<Editing>(null);
  const [flags, setFlags] = useState(false);
  const due = useMemo(() => reminders(care), [care]);
  const foods = care.filter((c): c is CareItem<'food'> => c.kind === 'food');
  const log = care.filter((c) => c.kind !== 'food').slice(0, 40);
  const ws = weights(care);
  const nameOf = (uid?: string) => (uid && uid !== account?.userId ? household?.members.find((m) => m.userId === uid)?.name : '') || '';
  if (!cat) return null;

  return <div className="screen">
    <div className="top" style={{ marginLeft: -10 }}><button className="iconbtn" aria-label="Back to Home" onClick={() => go('home')}><Icon name="back" /></button></div>
    <h1>{cat.name}’s care</h1>
    <p className="m" style={{ marginTop: 4 }}>Food he likes, his health log and what’s coming up{household && household.members.length > 1 ? ', shared with everyone who trains him' : ''}.</p>
    {account && careSync === 'missing' && <div className="card butter"><b>One setup step left</b><p className="s" style={{ marginTop: 4, color: 'var(--butter-ink)' }}>Care is saved on this phone. To share it, run the care setup in Supabase (docs/sharing-setup.md, step 5).</p></div>}

    <button className="card peach row" style={{ alignItems: 'flex-start' }} onClick={() => setFlags(!flags)} aria-expanded={flags}>
      <div className="ico"><Icon name="ear" /></div>
      <div className="sp"><b>When to call the vet now</b>
        {!flags && <p className="s" style={{ color: 'var(--peach-ink)' }}>Tap to see the warning signs.</p>}
        {flags && <><ul className="s" style={{ color: 'var(--peach-ink)', margin: '6px 0 0', paddingLeft: 18 }}>{RED_FLAGS.map((f) => <li key={f} style={{ marginTop: 4 }}>{f}</li>)}</ul>
          <p className="s" style={{ marginTop: 8, color: 'var(--peach-ink)' }}>This app can’t diagnose anything. If you’re unsure, call your vet or an emergency vet.</p></>}
      </div>
    </button>

    {due.length > 0 && <><h2 style={{ marginTop: 22 }}>Coming up</h2>
      {due.map((r) => <button key={r.id} className={`card ${r.daysLeft < 0 ? 'peach' : 'sky'} row`} style={{ marginTop: 10 }}
        onClick={() => setEditing(r.kind === 'groom' ? { kind: 'groom', preset: { what: r.id.split(':')[1] as GroomWhat } } : r.kind === 'vet' ? { kind: 'vet', preset: { reason: 'Yearly checkup' } } : { kind: 'med', preset: { name: r.title } })}>
        <div className="ico"><Icon name={r.kind === 'groom' ? 'hand' : r.kind === 'vet' ? 'box' : 'check'} /></div>
        <div className="sp"><b>{r.title}</b><p className="s">{r.detail}</p></div><span className="chip">{dueText(r.daysLeft)}</span></button>)}</>}

    <h2 style={{ marginTop: 22 }}>Log something</h2>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 10 }}>
      {(['weight', 'symptom', 'groom', 'vet', 'med'] as const).map((k) => <button key={k} className="chipbtn" style={{ height: 'auto', minHeight: 64, borderRadius: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, whiteSpace: 'normal', lineHeight: 1.15 }} onClick={() => { audio.chirp(); setEditing({ kind: k }); }}>
        <Icon name={ICON[k]} size={20} /><span style={{ fontSize: 12 }}>{k === 'med' ? 'Medicine' : TITLE[k]}</span></button>)}
      <button className="chipbtn" style={{ height: 'auto', minHeight: 64, borderRadius: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }} onClick={() => { audio.chirp(); setEditing({ kind: 'food' }); }}><Icon name="leaf" size={20} /><span style={{ fontSize: 12 }}>Food or treat</span></button>
    </div>

    {ws.length > 0 && <div className="card mint"><div className="row"><b className="sp">Weight</b><span className="chip num">{ws[ws.length - 1].data.lb} lb</span></div>
      {ws.length > 1 && <Spark values={ws.map((w) => w.data.lb)} />}
      <p className="s" style={{ marginTop: 6 }}>{ws.length} weigh-in{ws.length === 1 ? '' : 's'} · last {fmt(ws[ws.length - 1].at)}</p></div>}

    <h2 style={{ marginTop: 22 }}>Food and treats</h2>
    {foods.length === 0 && <p className="s" style={{ marginTop: 8 }}>Add the food and treats you use, and whether he loves them. Handy at the store and for the vet.</p>}
    {(['love', 'ok', 'no'] as Verdict[]).map((v) => { const list = foods.filter((f) => f.data.verdict === v); if (!list.length) return null;
      return <div key={v} style={{ marginTop: 12 }}><p className="s" style={{ fontWeight: 800 }}>{VERDICT_LABEL[v]}</p>
        {list.map((f) => <button key={f.id} className="item" onClick={() => setEditing({ kind: 'food', item: f })}>
          <div className="sp"><b>{f.data.name}</b><p className="s">{[f.data.brand, f.data.type === 'treat' ? 'Treat' : f.data.type === 'wet' ? 'Wet food' : f.data.type === 'dry' ? 'Dry food' : 'Other', f.data.notes].filter(Boolean).join(' · ')}</p></div>
          {f.data.current && <span className="chip" style={{ background: 'var(--mint)' }}>Using now</span>}</button>)}</div>; })}

    <h2 style={{ marginTop: 22 }}>Health log</h2>
    {log.length === 0 && <p className="s" style={{ marginTop: 8 }}>Weigh-ins, symptoms, grooming, vet visits and medicine show up here, newest first. A timeline like this is gold at the vet.</p>}
    {log.map((i) => <button key={i.id} className="item" onClick={() => setEditing({ kind: i.kind, item: i })}>
      <div className="ico grey"><Icon name={ICON[i.kind]} /></div>
      <div className="sp"><b>{TITLE[i.kind as Exclude<CareKind, 'food'>]}</b><p className="s">{summary(i)}</p></div>
      <span className="s" style={{ textAlign: 'right' }}>{fmt(i.at)}{nameOf(i.by) && <><br />{nameOf(i.by)}</>}</span></button>)}

    {editing && <Sheet key={editing.item?.id ?? editing.kind} editing={editing} onClose={() => setEditing(null)} />}
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
  vet: { reason: '', clinic: '', notes: '' }, med: { name: '', what: 'flea', nextDue: '', notes: '' },
};

/** Bottom sheet with the form for one kind of entry; also edits and deletes. */
function Sheet({ editing, onClose }: { editing: NonNullable<Editing>; onClose: () => void }) {
  const { kind, item } = editing;
  const d0 = { ...(item?.data ?? {}), ...(editing.preset ?? {}) } as any;
  const [day, setDay] = useState(localDay(item?.at ?? Date.now()));
  const [f, setF] = useState<any>(() => ({ ...DEFAULTS[kind], ...d0 }));
  const set = (k: string, v: unknown) => setF((x: any) => ({ ...x, [k]: v }));
  const ok = kind === 'food' ? !!f.name.trim() : kind === 'weight' ? Number(f.lb) > 0 && Number(f.lb) < 40 : kind === 'symptom' ? !!f.what.trim() : kind === 'vet' ? !!f.reason.trim() : kind === 'med' ? !!f.name.trim() : true;
  const save = async () => {
    const clean = (o: any) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v !== undefined));
    const data = kind === 'weight' ? { lb: Math.round(Number(f.lb) * 100) / 100 } : clean({ ...f, name: f.name?.trim?.() ?? f.name });
    await store.saveCare(kind, data as never, { id: item?.id, at: kind === 'food' && item ? item.at : noon(day) });
    audio.sparkle(); onClose();
  };
  const seg = <T extends string>(label: string, key: string, opts: [T, string][]) => <><span className="field">{label}</span>
    <div className="seg" role="group" aria-label={label}>{opts.map(([v, l]) => <button key={v} className={f[key] === v ? 'on' : ''} aria-pressed={f[key] === v} onClick={() => set(key, v)}>{l}</button>)}</div></>;
  const text = (label: string, key: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => <><label className="field" htmlFor={'c-' + key}>{label}</label>
    <input id={'c-' + key} className="in" value={f[key] ?? ''} onChange={(e) => set(key, e.target.value)} {...props} /></>;
  const when = kind !== 'food' && <><label className="field" htmlFor="c-day">Date</label><input id="c-day" className="in" type="date" value={day} max={localDay(Date.now())} onChange={(e) => setDay(e.target.value)} /></>;

  return <div className="overlay sheetbg" onClick={onClose}>
    <div className="sheet" role="dialog" aria-modal="true" aria-label={item ? 'Edit entry' : 'New entry'} onClick={(e) => e.stopPropagation()}>
      <div className="row"><b className="sp" style={{ fontSize: 18 }}>{kind === 'food' ? (item ? 'Edit food or treat' : 'Add food or treat') : (item ? 'Edit ' : '') + TITLE[kind]}</b>
        <button className="iconbtn" aria-label="Close" onClick={onClose}><Icon name="close" /></button></div>
      {kind === 'food' && !item && <FoodFinder onPick={(h) => setF((x: any) => ({ ...x, name: h.name, brand: h.brand ?? '', type: h.type, code: h.code, ingredients: h.ingredients, image: h.image }))} />}
      {kind === 'food' && <>{f.image && <img src={f.image} alt="" style={{ width: 72, height: 72, objectFit: 'contain', borderRadius: 12, background: '#fff', marginTop: 12 }} />}
        {text('Name', 'name', { placeholder: 'e.g. Chicken pâté' })}{text('Brand (optional)', 'brand')}
        {seg<FoodType>('Type', 'type', [['dry', 'Dry'], ['wet', 'Wet'], ['treat', 'Treat'], ['other', 'Other']])}
        {seg<Verdict>('What he thinks', 'verdict', [['love', 'Loves it'], ['ok', 'It’s OK'], ['no', 'Won’t eat it']])}
        <label className="row" style={{ marginTop: 14, gap: 10 }}><input type="checkbox" checked={!!f.current} onChange={(e) => set('current', e.target.checked)} style={{ width: 22, height: 22 }} /><span>We’re using this now</span></label>
        {text('Notes (optional)', 'notes', { placeholder: 'Flavor, where to buy, tummy trouble…' })}
        {f.ingredients && <details style={{ marginTop: 12 }}><summary className="s" style={{ fontWeight: 700 }}>Ingredients</summary><p className="s" style={{ marginTop: 6 }}>{f.ingredients}</p></details>}</>}
      {kind === 'weight' && <>{text('Weight in pounds', 'lb', { inputMode: 'decimal', placeholder: 'e.g. 3.4', autoFocus: !item })}{when}</>}
      {kind === 'symptom' && <><span className="field">What did you notice?</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{SYMPTOMS.map((s) => <button key={s} className={`chipbtn ${f.what === s ? 'on' : ''}`} onClick={() => set('what', s === 'Other' ? '' : s)}>{s}</button>)}</div>
        {(!SYMPTOMS.includes(f.what) || f.what === '') && text('Describe it', 'what', { placeholder: 'What happened?' })}
        <label className="row" style={{ marginTop: 14, gap: 10 }}><input type="checkbox" checked={!!f.worried} onChange={(e) => set('worried', e.target.checked)} style={{ width: 22, height: 22 }} /><span>We’re worried about this</span></label>
        {text('Notes (optional)', 'notes')}{when}
        <p className="s" style={{ marginTop: 10, color: 'var(--peach-ink)' }}>If it’s on the “call the vet now” list, call now rather than waiting.</p></>}
      {kind === 'groom' && <>{seg<GroomWhat>('What', 'what', [['brush', 'Brush'], ['nails', 'Nails'], ['bath', 'Bath'], ['teeth', 'Teeth'], ['ears', 'Ears']])}{text('Notes (optional)', 'notes')}{when}
        {f.what === 'bath' && <p className="s" style={{ marginTop: 10 }}>Most cats don’t need baths: only when he gets into something, or the vet says so.</p>}</>}
      {kind === 'vet' && <>{text('Why you went', 'reason', { placeholder: 'e.g. Kitten shots, checkup', autoFocus: !item })}{text('Clinic (optional)', 'clinic')}{text('What the vet said (optional)', 'notes')}{when}</>}
      {kind === 'med' && <>{text('Name', 'name', { placeholder: 'e.g. FVRCP booster, Revolution', autoFocus: !item && !editing.preset })}
        {seg<MedWhat>('Kind', 'what', [['vaccine', 'Vaccine'], ['flea', 'Flea'], ['worm', 'Worms'], ['medicine', 'Other']])}{when}
        <label className="field" htmlFor="c-next">Next due (optional)</label><input id="c-next" className="in" type="date" value={f.nextDue ?? ''} min={day} onChange={(e) => set('nextDue', e.target.value)} />
        {text('Notes (optional)', 'notes', { placeholder: 'Dose, which leg, reactions…' })}</>}
      <button className="btn" style={{ marginTop: 20 }} disabled={!ok} onClick={save}>{item ? 'Save changes' : 'Save'}</button>
      {item && <button className="btn2" style={{ marginTop: 10, width: '100%', background: 'transparent', color: 'var(--rose)' }} onClick={async () => { if (confirm('Delete this entry for everyone?')) { await store.deleteCare(item.id); onClose(); } }}>Delete</button>}
    </div>
  </div>;
}

/** Home card: what's due next, or a nudge to start the care log. */
export function CareCard() {
  const { cat, care } = useStore();
  const next = useMemo(() => reminders(care)[0], [care]);
  if (!cat) return null;
  return <button className="card sky row" onClick={() => go('care')}>
    <div className="ico"><Icon name="hand" /></div>
    <div className="sp"><b>{cat.name}’s care</b><p className="s">{next ? `${next.title}: ${dueText(next.daysLeft).toLowerCase()}` : care.length ? 'Food, health log and vet visits' : 'Track food he loves, weight, vet visits'}</p></div>
    {next && next.daysLeft <= 0 && <span className="chip" style={{ background: 'var(--peach)' }}>Due</span>}
  </button>;
}

/** Find a food by name or barcode in Open Pet Food Facts, and fill in the form from the pick. */
function FoodFinder({ onPick }: { onPick: (h: FoodHit) => void }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<FoodHit[] | null>(null);
  const [scan, setScan] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const run = async (fn: () => Promise<FoodHit[]>) => {
    setBusy(true); setMsg(''); setHits(null);
    try { const h = await fn(); setHits(h); if (!h.length) setMsg('Not found. Fill it in below; it only takes a moment.'); }
    catch { setMsg('Can’t reach the food database right now. Fill it in below.'); }
    finally { setBusy(false); }
  };
  const lookup = (code: string) => run(async () => { const h = await byBarcode(code); if (h) { onPick(h); audio.chirp(true); } return h ? [h] : []; });
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
    <p className="s" style={{ marginTop: 8, fontSize: 11 }}>Product data from Open Pet Food Facts (open database, ODbL).</p>
  </div>;
}
