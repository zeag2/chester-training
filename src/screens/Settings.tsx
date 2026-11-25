import { useEffect, useRef, useState } from 'react';
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
import { back, go } from '../ui/router';
import type { Cat } from '../engine/types';
import type { DeletionPlan } from '../sync/remote';
import { Sheet as SheetFrame } from '../ui/Sheet';
import { showToast } from '../ui/Toast';
import { readBackup, type BackupRead } from '../lib/backup';

/* Settings, grouped like iPhone Settings: the pet, the people, the app, your data. */

function Row({ label, value, onClick, danger, children, sub }: { label: string; value?: React.ReactNode; onClick?: () => void; danger?: boolean; children?: React.ReactNode; sub?: string }) {
  const body = <><span className="sp"><span style={{ color: danger ? 'var(--rose)' : undefined, fontWeight: danger ? 700 : 600 }}>{label}</span>{sub && <span className="s" style={{ display: 'block' }}>{sub}</span>}</span>
    {value !== undefined && <span className="s" style={{ textAlign: 'right' }}>{value}</span>}{children}
    {onClick && !danger && <span className="chev" aria-hidden="true">›</span>}</>;
  return onClick ? <button className="lrow" onClick={onClick}>{body}</button> : <div className="lrow">{body}</div>;
}
const Group = ({ title, children, foot }: { title: string; children: React.ReactNode; foot?: string }) =>
  <section style={{ marginTop: 'var(--sp-6)' }}><h2 className="lhead">{title}</h2><div className="lgroup">{children}</div>{foot && <p className="s" style={{ margin: 'var(--sp-2) var(--sp-1) 0' }}>{foot}</p>}</section>;

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button role="switch" aria-checked={on} aria-label={label} className={`switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)}><i /></button>;
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <SheetFrame label={title} onClose={onClose}>
    <div className="row"><b className="sp" style={{ fontSize: 18 }}>{title}</b><button className="iconbtn" aria-label="Close" onClick={onClose}><Icon name="close" /></button></div>
    {children}</SheetFrame>;
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
    <div className="lgroup" style={{ marginTop: 'var(--sp-4)' }}><Row label={f.sex === 'f' ? 'Spayed' : 'Neutered'}><Switch on={f.altered} onChange={(v) => set('altered', v)} label={f.sex === 'f' ? 'Spayed' : 'Neutered'} /></Row>
      <Row label="Training" sub="Adds skills, sets and rewards in the Train tab"><Switch on={f.training} onChange={(v) => set('training', v)} label="Training" /></Row>
      <Row label="Meals a day" sub="For the Fed button on Home"><div className="row" style={{ gap: 6 }}>
        <button className="iconbtn" aria-label="Fewer meals" disabled={f.meals <= 1} onClick={() => set('meals', Math.max(1, f.meals - 1))}>−</button>
        <b className="num" style={{ minWidth: 20, textAlign: 'center' }} aria-live="polite">{f.meals}</b>
        <button className="iconbtn" aria-label="More meals" disabled={f.meals >= 8} onClick={() => set('meals', Math.min(8, f.meals + 1))}>+</button></div></Row></div>
    <button className="btn sheetsave" style={{ marginTop: 'var(--sp-5)' }} onClick={save} disabled={!f.name.trim()}>Save</button>
  </Sheet>;
}

function EditMyName({ onClose }: { onClose: () => void }) {
  const { household, account, cat } = useStore();
  const meRow = household?.members.find((m) => m.userId === account?.userId);
  const [name, setName] = useState(household?.members.find((m) => m.userId === account?.userId)?.name || store.myName);
  return <Sheet title="Your name" onClose={onClose}>
    <p className="s" style={{ marginTop: 'var(--sp-1)' }}>Home greets you with it, and it’s what the people you train with see.</p>
    <input className="in" style={{ marginTop: 'var(--sp-3)' }} value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" autoFocus aria-label="Your name" />
    <button className="btn sheetsave" style={{ marginTop: 'var(--sp-4)' }} disabled={!name.trim()} onClick={async () => { await store.renameMe(name); onClose(); }}>Save</button>
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
    <p className="m" style={{ marginTop: 'var(--sp-1)' }}>{m.email ?? 'Email shows once the latest PalDex setup step is done.'}</p>
    {m.sets !== undefined && <p className="s" style={{ marginTop: 'var(--sp-1)' }}>{m.sets} training set{m.sets === 1 ? '' : 's'} logged</p>}
    {same && <div className="card butter" style={{ marginTop: 'var(--sp-3)' }}><p className="s" style={{ color: 'var(--butter-ink)' }}>Two people here are called {m.name}. That usually means someone made a second account. Check the emails and remove the one that isn’t used.</p></div>}
    {iOwn ? <>
      <button className="btn danger" style={{ marginTop: 'var(--sp-4)' }} onClick={async () => {
        if (!confirm(`Remove ${m.name || 'this person'}${m.email ? ` (${m.email})` : ''} from the household? They lose access to every pet in it. Sets they logged stay.`)) return;
        try { await store.removeMember(userId); onClose(); } catch (e) { setErr((e as Error).message === 'not-allowed' ? 'Only the person who set up the household can remove people.' : 'Couldn’t remove them. Is the latest setup step done in Supabase?'); }
      }}>Remove from household</button>
      <p className="s" style={{ marginTop: 'var(--sp-2)' }}>They lose access to every pet in the household. Everything they logged stays.</p></>
      : <p className="s" style={{ marginTop: 14 }}>Only the person who set up the household can remove people.</p>}
    {err && <p className="s" role="alert" style={{ marginTop: 10, color: 'var(--rose)' }}>{err}</p>}
  </Sheet>;
}

function Invite({ catName, code, onClose }: { catName: string; code: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return <Sheet title="Invite someone to your household" onClose={onClose}>
    <p className="s" style={{ marginTop: 'var(--sp-1)' }}>They open PalDex, choose “Someone invited me”, make an account, and enter this code. They’ll see and help train every pet in your household, including ones you add later.</p>
    <div className="card sky" style={{ textAlign: 'center' }}><span style={{ fontSize: 'var(--fs-display)', fontWeight: 800, letterSpacing: 4, fontVariantNumeric: 'tabular-nums' }}>{code}</span></div>
    <button className="btn" style={{ marginTop: 14 }} onClick={async () => { if (await sendInvite(catName, code)) { setCopied(true); setTimeout(() => setCopied(false), 2000); } }}>{copied ? 'Copied' : 'Send invite'}</button>
  </Sheet>;
}

const names = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/** Delete my account: what goes and what stays (from the server), a typed DELETE, then the app starts again. Until the
    delete-account SQL is run it says it's coming soon. */
function DeleteAccount({ onClose, onBackup }: { onClose: () => void; onBackup: () => void }) {
  const { account } = useStore();
  const [plan, setPlan] = useState<DeletionPlan | null | undefined>(undefined);
  const [err, setErr] = useState('');
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () => { setErr(''); store.accountDeletion().then(setPlan, () => setErr('Couldn’t reach PalDex. Check your connection and try again.')); };
  useEffect(load, []);
  const ready = typed.trim().toUpperCase() === 'DELETE';
  const run = async () => {
    if (!plan || !ready) return; setBusy(true); setErr('');
    try { await store.deleteAccount(plan); onClose(); go('home'); }
    catch { setBusy(false); setErr('Couldn’t delete your account. Nothing on this phone was removed. Check your connection and try again.'); }
  };
  return <Sheet title="Delete your account" onClose={onClose}>
    {plan === null ? <>
      <div className="card butter" style={{ marginTop: 'var(--sp-3)' }}><p className="s" style={{ color: 'var(--butter-ink)' }}><b>Coming soon.</b> Deleting your account from the app needs one more setup step on PalDex’s side. Until then you can sign out, and remove pets from your household in Settings.</p></div>
      <button className="btn2" style={{ marginTop: 'var(--sp-4)', width: '100%' }} onClick={() => go('privacy')}>What PalDex stores</button>
    </> : plan === undefined ? <p className="s" style={{ marginTop: 'var(--sp-3)' }} aria-live="polite">{err || 'Checking what would be deleted…'}</p>
      : <>
      <p className="m" style={{ marginTop: 'var(--sp-1)' }}>This deletes your account{account ? ` (${account.email})` : ''} for good. It can’t be undone.</p>
      <div className="lgroup" style={{ marginTop: 'var(--sp-4)' }}>
        <Row label="Deleted" sub={`Your account, friends and friend requests, the photos you posted${plan.deleted.length ? `, and ${names(plan.deleted.map((p) => p.name))} with all ${plan.deleted.length === 1 ? 'its' : 'their'} logs, documents and photos` : ''}.`} />
        {plan.kept.length > 0 && <Row label="Stays" sub={`${plan.kept.map((k) => `${k.name} stays with ${k.keeper || 'your household'}`).join('; ')}, with ${plan.kept.length === 1 ? 'its' : 'their'} history. What you logged stays, without your name.`} />}
        <Row label="This phone" sub="Everything PalDex keeps here is removed too." />
      </div>
      <button className="btn2" style={{ marginTop: 'var(--sp-3)', width: '100%' }} onClick={onBackup}>Download a backup first</button>
      <label className="field" htmlFor="del">Type DELETE to confirm</label>
      <input id="del" className="in" value={typed} onChange={(e) => setTyped(e.target.value)} autoCapitalize="characters" autoComplete="off" autoCorrect="off" spellCheck={false} />
      <button className="btn danger" style={{ marginTop: 'var(--sp-4)' }} disabled={!ready || busy} onClick={() => void run()}>{busy ? 'Deleting…' : 'Delete my account'}</button>
    </>}
    {err && plan !== undefined && <p className="s" role="alert" style={{ marginTop: 'var(--sp-3)', color: 'var(--rose)' }}>{err}</p>}
    {err && plan === undefined && <button className="btn2" style={{ marginTop: 'var(--sp-3)', width: '100%' }} onClick={load}>Try again</button>}
  </Sheet>;
}

/** Restore from a backup: what's in the file, Merge (the default, adds what's missing) or Replace (asks first), then a
    toast with Undo. A wrong or old file says so here instead. */
export function Restore({ read, onPick, onClose }: { read: BackupRead; onPick: () => void; onClose: () => void }) {
  const { account } = useStore();
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!read.ok) return <Sheet title="Restore from a backup" onClose={onClose}>
    <div className="card butter" role="alert" style={{ marginTop: 'var(--sp-3)' }}><p className="s" style={{ color: 'var(--butter-ink)' }}>{read.error}</p></div>
    <button className="btn2" style={{ marginTop: 'var(--sp-4)', width: '100%' }} onClick={onPick}>Choose another file</button>
  </Sheet>;
  const { summary: sum } = read;
  const when = sum.exported ? new Date(sum.exported) : null;
  const run = async () => {
    setBusy(true);
    const { changed, undo } = await store.importBackup(read.backup, mode);
    onClose();
    showToast({ msg: mode === 'replace' ? 'Saved · replaced with the backup' : changed ? `Saved · ${changed} added from the backup` : 'Saved · nothing new in the backup',
      action: { label: 'Undo', run: () => { void undo().then(() => showToast({ msg: 'Backup undone' })); } } });
  };
  return <Sheet title="Restore from a backup" onClose={onClose}>
    {when && !isNaN(+when) && <p className="s" style={{ marginTop: 'var(--sp-1)' }}>Saved {when.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>}
    <div className="lgroup" style={{ marginTop: 'var(--sp-3)' }}>
      <Row label={sum.pets.length === 1 ? 'Pet' : 'Pets'} value={sum.pets.join(', ')} />
      <Row label="Days of logs" value={<span className="num">{sum.days}</span>} />
      <Row label="Documents" value={<span className="num">{sum.documents}</span>} />
    </div>
    {sum.documents > 0 && <p className="s" style={{ marginTop: 'var(--sp-2)' }}>Documents come back as entries; their files open while they’re still stored online.</p>}
    <span className="field">How to restore it</span>
    <div className="seg" role="group" aria-label="How to restore it">{([['merge', 'Merge'], ['replace', 'Replace']] as const).map(([v, l]) =>
      <button key={v} className={mode === v ? 'on' : ''} aria-pressed={mode === v} onClick={() => { setMode(v); setSure(false); }}>{l}</button>)}</div>
    <p className="s" style={{ marginTop: 'var(--sp-2)' }}>{mode === 'merge' ? 'Adds what this phone doesn’t have yet. Nothing is doubled up, and nothing here is removed.'
      : `Swaps this phone’s pets and logs for the backup’s.${account ? ' Pets shared online come back on the next sync.' : ''}`}</p>
    {mode === 'replace' && sure ? <div className="card butter" style={{ marginTop: 'var(--sp-4)' }}>
      <p className="s" style={{ color: 'var(--butter-ink)' }}>Replace everything on this phone with this backup? You can undo it right after.</p>
      <button className="btn" style={{ marginTop: 'var(--sp-3)', background: 'var(--rose)' }} disabled={busy} onClick={run}>Replace everything</button>
      <button className="btn2" style={{ marginTop: 'var(--sp-2)', width: '100%', background: 'transparent' }} onClick={() => setSure(false)}>Keep what’s here</button>
    </div>
      : <button className="btn sheetsave" style={{ marginTop: 'var(--sp-5)' }} disabled={busy} onClick={mode === 'merge' ? run : () => setSure(true)}>{mode === 'merge' ? 'Merge into this phone' : 'Replace…'}</button>}
  </Sheet>;
}

export function Settings() {
  const { cat, account, household, sync, care, pets } = useStore();
  const [muted, setM] = useState(isMuted());
  const [theme, setT] = useState<Theme>(getTheme());
  const [sheet, setSheet] = useState<'' | 'pet' | 'name' | 'invite' | 'install' | 'delete'>('');
  const [person, setPerson] = useState('');
  const showInstall = useInstallHint();
  const [restore, setRestore] = useState<BackupRead | null>(null);
  const file = useRef<HTMLInputElement>(null);
  if (!cat) return null;
  const pickBackup = () => file.current?.click();
  const onBackup = async (f?: File) => { if (f) setRestore(readBackup(await f.text())); };
  const exportData = async () => {
    const data = await store.backup();
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `paldex-${cat.name.toLowerCase().replace(/\W+/g, '-')}-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  };
  const me = household?.members.find((m) => m.userId === account?.userId);
  const others = (household?.members ?? []).filter((m) => m.userId !== account?.userId);
  const syncText = sync === 'syncing' ? 'Syncing…' : sync === 'offline' ? 'Offline: changes are saved here and sync when you’re back online' : 'Up to date';

  const edit = async (id: string) => { if (id !== cat.id) await store.switchPet(id); setSheet('pet'); };
  return <div className="screen">
    <div className="row" style={{ marginTop: 10 }}><button className="iconbtn" aria-label="Back" onClick={() => back('home')}><Icon name="back" /></button><h1 className="sp">Settings</h1></div>
    {account && <p className="m" style={{ marginTop: 'var(--sp-1)' }}>{me?.name || store.myName || 'You'} · {account.email}</p>}

    <Group title="Your cats">
      {pets.map((p) => { const full = p.id === cat.id ? cat : null; return <Row key={p.id} label={p.name} sub={full ? [ageText(cat.birthday).replace(/^about /, ''), cat.training === false ? 'Health tracking' : 'Training on', `${care.length} health entries`].filter(Boolean).join(' · ') : 'Tap to edit'}
        value="Edit" onClick={() => void edit(p.id)}>
        <span style={{ width: 34, height: 34, marginLeft: -4, order: -1, display: 'flex' }}><Chester coat={p.coat} eyes={p.eyes} width={34} mood="happy" /></span></Row>; })}
      <Row label="Add another cat" onClick={() => go('add-pet')} />
    </Group>

    {/* three groups (navigation plan): your cats · household & account · app */}
    {sharingConfigured() && (account ? <Group title="Household & account" foot={household && others.length ? `Your household sees and looks after every cat here. ${syncText}.` : syncText}>
      {others.map((m) => <Row key={m.userId} label={m.name || 'Someone'} sub={[m.email, m.sets !== undefined && `${m.sets} set${m.sets === 1 ? '' : 's'} logged`].filter(Boolean).join(' · ') || undefined}
        value={m.owner ? 'Set it up' : 'Household'} onClick={() => setPerson(m.userId)} />)}
      {household && <Row label={others.length ? 'Invite someone else to your household' : 'Invite someone you live with'} onClick={() => setSheet('invite')} />}
      <Row label="Your name" value={me?.name || store.myName || 'Add'} onClick={() => setSheet('name')} />
      {sync === 'offline' && <Row label="Try syncing again" onClick={() => void store.sync()} />}
      <Row label="Sign out" danger onClick={() => { if (confirm(`Sign out? Your cats stay on this phone; sign back in to sync again.`)) void store.signOut(); }} />
      <Row label="Delete my account" danger onClick={() => setSheet('delete')} />
    </Group> : <Group title="Household & account" foot="Sign in to share your cats with the people you live with, and to add friends.">
      <Row label="Create an account or sign in" onClick={() => go('together')} />
      <Row label="Join a household with a code" onClick={() => go('join')} />
    </Group>)}

    <Group title="App" foot={account ? 'Your data is saved on this phone and online.' : 'Your data is saved on this phone only. Download a backup now and then.'}>
      <Row label="Sound"><Switch on={!muted} label="Sound" onChange={(on) => { setMuted(!on); localStorage.setItem('chester-muted', on ? '0' : '1'); setM(!on); if (on) chirp(); }} /></Row>
      <div className="lrow" style={{ display: 'block' }}><span style={{ fontWeight: 600 }}>Appearance</span>
        <div className="seg" role="group" aria-label="Appearance" style={{ marginTop: 'var(--sp-2)' }}>{(['system', 'light', 'dark'] as Theme[]).map((t) => <button key={t} className={theme === t ? 'on' : ''} aria-pressed={theme === t} onClick={() => { setTheme(t); setT(t); }}>{t === 'system' ? 'Match phone' : t === 'light' ? 'Light' : 'Dark'}</button>)}</div></div>
      {showInstall && <Row label={`Add ${titleFor(pets.map((p) => p.name))} to your Home Screen`} onClick={() => setSheet('install')} />}
      <Row label="Download a backup" sub="Health log, training and treats, as a file" onClick={exportData} />
      <Row label="Privacy" sub="What PalDex keeps, and who sees it" onClick={() => go('privacy')} />
      <Row label="Restore from a backup" sub="Add a backup file’s pets and logs to this phone" onClick={pickBackup} />
    </Group>
    <input ref={file} type="file" accept="application/json,.json" hidden aria-hidden="true" data-testid="backup-file" onChange={(e) => { void onBackup(e.target.files?.[0]); e.target.value = ''; }} />
    {restore && <Restore key={restore.ok ? 'ok' + restore.summary.exported : restore.error} read={restore} onPick={pickBackup} onClose={() => setRestore(null)} />}

    {sheet === 'pet' && <EditPet cat={cat} onClose={() => setSheet('')} />}
    {sheet === 'delete' && <DeleteAccount onClose={() => setSheet('')} onBackup={() => void exportData()} />}
    {sheet === 'name' && <EditMyName onClose={() => setSheet('')} />}
    {person && <Person userId={person} onClose={() => setPerson('')} />}
    {sheet === 'invite' && household && <Invite catName={cat.name} code={household.inviteCode} onClose={() => setSheet('')} />}
    {sheet === 'install' && <Sheet title="Add to your home screen" onClose={() => setSheet('')}>
      <p className="m" style={{ marginTop: 6 }}>It’s named {titleFor(pets.map((p) => p.name))}, opens full screen like an app and works offline. The steps depend on your browser:</p>
      <InstallSteps name={titleFor(pets.map((p) => p.name))} /></Sheet>}
  </div>;
}
