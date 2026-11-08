import { useState } from 'react';
import { Chester } from '../chester/Chester';
import { store, useStore } from '../db/store';
import { isMuted, setMuted, chirp } from '../lib/audio';
import { useInstallHint } from '../lib/install';
import { TogetherCard } from './Together';
import { getTheme, setTheme, type Theme } from '../lib/theme';

export function Settings() {
  const { cat, sets, account } = useStore();
  const [muted, setM] = useState(isMuted());
  const [theme, setT] = useState<Theme>(getTheme());
  const [name, setName] = useState(cat?.name ?? '');
  const showInstall = useInstallHint();
  if (!cat) return null;
  const exportData = async () => {
    const data = { cats: await store.db.cats.toArray(), progress: await store.db.progress.toArray(), sets: await store.db.sets.toArray(), wallet: await store.db.wallet.toArray() };
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `chester-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  };
  return <div className="screen">
    <h1>Settings</h1>
    <div className="card mint row"><Chester coat={cat.coat} eyes={cat.eyes} pose="sleep" width={110} interactive label={cat.name} /><div><b>{cat.name}</b><p className="s">{sets.length} sets logged</p></div></div>
    <span className="field">Sound</span>
    <div className="seg" role="group" aria-label="Sound"><button className={!muted ? 'on' : ''} aria-pressed={!muted} onClick={() => { setMuted(false); localStorage.setItem('chester-muted', '0'); setM(false); chirp(); }}>On</button><button className={muted ? 'on' : ''} aria-pressed={muted} onClick={() => { setMuted(true); localStorage.setItem('chester-muted', '1'); setM(true); }}>Off</button></div>
    <span className="field">Appearance</span>
    <div className="seg" role="group" aria-label="Appearance">{(['system', 'light', 'dark'] as Theme[]).map((t) => <button key={t} className={theme === t ? 'on' : ''} aria-pressed={theme === t} onClick={() => { setTheme(t); setT(t); }}>{t === 'system' ? 'Match phone' : t === 'light' ? 'Light' : 'Dark'}</button>)}</div>
    <label className="field" htmlFor="nm">Name</label>
    <div className="row"><input id="nm" className="in" value={name} onChange={(e) => setName(e.target.value)} /><button className="btn2" onClick={() => store.saveCat({ ...cat, name: name.trim() || cat.name })}>Save</button></div>
    <span className="field">Boy or girl?</span>
    <div className="seg" role="group" aria-label="Boy or girl">{([['m', 'Boy'], ['f', 'Girl']] as const).map(([v, l]) => <button key={v} className={(cat.sex ?? 'm') === v ? 'on' : ''} aria-pressed={(cat.sex ?? 'm') === v} onClick={() => void store.saveCat({ ...cat, sex: v })}>{l}</button>)}</div>
    <TogetherCard />
    {showInstall && <div className="card butter"><b>Put {cat.name} on your home screen</b><p className="s" style={{ marginTop: 4, color: 'var(--butter-ink)' }}>In Safari, tap the Share button, then "Add to Home Screen". It opens full screen like an app and works offline.</p></div>}
    <div className="card grey"><b>Backup</b><p className="s" style={{ marginTop: 4 }}>{account ? 'Saved on this phone and online. You can also download a copy.' : 'Everything is saved on this phone only. Download a backup file now and then.'}</p><button className="btn2" style={{ marginTop: 10, background: 'var(--surface)' }} onClick={exportData}>Download backup</button></div>
  </div>;
}
