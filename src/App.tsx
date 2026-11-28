import { useEffect, useState } from 'react';
import { store, useStore } from './db/store';
import { useRoute } from './ui/router';
import { TabBar } from './ui/TabBar';
import { AnotherCat, Onboarding } from './screens/Onboarding';
import { Home } from './screens/Home';
import { Session } from './screens/Session';
import { Recap } from './screens/Recap';
import { Skills } from './screens/Skills';
import { SkillPage } from './screens/SkillPage';
import { Settings } from './screens/Settings';
import { CatPage } from './screens/CatPage';
import { Feed } from './screens/Feed';
import { ResetPassword, Together } from './screens/Together';
import { Gallery } from './screens/Gallery';
import { Privacy } from './screens/Privacy';
import { Contact } from './screens/Contact';
import { Messages } from './screens/Messages';
import { Care } from './screens/Care';
import { Corner } from './screens/Corner';
import { Train } from './screens/Train';
import { QuickLog } from './screens/QuickLog';
import type { CareKind } from './engine/care';
import { Friends } from './screens/Friends';
import { Visit } from './screens/Visit';
import { LogLink } from './ui/DailyTaps';
import { Trophies } from './screens/Trophies';
import { Week } from './screens/Week';
import { VetSummary } from './screens/VetSummary';
import { VisitPage } from './screens/VisitPage';
import { Documents } from './screens/Documents';
import { keepAlive, setMuted, warm } from './lib/audio';
import { Install } from './screens/Install';
import { Play } from './screens/Play';
import { wantsInstallStep } from './lib/install';
import { applyAppName, pendingPets } from './lib/appname';
import { movedTo } from './lib/moved';
import { ToastHost } from './ui/Toast';
import { PushAskHost } from './ui/PushAsk';
import { TooltipHost } from './ui/Tooltip';

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
  if (r0 === 'reset-password') return <ResetPassword />;
  if (r0 === 'privacy') return <Privacy />; // readable before there's a pet (Welcome, the account form)
  if (r0 === 'contact') return <Contact />; // "Contact us", from Privacy too, so it works before there's a pet
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
    // #/health/visit/<id>: one visit with its documents, doses and weight; #/health/docs: all documents
    // #/health/overview, #/health/log, #/health/documents: the three views (the segmented control at the top)
    case 'health': case 'care': body = r1 === 'visit' ? <VisitPage key={r2} id={r2 ?? ''} /> : r1 === 'docs' ? <Documents />
      : <Care key={r1 === 'log' && r2 ? 'log-' + r2 : 'care-' + (r1 ?? '')} open={r1 === 'log' && r2 ? (r2 as CareKind) : undefined}
        view={r1 === 'overview' || r1 === 'documents' || (r1 === 'log' && !r2) ? r1 : undefined} />; tab = 'health'; break;
    // Train: everything about training, with the tree, library, skills and Chester's corner under it
    // the cat's own tab: his scene, corner and (when on) training; #/train lands here too
    case 'chester': case 'train': body = <CatPage />; tab = 'chester'; break;
    // Skills: the tree and the list (was Library) as two views of one screen; the old #/tree and #/library redirect
    case 'skills': body = <Skills key={r1 ?? ''} view={r1 === 'tree' || r1 === 'list' ? r1 : undefined} />; tab = 'chester'; break;
    case 'tree': case 'library': body = <Skills key={r0} view={r0 === 'tree' ? 'tree' : 'list'} redirect />; tab = 'chester'; break;
    case 'vet-summary': body = <VetSummary />; tab = 'health'; break;
    case 'week': body = <Week />; tab = 'home'; break;
    case 'trophies': body = <Trophies />; tab = 'chester'; break;
    case 'skill': body = <SkillPage key={r1} id={r1} />; tab = 'chester'; break;
    case 'corner': body = <Corner />; tab = 'chester'; break;
    case 'play': return <Play key={r1} toy={r1} />;
    // Settings (the gear on Home): your cats, household and account, the app. #/me lands here too
    case 'me': case 'settings': body = <Settings />; tab = 'settings'; break;
    case 'messages': body = <Messages />; tab = 'settings'; break;
    // Friends: the photo feed on top, then friends' cats, requests and your code
    case 'friends': body = <Friends key={r1 ?? ''} code={r1} />; tab = 'friends'; break;
    case 'feed': body = <Feed key={r1 ?? ''} skill={r1} />; tab = 'friends'; break;
    case 'log': return <LogLink what={r1} />;
    case 'visit': body = <Visit key={r1} catId={r1 ?? ''} />; tab = 'home'; break;
    default: body = <Home />; tab = 'home';
  }
  return <>{body}<TabBar active={tab} onPlus={() => setQuick(true)} dot={snap.friendNews || snap.requests.some((q) => q.incoming) ? 'friends' : undefined} catLabel={snap.pets.length > 1 ? 'Cats' : snap.cat?.name ?? 'Cats'} />{quick && <QuickLog onClose={() => setQuick(false)} />}<ToastHost /><TooltipHost /><PushAskHost /></>;
}

