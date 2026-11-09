import { useState } from 'react';
import { Chester } from '../chester/Chester';
import { store, useStore } from '../db/store';
import { isMuted, setMuted, chirp } from '../lib/audio';
import { useInstallHint } from '../lib/install';
import { InstallSteps } from '../ui/InstallSteps';
import { titleFor } from '../lib/appname';
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
  const [f, setF] = useState({ name: cat.name, sex: cat.sex ?? 'm', birthday: cat.birthday, homeDate: cat.homeDate, microchip: cat.microchip ?? '', altered: !!cat.altered, training: cat.training !== false, meals: cat.mealsPerDay ?? 2 });
  const set = (k: keyof typeof f, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => { await store.saveCat({ ...cat, name: f.name.trim() || cat.name, sex: f.sex, birthday: f.birthday, homeDate: f.homeDate, microchip: f.microchip.replace(/\s/g, '') || undefined, altered: f.altered, training: f.training, mealsPerDay: f.meals }); onClose(); };
  return <Sheet title={`Edit ${cat.name}`} onClose={onClose}>
    <label className="field" htmlFor="pn">Name</label><input id="pn" className="in" value={f.name} onChange={(e) => set('name', e.target.value)} />
    <span className="field">Boy or girl</span>
    <div className="seg" role="group" aria-label="Boy or girl">{([['m', 'Boy'], ['f', 'Girl']] as const).map(([v, l]) => <button key={v} className={f.sex === v ? 'on' : ''} aria-pressed={f.sex === v} onClick={() => set('sex', v)}>{l}</button>)}</div>
    <div style={{ display: 'flex', gap: 10 }}>
      <div style={{ flex: 1, minWidth: 0 }}><label className="field" htmlFor="pb">Birthday</label><input id="pb" className="in" type="month" value={f.birthday} onChange={(e) => set('birthday', e.target.value)} /></div>
      <div style={{ flex: 1, minWidth: 0 }}><label className="field" htmlFor="ph">Home since</label><input id="ph" className="in" type="date" value={f.homeDate} onChange={(e) => set('homeDate', e.target.value)} /></div>
    </div>
    <label className="field" htmlFor="pm">Microchip number</label><input id="pm" className="in" inputMode="numeric" value={f.microchip} onChange={(e) => set('microchip', e.target.value)} placeholder="15 digits, from adoption or vet papers" />
    <div className="lgroup" style={{ marginTop: 16 }}><Row label={f.sex === 'f' ? 'Spayed' : 'Neutered'}><Switch on={f.altered} onChange={(v) => set('altered', v)} label={f.sex === 'f' ? 'Spayed' : 'Neutered'} /></Row>
      <Row label="Training" sub="Adds skills, sets and rewards in the Train tab"><Switch on={f.training} onChange={(v) => set('training', v)} label="Training" /></Row>
      <Row label="Meals a day" sub="For the Fed button on Home"><div className="row" style={{ gap: 6 }}>
        <button className="iconbtn" aria-label="Fewer meals" disabled={f.meals <= 1} onClick={() => set('meals', Math.max(1, f.meals - 1))}>−</button>
        <b className="num" style={{ minWidth: 20, textAlign: 'center' }} aria-live="polite">{f.meals}</b>
        <button className="iconbtn" aria-label="More meals" disabled={f.meals >= 8} onClick={() => set('meals', Math.min(8, f.meals + 1))}>+</button></div></Row></div>
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
      onClick={async () => { if (confirm(`Leave this household? Its pets are removed from this phone; you can rejoin with an invite code.`)) { await store.removeMember(meRow.userId).catch(() => {}); onClose(); } }}>Leave household</button>}
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
        if (!confirm(`Remove ${m.name || 'this person'}${m.email ? ` (${m.email})` : ''} from the household? They lose access to every pet in it. Sets they logged stay.`)) return;
        try { await store.removeMember(userId); onClose(); } catch (e) { setErr((e as Error).message === 'not-allowed' ? 'Only the person who set up the household can remove people.' : 'Couldn’t remove them. Is the latest setup step done in Supabase?'); }
      }}>Remove from household</button>
      <p className="s" style={{ marginTop: 8 }}>They lose access to every pet in the household. Everything they logged stays.</p></>
      : <p className="s" style={{ marginTop: 14 }}>Only the person who set up the household can remove people.</p>}
    {err && <p className="s" role="alert" style={{ marginTop: 10, color: 'var(--rose)' }}>{err}</p>}
  </Sheet>;
}

