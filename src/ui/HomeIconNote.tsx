import { useState } from 'react';
import { useStore } from '../db/store';
import { closeHomeIconNote, staleHomeIcon, titleFor } from '../lib/appname';
import { InstallSteps } from './InstallSteps';
import { Icon } from './icons';

/* In the installed iPhone app only: the cats changed since PalDex was added to the Home Screen, and iPhone keeps the
   old icon and name. Say so once, with the way to fix it (the Add to Home Screen guide). */
export function HomeIconNote() {
  const { pets, account } = useStore();
  const looks = pets.map((p) => ({ name: p.name, coat: p.coat, eyes: p.eyes }));
  const [shown, setShown] = useState(() => staleHomeIcon(looks));
  const [how, setHow] = useState(false);
  if (!shown) return null;
  const close = () => { closeHomeIconNote(looks); setShown(false); setHow(false); };
  const name = titleFor(looks);
  const site = new URL(import.meta.env.BASE_URL, location.href).host;
  return <>
    <div className="card sky" role="status" aria-label="Home Screen icon">
      <div className="row" style={{ alignItems: 'flex-start', gap: 8 }}>
        <span className="sp"><b>Your Home Screen icon still shows the old cats</b>
          <span className="s" style={{ display: 'block', marginTop: 2 }}>iPhone keeps the icon and name from when it was added. Remove it and add it again to update.</span></span>
        <button className="iconbtn" aria-label="Close" onClick={close}><Icon name="close" /></button></div>
      <button className="btn2" style={{ marginTop: 10, background: 'var(--surface)' }} onClick={() => setHow(true)}>Show me how</button>
    </div>
    {how && <div className="overlay sheetbg" onClick={() => setHow(false)}><div className="sheet" role="dialog" aria-modal="true" aria-label="Update the Home Screen icon" onClick={(e) => e.stopPropagation()}>
      <div className="row"><b className="sp" style={{ fontSize: 18 }}>Update the Home Screen icon</b><button className="iconbtn" aria-label="Close" onClick={() => setHow(false)}><Icon name="close" /></button></div>
      {!account && <p className="s" style={{ marginTop: 8, padding: '8px 12px', borderRadius: 14, background: 'var(--butter)', color: 'var(--butter-ink)' }}>
        <b>Sign in first</b> (Me, then Account). Removing the icon removes what’s saved only on this phone; signed in, it all comes back.</p>}
      <ol className="steps">
        <li><span>Press and hold the old icon on your Home Screen, tap <b>Remove App</b>, then <b>Delete</b>.</span></li>
        <li><span>Open <b>{site}</b> in Safari and sign in.</span></li>
      </ol>
      <p className="s" style={{ marginTop: 4 }}>Then add <b>{name}</b> again:</p>
      <InstallSteps name={name} />
      <button className="btn" style={{ marginTop: 14 }} onClick={close}>Got it</button>
    </div></div>}
  </>;
}
