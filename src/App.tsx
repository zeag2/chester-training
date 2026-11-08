import { useEffect, useState } from 'react';
import { store, useStore } from './db/store';
import { useRoute } from './ui/router';
import { TabBar } from './ui/TabBar';
import { AnotherCat, Onboarding } from './screens/Onboarding';
import { Home } from './screens/Home';
import { Session } from './screens/Session';
import { Recap } from './screens/Recap';
import { Tree } from './screens/Tree';
import { Library } from './screens/Library';
import { SkillPage } from './screens/SkillPage';
import { Settings } from './screens/Settings';
import { Together } from './screens/Together';
import { Gallery } from './screens/Gallery';
import { Care } from './screens/Care';
import { Corner } from './screens/Corner';
import { Train } from './screens/Train';
import { QuickLog } from './screens/QuickLog';
import type { CareKind } from './engine/care';
import { Friends } from './screens/Friends';
import { Visit } from './screens/Visit';
import { keepAlive, setMuted, warm } from './lib/audio';
import { Install } from './screens/Install';
import { wantsInstallStep } from './lib/install';
import { applyAppName, pendingPets } from './lib/appname';
import { movedTo } from './lib/moved';

export default function App() {
  const snap = useStore();
  const route = useRoute(); const [r0, r1] = route;
  const [quick, setQuick] = useState(false);
  useEffect(() => { void store.load(); }, []);
  const [installStep, setInstallStep] = useState(wantsInstallStep);
  // the app is named after the kittens: on the tab, the Home Screen icon and the install manifest
  const petNames = snap.pets.map((p) => [p.name, p.coat, p.eyes].join('/')).join('\u0000');
  useEffect(() => { if (snap.ready && !(installStep && !snap.cat)) applyAppName(snap.pets.length ? snap.pets.map((p) => ({ name: p.name, coat: p.coat, eyes: p.eyes })) : pendingPets(), !snap.pets.length); }, [snap.ready, petNames, installStep, snap.cat]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setMuted(localStorage.getItem('chester-muted') === '1'); }, []);
  // iPhone only allows audio after a tap: unlock it and fetch the sampled sounds on the first one
  useEffect(() => { const f = () => warm(); document.addEventListener('pointerdown', f, { once: true, passive: true }); return () => document.removeEventListener('pointerdown', f); }, []);
  // …and keep it working after switching apps (iPhone pauses it in the background)
  useEffect(() => keepAlive(), []);
  // Pick up the other trainer's sets when the app comes back to the front, and every few minutes while open
  useEffect(() => {
    const f = () => { if (document.visibilityState === 'visible' && store.get().account) void store.sync(); };
    document.addEventListener('visibilitychange', f); const t = setInterval(f, 180_000);
    return () => { document.removeEventListener('visibilitychange', f); clearInterval(t); };
  }, []);
  if (!snap.ready) return <div className="screen" aria-busy="true" />;
  // PalDex moved: someone new on the old address goes straight to the new one (people with pets here get a card on Home)
  if (!snap.cat && movedTo()) { location.replace(movedTo()!); return <div className="screen" aria-busy="true" />; }
  if (import.meta.env.DEV && r0 === 'gallery') return <Gallery />;
  if (r0 === 'together' || r0 === 'join') return <Together key={r0} mode={r0 === 'join' ? 'join' : 'share'} />;
  if (r0 === 'add-pet') return <Onboarding adding key={pendingPets().map((p) => p.name).join()} />;
  if (r0 === 'another' && snap.cat) return <AnotherCat />;
  if (!snap.cat && installStep && r0 !== 'join') return <Install onSkip={() => setInstallStep(false)} />;
  if (!snap.cat && r0 !== 'session') return <Onboarding />;
  let body: React.ReactNode;
  let tab = '';
  const r2 = route[2];
  switch (r0) {
    case 'session': return snap.cat ? <Session key={r1} skillId={r1 ?? 'clicker'} /> : <Onboarding />;
    case 'recap': return <Recap key={r1} skillId={r1 ?? 'clicker'} />;
    // Health: the care page, as its own tab; #/health/log/<kind> opens a log form straight away (from the + sheet)
    case 'health': case 'care': body = <Care key={r1 === 'log' ? 'log-' + r2 : 'care'} open={r1 === 'log' ? (r2 as CareKind) : undefined} />; tab = 'health'; break;
    // Train: everything about training, with the tree, library, skills and Chester's corner under it
    case 'train': body = <Train />; tab = 'train'; break;
    case 'tree': body = <Tree />; tab = 'train'; break;
    case 'library': body = <Library />; tab = 'train'; break;
    case 'skill': body = <SkillPage key={r1} id={r1} />; tab = 'train'; break;
    case 'corner': body = <Corner />; tab = 'train'; break;
    // Me: your cats, people (household and friends), app settings, your data
    case 'me': case 'settings': body = <Settings />; tab = 'me'; break;
    case 'friends': body = <Friends key={r1 ?? ''} code={r1} />; tab = 'me'; break;
    case 'visit': body = <Visit key={r1} catId={r1 ?? ''} />; tab = 'home'; break;
    default: body = <Home />; tab = 'home';
  }
  return <>{body}<TabBar active={tab} onPlus={() => setQuick(true)} dot={snap.friendNews ? 'me' : undefined} />{quick && <QuickLog onClose={() => setQuick(false)} />}</>;
}

