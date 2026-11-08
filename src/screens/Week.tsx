import { useMemo } from 'react';
import { useStore } from '../db/store';
import { weekSummary } from '../engine/week';
import { Icon } from '../ui/icons';
import { go } from '../ui/router';

const short = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/** "{cat}'s week": the last 7 days at a glance, from everything the household logged. */
export function Week() {
  const { cat, care, sets, account, household } = useStore();
  const w = useMemo(() => weekSummary(care, sets, cat?.corner), [care, sets, cat?.corner]);
  if (!cat) return null;
  const he = cat.sex === 'f' ? 'She' : 'He';
  const name = (id: string) => (!id || id === account?.userId ? 'You' : household?.members.find((m) => m.userId === id)?.name || 'Someone');
  const people = Object.entries(w.byPerson).sort((a, b) => b[1] - a[1]);
  const delta = w.weight?.before != null ? Math.round((w.weight.now - w.weight.before) * 10) / 10 : null;
  const row = (label: string, value: string, note?: string) => <div className="row" style={{ marginTop: 10, alignItems: 'baseline' }}><span className="sp">{label}</span><b className="num">{value}</b>{note && <span className="s" style={{ marginLeft: 6 }}>{note}</span>}</div>;
  return <div className="screen">
    <div className="top"><button className="iconbtn" aria-label="Back" onClick={() => go('home')}><Icon name="back" /></button><b className="sp" style={{ fontSize: 17 }}>{cat.name}’s week</b></div>
    <div className="stag">
      <p className="m">{short(w.from)} to {short(w.to)}</p>
      <div className="card mint"><b>Everyday</b>
        {row('Meals logged', String(w.meals))}{row('Litter scooped', String(w.scoops))}{row('Playtimes', String(w.plays))}
        {row('Daily checks', `${w.checks} of 7`, w.checksOff ? `${w.checksOff} with something off` : w.checks ? 'all normal' : undefined)}</div>
      <div className="card sky"><b>Health</b>
        {w.weight ? row('Weight', `${w.weight.now} lb`, delta == null ? 'first weigh-in' : delta === 0 ? 'no change' : `${delta > 0 ? '+' : ''}${delta} lb`) : row('Weight', '–', 'no weigh-in this week')}
        {row('Symptoms', String(w.symptoms.length), w.symptoms.length ? [...new Set(w.symptoms)].join(', ') : 'none')}
        {w.vetVisits > 0 && row('Vet visits', String(w.vetVisits))}
        {w.meds.length > 0 && row('Medicine and vaccines', String(w.meds.length), [...new Set(w.meds)].join(', '))}</div>
      {cat.training !== false && <div className="card butter"><b style={{ color: 'var(--butter-ink)' }}>Training</b>
        <div style={{ color: 'var(--butter-ink)' }}>{w.sets ? <>{row('Sets', String(w.sets), `on ${w.daysTrained} ${w.daysTrained === 1 ? 'day' : 'days'}`)}{w.goodRate != null && row('Good reps', `${w.goodRate}%`)}</>
          : <p className="s" style={{ marginTop: 6, color: 'var(--butter-ink)' }}>No sets this week. {he}’ll be happy to start again whenever you are.</p>}</div></div>}
      {(people.length > 0 || w.friendTreats > 0 || w.careTreats > 0) && <div className="card grey"><b>Who helped</b>
        {people.map(([id, n]) => row(name(id), `${n}`, n === 1 ? 'entry' : 'entries'))}
        {w.friendTreats > 0 && row('Treats from friends', String(w.friendTreats))}
        {w.careTreats > 0 && row('Treats earned for care', String(w.careTreats))}</div>}
    </div>
  </div>;
}
