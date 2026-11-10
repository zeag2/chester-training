import { useMemo, useState } from 'react';
import { useStore } from '../db/store';
import { summaryText, vetSummary } from '../engine/vetsummary';
import { MED_LABEL, type MedWhat } from '../engine/care';
import { telHref, yourVets } from '../engine/vets';
import { ageText } from '../lib/stats';
import { Icon } from '../ui/icons';
import { go } from '../ui/router';
import { openDoc } from '../ui/DocRow';

const fmt = (day: string) => new Date(day + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

/** One screen to show the vet (step 5 of docs/plans/2026-11-09-vet-redesign.md): your vet and the pet at the top,
    weights, doses, recent symptoms, visits (tap for the visit), daily checks, food and documents, and Share to send
    it as text before the appointment. */
export function VetSummary() {
  const { cat, care, vets } = useStore();
  const s = useMemo(() => vetSummary(care), [care]);
  const [shared, setShared] = useState('');
  if (!cat) return null;
  const { primary } = yourVets(vets);
  const about = [ageText(cat.birthday), cat.sex === 'f' ? 'female' : 'male', cat.altered ? (cat.sex === 'f' ? 'spayed' : 'neutered') : null, cat.breed].filter(Boolean).join(' · ') + (cat.microchip ? ` · chip ${cat.microchip}` : '');
  const sect = (title: string, body: React.ReactNode) => <div className="card white"><b>{title}</b><div style={{ marginTop: 2 }}>{body}</div></div>;
  // two lines, name then dates, so long names never wrap into three
  const line = (a: string, b?: string, key?: string | number) => <div key={key} style={{ marginTop: 8 }}><span style={{ display: 'block' }}>{a}</span>{b && <span className="s" style={{ display: 'block' }}>{b}</span>}</div>;
  const none = (t: string) => <p className="s" style={{ marginTop: 6 }}>{t}</p>;
  const rowBtn: React.CSSProperties = { display: 'flex', width: '100%', border: 0, background: 'none', padding: 0, textAlign: 'left', color: 'inherit', font: 'inherit', alignItems: 'center', gap: 8, minHeight: 44 };
  const w0 = s.weights[0], wl = s.weights[s.weights.length - 1];
  const share = async () => {
    const text = summaryText(cat.name, about, s, primary?.data);
    try {
      if (navigator.share) { await navigator.share({ title: `${cat.name}: health summary`, text }); return; }
      await navigator.clipboard.writeText(text); setShared('Copied. Paste it into an email or message.');
    } catch (e) { if ((e as Error).name !== 'AbortError') setShared('Couldn’t share from this browser.'); }
  };
  return <div className="screen">
    <div className="top"><button className="iconbtn" aria-label="Back" onClick={() => go('health')}><Icon name="back" /></button><b className="sp" style={{ fontSize: 17 }}>For the vet</b>
      <button className="btn2" style={{ minHeight: 40, background: 'var(--grey)', display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => void share()}>Share</button></div>
    {shared && <p className="s" role="status" style={{ textAlign: 'right' }}>{shared}</p>}
    <div className="stag">
      <h1 style={{ marginTop: 4 }}>{cat.name}</h1>
      <p className="m">{about}</p>
      {primary && <div className="card sky" style={{ marginTop: 10 }}>
        <span className="s" style={{ fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase' }}>Vet</span>
        <b style={{ display: 'block' }}>{primary.data.clinic}</b>
        <p className="s">{[primary.data.vetName, primary.data.phone].filter(Boolean).join(' · ')}</p>
        {telHref(primary.data.phone) && <a className="btn2" href={telHref(primary.data.phone)!} style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', color: 'inherit', background: 'var(--surface)' }}><Icon name="phone" size={16} />Call</a>}
      </div>}
      {sect('Weight', s.weights.length ? <>{line(`${w0.lb} lb`, fmt(w0.day))}{s.weights.length > 1 && line(`${wl.lb} lb → ${w0.lb} lb`, `since ${fmt(wl.day)}`)}</> : none('No weigh-ins logged yet.'))}
      {sect('Medicine and vaccines', s.doses.length ? s.doses.map((x) => line(`${x.name} (${MED_LABEL[x.what as MedWhat] ?? x.what})`, `given ${fmt(x.given)}${x.nextDue ? ` · next ${fmt(x.nextDue)}` : ''}`, x.name)) : none('None logged.'))}
      {sect('Symptoms (last 60 days)', s.symptoms.length ? s.symptoms.map((x, i) => line(x.what + (x.worried ? ' (we were worried)' : ''), fmt(x.day), i)) : none('None logged.'))}
      {sect('Daily checks (last 30 days)', s.checks.days ? line(`${s.checks.days} days checked`, s.checks.off ? `${s.checks.off} with something off` : 'all normal') : none('No daily checks yet.'))}
      {sect('Recent vet visits', s.visits.length ? s.visits.map((v) => <button key={v.id} style={{ ...rowBtn, marginTop: 6 }} onClick={() => go('health/visit/' + v.id)}>
        <span className="sp"><span style={{ display: 'block' }}>{v.reason}{v.clinic ? ` · ${v.clinic}` : ''}</span>
          <span className="s" style={{ display: 'block' }}>{fmt(v.day)}{v.docs ? ` · ${v.docs} document${v.docs === 1 ? '' : 's'}` : ''}</span>
          {v.notes && <span className="s" style={{ display: 'block', color: 'var(--ink)' }}>{v.notes}</span>}</span><span aria-hidden="true" className="s">›</span></button>) : none('None logged.'))}
      {s.next && sect('Next visit', <button style={{ ...rowBtn, marginTop: 6 }} onClick={() => go('health/visit/' + s.next!.id)}><span className="sp">{s.next.reason}<span className="s" style={{ display: 'block' }}>{fmt(s.next.day)}{s.next.time ? ` · ${s.next.time}` : ''}{s.next.clinic ? ` · ${s.next.clinic}` : ''}</span></span><span aria-hidden="true" className="s">›</span></button>)}
      {s.foods.length > 0 && sect('Eating now', <p className="s" style={{ marginTop: 6 }}>{s.foods.join(', ')}</p>)}
      {s.docs.length > 0 && sect('Documents', <>{s.docs.map((d) => <button key={d.id} style={{ ...rowBtn, marginTop: 6 }} onClick={() => void openDoc(d.path)}>
        <Icon name="book" size={18} /><span className="sp">{d.title}<span className="s" style={{ display: 'block' }}>{fmt(d.day)}{d.vaccine ? ' · vaccines' : ''}</span></span><span aria-hidden="true" className="s">›</span></button>)}
        <a href="#/health/docs" className="s" style={{ display: 'block', marginTop: 8, fontWeight: 800, color: 'var(--ink)' }}>All documents ›</a></>)}
      <p className="s" style={{ textAlign: 'center', marginTop: 14 }}>From {cat.name}’s PalDex log. Turn your phone around to show it, or Share to send it.</p>
    </div>
  </div>;
}
