import { useMemo } from 'react';
import { useStore } from '../db/store';
import { vetSummary } from '../engine/vetsummary';
import { MED_LABEL, type MedWhat } from '../engine/care';
import { ageText } from '../lib/stats';
import { Icon } from '../ui/icons';
import { go } from '../ui/router';

const fmt = (day: string) => new Date(day + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

/** One screen to show the vet: who the pet is, weights, doses, recent symptoms and visits, daily checks, food. */
export function VetSummary() {
  const { cat, care } = useStore();
  const s = useMemo(() => vetSummary(care), [care]);
  if (!cat) return null;
  const sect = (title: string, body: React.ReactNode) => <div className="card white" style={{ border: '1px solid var(--grey)' }}><b>{title}</b><div style={{ marginTop: 6 }}>{body}</div></div>;
  const line = (a: string, b?: string) => <div className="row" style={{ marginTop: 6, alignItems: 'baseline', gap: 8 }}><span className="sp">{a}</span>{b && <span className="s">{b}</span>}</div>;
  const none = (t: string) => <p className="s">{t}</p>;
  const w0 = s.weights[0], wl = s.weights[s.weights.length - 1];
  return <div className="screen">
    <div className="top"><button className="iconbtn" aria-label="Back" onClick={() => go('health')}><Icon name="back" /></button><b className="sp" style={{ fontSize: 17 }}>For the vet</b></div>
    <div className="stag">
      <h1 style={{ marginTop: 4 }}>{cat.name}</h1>
      <p className="m">{[ageText(cat.birthday), cat.sex === 'f' ? 'female' : 'male', cat.altered ? (cat.sex === 'f' ? 'spayed' : 'neutered') : null, cat.breed].filter(Boolean).join(' · ')}{cat.microchip ? ` · chip ${cat.microchip}` : ''}</p>
      {sect('Weight', s.weights.length ? <>{line(`${w0.lb} lb`, fmt(w0.day))}{s.weights.length > 1 && line(`${wl.lb} lb → ${w0.lb} lb`, `since ${fmt(wl.day)}`)}</> : none('No weigh-ins logged yet.'))}
      {sect('Medicine and vaccines', s.doses.length ? s.doses.map((x) => <div key={x.name}>{line(`${x.name} (${MED_LABEL[x.what as MedWhat] ?? x.what})`, `given ${fmt(x.given)}${x.nextDue ? ` · next ${fmt(x.nextDue)}` : ''}`)}</div>) : none('None logged.'))}
      {sect('Symptoms (last 60 days)', s.symptoms.length ? s.symptoms.map((x, i) => <div key={i}>{line(x.what + (x.worried ? ' (we were worried)' : ''), fmt(x.day))}</div>) : none('None logged.'))}
      {sect('Daily checks (last 30 days)', s.checks.days ? line(`${s.checks.days} days checked`, s.checks.off ? `${s.checks.off} with something off` : 'all normal') : none('No daily checks yet.'))}
      {sect('Recent vet visits', s.visits.length ? s.visits.map((v, i) => <div key={i}>{line(v.reason + (v.clinic ? ` · ${v.clinic}` : ''), fmt(v.day))}</div>) : none('None logged.'))}
      {s.foods.length > 0 && sect('Eating now', <p className="s">{s.foods.join(', ')}</p>)}
      <p className="s" style={{ textAlign: 'center', marginTop: 14 }}>From {cat.name}’s PalDex log. Turn your phone around to show it.</p>
    </div>
  </div>;
}
