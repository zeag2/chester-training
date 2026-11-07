import { useState } from 'react';
import { Chester } from '../chester/Chester';
import { COATS, EYES } from '../chester/art';
import { store, useStore } from '../db/store';
import { Icon, Paw } from '../ui/icons';
import { ageText } from '../lib/stats';
import { go } from '../ui/router';
import * as audio from '../lib/audio';
import { sharingConfigured } from '../sync/config';
import { AccountForm, CodeForm, StepLabel } from './Together';

const REWARDS = [
  { id: 'treats', title: 'Tasty treats', sub: 'Lickable treats, chicken, kibble', bg: 'peach', icon: 'yarn' },
  { id: 'petting', title: 'Petting and chin scratches', sub: 'Lots of cats like this best', bg: 'mint', icon: 'hand' },
  { id: 'play', title: 'Play', sub: 'Wand toy, a quick chase', bg: 'sky', icon: 'target' },
  { id: 'smells', title: 'Smells', sub: 'Catnip or silvervine', bg: 'butter', icon: 'leaf' },
];
const SWATCH: Record<string, string> = { black: '#353746', orange: '#f3a65e', grey: '#9aa0b4', white: '#fbfaf7', cream: '#f3dcb5', brown: 'repeating-linear-gradient(45deg,#a8805a 0 5px,#6b4a2e 5px 8px)', silver: 'repeating-linear-gradient(45deg,#ced3dc 0 5px,#717789 5px 8px)', tuxedo: 'linear-gradient(90deg,#353746 50%,#fbfaf7 50%)', calico: 'conic-gradient(#fbfaf7 0 120deg,#f3a65e 0 240deg,#4a3f3c 0)', tortie: 'conic-gradient(#3d3330 0 180deg,#d7823a 0)', point: 'radial-gradient(#6e5140 35%,#f4ebdd 36%)' };
const EYESW: Record<string, string> = { gold: '#f2bb3d', copper: '#e07d2e', green: '#8cc152', blue: '#6db3f2', hazel: '#b39b4b', odd: 'linear-gradient(90deg,#6db3f2 50%,#f2bb3d 50%)' };

function guessCoat(breed: string): string {
  const b = breed.toLowerCase();
  if (/siam|himalay|ragdoll|birman|point/.test(b)) return 'point';
  if (/calico/.test(b)) return 'calico'; if (/tux/.test(b)) return 'tuxedo'; if (/tort/.test(b)) return 'tortie';
  if (/orange|ginger/.test(b)) return 'orange'; if (/silver/.test(b)) return 'silver'; if (/russian|blue|grey|gray|korat|chartreux/.test(b)) return 'grey';
  if (/white/.test(b)) return 'white'; if (/tabby/.test(b)) return 'brown'; return 'black';
}

