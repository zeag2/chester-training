import { useEffect, useRef, useState } from 'react';
import { Chester } from '../chester/Chester';
import { store, useStore } from '../db/store';
import { suggestNext } from '../engine/plan';
import { SKILLS, SKILL_BY_ID } from '../engine/skills';
import { DAILY_REWARDED_SETS } from '../engine/rewards';
import { daysHome, today, ageText } from '../lib/stats';
import { Icon, Paw } from '../ui/icons';
import { go } from '../ui/router';
import * as audio from '../lib/audio';
import { TodayCard } from './Care';
import { PetSwitcher } from '../ui/PetSwitcher';
import { Chase } from '../chester/Chase';
import { FRIEND_BONUS, giftClaimed } from '../engine/corner';
import { movedTo } from '../lib/moved';
import { pendingFriend } from '../lib/invite';
import { InviteSheet } from './Friends';
import { FriendsStrip } from '../ui/FriendsStrip';
import { DailyTaps } from '../ui/DailyTaps';
import { usePetText } from '../lib/pet';
import { CushionArt } from './Corner';

/** Part of the day from the time; night runs 10:30 PM to 5 AM. */
const PH = (h: number, m = 0) => (h < 5 ? 'night' : h < 12 ? 'morning' : h < 17 ? 'day' : h < 22 || (h === 22 && m < 30) ? 'evening' : 'night');
const BEAM = { morning: 'rgba(255,214,130,.24)', day: 'rgba(255,236,170,.22)', evening: 'rgba(255,170,140,.22)', night: 'rgba(150,170,230,.18)' };
const MOTE = { morning: '#f0c76a', day: '#efd27e', evening: '#f0a07e', night: '#c9d4f2' };
const GREET = { morning: 'Good morning', day: 'Good afternoon', evening: 'Good evening', night: 'Hi, night owl' };