function Invite({ catName, code, onClose }: { catName: string; code: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return <Sheet title="Invite someone to your household" onClose={onClose}>
    <p className="s" style={{ marginTop: 4 }}>They open PalDex, choose “Someone invited me”, make an account, and enter this code. They’ll see and help train every pet in your household, including ones you add later.</p>
    <div className="card sky" style={{ textAlign: 'center' }}><span style={{ fontSize: 34, fontWeight: 800, letterSpacing: 4, fontVariantNumeric: 'tabular-nums' }}>{code}</span></div>
    <button className="btn" style={{ marginTop: 14 }} onClick={async () => { if (await sendInvite(catName, code)) { setCopied(true); setTimeout(() => setCopied(false), 2000); } }}>{copied ? 'Copied' : 'Send invite'}</button>
  </Sheet>;
}

export function Settings() {
  const { cat, account, household, sync, care, pets, friendNews, requests } = useStore();
  const [muted, setM] = useState(isMuted());
  const [theme, setT] = useState<Theme>(getTheme());
  const [sheet, setSheet] = useState<'' | 'pet' | 'name' | 'invite' | 'install'>('');
  const [person, setPerson] = useState('');
  const showInstall = useInstallHint();
  if (!cat) return null;
  const exportData = async () => {
    const data = { app: 'PalDex', exported: new Date().toISOString(), cats: await store.db.cats.toArray(), sets: await store.db.sets.toArray(), care: await store.db.care.toArray(), wallet: await store.db.wallet.toArray() };
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `paldex-${cat.name.toLowerCase().replace(/\W+/g, '-')}-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  };
  const me = household?.members.find((m) => m.userId === account?.userId);
  const others = (household?.members ?? []).filter((m) => m.userId !== account?.userId);
  const syncText = sync === 'syncing' ? 'Syncing…' : sync === 'offline' ? 'Offline: changes are saved here and sync when you’re back online' : 'Up to date';

  const edit = async (id: string) => { if (id !== cat.id) await store.switchPet(id); setSheet('pet'); };
  return <div className="screen">
    <h1 style={{ marginTop: 18 }}>Me</h1>
    {account && <p className="m" style={{ marginTop: 4 }}>{me?.name || store.myName || 'You'} · {account.email}</p>}

    <Group title="Your cats">
      {pets.map((p) => { const full = p.id === cat.id ? cat : null; return <Row key={p.id} label={p.name} sub={full ? [ageText(cat.birthday).replace(/^about /, ''), cat.training === false ? 'Health tracking' : 'Training on', `${care.length} health entries`].filter(Boolean).join(' · ') : 'Tap to edit'}
        value="Edit" onClick={() => void edit(p.id)}>
        <span style={{ width: 34, height: 34, marginLeft: -4, order: -1, display: 'flex' }}><Chester coat={p.coat} eyes={p.eyes} width={34} mood="happy" /></span></Row>; })}
      <Row label="Add another cat" onClick={() => go('add-pet')} />
    </Group>

    {sharingConfigured() && (account ? <Group title="People" foot={household && others.length ? `Your household sees and looks after every cat here. ${syncText}.` : syncText}>
      <Row label="Friends" sub="Your friend code, and your friends’ cats" value={requests.some((q) => q.incoming) ? 'Request' : friendNews ? 'New' : undefined} onClick={() => go('friends')} />
      {others.map((m) => <Row key={m.userId} label={m.name || 'Someone'} sub={[m.email, m.sets !== undefined && `${m.sets} set${m.sets === 1 ? '' : 's'} logged`].filter(Boolean).join(' · ') || undefined}
        value={m.owner ? 'Set it up' : 'Household'} onClick={() => setPerson(m.userId)} />)}
      {household && <Row label={others.length ? 'Invite someone else to your household' : 'Invite someone you live with'} onClick={() => setSheet('invite')} />}
    </Group> : <Group title="People" foot="Sign in to share your cats with the people you live with, and to add friends.">
      <Row label="Create an account or sign in" onClick={() => go('together')} />
      <Row label="Join a household with a code" onClick={() => go('join')} />
    </Group>)}

    {account && <Group title="Account">
      <Row label="Your name" value={me?.name || store.myName || 'Add'} onClick={() => setSheet('name')} />
      {sync === 'offline' && <Row label="Try syncing again" onClick={() => void store.sync()} />}
      <Row label="Sign out" danger onClick={() => { if (confirm(`Sign out? Your cats stay on this phone; sign back in to sync again.`)) void store.signOut(); }} />
    </Group>}

    <Group title="App">
      <Row label="Sound"><Switch on={!muted} label="Sound" onChange={(on) => { setMuted(!on); localStorage.setItem('chester-muted', on ? '0' : '1'); setM(!on); if (on) chirp(); }} /></Row>
      <div className="lrow" style={{ display: 'block' }}><span style={{ fontWeight: 600 }}>Appearance</span>
        <div className="seg" role="group" aria-label="Appearance" style={{ marginTop: 8 }}>{(['system', 'light', 'dark'] as Theme[]).map((t) => <button key={t} className={theme === t ? 'on' : ''} aria-pressed={theme === t} onClick={() => { setTheme(t); setT(t); }}>{t === 'system' ? 'Match phone' : t === 'light' ? 'Light' : 'Dark'}</button>)}</div></div>
      {showInstall && <Row label={`Add ${titleFor(pets.map((p) => p.name))} to your Home Screen`} onClick={() => setSheet('install')} />}
    </Group>

    <Group title="Your data" foot={account ? 'Saved on this phone and online.' : 'Saved on this phone only. Download a copy now and then.'}>
      <Row label="Download a backup" sub="Health log, training and treats, as a file" onClick={exportData} />
    </Group>

    {sheet === 'pet' && <EditPet cat={cat} onClose={() => setSheet('')} />}
    {sheet === 'name' && <EditMyName onClose={() => setSheet('')} />}
    {person && <Person userId={person} onClose={() => setPerson('')} />}
    {sheet === 'invite' && household && <Invite catName={cat.name} code={household.inviteCode} onClose={() => setSheet('')} />}
    {sheet === 'install' && <Sheet title="Add to your home screen" onClose={() => setSheet('')}>
      <p className="m" style={{ marginTop: 6 }}>It’s named {titleFor(pets.map((p) => p.name))}, opens full screen like an app and works offline. The steps depend on your browser:</p>
      <InstallSteps name={titleFor(pets.map((p) => p.name))} /></Sheet>}
  </div>;
}
