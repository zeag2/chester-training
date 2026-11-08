import { useState } from 'react';
import { Chester } from '../chester/Chester';
import { store, useStore } from '../db/store';
import { isMuted, setMuted, chirp } from '../lib/audio';
import { useInstallHint } from '../lib/install';
import { ageText } from '../lib/stats';
import { getTheme, setTheme, type Theme } from '../lib/theme';
import { sharingConfigured } from '../sync/config';
import { sendInvite } from './Together';
import { Icon } from '../ui/icons';
import { go } from '../ui/router';
import type { Cat } from '../engine/types';

/* Settings, grouped like iPhone Settings: the pet, the people, the app, your data. */

function Row({ label, value, onClick, danger, children, sub }: { label: string; value?: React.ReactNode; onClick?: () => void; danger?: boolean; children?: React.ReactNode; sub?: string }) {
  const body = <><span className="sp"><span style={{ color: danger ? 'var(--rose)' : undefined, fontWeight: danger ? 700 : 600 }}>{label}</span>{sub && <span className="s" style={{ display: 'block' }}>{sub}</span>}</span>
    {value !== undefined && <span className="s" style={{ textAlign: 'right' }}>{value}</span>}{children}
    {onClick && !danger && <span className="chev" aria-hidden="true">›</span>}</>;
  return onClick ? <button className="lrow" onClick={onClick}>{body}</button> : <div className="lrow">{body}</div>;
}
const Group = ({ title, children, foot }: { title: string; children: React.ReactNode; foot?: string }) =>
  <section style={{ marginTop: 24 }}><h2 className="lhead">{title}</h2><div className="lgroup">{children}</div>{foot && <p className="s" style={{ margin: '8px 4px 0' }}>{foot}</p>}</section>;

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button role="switch" aria-checked={on} aria-label={label} className={`switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)}><i /></button>;
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="overlay sheetbg" onClick={onClose}><div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
    <div className="row"><b className="sp" style={{ fontSize: 18 }}>{title}</b><button className="iconbtn" aria-label="Close" onClick={onClose}><Icon name="close" /></button></div>
    {children}</div></div>;
}

function EditPet({ cat, onClose }: { cat: Cat; onClose: () => void }) {
  const [f, setF] = useState({ name: cat.name, sex: cat.sex ?? 'm', birthday: cat.birthday, homeDate: cat.homeDate, microchip: cat.microchip ?? '', altered: !!cat.altered });
  const set = (k: keyof typeof f, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => { await store.saveCat({ ...cat, name: f.name.trim() || cat.name, sex: f.sex, birthday: f.birthday, homeDate: f.homeDate, microchip: f.microchip.replace(/\s/g, '') || undefined, altered: f.altered }); onClose(); };
  return <Sheet title={`Edit ${cat.name}`} onClose={onClose}>
    <label className="field" htmlFor="pn">Name</label><input id="pn" className="in" value={f.name} onChange={(e) => set('name', e.target.value)} />
    <span className="field">Boy or girl</span>
    <div className="seg" role="group" aria-label="Boy or girl">{([['m', 'Boy'], ['f', 'Girl']] as const).map(([v, l]) => <button key={v} className={f.sex === v ? 'on' : ''} aria-pressed={f.sex === v} onClick={() => set('sex', v)}>{l}</button>)}</div>
    <div style={{ display: 'flex', gap: 10 }}>
      <div style={{ flex: 1, minWidth: 0 }}><label className="field" htmlFor="pb">Birthday</label><input id="pb" className="in" type="month" value={f.birthday} onChange={(e) => set('birthday', e.target.value)} /></div>
      <div style={{ flex: 1, minWidth: 0 }}><label className="field" htmlFor="ph">Home since</label><input id="ph" className="in" type="date" value={f.homeDate} onChange={(e) => set('homeDate', e.target.value)} /></div>
    </div>
    <label className="field" htmlFor="pm">Microchip number</label><input id="pm" className="in" inputMode="numeric" value={f.microchip} onChange={(e) => set('microchip', e.target.value)} placeholder="15 digits, from adoption or vet papers" />
    <div className="lgroup" style={{ marginTop: 16 }}><Row label={f.sex === 'f' ? 'Spayed' : 'Neutered'}><Switch on={f.altered} onChange={(v) => set('altered', v)} label={f.sex === 'f' ? 'Spayed' : 'Neutered'} /></Row></div>
    <button className="btn" style={{ marginTop: 20 }} onClick={save} disabled={!f.name.trim()}>Save</button>
  </Sheet>;
}

function EditMyName({ onClose }: { onClose: () => void }) {
  const { household, account, cat } = useStore();
  const meRow = household?.members.find((m) => m.userId === account?.userId);
  const [name, setName] = useState(household?.members.find((m) => m.userId === account?.userId)?.name || store.myName);
  return <Sheet title="Your name" onClose={onClose}>
    <p className="s" style={{ marginTop: 4 }}>Home greets you with it, and it’s what the people you train with see.</p>
    <input className="in" style={{ marginTop: 12 }} value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" autoFocus aria-label="Your name" />
    <button className="btn" style={{ marginTop: 16 }} disabled={!name.trim()} onClick={async () => { await store.renameMe(name); onClose(); }}>Save</button>
    {meRow && !meRow.owner && meRow.email !== undefined && cat && <button className="btn2" style={{ marginTop: 10, width: '100%', background: 'transparent', color: 'var(--rose)' }}
      onClick={async () => { if (confirm(`Stop training ${cat.name}? ${cat.name} is removed from this phone; you can rejoin with an invite code.`)) { await store.removeMember(meRow.userId).catch(() => {}); onClose(); } }}>Leave {cat.name}</button>}
  </Sheet>;
}

/** Someone who trains the pet: who they are, and (for whoever set the pet up) a way to remove them. */
function Person({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { household, account, cat } = useStore();
  const [err, setErr] = useState('');
  const m = household?.members.find((x) => x.userId === userId);
  const iOwn = !!household?.members.find((x) => x.userId === account?.userId)?.owner;
  if (!m || !cat) return null;
  const same = household!.members.filter((x) => x.name && x.name === m.name).length > 1;
  return <Sheet title={m.name || 'Someone'} onClose={onClose}>
    <p className="m" style={{ marginTop: 4 }}>{m.email ?? 'Email shows once the latest PalDex setup step is done.'}</p>
    {m.sets !== undefined && <p className="s" style={{ marginTop: 4 }}>{m.sets} training set{m.sets === 1 ? '' : 's'} logged</p>}
    {same && <div className="card butter" style={{ marginTop: 12 }}><p className="s" style={{ color: 'var(--butter-ink)' }}>Two people here are called {m.name}. That usually means someone made a second account. Check the emails and remove the one that isn’t used.</p></div>}
    {iOwn ? <>
      <button className="btn" style={{ marginTop: 16, background: 'var(--rose)' }} onClick={async () => {
        if (!confirm(`Remove ${m.name || 'this person'}${m.email ? ` (${m.email})` : ''} from ${cat.name}? Sets they logged stay.`)) return;
        try { await store.removeMember(userId); onClose(); } catch (e) { setErr((e as Error).message === 'not-allowed' ? 'Only the person who set up ' + cat.name + ' can remove people.' : 'Couldn’t remove them. Is the latest setup step done in Supabase?'); }
      }}>Remove from {cat.name}</button>
      <p className="s" style={{ marginTop: 8 }}>They lose access to {cat.name}. Everything they logged stays.</p></>
      : <p className="s" style={{ marginTop: 14 }}>Only the person who set up {cat.name} can remove people.</p>}
    {err && <p className="s" role="alert" style={{ marginTop: 10, color: 'var(--rose)' }}>{err}</p>}
  </Sheet>;
}

function Invite({ catName, code, onClose }: { catName: string; code: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return <Sheet title={`Invite someone to train ${catName}`} onClose={onClose}>
    <p className="s" style={{ marginTop: 4 }}>They open PalDex, choose “Someone invited me”, make an account, and enter this code. Anyone with it can see and train {catName}.</p>
    <div className="card sky" style={{ textAlign: 'center' }}><span style={{ fontSize: 34, fontWeight: 800, letterSpacing: 4, fontVariantNumeric: 'tabular-nums' }}>{code}</span></div>
    <button className="btn" style={{ marginTop: 14 }} onClick={async () => { if (await sendInvite(catName, code)) { setCopied(true); setTimeout(() => setCopied(false), 2000); } }}>{copied ? 'Copied' : 'Send invite'}</button>
  </Sheet>;
}

export function Settings() {
  const { cat, sets, account, household, sync, care } = useStore();
  const [muted, setM] = useState(isMuted());
  const [theme, setT] = useState<Theme>(getTheme());
  const [sheet, setSheet] = useState<'' | 'pet' | 'name' | 'invite' | 'install'>('');
  const [person, setPerson] = useState('');
  const showInstall = useInstallHint();
  if (!cat) return null;
  const he = cat.sex === 'f' ? 'Girl' : 'Boy';
  const exportData = async () => {
    const data = { app: 'PalDex', exported: new Date().toISOString(), cats: await store.db.cats.toArray(), sets: await store.db.sets.toArray(), care: await store.db.care.toArray(), wallet: await store.db.wallet.toArray() };
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `paldex-${cat.name.toLowerCase().replace(/\W+/g, '-')}-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  };
  const me = household?.members.find((m) => m.userId === account?.userId);
  const others = (household?.members ?? []).filter((m) => m.userId !== account?.userId);
  const syncText = sync === 'syncing' ? 'Syncing…' : sync === 'offline' ? 'Offline: changes are saved here and sync when you’re back online' : 'Up to date';

  return <div className="screen">
    <h1>Settings</h1>

    <div className="card mint row" style={{ marginTop: 16, alignItems: 'center' }}>
      <Chester coat={cat.coat} eyes={cat.eyes} pose="sleep" width={96} interactive label={cat.name} />
      <div className="sp"><b style={{ fontSize: 18 }}>{cat.name}</b>
        <p className="s">{[he, ageText(cat.birthday).replace(/^about /, ''), cat.altered && (cat.sex === 'f' ? 'spayed' : 'neutered')].filter(Boolean).join(' · ')}</p>
        <p className="s">{sets.length} sets · {care.length} care entries{cat.microchip ? ` · chip …${cat.microchip.slice(-4)}` : ''}</p></div>
      <button className="btn2" style={{ background: 'var(--surface)', minHeight: 40 }} onClick={() => setSheet('pet')}>Edit</button>
    </div>

    {sharingConfigured() && (account ? <Group title="People" foot={syncText}>
      <Row label={me?.name || 'Add your name'} sub={account.email} value={me?.owner ? 'You · set up ' + cat.name : 'You'} onClick={() => setSheet('name')} />
      {others.map((m) => <Row key={m.userId} label={m.name || 'Someone'} sub={[m.email, m.sets !== undefined && `${m.sets} set${m.sets === 1 ? '' : 's'} logged`].filter(Boolean).join(' · ') || undefined}
        value={m.owner ? 'Set up ' + cat.name : 'Trains with you'} onClick={() => setPerson(m.userId)} />)}
      {household && <Row label={others.length ? 'Invite someone else' : `Invite someone to train ${cat.name}`} onClick={() => setSheet('invite')} />}
      {sync === 'offline' && <Row label="Try syncing again" onClick={() => void store.sync()} />}
      <Row label="Sign out" danger onClick={() => { if (confirm(`Sign out? ${cat.name} stays on this phone; sign back in to sync again.`)) void store.signOut(); }} />
    </Group> : <Group title="People" foot={`Share ${cat.name}’s progress so you both see the same skills, treats and limits.`}>
      <Row label={`Train ${cat.name} together`} onClick={() => go('together')} />
      <Row label="I have an invite code" onClick={() => go('join')} />
    </Group>)}

    <Group title="App">
      <Row label="Sound"><Switch on={!muted} label="Sound" onChange={(on) => { setMuted(!on); localStorage.setItem('chester-muted', on ? '0' : '1'); setM(!on); if (on) chirp(); }} /></Row>
      <div className="lrow" style={{ display: 'block' }}><span style={{ fontWeight: 600 }}>Appearance</span>
        <div className="seg" role="group" aria-label="Appearance" style={{ marginTop: 8 }}>{(['system', 'light', 'dark'] as Theme[]).map((t) => <button key={t} className={theme === t ? 'on' : ''} aria-pressed={theme === t} onClick={() => { setTheme(t); setT(t); }}>{t === 'system' ? 'Match phone' : t === 'light' ? 'Light' : 'Dark'}</button>)}</div></div>
      {showInstall && <Row label="Add PalDex to your home screen" onClick={() => setSheet('install')} />}
    </Group>

    <Group title="Your data" foot={account ? 'Saved on this phone and online.' : 'Saved on this phone only. Download a copy now and then.'}>
      <Row label="Download a backup" sub="Training, care log and treats, as a file" onClick={exportData} />
    </Group>

    {sheet === 'pet' && <EditPet cat={cat} onClose={() => setSheet('')} />}
    {sheet === 'name' && <EditMyName onClose={() => setSheet('')} />}
    {person && <Person userId={person} onClose={() => setPerson('')} />}
    {sheet === 'invite' && household && <Invite catName={cat.name} code={household.inviteCode} onClose={() => setSheet('')} />}
    {sheet === 'install' && <Sheet title="Add to your home screen" onClose={() => setSheet('')}>
      <p className="m" style={{ marginTop: 6 }}>In Safari, tap the Share button, then “Add to Home Screen”. PalDex then opens full screen like an app and works offline.</p></Sheet>}
  </div>;
}
