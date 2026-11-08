import { useEffect, useRef, useState } from 'react';
import { Chester } from '../chester/Chester';
import { store, useStore } from '../db/store';
import { suggestNext } from '../engine/plan';
import { isStruggling } from '../engine/rules';
import { SKILLS, SKILL_BY_ID } from '../engine/skills';
import { DAILY_REWARDED_SETS } from '../engine/rewards';
import { dailyRates, daysHome, inProgress, streak, today, weekStats, ageText } from '../lib/stats';
import { Icon, ICON_FOR, Paw } from '../ui/icons';
import { go } from '../ui/router';
import * as audio from '../lib/audio';
import { CareCard } from './Care';
import { giftClaimed } from '../engine/corner';
import { movedTo } from '../lib/moved';
import { pendingFriend } from '../lib/invite';
import { InviteSheet } from './Friends';
import { usePetText } from '../lib/pet';
import type { ReactionId } from '../chester/reactions';

/** Part of the day from the time; night runs 10:30 PM to 5 AM. */
const PH = (h: number, m = 0) => (h < 5 ? 'night' : h < 12 ? 'morning' : h < 17 ? 'day' : h < 22 || (h === 22 && m < 30) ? 'evening' : 'night');
const BEAM = { morning: 'rgba(255,214,130,.24)', day: 'rgba(255,236,170,.22)', evening: 'rgba(255,170,140,.22)', night: 'rgba(150,170,230,.18)' };
const MOTE = { morning: '#f0c76a', day: '#efd27e', evening: '#f0a07e', night: '#c9d4f2' };
const GREET = { morning: 'Good morning', day: 'Good afternoon', evening: 'Good evening', night: 'Hi, night owl' };

