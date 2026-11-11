import { useState } from 'react';
import { Chester } from '../chester/Chester';
import { COATS, EYES } from '../chester/art';
import { store, useStore } from '../db/store';
import { Icon, Paw } from '../ui/icons';
import { ageText } from '../lib/stats';
import { go } from '../ui/router';
import * as audio from '../lib/audio';
import { sharingConfigured } from '../sync/config';
import { petText } from '../lib/pet';
import { AccountForm, CodeForm, StepLabel } from './Together';
import { SWATCH, EYESW } from '../ui/swatches';
import { donePendingPet, pendingPets, setPendingPets, titleFor } from '../lib/appname';
import { useStore as useSnap } from '../db/store';

const REWARDS = [
  { id: 'treats', title: 'Tasty treats', sub: 'Lickable treats, chicken, kibble', bg: 'peach', icon: 'yarn' },
  { id: 'petting', title: 'Petting and chin scratches', sub: 'Lots of cats like this best', bg: 'mint', icon: 'hand' },
  { id: 'play', title: 'Play', sub: 'Wand toy, a quick chase', bg: 'sky', icon: 'target' },
  { id: 'smells', title: 'Smells', sub: 'Catnip or silvervine', bg: 'butter', icon: 'leaf' },
];

function guessCoat(breed: string): string {
  const b = breed.toLowerCase();
  if (/siam|himalay|ragdoll|birman|point/.test(b)) return 'point';
  if (/calico/.test(b)) return 'calico'; if (/tux/.test(b)) return 'tuxedo'; if (/tort/.test(b)) return 'tortie';
  if (/orange|ginger/.test(b)) return 'orange'; if (/silver/.test(b)) return 'silver'; if (/russian|blue|grey|gray|korat|chartreux/.test(b)) return 'grey';
  if (/white/.test(b)) return 'white'; if (/tabby/.test(b)) return 'brown'; return 'black';
}

