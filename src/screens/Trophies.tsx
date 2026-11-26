import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../db/store';
import { badgeArtKey, badgeShelves, closestBadge, tapDelay, type Badge } from '../engine/badges';
import { SKILLS } from '../engine/skills';
import { badgeArtUrl } from '../ui/badgeArt';
import { BadgeShine, prefersReducedMotion, SHINE_FLASH_MS, SHINE_MS } from '../ui/BadgeShine';
import { Icon } from '../ui/icons';
import { ScreenHeader } from '../ui/ScreenHeader';
import { go } from '../ui/router';

const day = (at?: number) => (at ? new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '');

/** One badge: earned (full colour, shines on tap, then opens the skill), locked (faded grey with a lock, opens at
 *  once), or hidden (the branch shape dashed with a "?"; no name, doesn't open). */
export function BadgeTile({ b }: { b: Badge }) {
  const [pulse, setPulse] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const src = badgeArtUrl(badgeArtKey(b)) ?? '';
  if (b.state === 'hidden') {
    return <div className="badgetile" role="img" aria-label={`A hidden ${b.skill.branch} skill`}>
      <BadgeShine src={src} shine={false} />
      <span className="s lbl">Hidden</span>
    </div>;
  }
  const open = () => {
    const wait = tapDelay(b.state, SHINE_MS, SHINE_FLASH_MS, prefersReducedMotion());
    if (wait === null) return;
    if (b.earned) setPulse((n) => n + 1);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => go('skill/' + b.skill.id), wait);
  };
  return <button className={`badgetile ${b.state}`} onClick={open}
    aria-label={`${b.skill.name}: ${b.earned ? `earned${b.at ? ' ' + day(b.at) : ''}` : `not earned yet, step ${b.step} of ${b.steps}`}`}>
    <BadgeShine src={src} shine={b.earned} pulse={pulse} />
    <span className="s lbl">{b.skill.name}</span>
    {b.earned && b.at ? <span className="s" style={{ fontSize: 11 }}>{day(b.at)}</span>
      : !b.earned && b.step > 0 ? <span className="s num" style={{ fontSize: 11 }}>{b.step}/{b.steps}</span> : null}
  </button>;
}

/** The trophy case: a badge for every mastered skill, on shelves by branch, with the closest one to earning on top. */
export function Trophies() {
  const { cat, progress, unlockedHidden } = useStore();
  const shelves = useMemo(() => badgeShelves(SKILLS, progress, unlockedHidden), [progress, unlockedHidden]);
  const next = closestBadge(shelves);
  if (!cat) return null;
  const all = shelves.flatMap((s) => s.badges); const earned = all.filter((b) => b.earned).length;
  const hidden = all.filter((b) => b.state === 'hidden').length;
  return <div className="screen">
    <ScreenHeader onBack={() => go('chester')} title="Trophy case" />
    <div className="stag">
      <p className="m">{earned ? `${cat.name} has ${earned} of ${all.length} badges. One for every skill mastered.` : `Master a skill and ${cat.name}’s first badge goes here.`}{hidden ? ` The ${hidden} marked “?” are hidden skills that unlock along the way.` : ''}</p>
      {next && <a href={'#/skill/' + next.skill.id} className="card butter row" style={{ color: 'inherit', textDecoration: 'none', gap: 'var(--sp-3)' }}>
        <BadgeShine src={badgeArtUrl(badgeArtKey(next)) ?? ''} shine={false} />
        <div className="sp"><p className="s" style={{ color: 'var(--butter-ink)' }}>Closest badge</p><b style={{ color: 'var(--butter-ink)', fontSize: 'var(--fs-body)' }}>{next.skill.name}</b>
          <div className="bar" style={{ marginTop: 'var(--sp-2)' }}><i style={{ width: `${Math.max(6, next.frac * 100)}%` }} /></div>
          <p className="s" style={{ color: 'var(--butter-ink)', marginTop: 6 }}>Step {next.step} of {next.steps} done</p></div></a>}
      {shelves.map((s) => <div key={s.branch} style={{ marginTop: 18 }}>
        <h2><i className="branchdot" style={{ background: `var(--branch-${s.branch.toLowerCase()})` }} aria-hidden="true" />{s.branch}</h2>
        <div className="card grey" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', gap: 14, marginTop: 'var(--sp-2)' }}>
          {s.badges.map((b) => <BadgeTile key={b.skill.id} b={b} />)}</div>
      </div>)}
    </div>
  </div>;
}
