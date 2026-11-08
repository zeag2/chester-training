import { useEffect, useState } from 'react';
import { Chester } from '../chester/Chester';
import { applyAppName, pendingPets, setPendingPets, titleFor, type PetLook } from '../lib/appname';
import { drawIcon } from '../lib/appicon';
import { COATS, EYES } from '../chester/art';
import { SWATCH, EYESW } from '../ui/swatches';
import { platform, promptInstall, skipInstallStep, useInstallState } from '../lib/install';
import { Icon } from '../ui/icons';
import * as audio from '../lib/audio';

const ShareIcon = () => <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden="true" style={{ stroke: 'currentColor', fill: 'none', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', verticalAlign: '-5px' }}><path d="M8 9 H6 V20 H18 V9 H16 M12 3 V14 M8.5 6.5 L12 3 L15.5 6.5" /></svg>;
const PlusBox = () => <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden="true" style={{ stroke: 'currentColor', fill: 'none', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', verticalAlign: '-5px' }}><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M12 8.5 V15.5 M8.5 12 H15.5" /></svg>;

/** First page on a phone's browser: name the kitten(s), then put the app on the Home Screen under their names. */
export function Install({ onSkip }: { onSkip: () => void }) {
  const [pets, setPets] = useState<PetLook[]>(() => { const p = pendingPets(); return p.length ? p : [{ name: '', coat: 'black', eyes: 'gold' }]; });
  const [open, setOpen] = useState(0); // which cat's colours are being picked
  const [icon, setIcon] = useState<string | null>(null);
  const names = pets.map((p) => p.name);
  const [guide, setGuide] = useState(false);
  const state = useInstallState();
  const os = platform();
  const title = titleFor(names);
  const named = names.some((n) => n.trim());
  // keep the Home Screen name in step with what's typed, so whenever they tap Add it's already right
  useEffect(() => { setPendingPets(pets); applyAppName(pets, true); void drawIcon(pets.filter((p) => p.name.trim()).length ? pets : [{ name: 'x', coat: pets[0]?.coat, eyes: pets[0]?.eyes }], 180).then(setIcon); }, [pets]);

  const set = (i: number, v: Partial<PetLook>) => setPets((ps) => ps.map((x, k) => (k === i ? { ...x, ...v, name: (v.name ?? x.name).slice(0, 24) } : x)));
  const add = async () => {
    audio.chirp();
    if (state === 'prompt') { await promptInstall(); return; }
    setGuide(true);
  };

  if (state === 'installed') return <div className="screen" style={{ display: 'flex', flexDirection: 'column', paddingBottom: 'calc(28px + var(--safe-b))' }}>
    <div className="stag" style={{ display: 'flex', flexDirection: 'column', flex: 1, paddingTop: 36, textAlign: 'center' }}>
      <div className="card mint" style={{ margin: 0, display: 'flex', justifyContent: 'center', padding: '26px 16px 14px', borderRadius: 32 }}><Chester coat="black" eyes="gold" mood="happy" anim="dance" width={170} /></div>
      <h1 style={{ marginTop: 26 }}>{named ? `${title} is on your Home Screen` : 'Added to your Home Screen'}</h1>
      <p className="m" style={{ marginTop: 10, fontSize: 16 }}>Open it from there to finish setting up. You can close this page.</p>
    </div></div>;

  return <div className="screen" style={{ display: 'flex', flexDirection: 'column', paddingBottom: 'calc(28px + var(--safe-b))' }}>
    <div className="stag" style={{ display: 'flex', flexDirection: 'column', flex: 1, paddingTop: 12 }}>
      <div className="card mint" style={{ margin: 0, display: 'flex', justifyContent: 'center', padding: '14px 16px 6px', borderRadius: 32 }}><Chester coat={pets[open]?.coat ?? pets[0]?.coat} eyes={pets[open]?.eyes ?? pets[0]?.eyes} mood="happy" raised anim="wave" width={118} interactive /></div>
      <h1 style={{ marginTop: 20, fontSize: 30 }}>Hi! Who’s your cat?</h1>
      <p className="m" style={{ marginTop: 8, fontSize: 16 }}>The app gets their name and face, then lives on your Home Screen like any other app.</p>
      {pets.map((p, i) => <div key={i} className="card grey" style={{ marginTop: i ? 8 : 16, padding: 12 }}>
        <div className="row" style={{ gap: 8 }}>
          <span style={{ width: 46, height: 46, flex: 'none', display: 'flex' }}><Chester coat={p.coat} eyes={p.eyes} mood="happy" width={46} /></span>
          <input className="in sp" style={{ marginTop: 0, background: 'var(--surface)' }} value={p.name} onChange={(e) => set(i, { name: e.target.value })} onFocus={() => setOpen(i)} placeholder={i ? 'Another cat’s name' : 'Your cat’s name'} aria-label={i ? `Cat ${i + 1} name` : 'Your cat’s name'} autoComplete="off" enterKeyHint="done" />
          {i > 0 && <button className="iconbtn" aria-label={`Remove ${p.name || 'this cat'}`} onClick={() => { setPets((ps) => ps.filter((_, k) => k !== i)); setOpen(0); }}><Icon name="close" /></button>}
        </div>
        {open === i ? <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }} role="group" aria-label={`${p.name || 'Cat'}’s coat`}>
            {Object.keys(COATS).map((k) => <button key={k} aria-label={COATS[k].name} aria-pressed={p.coat === k} onClick={() => set(i, { coat: k })}
              style={{ width: 32, height: 32, borderRadius: '50%', background: SWATCH[k], border: 0, outline: p.coat === k ? '3px solid var(--ink)' : '1px solid var(--line)', outlineOffset: 2 }} />)}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }} role="group" aria-label={`${p.name || 'Cat'}’s eyes`}>
            {Object.keys(EYES).map((k) => <button key={k} aria-label={EYES[k].name + ' eyes'} aria-pressed={p.eyes === k} onClick={() => set(i, { eyes: k })}
              style={{ width: 24, height: 24, borderRadius: '50%', background: EYESW[k], border: 0, outline: p.eyes === k ? '3px solid var(--ink)' : '1px solid var(--line)', outlineOffset: 2 }} />)}
          </div></>
          : <button className="s" style={{ marginTop: 6, background: 'none', border: 0, padding: 0, color: 'var(--teal)', fontWeight: 700 }} onClick={() => setOpen(i)}>Change {p.name || 'their'} colours</button>}
      </div>)}
      {pets.length < 4 && <button className="btn2" style={{ marginTop: 10, alignSelf: 'flex-start', minHeight: 40 }} onClick={() => { setPets((ps) => [...ps, { name: '', coat: 'orange', eyes: 'green' }]); setOpen(pets.length); }}><Icon name="plus" size={18} />&nbsp;Add another cat</button>}
      <div style={{ marginTop: 'auto', paddingTop: 24 }}>
        {named && <div className="row" style={{ justifyContent: 'center', gap: 10, marginBottom: 14 }} aria-label={`Your Home Screen icon will be called ${title}`}>
          <img src={icon ?? import.meta.env.BASE_URL + 'apple-touch-icon.png'} alt="" width={52} height={52} style={{ borderRadius: 12 }} />
          <span className="s">Your icon: <b style={{ color: 'var(--ink)' }}>{title}</b></span></div>}
        <button className="btn" onClick={add}><PlusBox />&nbsp;Add to Home Screen</button>
        <button className="btn2" style={{ width: '100%', marginTop: 10, background: 'transparent' }} onClick={() => { skipInstallStep(); onSkip(); }}>Not now, continue in the browser</button>
      </div>
    </div>
    {guide && <div className="overlay sheetbg" onClick={() => setGuide(false)}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Add to Home Screen" onClick={(e) => e.stopPropagation()}>
        <div className="row"><b className="sp" style={{ fontSize: 18 }}>Add {named ? title : 'PalDex'} to your Home Screen</b><button className="iconbtn" aria-label="Close" onClick={() => setGuide(false)}><Icon name="close" /></button></div>
        {os === 'ios' ? <ol className="steps">
          <li><span>Tap <b>Share</b> <ShareIcon /> in Safari’s toolbar. On newer iPhones, tap <b>•••</b> first, then Share.</span></li>
          <li><span>Scroll down and tap <b>Add to Home Screen</b> <PlusBox /></span></li>
          <li><span>Tap <b>Add</b>, then open <b>{named ? title : 'PalDex'}</b> from your Home Screen.</span></li>
        </ol> : <ol className="steps">
          <li><span>Open your browser’s menu <b>⋮</b>.</span></li>
          <li><span>Tap <b>Add to Home screen</b> or <b>Install app</b>.</span></li>
          <li><span>Open <b>{named ? title : 'PalDex'}</b> from your Home Screen.</span></li>
        </ol>}
        <p className="s" style={{ marginTop: 10 }}>It opens full screen, works offline, and keeps everything you set up.</p>
        {os === 'ios' && <div className="pointdown" aria-hidden="true">↓</div>}
      </div></div>}
  </div>;
}