/** Home life: sits by default, makes biscuits for a few seconds now and then, and dozes off if left alone. */
function useHomeMood() {
  const [doze, setDoze] = useState(false);
  // the idle between sits: biscuits on the pillow, or draped over the cushion, taking turns
  const [knead, setKnead] = useState<null | 'knead' | 'drape'>(null);
  const pokeRef = useRef<() => void>(() => {});
  useEffect(() => {
    let t = 0;
    const poke = () => { setDoze(false); window.clearTimeout(t); t = window.setTimeout(() => { setKnead(null); setDoze(true); }, 90_000); };
    pokeRef.current = poke;
    poke();
    document.addEventListener('pointerdown', poke, { passive: true }); window.addEventListener('scroll', poke, { passive: true });
    return () => { window.clearTimeout(t); document.removeEventListener('pointerdown', poke); window.removeEventListener('scroll', poke); };
  }, []);
  useEffect(() => {
    let a = 0, b = 0, n = 0;
    const next = () => { a = window.setTimeout(() => { const drape = n++ % 2 === 1; setKnead(drape ? 'drape' : 'knead'); b = window.setTimeout(() => { setKnead(null); next(); }, drape ? 14_000 : 7000); }, 25_000 + Math.random() * 30_000); };
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
  const { cat, progress, sets, wallet, unlockedHidden, account, household, pets, friendNews } = useStore();
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
  // just fed (a Fed tap in Quick log): round, content and patting his belly for a few seconds; "Luna too" fills her up too
  const [fed, setFed] = useState<string[]>([]);
  useEffect(() => {
    let t = 0;
    const f = (e: Event) => { const ids = (e as CustomEvent<string[]>).detail ?? []; wake(); setFed((x) => [...new Set([...x, ...ids])]); setLine(['Mmm. So full.', '*contented sigh*', 'That hit the spot.'][Math.floor(Math.random() * 3)]); setShown('pet');
      window.clearTimeout(t); t = window.setTimeout(() => setFed([]), 9000); };
    window.addEventListener('paldex:fed', f); return () => { window.removeEventListener('paldex:fed', f); window.clearTimeout(t); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const full = !!cat && fed.includes(cat.id) && !gag;
  // a bed bought in the corner sits under him on Home: he kneads and rests on it (the loaf instead of the sofa drape)
  const bed = cat?.corner?.cushion;
  // the other cats sit beside this one; now and then two of them nuzzle, and a toy rolls in for everyone to chase
  const others = pets.filter((p) => p.id !== cat?.id).slice(0, 2);
  const [chasing, setChasing] = useState(false);
  const [cuteN, setCuteN] = useState(0);
  // cheek to cheek with the cat beside him, eyes closed, for a couple of seconds
  const [nuzzle, setNuzzle] = useState(false);
  useEffect(() => { if (!cuteN) return; setNuzzle(true); audio.purr(1.6); const t = window.setTimeout(() => setNuzzle(false), 2800); return () => window.clearTimeout(t); }, [cuteN]);
  const calm = !night && !doze && !gag;
  const startChase = () => { if (!chasing && calm) { wake(); setChasing(true); } };
  const chaseRef = useRef(startChase); chaseRef.current = startChase;
  useEffect(() => {
    if (!calm) return;
    let t = 0;
    const next = () => { t = window.setTimeout(() => { if (!document.hidden) chaseRef.current(); next(); }, 60_000 + Math.random() * 60_000); };
    next(); return () => window.clearTimeout(t);
  }, [calm]);
  useEffect(() => {
    if (!calm || others.length === 0) return;
    const iv = window.setInterval(() => { if (!document.hidden) setCuteN((n) => n + 1); }, 30_000 + Math.random() * 15_000);
    return () => window.clearInterval(iv);
  }, [calm, others.length]);
  const t = today();
  const todaySets = sets.filter((s) => s.day === t);
  const rewardedToday = todaySets.filter((s) => s.rewarded).length;
  const plan = suggestNext(SKILLS, progress, sets, unlockedHidden, t);
  const next = plan[0];
  if (!cat) return null;
  const done = rewardedToday >= DAILY_REWARDED_SETS;
  const lines = ['Pet me!', 'Hi! Scratches?', 'Mrrp.', 'Is it dinner time?', 'I was napping. Hi.'];
  const idleLine = cat.training === false ? `Hi! I'm ${cat.name}. ${lines[new Date().getMinutes() % lines.length]}`
    : done ? `That's ${DAILY_REWARDED_SETS} sets today. Nap time!` : sets.length === 0 ? `Hi! I'm ${cat.name}. Let's start with the clicker.` : next ? `Next up: ${next.skill.name}. Ready?` : 'Pet me!';

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
        {partners.length > 0 && <p className="s" style={{ marginTop: 4 }}>Looking after {pets.length > 1 ? 'your cats' : cat.name} with {partners.join(' and ')}</p>}
        <PetSwitcher />
        {account && !myName && <button className="chip" style={{ marginTop: 8, border: 0, minHeight: 32 }} onClick={() => go('me')}>Add your name so {cat.name} can greet you</button>}</div>
      <div className="row" style={{ alignItems: 'flex-end', gap: 4, marginTop: 10 }}>
        {chasing ? <Chase cats={[{ id: cat.id, name: cat.name, coat: cat.coat, eyes: cat.eyes, wear: cat.corner?.wearing }, ...others]} width={Math.min(360, window.innerWidth - 40)} size={104} gap={70} onDone={() => setChasing(false)} />
        : <div className={`bedspot${bed ? ' onbed' : ''}`}>{bed && <div className="bed" aria-hidden="true"><CushionArt id={bed} width={150} /></div>}
        <div className={`gagwrap ${gag ?? ''}${nuzzle && calm && !knead ? ' nuzzling' : ''}`}><span className="gagflip">
        <Chester coat={cat.coat} eyes={cat.eyes} wear={cat.corner?.wearing} pose={gag === 'out' ? 'walk' : gag === 'back' ? 'run' : gag ? 'sit' : full ? 'full' : night ? 'sleep' : doze ? 'doze' : knead && !done ? (bed && knead === 'drape' ? 'loaf' : knead) : 'sit'} mood={gag === 'proud' || (nuzzle && calm && !knead) ? 'happy' : done || ph === 'night' ? 'sleepy' : 'curious'}
          raised={!gag && !full && !done && !night && !doze && sets.length === 0 && cat.training !== false} anim={gag || full ? '' : night ? 'night' : doze ? 'nap' : nuzzle && others.length > 0 && !knead ? 'nuzzle' : done ? 'nod' : sets.length === 0 ? 'wave' : ''}
          width={104} interactive label={cat.name} onPet={(l) => { if (ph === 'night' && !awakeUntil) { setAwakeUntil(Date.now() + 120_000); setLine(['Mrrp…? It’s late.', '*yawns* Oh, hi.', 'Five more minutes…'][Math.floor(Math.random() * 3)]); } else setLine(l); setShown('pet'); }} react={meowN ? 'r15' : null} reactKey={meowN} /></span></div></div>}
        {!chasing && others.length > 0 && <div className={`homecats${nuzzle && calm && !knead ? ' nuzzling' : ''}`}>{others.map((o, i) => <button key={o.id} className="other" style={{ zIndex: 2 - i }} aria-label={`Show ${o.name}`} onClick={() => { audio.chirp(); void store.switchPet(o.id); }}>
          <Chester coat={o.coat} eyes={o.eyes} wear={o.wear} pose={fed.includes(o.id) ? 'full' : night ? 'sleep' : doze ? 'doze' : 'sit'} mood={night ? 'sleepy' : nuzzle && i === 0 ? 'happy' : 'curious'} anim={doze ? 'nap' : nuzzle && i === 0 && !knead ? 'nuzzleL' : ''} width={84} label={o.name} /></button>)}</div>}
        {!chasing && !gag && !night && <button className="yarnbtn" aria-label="Roll a toy" onClick={() => startChase()}><Icon name="yarn" size={20} /></button>}
        {!chasing && <div style={{ marginBottom: 26 }}><span key={doze ? 'z' : shown + line + meowLine + gagLine} className="bubble mint">{pt(doze ? 'Zzz… (tap to wake him)' : shown === 'gag' && gagLine ? gagLine : shown === 'meow' ? meowLine : line || idleLine)}</span></div>}
      </div>
      {movedTo() && <div className="card butter"><b style={{ color: 'var(--butter-ink)' }}>PalDex has a new home</b>
        <p className="s" style={{ color: 'var(--butter-ink)', marginTop: 4 }}>{account ? `Open the new link, sign in, and add it to your Home Screen. ${cat.name}’s training comes with you.` : `First sign in (Settings, then Set up a household) so ${cat.name}’s training is saved online. Then open the new link and sign in there.`}</p>
        <a className="btn" style={{ marginTop: 12 }} href={movedTo()!}>Open {new URL(movedTo()!).host}</a></div>}
      <DailyTaps />
      <TodayCard />
      <FriendsStrip onInvite={() => setInvite(true)} />
      {cat.training !== false && <a href="#/train" className="card mint row" style={{ color: 'inherit', textDecoration: 'none' }}>
        <div className="ico"><Icon name="target" /></div>
        <div className="sp"><b>Training</b><p className="s">{done ? `${DAILY_REWARDED_SETS} of ${DAILY_REWARDED_SETS} sets today. Nap time!` : next ? `${Math.min(rewardedToday, DAILY_REWARDED_SETS)} of ${DAILY_REWARDED_SETS} sets today · up next: ${next.skill.name}` : `${Math.min(rewardedToday, DAILY_REWARDED_SETS)} of ${DAILY_REWARDED_SETS} sets today`}</p></div>
        {next && !done && <button className="btn2" style={{ minHeight: 40, background: 'var(--surface)' }} onClick={(e) => { e.preventDefault(); go('session/' + next.skill.id); }}>Start</button>}</a>}
      {wallet && <a href="#/corner" className="card butter row" style={{ color: 'inherit', textDecoration: 'none' }}><Paw color="#d4a23a" size={24} /><div className="sp"><b style={{ color: 'var(--butter-ink)' }}>{cat.name}’s corner</b>
        <p className="s" style={{ color: 'var(--butter-ink)' }}>{giftClaimed(cat.corner, t) ? `${Math.max(0, wallet.treats)} treats to spend on outfits, toys and cushions.` : `Today’s gift is waiting · ${Math.max(0, wallet.treats)} treats to spend`}</p></div>
        {!giftClaimed(cat.corner, t) && <span className="chip" style={{ background: 'var(--surface)' }}>New</span>}</a>}
      {friendNews && <div className="card butter pop" role="status">
        <div className="row" style={{ alignItems: 'flex-start' }}><Icon name="star" /><div className="sp">
          <b style={{ color: 'var(--butter-ink)' }}>{friendNews.names.length === 1 ? `${friendNews.names[0]} is now your friend!` : `${friendNews.names.length} new friends!`}</b>
          <p className="s" style={{ color: 'var(--butter-ink)', marginTop: 2 }}>+{FRIEND_BONUS.treats * friendNews.names.length} treats and +{friendNews.names.length} bond for {cat.name}{friendNews.scarf ? `, and a Friendship scarf in ${pt('his')} corner` : ''}.</p></div>
          <button className="iconbtn" aria-label="Dismiss" onClick={() => store.dismissFriendNews()}><Icon name="close" /></button></div>
        <div className="row" style={{ gap: 8, marginTop: 10 }}>
          {friendNews.scarf && <button className="btn2" style={{ flex: 1, background: 'var(--surface)' }} onClick={() => { void store.wear('scarf'); store.dismissFriendNews(); }}>Put the scarf on</button>}
          <button className="btn2" style={{ flex: 1, background: 'var(--surface)' }} onClick={() => { store.dismissFriendNews(); go('friends'); }}>See their cats</button></div>
      </div>}
      {invite && <InviteSheet onClose={() => setInvite(false)} />}
      <p className="s" style={{ textAlign: 'center', marginTop: 20 }}>{cat.name} · {ageText(cat.birthday)}</p>
    </div>
  </div>;
}

export const skillName = (id: string) => SKILL_BY_ID[id]?.name ?? id;