export function Onboarding() {
  const [step, setStep] = useState(1);
  const [invited, setInvited] = useState(false);
  const { account } = useStore();
  const [myName, setMyName] = useState('');
  const [name, setName] = useState('Chester');
  const [birthday, setBirthday] = useState('2026-04');
  const [homeDate, setHomeDate] = useState('2026-11-01');
  const [breed, setBreed] = useState('American Shorthair, black');
  const [weight, setWeight] = useState('');
  const [coat, setCoat] = useState('black');
  const [eyes, setEyes] = useState('gold');
  const [rewards, setRewards] = useState<string[]>(['treats', 'petting']);
  const next = (n: number) => { audio.chirp(true); setStep(n); };
  const total = !sharingConfigured() ? 5 : invited ? 4 : 7;
  const dots = (n: number) => { const at = sharingConfigured() ? n : n === 1 ? 1 : n - 2; return <div className="dots" aria-label={`Step ${at} of ${total}`}>{Array.from({ length: total }, (_, i) => <i key={i} className={i + 1 === at ? 'on' : ''} />)}</div>; };
  const back = (n: number, label: string) => <div className="top"><button className="iconbtn" aria-label="Back" onClick={() => setStep(n)}><Icon name="back" /></button><b style={{ fontSize: 17 }}>{label}</b></div>;
  const foot = (n: number, label: string, onClick: () => void, disabled = false) => <div style={{ marginTop: 'auto', paddingTop: 24 }}>{dots(n)}<button className="btn" style={{ marginTop: 20 }} onClick={onClick} disabled={disabled}>{label}</button></div>;
  const wrap = (children: React.ReactNode) => <div className="screen" style={{ display: 'flex', flexDirection: 'column', paddingBottom: 'calc(28px + var(--safe-b))' }}>{children}</div>;

  if (step === 1) return wrap(<div className="stag" style={{ display: 'flex', flexDirection: 'column', flex: 1, paddingTop: 36 }}>
    <div className="card mint" style={{ margin: 0, display: 'flex', justifyContent: 'center', padding: '30px 16px 16px', borderRadius: 32 }}><Chester coat="black" eyes="gold" mood="happy" raised anim="wave" width={190} interactive /></div>
    <h1 style={{ marginTop: 30, fontSize: 32 }}>Let's teach your kitten a few tricks.</h1>
    <p className="m" style={{ marginTop: 12, fontSize: 16 }}>Short, fun sessions with a clicker. A few minutes a day, with steps based on cat research.</p>
    {foot(1, 'Get started', () => next(sharingConfigured() ? 2 : 4))}</div>);

  if (step === 2) return wrap(<>{back(1, 'Welcome')}<div className="stag" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
    <h1>How are you joining?</h1><p className="m" style={{ marginTop: 6 }}>Training a cat with someone else? Join their cat so you share the same progress.</p>
    <button className="card mint row" style={{ marginTop: 18, textAlign: 'left', border: 0 }} onClick={() => { setInvited(false); next(account ? 4 : 3); }}>
      <div className="ico"><Icon name="star" /></div><div className="sp"><b style={{ fontSize: 17 }}>Set up my cat</b><p className="s">Start fresh. You can invite someone later.</p></div></button>
    <button className="card sky row" style={{ textAlign: 'left', border: 0 }} onClick={() => { setInvited(true); next(account ? 8 : 3); }}>
      <div className="ico"><Icon name="hand" /></div><div className="sp"><b style={{ fontSize: 17 }}>Someone invited me</b><p className="s">You have an invite code from the person you train with.</p></div></button>
    <div style={{ marginTop: 'auto', paddingTop: 24 }}>{dots(2)}</div></div></>);

  if (step === 3) return wrap(<>{back(2, 'Your account')}<div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
    {invited && <StepLabel n={1} of={2} label="Your account" />}
    <AccountForm share={!invited} onDone={(n) => { setMyName(n); next(invited ? 8 : 4); }}
      intro={invited ? 'You need your own account to train together. Next you’ll enter the invite code.' : 'Your account keeps your cat’s progress safe online, and lets you invite someone to train with you later.'} />
    <div style={{ marginTop: 'auto', paddingTop: 24 }}>{dots(3)}</div></div></>);

  if (step === 8) return wrap(<>{back(account ? 2 : 3, 'Invite code')}<div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
    <StepLabel n={2} of={2} label="Invite code" />
    <CodeForm name={myName} onDone={() => go('home')} />
    <div style={{ marginTop: 'auto', paddingTop: 24 }}>{dots(4)}</div></div></>);

  if (step === 4) return wrap(<>{back(!sharingConfigured() ? 1 : account ? 2 : 3, 'About him')}<div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
    <h1>Who are we training?</h1><p className="m" style={{ marginTop: 6 }}>You can change this later.</p>
    <label className="field" htmlFor="nm">Name</label><input id="nm" className="in" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" enterKeyHint="next" />
    <div style={{ display: 'flex', gap: 10 }}>
      <div style={{ flex: 1, minWidth: 0 }}><label className="field" htmlFor="bd">Birthday (a guess is fine)</label><input id="bd" className="in" type="month" value={birthday} onChange={(e) => setBirthday(e.target.value)} /></div>
      <div style={{ flex: 1, minWidth: 0 }}><label className="field" htmlFor="hd">Home since</label><input id="hd" className="in" type="date" value={homeDate} onChange={(e) => setHomeDate(e.target.value)} /></div>
    </div>
    <label className="field" htmlFor="br">Breed and coat</label><input id="br" className="in" value={breed} onChange={(e) => setBreed(e.target.value)} />
    <label className="field" htmlFor="wt">Weight in pounds (optional)</label><input id="wt" className="in" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="lb" />
    {birthday && <div className="card butter row" style={{ marginTop: 16 }}><Paw color="#d4a23a" size={24} /><p className="s" style={{ color: '#5b4a1c' }}>{name || 'He'} is {ageText(birthday)}. A great age to start.</p></div>}
    {foot(4, 'Next', () => { setCoat(guessCoat(breed)); next(5); }, !name.trim())}</div></>);

  if (step === 5) return wrap(<>{back(4, 'His look')}<div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
    <h1>Let's build {name}</h1><p className="m" style={{ marginTop: 6 }}>We started from "{breed}". Change anything.</p>
    <div className="card mint" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 12px 12px' }}>
      <Chester key={coat + eyes} coat={coat} eyes={eyes} raised anim="wave" width={170} interactive label={name} />
      <b style={{ fontSize: 16, marginTop: 6 }}>{COATS[coat].name} · {EYES[eyes].name} eyes</b></div>
    <span className="field">Coat</span>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }} role="group" aria-label="Coat">
      {Object.keys(COATS).map((k) => <button key={k} aria-pressed={k === coat} onClick={() => { audio.chirp(); setCoat(k); }} className="chipbtn" style={{ height: 'auto', padding: '8px 2px', borderRadius: 16, background: '#fff', outline: k === coat ? '3px solid #232320' : '1px solid #ecece8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <span style={{ width: 34, height: 34, borderRadius: '50%', background: SWATCH[k], border: '2px solid rgba(35,35,32,.12)' }} /><span style={{ fontSize: 11, lineHeight: 1.1 }}>{COATS[k].name}</span></button>)}
    </div>
    <span className="field">Eyes</span>
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }} role="group" aria-label="Eye colour">
      {Object.keys(EYES).map((k) => <button key={k} aria-label={EYES[k].name + ' eyes'} aria-pressed={k === eyes} onClick={() => { audio.chirp(); setEyes(k); }} style={{ background: '#fff', border: 0, borderRadius: '50%', padding: 7, outline: k === eyes ? '3px solid #232320' : '1px solid #ecece8' }}><span style={{ display: 'block', width: 30, height: 30, borderRadius: '50%', background: EYESW[k] }} /></button>)}
    </div>
    {foot(5, `That's ${name}!`, () => next(6))}</div></>);

  if (step === 6) return wrap(<>{back(5, 'Rewards')}<div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
    <h1>What does {name} love most?</h1><p className="m" style={{ marginTop: 6 }}>This becomes his paycheck. Pick up to two.</p>
    {REWARDS.map((r) => { const on = rewards.includes(r.id); return <button key={r.id} className={`card ${r.bg} row`} aria-pressed={on} style={{ outline: on ? '2.5px solid #232320' : 'none' }}
      onClick={() => { audio.chirp(); setRewards(on ? rewards.filter((x) => x !== r.id) : [...rewards, r.id].slice(-2)); }}>
      <div className="ico"><Icon name={r.icon} /></div><div className="sp"><b style={{ fontSize: 16 }}>{r.title}</b><p className="s">{r.sub}</p></div>{on && <span className="chip">Picked</span>}</button>; })}
    <p className="s" style={{ marginTop: 14 }}>In one study, half the cats chose time with a person over food.</p>
    {foot(6, 'Next', () => next(7), rewards.length === 0)}</div></>);

  const rule = (n: number, bg: string, t: string, s: string) => <div className={`card ${bg} row`} style={{ alignItems: 'flex-start' }}><div className="ico" style={{ fontWeight: 800, fontSize: 18 }}>{n}</div><div><b style={{ fontSize: 16 }}>{t}</b><p className="s" style={{ marginTop: 2 }}>{s}</p></div></div>;
  return wrap(<>{back(6, 'How it works')}<div className="stag" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
    <h1>Three house rules</h1>
    {rule(1, 'mint', 'Keep it tiny', '1 to 3 minutes, up to 3 times a day. Stop while he still wants more.')}
    {rule(2, 'peach', 'Click, then treat', 'Click the moment he does it. Every click gets a reward.')}
    {rule(3, 'sky', 'He can say no', 'Ears back or walking away means stop. Try again later.')}
    <div className="card butter"><b>First up: Charge the clicker</b><p className="s" style={{ marginTop: 2 }}>Click, treat, repeat 10 times. {name} learns that the click means something good.</p></div>
    {foot(7, `Start ${name}'s first session`, async () => {
      audio.sparkle();
      await store.saveCat({ name: name.trim() || 'Chester', birthday, homeDate, breed, coat, eyes, weightLb: weight ? Number(weight) : undefined, rewards, outfit: '' });
      go('session/clicker');
    })}</div></>);
}
