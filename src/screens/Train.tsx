import { useEffect, useState } from 'react';
import { store, useStore } from '../db/store';
import { suggestNext } from '../engine/plan';
import { isStruggling } from '../engine/rules';
import { SKILLS } from '../engine/skills';
import { DAILY_REWARDED_SETS } from '../engine/rewards';
import { dailyRates, inProgress, streak, today, weekStats } from '../lib/stats';
import { Icon, ICON_FOR, Paw } from '../ui/icons';
import { go } from '../ui/router';
import { usePetText } from '../lib/pet';
import { Chester } from '../chester/Chester';
import { PetSwitcher } from '../ui/PetSwitcher';

function useCountUp(target: number, ms = 1000) {
  const [v, setV] = useState(0);
  useEffect(() => { let raf = 0; const t0 = performance.now(); const step = (now: number) => { const k = Math.min(1, (now - t0) / ms); setV(Math.round(target * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(step); }; raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf); }, [target, ms]);
  return v;
}

/** Training's own area: today's sets, what's next, progress, and the tree, library and corner. Optional per cat. */
export function Train() {
  const { cat, progress, sets, unlockedHidden, wallet } = useStore();
  const pt = usePetText();
  const t = today();
  const rewardedToday = sets.filter((s) => s.day === t && s.rewarded).length;
  const next = suggestNext(SKILLS, progress, sets, unlockedHidden, t)[0];
  const ws = weekStats(sets); const st = streak(sets);
  const mastered = Object.values(progress).filter((p) => p.mastered).length;
  const learning = inProgress(progress, sets);
  const struggling = learning.find((d) => progress[d.id] && isStruggling(sets.filter((s) => s.skillId === d.id), progress[d.id]));
  const c1 = useCountUp(ws.sessions), c2 = useCountUp(ws.rate), c3 = useCountUp(mastered), c4 = useCountUp(st);
  const rates = dailyRates(sets);
  if (!cat) return null;
  const done = rewardedToday >= DAILY_REWARDED_SETS;

  if (cat.training === false) return <div className="screen">
    <h1 style={{ marginTop: 18 }}>Training</h1>
    <PetSwitcher />
    <div className="card mint" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '22px 18px' }}>
      <Chester coat={cat.coat} eyes={cat.eyes} wear={cat.corner?.wearing} mood="happy" raised anim="wave" width={130} label={cat.name} />
      <b style={{ fontSize: 18, marginTop: 8 }}>Training is off for {cat.name}</b>
      <p className="s" style={{ marginTop: 6 }}>{pt('Short clicker sessions, a couple of minutes at a time: sit, high five, come when called, and calm carrier trips. Cats of any age can learn.')}</p>
      <button className="btn" style={{ marginTop: 14 }} onClick={() => void store.saveCat({ ...cat, training: true })}>Turn on training for {cat.name}</button>
    </div>
  </div>;

  return <div className="screen">
    <h1 style={{ marginTop: 18 }}>Training</h1>
    <PetSwitcher />
    <div className="stag">
      <div className="card mint" style={{ padding: 18 }}>
        <div className="row"><b className="sp" style={{ fontSize: 16 }}>Today's sets</b><span className="chip num">{Math.min(rewardedToday, DAILY_REWARDED_SETS)} of {DAILY_REWARDED_SETS}</span></div>
        <div className="row" style={{ gap: 10, marginTop: 10 }}>{Array.from({ length: DAILY_REWARDED_SETS }, (_, i) => <span key={i} className="pop" style={{ animationDelay: `${i * 90}ms`, display: 'inline-flex' }}><Paw size={34} color={i < rewardedToday ? 'var(--ink)' : 'var(--faint)'} /></span>)}</div>
        {next && !done && <div className="card white" style={{ marginTop: 14, padding: 14 }}>
          <div className="row"><div className="ico peach"><Icon name={ICON_FOR[next.skill.branch]} /></div><div className="sp"><p className="s">{next.kind === 'review' ? 'Review' : next.kind === 'start' ? 'Up next · new skill' : 'Up next'}</p><b style={{ fontSize: 16 }}>{next.skill.name}</b><p className="s">Step {(progress[next.skill.id]?.step ?? 0) + 1}: {pt(next.skill.steps[progress[next.skill.id]?.step ?? 0])}</p></div></div>
          <button className="btn" style={{ marginTop: 12 }} onClick={() => go('session/' + next.skill.id)}>Start · about 2 min</button></div>}
        {done && <p className="s" style={{ marginTop: 10 }}>Daily goal done. {cat.name} is napping; rewards reset tomorrow.</p>}
      </div>
      {struggling && <div className="card peach row" style={{ alignItems: 'flex-start' }}><Paw color="#c2563f" size={22} /><p className="s" style={{ color: 'var(--peach-ink)' }}><b>Go easy on {struggling.name.toLowerCase()}.</b> Two tough sets in a row. Make the step easier or go back one; better treats help too.</p></div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
        <div className="card grey" style={{ margin: 0 }}><p className="s">This week</p><b className="num" style={{ fontSize: 26 }}>{c1}</b><p className="s">sets</p></div>
        <div className="card grey" style={{ margin: 0 }}><p className="s">Success</p><b className="num" style={{ fontSize: 26 }}>{ws.reps ? c2 + '%' : '–'}</b><p className="s">{ws.good} of {ws.reps} reps</p></div>
        <div className="card grey" style={{ margin: 0 }}><p className="s">Mastered</p><b className="num" style={{ fontSize: 26 }}>{c3}</b><p className="s">of {SKILLS.filter((s) => !s.hidden || unlockedHidden.includes(s.id)).length} skills</p></div>
        <div className="card grey" style={{ margin: 0 }}><p className="s">Streak</p><b className="num" style={{ fontSize: 26 }}>{c4}</b><p className="s">{st === 1 ? 'day' : 'days in a row'}</p></div>
      </div>
      {sets.length > 0 && <div className="card grey">
        <div className="row"><b className="sp" style={{ fontSize: 16 }}>{pt('Is he getting it?')}</b><span className="s">Pass is 80%</span></div>
        <div style={{ display: 'flex', gap: 6, marginTop: 12 }} role="img" aria-label={'Success rate by day: ' + rates.map((r) => `${r.day} ${r.rate ?? 'no sets'}`).join(', ')}>
          {rates.map((r, i) => <div key={r.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span className="s num" style={{ fontSize: 11 }}>{r.rate == null ? '' : r.rate + '%'}</span>
            <div style={{ width: '100%', maxWidth: 30, height: 90, display: 'flex', alignItems: 'flex-end' }}><div className="pop" style={{ width: '100%', height: r.rate == null ? 4 : Math.max(6, r.rate * 0.9), background: r.rate == null ? 'var(--line)' : r.rate >= 80 ? 'var(--ink)' : '#9ccbbf', borderRadius: 8, transformOrigin: 'bottom', animationDelay: `${i * 50}ms` }} /></div>
            <span className="s" style={{ fontSize: 11 }}>{new Date(r.day + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'narrow' })}</span></div>)}
        </div><p className="s" style={{ marginTop: 10 }}>Dark bars passed. New steps always start out harder.</p></div>}
      {learning.length > 0 && <><div className="row" style={{ marginTop: 22 }}><h2 className="sp">Learning now</h2><a href="#/tree" className="s" style={{ color: 'var(--teal)', fontWeight: 700 }}>See tree</a></div>
        {learning.map((d, i) => { const p = progress[d.id] ?? { step: 0 }; return <a key={d.id} href={'#/skill/' + d.id} className={`card ${['sky', 'peach', 'butter'][i % 3]}`}>
          <div className="row"><div className="ico"><Icon name={ICON_FOR[d.branch]} /></div><div className="sp"><b style={{ fontSize: 16 }}>{d.name}</b><p className="s">Step {p.step + 1} of {d.steps.length}</p></div></div>
          <div className="bar" style={{ marginTop: 12 }}><i style={{ width: `${Math.max(6, (p.step / d.steps.length) * 100)}%` }} /></div></a>; })}</>}
      <h2 style={{ marginTop: 22 }}>More</h2>
      {([['tree', 'Skill tree', 'tree', 'Every skill by branch, and what unlocks next'], ['library', 'Library', 'book', 'How each skill works, with tips and sources'],
        ['corner', `${cat.name}’s corner`, 'star', wallet ? `${Math.max(0, wallet.treats)} treats to spend on outfits, toys and cushions` : 'Outfits, toys and cushions']] as const).map(([to, title, icon, sub]) =>
        <button key={to} className="card grey row" style={{ width: '100%', border: 0, textAlign: 'left', color: 'inherit', marginTop: 8 }} onClick={() => go(to)}>
          <div className="ico"><Icon name={icon} /></div><div className="sp"><b>{title}</b><p className="s">{sub}</p></div></button>)}
      <button className="btn2" style={{ width: '100%', marginTop: 14, background: 'transparent' }} onClick={() => { if (confirm(`Turn off training for ${cat.name}? Progress and treats are kept; you can turn it back on any time.`)) void store.saveCat({ ...cat, training: false }); }}>Turn off training for {cat.name}</button>
    </div>
  </div>;
}
