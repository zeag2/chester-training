import { useMemo } from 'react';
import { useStore } from '../db/store';
import { badgeShelves, closestBadge, type Badge } from '../engine/badges';
import { SKILLS } from '../engine/skills';
import { Icon, ICON_FOR } from '../ui/icons';
import { go } from '../ui/router';

const day = (at?: number) => (at ? new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '');

function BadgeTile({ b }: { b: Badge }) {
  return <button onClick={() => go('skill/' + b.skill.id)} aria-label={`${b.skill.name}: ${b.earned ? `earned${b.at ? ' ' + day(b.at) : ''}` : `step ${b.step} of ${b.steps}`}`}
    style={{ border: 0, background: 'none', padding: 0, color: 'inherit', font: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0 }}>
    <span style={{ width: 64, height: 64, borderRadius: '50%', display: 'grid', placeItems: 'center', position: 'relative',
      background: b.earned ? 'var(--butter)' : 'var(--grey)', color: b.earned ? 'var(--butter-ink)' : 'var(--muted)',
      boxShadow: b.earned ? 'inset 0 0 0 3px #d4a23a' : 'inset 0 0 0 2px var(--surface)', opacity: b.earned ? 1 : 0.85 }}>
      {b.earned ? <Icon name={ICON_FOR[b.skill.branch]} size={26} /> : <b className="num" style={{ fontSize: 13 }}>{b.step}/{b.steps}</b>}
    </span>
    <span className="s" style={{ fontSize: 12, lineHeight: 1.2, textAlign: 'center', fontWeight: b.earned ? 700 : 400, color: b.earned ? 'var(--ink)' : undefined }}>{b.skill.name}</span>
    {b.earned && b.at && <span className="s" style={{ fontSize: 11 }}>{day(b.at)}</span>}
  </button>;
}

/** The trophy case: a badge for every mastered skill, on shelves by branch, with the closest one to earning on top. */
export function Trophies() {
  const { cat, progress, unlockedHidden } = useStore();
  const shelves = useMemo(() => badgeShelves(SKILLS, progress, unlockedHidden), [progress, unlockedHidden]);
  const next = closestBadge(shelves);
  if (!cat) return null;
  const all = shelves.flatMap((s) => s.badges); const earned = all.filter((b) => b.earned).length;
  return <div className="screen">
    <div className="top"><button className="iconbtn" aria-label="Back" onClick={() => go('train')}><Icon name="back" /></button><b className="sp" style={{ fontSize: 17 }}>Trophy case</b></div>
    <div className="stag">
      <p className="m">{earned ? `${cat.name} has ${earned} of ${all.length} badges. One for every skill mastered.` : `Master a skill and ${cat.name}’s first badge goes here.`}</p>
      {next && <a href={'#/skill/' + next.skill.id} className="card butter row" style={{ color: 'inherit', textDecoration: 'none' }}>
        <div className="sp"><p className="s" style={{ color: 'var(--butter-ink)' }}>Closest badge</p><b style={{ color: 'var(--butter-ink)', fontSize: 16 }}>{next.skill.name}</b>
          <div className="bar" style={{ marginTop: 8 }}><i style={{ width: `${Math.max(6, next.frac * 100)}%` }} /></div>
          <p className="s" style={{ color: 'var(--butter-ink)', marginTop: 6 }}>Step {next.step} of {next.steps} done</p></div></a>}
      {shelves.map((s) => <div key={s.branch} style={{ marginTop: 18 }}>
        <h2>{s.branch}</h2>
        <div className="card grey" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', gap: 14, marginTop: 8 }}>
          {s.badges.map((b) => <BadgeTile key={b.skill.id} b={b} />)}</div>
      </div>)}
    </div>
  </div>;
}