function useCountUp(target: number, ms = 1000) {
  const [v, setV] = useState(0);
  useEffect(() => { let raf = 0; const t0 = performance.now(); const step = (now: number) => { const k = Math.min(1, (now - t0) / ms); setV(Math.round(target * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(step); }; raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf); }, [target, ms]);
  return v;
}

/** Home life: sits by default, makes biscuits for a few seconds now and then, and dozes off if left alone. */
function useHomeMood() {
  const [doze, setDoze] = useState(false);
  const [knead, setKnead] = useState(false);
  const pokeRef = useRef<() => void>(() => {});
  useEffect(() => {
    let t = 0;
    const poke = () => { setDoze(false); window.clearTimeout(t); t = window.setTimeout(() => { setKnead(false); setDoze(true); }, 90_000); };
    pokeRef.current = poke;
    poke();
    document.addEventListener('pointerdown', poke, { passive: true }); window.addEventListener('scroll', poke, { passive: true });
    return () => { window.clearTimeout(t); document.removeEventListener('pointerdown', poke); window.removeEventListener('scroll', poke); };
  }, []);
  useEffect(() => {
    let a = 0, b = 0;
    const next = () => { a = window.setTimeout(() => { setKnead(true); b = window.setTimeout(() => { setKnead(false); next(); }, 7000); }, 25_000 + Math.random() * 30_000); };
    next();
    return () => { window.clearTimeout(a); window.clearTimeout(b); };
  }, []);
  return { doze, knead, wake: () => pokeRef.current() };
}

const MEOWS = ['Meow.', 'Mew?', 'Mrrp!', 'Meeeow.', 'Mrrrow?'];
const AFTER = ['I feel 3 pounds lighter.', 'Don’t go in the bathroom.', 'Someone should check the box. Not it.', 'That one was for you.', 'I have done a great thing.'];
type Gag = null | 'peek' | 'out' | 'away' | 'gone' | 'back' | 'proud';
const LEAVE = ['Be right back.', 'Don’t follow me.', 'Nobody look.', 'I have business.'];

/** Every so often he meows at nobody; less often he leaves the room, and the room soon knows why. */
function useHomeLife(night: boolean, dozing: boolean, wake: () => void) {
  const [meowN, setMeowN] = useState(0);
  const [meowLine, setMeowLine] = useState('');
  const [gag, setGag] = useState<Gag>(null);
  const [gagLine, setGagLine] = useState('');
  const [stink, setStink] = useState(false);
  const gagRef = useRef<Gag>(null); gagRef.current = gag;
  useEffect(() => {
    if (night || dozing) return;
    let t = 0;
    const next = () => { t = window.setTimeout(() => {
      if (!document.hidden && !gagRef.current) { audio.meow((['mew', 'meow', 'mrrp'] as const)[Math.floor(Math.random() * 3)]); setMeowN((n) => n + 1); setMeowLine(MEOWS[Math.floor(Math.random() * MEOWS.length)]); }
      next();
    }, 25_000 + Math.random() * 45_000); };
    next();
    return () => window.clearTimeout(t);
  }, [night, dozing]);
  const wakeRef = useRef(wake); wakeRef.current = wake;
  useEffect(() => {
    if (night) return;
    const ts: number[] = []; const at = (ms: number, f: () => void) => ts.push(window.setTimeout(f, ms));
    // glance back, trot off, dig (heard, never seen), stink drifts in, zoom back, then own it proudly
    const run = () => {
      if (document.hidden) { schedule(); return; }
      wakeRef.current(); setGag('peek'); setGagLine(LEAVE[Math.floor(Math.random() * LEAVE.length)]);
      at(900, () => setGag('out'));
      at(2500, () => { setGag('away'); setGagLine('*scritch scritch scritch*'); audio.litter(2.2); });
      at(4600, () => { setGag('gone'); setGagLine('…'); setStink(true); });
      at(11_000, () => setStink(false));
      at(6400, () => { setGag('back'); setGagLine('Mrrp!'); audio.meow('mrrp'); });
      at(7300, () => { setGag('proud'); setGagLine(AFTER[Math.floor(Math.random() * AFTER.length)]); });
      at(9800, () => { setGag(null); schedule(); });
    };
    const schedule = () => at(180_000 + Math.random() * 180_000, run);
    at(30_000 + Math.random() * 30_000, run);
    return () => { ts.forEach((x) => window.clearTimeout(x)); setGag(null); setStink(false); };
  }, [night]);
  return { meowN, meowLine, gag, gagLine, stink };
}

export function Home() {
  const { cat, progress, sets, wallet, unlockedHidden, account, household, pets } = useStore();
  // whoever is signed in on this phone gets greeted by name; the other trainer shows as "training with"
  const me = household?.members.find((m) => m.userId === account?.userId);
  const myName = me?.name || store.myName;
  const partners = (household?.members ?? []).filter((m) => m.userId !== account?.userId && m.name).map((m) => m.name);
  const [line, setLine] = useState('');
  const [invite, setInvite] = useState(false);
  const { doze, knead, wake } = useHomeMood();
  const pt = usePetText();
  const ph0 = PH(new Date().getHours(), new Date().getMinutes());
  const { meowN, meowLine, gag, gagLine, stink } = useHomeLife(ph0 === 'night', doze, wake);
  const [shown, setShown] = useState<'pet' | 'meow' | 'gag'>('pet');
  useEffect(() => { if (meowN) setShown('meow'); }, [meowN]);
  useEffect(() => { if (gagLine) setShown('gag'); }, [gagLine]);
  const ph = PH(new Date().getHours(), new Date().getMinutes());
  // at night he sleeps, but a tap wakes him (sleepy) for two minutes before he dozes off again
  const [awakeUntil, setAwakeUntil] = useState(0);
  useEffect(() => { if (!awakeUntil) return; const t = window.setTimeout(() => setAwakeUntil(0), Math.max(0, awakeUntil - Date.now())); return () => window.clearTimeout(t); }, [awakeUntil]);
  const night = ph === 'night' && !awakeUntil;
  const t = today();
  const todaySets = sets.filter((s) => s.day === t);
  const rewardedToday = todaySets.filter((s) => s.rewarded).length;
  const plan = suggestNext(SKILLS, progress, sets, unlockedHidden, t);
  const next = plan[0];
  const ws = weekStats(sets); const st = streak(sets);
  const mastered = Object.values(progress).filter((p) => p.mastered).length;
  const learning = inProgress(progress, sets);
  const struggling = learning.find((d) => progress[d.id] && isStruggling(sets.filter((s) => s.skillId === d.id), progress[d.id]));
  const c1 = useCountUp(ws.sessions), c2 = useCountUp(ws.rate), c3 = useCountUp(mastered), c4 = useCountUp(st);
  const rates = dailyRates(sets);
  if (!cat) return null;
  const done = rewardedToday >= DAILY_REWARDED_SETS;
  const idleLine = done ? `That's ${DAILY_REWARDED_SETS} sets today. Nap time!` : sets.length === 0 ? `Hi! I'm ${cat.name}. Let's start with the clicker.` : next ? `Ready for ${next.skill.name.toLowerCase()}?` : 'Pet me!';

  return <div className="screen">
    <div aria-hidden="true" style={{ position: 'absolute', inset: '0 0 auto 0', height: 420, overflow: 'hidden', pointerEvents: 'none' }}>
      <div className="beam" style={{ left: '40%', background: BEAM[ph] }} /><div className="beam" style={{ left: '65%', width: 60, animationDelay: '-8s', background: BEAM[ph] }} />
      {[[45, 300, 0], [57, 360, 3], [70, 260, 6], [78, 340, 9], [52, 220, 11], [85, 300, 4.5]].map(([x, y, d], i) => <span key={i} className="mote" style={{ left: x + '%', top: y, background: MOTE[ph], animationDelay: `-${d}s` }} />)}
      {stink && <div className="stink">{[0, 1, 2, 3].map((i) => <svg key={i} viewBox="0 0 90 30" style={{ animationDelay: i * 0.35 + 's', top: [104, 140, 120, 158][i] }}><path d="M88 15 C74 2 60 28 46 15 C32 2 18 28 2 15" stroke="#9cbf5b" strokeWidth="5" fill="none" strokeLinecap="round" opacity=".85" /></svg>)}</div>}
      {ph === 'night' && [[10, 30], [30, 18], [55, 40], [78, 22], [90, 60]].map(([x, y], i) => <span key={i} className="star" style={{ left: x + '%', top: y, animationDelay: `-${i * 0.7}s` }} />)}
    </div>
    <div className="stag" style={{ position: 'relative' }}>
      <div><p className="m">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })} · day {daysHome(cat.homeDate)} at home</p>
        <h1 style={{ marginTop: 4 }}>{GREET[ph]}{myName ? `, ${myName}` : ''}.</h1>
        {partners.length > 0 && <p className="s" style={{ marginTop: 4 }}>Training {cat.name} with {partners.join(' and ')}</p>}
        {pets.length > 1 && <div className="row" role="group" aria-label="Pets" style={{ gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          {pets.map((p) => <button key={p.id} className={`chipbtn ${p.id === cat.id ? 'on' : ''}`} aria-pressed={p.id === cat.id} style={{ minHeight: 36, padding: '0 12px' }} onClick={() => p.id !== cat.id && void store.switchPet(p.id)}>{p.name}</button>)}</div>}
        {account && !myName && <button className="chip" style={{ marginTop: 8, border: 0, minHeight: 32 }} onClick={() => go('settings')}>Add your name so {cat.name} can greet you</button>}</div>
      <div className="row" style={{ alignItems: 'flex-end', gap: 4, marginTop: 10 }}>
        <div className={`gagwrap ${gag ?? ''}`}><span className="gagflip">
        <Chester coat={cat.coat} eyes={cat.eyes} wear={cat.corner?.wearing} pose={gag === 'out' || gag === 'back' ? 'walk' : gag ? 'sit' : night || doze ? 'sleep' : knead && !done ? 'knead' : 'sit'} mood={gag === 'proud' ? 'happy' : done || ph === 'night' ? 'sleepy' : 'curious'}
          raised={!gag && !done && !night && !doze && sets.length === 0} anim={gag ? '' : night ? 'night' : doze ? 'nap' : done ? 'nod' : sets.length === 0 ? 'wave' : ''}
          width={104} interactive label={cat.name} onPet={(l) => { if (ph === 'night' && !awakeUntil) { setAwakeUntil(Date.now() + 120_000); setLine(['Mrrp…? It’s late.', '*yawns* Oh, hi.', 'Five more minutes…'][Math.floor(Math.random() * 3)]); } else setLine(l); setShown('pet'); }} react={meowN ? 'r15' : null} reactKey={meowN} /></span></div>
        <div style={{ marginBottom: 26 }}><span key={doze ? 'z' : shown + line + meowLine + gagLine} className="bubble mint">{pt(doze ? 'Zzz… (tap to wake him)' : shown === 'gag' && gagLine ? gagLine : shown === 'meow' ? meowLine : line || idleLine)}</span></div>
      </div>
      {movedTo() && <div className="card butter"><b style={{ color: 'var(--butter-ink)' }}>PalDex has a new home</b>
        <p className="s" style={{ color: 'var(--butter-ink)', marginTop: 4 }}>{account ? `Open the new link, sign in, and add it to your Home Screen. ${cat.name}’s training comes with you.` : `First sign in (Settings, then Set up a household) so ${cat.name}’s training is saved online. Then open the new link and sign in there.`}</p>
        <a className="btn" style={{ marginTop: 12 }} href={movedTo()!}>Open {new URL(movedTo()!).host}</a></div>}
      <div className="card mint" style={{ padding: 18 }}>
        <div className="row"><b className="sp" style={{ fontSize: 16 }}>Today's sets</b><span className="chip num">{Math.min(rewardedToday, DAILY_REWARDED_SETS)} of {DAILY_REWARDED_SETS}</span></div>
        <div className="row" style={{ gap: 10, marginTop: 10 }}>{Array.from({ length: DAILY_REWARDED_SETS }, (_, i) => <span key={i} className="pop" style={{ animationDelay: `${i * 90}ms`, display: 'inline-flex' }}><Paw size={34} color={i < rewardedToday ? 'var(--ink)' : 'var(--faint)'} /></span>)}</div>
        {next && !done && <div className="card white" style={{ marginTop: 14, padding: 14 }}>
          <div className="row"><div className="ico peach"><Icon name={ICON_FOR[next.skill.branch]} /></div><div className="sp"><p className="s">{next.kind === 'review' ? 'Review' : next.kind === 'start' ? 'Up next · new skill' : 'Up next'}</p><b style={{ fontSize: 16 }}>{next.skill.name}</b><p className="s">Step {(progress[next.skill.id]?.step ?? 0) + 1}: {pt(next.skill.steps[progress[next.skill.id]?.step ?? 0])}</p></div></div>
          <button className="btn" style={{ marginTop: 12 }} onClick={() => go('session/' + next.skill.id)}>Start · about 2 min</button></div>}
        {done && <p className="s" style={{ marginTop: 10 }}>Daily goal done. {cat.name} is napping; rewards reset tomorrow.</p>}
      </div>
      <CareCard />
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
      {wallet && <a href="#/corner" className="card butter row" style={{ color: 'inherit' }}><Paw color="#d4a23a" size={24} /><div className="sp"><b style={{ color: 'var(--butter-ink)' }}>{cat.name}’s corner</b>
        <p className="s" style={{ color: 'var(--butter-ink)' }}>{giftClaimed(cat.corner, t) ? `${Math.max(0, wallet.treats)} treats to spend on outfits, toys and cushions.` : `Today’s gift is waiting · ${Math.max(0, wallet.treats)} treats to spend`}</p></div>
        {!giftClaimed(cat.corner, t) && <span className="chip" style={{ background: 'var(--surface)' }}>New</span>}</a>}
      {account && <div className="card sky row">
        <a href="#/friends" className="row sp" style={{ color: 'inherit', gap: 12, textDecoration: 'none' }}><div className="ico"><Icon name="hand" /></div>
          <div className="sp"><b>Friends’ cats</b><p className="s">{pendingFriend() ? 'A friend invited you. Tap to add them.' : `See your friends’ cats next to ${cat.name}.`}</p></div></a>
        <button className="plusbtn" aria-label="Invite a friend" onClick={() => setInvite(true)}><Icon name="plus" size={22} /></button></div>}
      {invite && <InviteSheet onClose={() => setInvite(false)} />}
      <p className="s" style={{ textAlign: 'center', marginTop: 20 }}>{cat.name} · {ageText(cat.birthday)}</p>
    </div>
  </div>;
}

export const skillName = (id: string) => SKILL_BY_ID[id]?.name ?? id;
