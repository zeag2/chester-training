import { useEffect } from 'react';
import { store, useStore } from './db/store';
import { suggestNext } from './engine/plan';
import { SKILLS } from './engine/skills';
import { today } from './lib/stats';
import { useRoute, go } from './ui/router';
import { TabBar } from './ui/TabBar';
import { Onboarding } from './screens/Onboarding';
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
import { setMuted, warm } from './lib/audio';

export default function App() {
  const snap = useStore();
  const [r0, r1] = useRoute();
  useEffect(() => { void store.load(); }, []);
  useEffect(() => { setMuted(localStorage.getItem('chester-muted') === '1'); }, []);
  // iPhone only allows audio after a tap: unlock it and fetch the sampled sounds on the first one
  useEffect(() => { const f = () => warm(); document.addEventListener('pointerdown', f, { once: true, passive: true }); return () => document.removeEventListener('pointerdown', f); }, []);
  // Pick up the other trainer's sets when the app comes back to the front, and every few minutes while open
  useEffect(() => {
    const f = () => { if (document.visibilityState === 'visible' && store.get().account) void store.sync(); };
    document.addEventListener('visibilitychange', f); const t = setInterval(f, 180_000);
    return () => { document.removeEventListener('visibilitychange', f); clearInterval(t); };
  }, []);
  if (!snap.ready) return <div className="screen" aria-busy="true" />;
  if (import.meta.env.DEV && r0 === 'gallery') return <Gallery />;
  if (r0 === 'together' || r0 === 'join') return <Together key={r0} mode={r0 === 'join' ? 'join' : 'share'} />;
  if (!snap.cat && r0 !== 'session') return <Onboarding />;
  const plus = () => { const s = suggestNext(SKILLS, snap.progress, snap.sets, snap.unlockedHidden, today())[0]; go('session/' + (s?.skill.id ?? 'clicker')); };
  let body: React.ReactNode;
  let tab = '';
  switch (r0) {
    case 'session': return snap.cat ? <Session key={r1} skillId={r1 ?? 'clicker'} /> : <Onboarding />;
    case 'recap': return <Recap key={r1} skillId={r1 ?? 'clicker'} />;
    case 'tree': body = <Tree />; tab = 'tree'; break;
    case 'library': body = <Library />; tab = 'library'; break;
    case 'skill': body = <SkillPage key={r1} id={r1} />; tab = 'library'; break;
    case 'settings': body = <Settings />; tab = 'settings'; break;
    case 'care': body = <Care />; tab = 'home'; break;
    default: body = <Home />; tab = 'home';
  }
  return <>{body}<TabBar active={tab} onPlus={plus} /></>;
}

