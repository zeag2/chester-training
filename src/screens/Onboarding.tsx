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
  // three screens before the app: welcome, name + look, training (or welcome, account, invite code)
  const total = 3;
  const dots = (at: number) => { return <div className="dots" aria-label={`Step ${at} of ${total}`}>{Array.from({ length: total }, (_, i) => <i key={i} className={i + 1 === at ? 'on' : ''} />)}</div>; };
  const back = (n: number, label: string) => <div className="top"><button className="iconbtn" aria-label="Back" onClick={() => setStep(n)}><Icon name="back" /></button><b style={{ fontSize: 17 }}>{label}</b></div>;
  const foot = (n: number, label: string, onClick: () => void, disabled = false) => <div style={{ marginTop: 'auto', paddingTop: 24 }}>{dots(n)}<button className="btn" style={{ marginTop: 20 }} onClick={onClick} disabled={disabled}>{label}</button></div>;
  const wrap = (children: React.ReactNode) => <div className="screen centred" style={{ display: 'flex', flexDirection: 'column', paddingBottom: 'calc(28px + var(--safe-b))' }}>{children}</div>;

  if (step === 1) return wrap(<div className="stag" style={{ display: 'flex', flexDirection: 'column', flex: 1, paddingTop: 36 }}>
    <div className="card mint" style={{ margin: 0, display: 'flex', justifyContent: 'center', padding: '30px 16px 16px', borderRadius: 32 }}><Chester coat={coat} eyes={eyes} mood="happy" raised anim="wave" width={190} interactive /></div>
    <h1 style={{ marginTop: 30, fontSize: 32 }}>Let’s look after {waiting.length ? titleFor(waiting) : 'your cat'}.</h1>
    <p className="m" style={{ marginTop: 12, fontSize: 16 }}>Weight, health, vet visits and food in one place, shared with the people you live with. And clicker training, if you want it.</p>
    {sharingConfigured() ? <div style={{ marginTop: 'auto', paddingTop: 24 }}>{dots(1)}
      <button className="btn" style={{ marginTop: 20 }} onClick={() => { setInvited(false); next(4); }}>Set up my cat</button>
      <button className="btn2" style={{ marginTop: 10, width: '100%' }} onClick={() => { setInvited(true); next(account ? 8 : 3); }}>Someone invited me</button></div>
      : foot(1, 'Get started', () => next(4))}</div>);

  if (step === 3) return wrap(<>{back(1, 'Your account')}<div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
    {invited && <StepLabel n={1} of={2} label="Your account" />}
    <AccountForm share={!invited} onDone={(n) => { setMyName(n); next(invited ? 8 : 4); }}
      intro={invited ? 'You need your own account to train together. Next you’ll enter the invite code.' : 'Your account keeps your cat’s progress safe online, and lets you invite someone to train with you later.'} />
    <div style={{ marginTop: 'auto', paddingTop: 24 }}>{dots(2)}</div></div></>);

  if (step === 8) return wrap(<>{back(account ? 1 : 3, 'Invite code')}<div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
    <StepLabel n={2} of={2} label="Invite code" />
    <CodeForm name={myName} onDone={() => { setPendingPets([]); go('home'); }} />
    <div style={{ marginTop: 'auto', paddingTop: 24 }}>{dots(3)}</div></div></>);

  if (step === 4) return wrap(<>{adding ? <div className="top"><button className="iconbtn" aria-label="Back" onClick={() => go('settings')}><Icon name="back" /></button><b style={{ fontSize: 17 }}>Add another pet</b></div> : back(1, 'About your cat')}<div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
    <h1>{adding && waiting.length && name ? `Now, ${name}` : 'Tell us about your cat'}</h1><p className="m" style={{ marginTop: 6 }}>{waiting.length > 1 ? `${titleFor(waiting)}: one at a time. You can change this later.` : 'You can change this later.'}</p>
    <label className="field" htmlFor="nm">Name</label><input id="nm" className="in" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" enterKeyHint="next" placeholder="Your cat’s name" />
    <span className="field">Boy or girl?</span>
    <div className="seg" role="group" aria-label="Boy or girl"><button className={sex === 'm' ? 'on' : ''} aria-pressed={sex === 'm'} onClick={() => setSex('m')}>Boy</button><button className={sex === 'f' ? 'on' : ''} aria-pressed={sex === 'f'} onClick={() => setSex('f')}>Girl</button></div>
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
    <p className="s" style={{ marginTop: 10 }}>Birthday, breed and weight can go in later, in Settings.</p>
    {foot(2, 'Next', () => next(9), !name.trim())}</div></>);

  const save = async (training: boolean) => {
    audio.sparkle();
    await store.saveCat({ name: name.trim() || 'Kitty', sex, birthday, homeDate, breed, coat, eyes, weightLb: weight ? Number(weight) : undefined, rewards: training ? rewards : [], outfit: '', training });
    donePendingPet(name);
    go('another'); // every setup ends with "Another cat?"
  };

  if (step === 9) return wrap(<>{back(4, 'Training')}<div className="stag" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
    <h1>Do you want to train {name}?</h1>
    <p className="m" style={{ marginTop: 6 }}>{pt('Short clicker sessions: sit, high five, coming when called, and getting used to the carrier. Plenty of people just track health and weight; you can turn training on any time.')}</p>
    <button className="card mint row" style={{ marginTop: 18, textAlign: 'left', border: 0, color: 'inherit' }} onClick={() => { setTrain(true); void save(true); }}>
      <div className="ico"><Icon name="star" /></div><div className="sp"><b style={{ fontSize: 17 }}>Yes, let’s train</b><p className="s">{pt('Adds a Train tab with his skills and rewards.')}</p></div></button>
    <button className="card sky row" style={{ textAlign: 'left', border: 0, color: 'inherit' }} onClick={() => { setTrain(false); void save(false); }}>
      <div className="ico"><Icon name="hand" /></div><div className="sp"><b style={{ fontSize: 17 }}>Not now, just tracking</b><p className="s">Health, weight, vet visits and food.</p></div></button>
    <div style={{ marginTop: 'auto', paddingTop: 24 }}>{dots(3)}</div></div></>);

  return null;
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
