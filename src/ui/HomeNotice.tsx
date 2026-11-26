import { useState } from 'react';
import { useStore } from '../db/store';
import { movedTo } from '../lib/moved';
import { closeHomeIconNote, staleHomeIcon, titleFor } from '../lib/appname';
import { InstallSteps } from './InstallSteps';
import { Icon } from './icons';
import { Sheet } from './Sheet';

const MOVED_KEY = 'paldex-moved-notice';
const movedClosed = () => { try { return localStorage.getItem(MOVED_KEY) === 'closed'; } catch { return false; } };

/** Home's one dismissible notice (Home step 1; design doc, Components › Notice). One note at a time, most important
    first: PalDex has a new home (on the old address), then the iPhone Home Screen icon still showing the old cats (in
    the installed app). Closing remembers it on this phone. Was two cards: the "new home" card and HomeIconNote. */
export function HomeNotice() {
  const { pets, account, cat } = useStore();
  const looks = pets.map((p) => ({ name: p.name, coat: p.coat, eyes: p.eyes }));
  const [movedShown, setMovedShown] = useState(() => !!movedTo() && !movedClosed());
  const [iconShown, setIconShown] = useState(() => staleHomeIcon(looks));
  const [how, setHow] = useState(false);
  if (!cat) return null;
  const to = movedTo();
  if (movedShown && to) {
    const close = () => { try { localStorage.setItem(MOVED_KEY, 'closed'); } catch { /* private mode: hide for now */ } setMovedShown(false); };
    return <Notice title="PalDex has a new home" onClose={close}
      sub={account ? `Open the new link, sign in, and add it to your Home Screen. ${cat.name}’s training comes with you.` : `First sign in (Settings, then Set up a household) so ${cat.name}’s training is saved online. Then open the new link and sign in there.`}>
      <a className="btn" style={{ marginTop: 'var(--sp-3)' }} href={to}>Open {new URL(to).host}</a></Notice>;
  }
  if (!iconShown) return null;
  const close = () => { closeHomeIconNote(looks); setIconShown(false); setHow(false); };
  const name = titleFor(looks);
  const site = new URL(import.meta.env.BASE_URL, location.href).host;
  return <>
    <Notice title="Your Home Screen icon still shows the old cats" onClose={close}
      sub="iPhone keeps the icon and name from when it was added. Remove it and add it again to update.">
      <button className="btn2" style={{ marginTop: 10, background: 'var(--surface)' }} onClick={() => setHow(true)}>Show me how</button></Notice>
    {how && <Sheet label="Update the Home Screen icon" onClose={() => setHow(false)}>
      <div className="row"><b className="sp" style={{ fontSize: 18 }}>Update the Home Screen icon</b><button className="iconbtn" aria-label="Close" onClick={() => setHow(false)}><Icon name="close" /></button></div>
      {!account && <p className="s" style={{ marginTop: 'var(--sp-2)', padding: 'var(--sp-2) var(--sp-3)', borderRadius: 'var(--r-row)', background: 'var(--butter)', color: 'var(--butter-ink)' }}>
        <b>Sign in first</b> (Me, then Account). Removing the icon removes what’s saved only on this phone; signed in, it all comes back.</p>}
      <ol className="steps">
        <li><span>Press and hold the old icon on your Home Screen, tap <b>Remove App</b>, then <b>Delete</b>.</span></li>
        <li><span>Open <b>{site}</b> in Safari and sign in.</span></li>
      </ol>
      <p className="s" style={{ marginTop: 'var(--sp-1)' }}>Then add <b>{name}</b> again:</p>
      <InstallSteps name={name} />
      <button className="btn" style={{ marginTop: 14 }} onClick={close}>Got it</button>
    </Sheet>}
  </>;
}

function Notice({ title, sub, onClose, children }: { title: string; sub: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="card sky" role="status" aria-label={title} data-home="notice">
    <div className="row" style={{ alignItems: 'flex-start', gap: 'var(--sp-2)' }}>
      <span className="sp"><b>{title}</b><span className="s" style={{ display: 'block', marginTop: 2 }}>{sub}</span></span>
      <button className="iconbtn" aria-label="Close" onClick={onClose}><Icon name="close" /></button></div>
    {children}
  </div>;
}