/** First-run setup; with `adding`, just the pet questions for another pet. */
export function Onboarding({ adding = false }: { adding?: boolean }) {
  const [step, setStep] = useState(adding ? 4 : 1);
  const [invited, setInvited] = useState(false);
  const { account } = useStore();
  const [myName, setMyName] = useState('');
  const [waiting] = useState(pendingPets); // kittens named on the install page, set up one after another
  const [name, setName] = useState(waiting[0]?.name ?? '');
  const [train, setTrain] = useState(true);
  const [sex, setSex] = useState<'m' | 'f'>('m');
  const [birthday, setBirthday] = useState('');
  const [homeDate, setHomeDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [breed, setBreed] = useState('');
  const [weight, setWeight] = useState('');
  const [coat, setCoat] = useState(waiting[0]?.coat ?? 'black');
  const [eyes, setEyes] = useState(waiting[0]?.eyes ?? 'gold');
  const [rewards, setRewards] = useState<string[]>(['treats', 'petting']);
  const next = (n: number) => { audio.chirp(true); setStep(n); };
  const pt = (x: string) => petText(x, { name: name.trim() || 'your cat', sex });
  const He = sex === 'f' ? 'She' : 'He';
  const total = !sharingConfigured() ? 6 : invited ? 4 : 8;
  const dots = (n: number) => { const at = sharingConfigured() ? n : n === 1 ? 1 : n - 2; return <div className="dots" aria-label={`Step ${at} of ${total}`}>{Array.from({ length: total }, (_, i) => <i key={i} className={i + 1 === at ? 'on' : ''} />)}</div>; };
  const back = (n: number, label: string) => <div className="top"><button className="iconbtn" aria-label="Back" onClick={() => setStep(n)}><Icon name="back" /></button><b style={{ fontSize: 17 }}>{label}</b></div>;
  const foot = (n: number, label: string, onClick: () => void, disabled = false) => <div style={{ marginTop: 'auto', paddingTop: 24 }}>{dots(n)}<button className="btn" style={{ marginTop: 20 }} onClick={onClick} disabled={disabled}>{label}</button></div>;
  const wrap = (children: React.ReactNode) => <div className="screen centred" style={{ display: 'flex', flexDirection: 'column', paddingBottom: 'calc(28px + var(--safe-b))' }}>{children}</div>;

  if (step === 1) return wrap(<div className="stag" style={{ display: 'flex', flexDirection: 'column', flex: 1, paddingTop: 36 }}>
    <div className="card mint" style={{ margin: 0, display: 'flex', justifyContent: 'center', padding: '30px 16px 16px', borderRadius: 32 }}><Chester coat={coat} eyes={eyes} mood="happy" raised anim="wave" width={190} interactive /></div>
    <h1 style={{ marginTop: 30, fontSize: 32 }}>Let’s look after {waiting.length ? titleFor(waiting) : 'your cat'}.</h1>
    <p className="m" style={{ marginTop: 12, fontSize: 16 }}>Weight, health, vet visits and food in one place, shared with the people you live with. And clicker training, if you want it.</p>
    {foot(1, 'Get started', () => next(sharingConfigured() ? 2 : 4))}</div>);

  if (step === 2) return wrap(<>{back(1, 'Welcome')}<div className="stag" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
    <h1>How are you joining?</h1><p className="m" style={{ marginTop: 6 }}>Training a cat with someone else? Join their cat so you share the same progress.</p>
    <button className="card mint row" style={{ marginTop: 18, textAlign: 'left', border: 0 }} onClick={() => { setInvited(false); next(account ? 4 : 3); }}>
      <div className="ico"><Icon name="star" /></div><div className="sp"><b style={{ fontSize: 17 }}>Set up my cat</b><p className="s">Start fresh. You can invite someone later.</p></div></button>
    <button className="card sky row" style={{ textAlign: 'left', border: 0 }} onClick={() => { setInvited(true); next(account ? 8 : 3); }}>
      <div className="ico"><Icon name="hand" /></div><div className="sp"><b style={{ fontSize: 17 }}>Someone invited me</b><p className="s">You have an invite code to join their household.</p></div></button>
    <div style={{ marginTop: 'auto', paddingTop: 24 }}>{dots(2)}</div></div></>);

  if (step === 3) return wrap(<>{back(2, 'Your account')}<div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
    {invited && <StepLabel n={1} of={2} label="Your account" />}
    <AccountForm share={!invited} onDone={(n) => { setMyName(n); next(invited ? 8 : 4); }}
      intro={invited ? 'You need your own account to train together. Next you’ll enter the invite code.' : 'Your account keeps your cat’s progress safe online, and lets you invite someone to train with you later.'} />
    <div style={{ marginTop: 'auto', paddingTop: 24 }}>{dots(3)}</div></div></>);

  if (step === 8) return wrap(<>{back(account ? 2 : 3, 'Invite code')}<div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
    <StepLabel n={2} of={2} label="Invite code" />
    <CodeForm name={myName} onDone={() => { setPendingPets([]); go('home'); }} />
    <div style={{ marginTop: 'auto', paddingTop: 24 }}>{dots(4)}</div></div></>);

  if (step === 4) return wrap(<>{adding ? <div className="top"><button className="iconbtn" aria-label="Back" onClick={() => go('settings')}><Icon name="back" /></button><b style={{ fontSize: 17 }}>Add another pet</b></div> : back(!sharingConfigured() ? 1 : account ? 2 : 3, 'About your cat')}<div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
    <h1>{adding && waiting.length && name ? `Now, ${name}` : 'Tell us about your cat'}</h1><p className="m" style={{ marginTop: 6 }}>{waiting.length > 1 ? `${titleFor(waiting)}: one at a time. You can change this later.` : 'You can change this later.'}</p>
    <label className="field" htmlFor="nm">Name</label><input id="nm" className="in" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" enterKeyHint="next" placeholder="Your cat’s name" />
    <span className="field">Boy or girl?</span>
    <div className="seg" role="group" aria-label="Boy or girl"><button className={sex === 'm' ? 'on' : ''} aria-pressed={sex === 'm'} onClick={() => setSex('m')}>Boy</button><button className={sex === 'f' ? 'on' : ''} aria-pressed={sex === 'f'} onClick={() => setSex('f')}>Girl</button></div>
    <div style={{ display: 'flex', gap: 10 }}>
      <div style={{ flex: 1, minWidth: 0 }}><label className="field" htmlFor="bd">Birthday (a guess is fine)</label><input id="bd" className="in" type="month" value={birthday} onChange={(e) => setBirthday(e.target.value)} /></div>
      <div style={{ flex: 1, minWidth: 0 }}><label className="field" htmlFor="hd">Home since</label><input id="hd" className="in" type="date" value={homeDate} onChange={(e) => setHomeDate(e.target.value)} /></div>
    </div>
    <label className="field" htmlFor="br">Breed and coat</label><input id="br" className="in" value={breed} onChange={(e) => setBreed(e.target.value)} placeholder="e.g. Tabby, Siamese, black shorthair" />
    <label className="field" htmlFor="wt">Weight in pounds (optional)</label><input id="wt" className="in" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="lb" />
    {birthday && <div className="card butter row" style={{ marginTop: 16 }}><Paw color="#d4a23a" size={24} /><p className="s" style={{ color: 'var(--butter-ink)' }}>{name || He} is {ageText(birthday)}. A great age to start.</p></div>}
    {foot(4, 'Next', () => { if (!waiting.find((w) => w.name.toLowerCase() === name.trim().toLowerCase())?.coat) setCoat(guessCoat(breed)); next(5); }, !name.trim())}</div></>);

  if (step === 5) return wrap(<>{back(4, sex === 'f' ? 'Her look' : 'His look')}<div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
    <h1>Let's build {name}</h1><p className="m" style={{ marginTop: 6 }}>{breed ? <>We started from "{breed}". Change anything.</> : 'Pick the closest coat and eye colour.'}</p>
    <div className="card mint" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 12px 12px' }}>
      <Chester key={coat + eyes} coat={coat} eyes={eyes} raised anim="wave" width={170} interactive label={name} />
      <b style={{ fontSize: 16, marginTop: 6 }}>{COATS[coat].name} · {EYES[eyes].name} eyes</b></div>
    <span className="field">Coat</span>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }} role="group" aria-label="Coat">
      {Object.keys(COATS).map((k) => <button key={k} aria-pressed={k === coat} onClick={() => { audio.chirp(); setCoat(k); }} className="chipbtn" style={{ height: 'auto', padding: '8px 2px', borderRadius: 16, background: 'var(--surface)', outline: k === coat ? '3px solid var(--ink)' : '1px solid var(--line)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <span style={{ width: 34, height: 34, borderRadius: '50%', background: SWATCH[k], border: '2px solid var(--faint)' }} /><span style={{ fontSize: 11, lineHeight: 1.1 }}>{COATS[k].name}</span></button>)}
    </div>
    <span className="field">Eyes</span>
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }} role="group" aria-label="Eye colour">
      {Object.keys(EYES).map((k) => <button key={k} aria-label={EYES[k].name + ' eyes'} aria-pressed={k === eyes} onClick={() => { audio.chirp(); setEyes(k); }} style={{ background: 'var(--surface)', border: 0, borderRadius: '50%', padding: 7, outline: k === eyes ? '3px solid var(--ink)' : '1px solid var(--line)' }}><span style={{ display: 'block', width: 30, height: 30, borderRadius: '50%', background: EYESW[k] }} /></button>)}
    </div>
    {foot(5, `That's ${name}!`, () => next(9))}</div></>);

  const save = async (training: boolean) => {
    audio.sparkle();
    await store.saveCat({ name: name.trim() || 'Kitty', sex, birthday, homeDate, breed, coat, eyes, weightLb: weight ? Number(weight) : undefined, rewards: training ? rewards : [], outfit: '', training });
    donePendingPet(name);
    go('another'); // every setup ends with "Another cat?"
  };

  if (step === 9) return wrap(<>{back(5, 'Training')}<div className="stag" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
    <h1>Do you want to train {name}?</h1>
    <p className="m" style={{ marginTop: 6 }}>{pt('Short clicker sessions: sit, high five, coming when called, and getting used to the carrier. Plenty of people just track health and weight; you can turn training on any time.')}</p>
    <button className="card mint row" style={{ marginTop: 18, textAlign: 'left', border: 0, color: 'inherit' }} onClick={() => { setTrain(true); next(6); }}>
      <div className="ico"><Icon name="star" /></div><div className="sp"><b style={{ fontSize: 17 }}>Yes, let’s train</b><p className="s">{pt('Adds a Train tab with his skills and rewards.')}</p></div></button>
    <button className="card sky row" style={{ textAlign: 'left', border: 0, color: 'inherit' }} onClick={() => { setTrain(false); void save(false); }}>
      <div className="ico"><Icon name="hand" /></div><div className="sp"><b style={{ fontSize: 17 }}>Not now, just tracking</b><p className="s">Health, weight, vet visits and food.</p></div></button>
    <div style={{ marginTop: 'auto', paddingTop: 24 }}>{dots(6)}</div></div></>);

  if (step === 6) return wrap(<>{back(9, 'Rewards')}<div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
    <h1>What does {name} love most?</h1><p className="m" style={{ marginTop: 6 }}>{pt('This becomes his paycheck. Pick up to two.')}</p>
    {REWARDS.map((r) => { const on = rewards.includes(r.id); return <button key={r.id} className={`card ${r.bg} row`} aria-pressed={on} style={{ outline: on ? '2.5px solid var(--ink)' : 'none' }}
      onClick={() => { audio.chirp(); setRewards(on ? rewards.filter((x) => x !== r.id) : [...rewards, r.id].slice(-2)); }}>
      <div className="ico"><Icon name={r.icon} /></div><div className="sp"><b style={{ fontSize: 16 }}>{r.title}</b><p className="s">{r.sub}</p></div>{on && <span className="chip">Picked</span>}</button>; })}
    <p className="s" style={{ marginTop: 14 }}>In one study, half the cats chose time with a person over food.</p>
    {foot(7, 'Next', () => next(7), rewards.length === 0)}</div></>);

  const rule = (n: number, bg: string, t: string, s: string) => <div className={`card ${bg} row`} style={{ alignItems: 'flex-start' }}><div className="ico" style={{ fontWeight: 800, fontSize: 18 }}>{n}</div><div><b style={{ fontSize: 16 }}>{t}</b><p className="s" style={{ marginTop: 2 }}>{s}</p></div></div>;
  return wrap(<>{back(6, 'How it works')}<div className="stag" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
    <h1>Three house rules</h1>
    {rule(1, 'mint', 'Keep it tiny', pt('1 to 3 minutes, up to 3 times a day. Stop while he still wants more.'))}
    {rule(2, 'peach', 'Click, then treat', pt('Click the moment he does it. Every click gets a reward.'))}
    {rule(3, 'sky', `${He} can say no`, 'Ears back or walking away means stop. Try again later.')}
    <div className="card butter"><b>First up: Charge the clicker</b><p className="s" style={{ marginTop: 2 }}>Click, treat, repeat 10 times. {name} learns that the click means something good.</p></div>
    {sharingConfigured() && <p className="s" style={{ marginTop: 12 }}>Your pet’s info is saved to PalDex’s online database so it’s backed up and can be shared with people you invite. Only you and the people you invite see it in the app; the person who runs this PalDex can see the database.</p>}
    {foot(8, `Save ${name}`, () => save(train))}</div></>);
}

/** The end of every setup: another cat (the next one already named, if any), or done. */
export function AnotherCat() {
  const { cat } = useSnap();
  const next = pendingPets()[0];
  if (!cat) return null;
  const training = cat.training !== false;
  return <div className="screen centred" style={{ display: 'flex', flexDirection: 'column', paddingBottom: 'calc(28px + var(--safe-b))' }}>
    <div className="stag" style={{ display: 'flex', flexDirection: 'column', flex: 1, paddingTop: 36 }}>
      <div className="card mint" style={{ margin: 0, display: 'flex', justifyContent: 'center', padding: '26px 16px 14px', borderRadius: 32 }}><Chester coat={cat.coat} eyes={cat.eyes} mood="happy" anim="dance" width={170} label={cat.name} /></div>
      <h1 style={{ marginTop: 26 }}>{cat.name} is all set!</h1>
      <p className="m" style={{ marginTop: 8, fontSize: 16 }}>{next ? `Next up: ${next.name}.` : 'Do you have another cat? Each one gets their own health log, and they all show up together on Home.'}</p>
      <div style={{ marginTop: 'auto', paddingTop: 24 }}>
        {next ? <button className="btn" onClick={() => go('add-pet')}>Set up {next.name}</button>
          : <button className="btn" onClick={() => go(training ? 'session/clicker' : 'home')}>{training ? `Start ${cat.name}’s first session` : 'Go to Home'}</button>}
        <button className="btn2" style={{ width: '100%', marginTop: 10, background: next ? 'transparent' : undefined }} onClick={() => { if (next) { setPendingPets([]); go(training ? 'session/clicker' : 'home'); } else go('add-pet'); }}>
          {next ? 'Skip for now' : 'Add another cat'}</button>
      </div>
    </div></div>;
}
