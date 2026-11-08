import { useEffect, useState } from 'react';
import { Chester } from '../chester/Chester';
import { store, useStore } from '../db/store';
import { sharingConfigured } from '../sync/config';
import { Icon } from '../ui/icons';
import { go } from '../ui/router';
import * as audio from '../lib/audio';

const appLink = () => location.origin + import.meta.env.BASE_URL;
const errText = (e: unknown) => {
  const m = e instanceof Error ? e.message : String(e);
  if (m === 'bad-login') return 'That email and password don’t match. New here? Tap “Create account” above.';
  if (m === 'email-taken') return 'That email already has an account. Tap “I already have one” above to sign in.';
  if (m === 'confirm-email-on') return 'Almost: in Supabase, turn off “Confirm email” (Authentication → Sign In / Providers → Email), then try again.';
  if (/rate|security purposes/i.test(m)) return 'Too many tries just now. Wait a minute and try again.';
  if (/password/i.test(m)) return m;
  if (/fetch|network|offline/i.test(m)) return 'No connection. Try again when you’re online.';
  return m;
};

/** Send the invite code with the phone's share sheet, or copy it. Returns true when copied. */
export async function sendInvite(catName: string, code: string): Promise<boolean> {
  const text = `Help me train ${catName}! Open ${appLink()} , choose “Someone invited me”, create an account, and enter ${code}.`;
  try {
    if (navigator.share) { await navigator.share({ title: `Train ${catName}`, text }); return false; }
    await navigator.clipboard.writeText(text); return true;
  } catch { return false; /* closed the share sheet */ }
}

function useRun() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const run = async (fn: () => Promise<void>) => { setBusy(true); setErr(''); try { await fn(); } catch (e) { setErr(errText(e)); } finally { setBusy(false); } };
  return { busy, err, setErr, run };
}
const ErrLine = ({ err }: { err: string }) => (err ? <p role="alert" className="s" style={{ marginTop: 12, color: '#b4412b', fontWeight: 700 }}>{err}</p> : null);
export const StepLabel = ({ n, of, label }: { n: number; of: number; label: string }) =>
  <p className="s" style={{ marginTop: 18, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase' }}>Step {n} of {of} · {label}</p>;

/**
 * Create an account or sign in. `share` uploads this phone's cat (or brings back the cat this account already has).
 * Calls onDone(name) once signed in.
 */
export function AccountForm({ intro, share, onDone }: { intro: string; share: boolean; onDone: (name: string) => void }) {
  const [create, setCreate] = useState(true);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const { busy, err, setErr, run } = useRun();
  const valid = /\S+@\S+\.\S+/.test(email) && password.length >= 6 && (!create || !!name.trim());
  const pick = (c: boolean) => { setCreate(c); setErr(''); };
  return <>
    <h1 style={{ marginTop: 6 }}>{create ? 'Create your account' : 'Sign in'}</h1>
    <p className="m" style={{ marginTop: 6 }}>{intro}</p>
    <div className="seg" role="group" aria-label="Account" style={{ marginTop: 16 }}>
      <button className={create ? 'on' : ''} aria-pressed={create} onClick={() => pick(true)}>I’m new</button>
      <button className={!create ? 'on' : ''} aria-pressed={!create} onClick={() => pick(false)}>I already have one</button>
    </div>
    {create && <><label className="field" htmlFor="tn">Your first name</label>
      <input id="tn" className="in" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" enterKeyHint="next" /></>}
    <label className="field" htmlFor="te">Email</label>
    <input id="te" className="in" type="email" inputMode="email" autoComplete="username" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} enterKeyHint="next" />
    <label className="field" htmlFor="tp">{create ? 'Make a password' : 'Password'}</label>
    <div className="row" style={{ gap: 8 }}>
      <input id="tp" className="in" type={show ? 'text' : 'password'} autoComplete={create ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} enterKeyHint="go" />
      <button className="btn2" onClick={() => setShow(!show)} aria-pressed={show}>{show ? 'Hide' : 'Show'}</button>
    </div>
    {create && <p className="s" style={{ marginTop: 8 }}>At least 6 characters. No email is sent.</p>}
    <button className="btn" style={{ marginTop: 20 }} disabled={busy || !valid}
      onClick={() => run(async () => { await store.signIn(email, password, name, share, create); audio.sparkle(); onDone(name.trim()); })}>
      {busy ? (create ? 'Creating…' : 'Signing in…') : create ? 'Create account' : 'Sign in'}</button>
    <ErrLine err={err} />
  </>;
}

/** Enter someone's invite code and switch this phone to their cat. */
export function CodeForm({ name, onDone }: { name: string; onDone: () => void }) {
  const snap = useStore();
  const [invite, setInvite] = useState('');
  const { busy, err, run } = useRun();
  return <>
    <h1 style={{ marginTop: 6 }}>Enter the invite code</h1>
    <p className="m" style={{ marginTop: 6 }}>{snap.cat && !snap.household
      ? `Joining replaces the ${snap.cat.name} on this phone with the shared one.`
      : 'It’s 8 letters and numbers. The person who invited you can find it in Settings, under Training together.'}</p>
    <label className="field" htmlFor="ti">Invite code</label>
    <input id="ti" className="in" autoCapitalize="characters" autoComplete="off" maxLength={8} value={invite} onChange={(e) => setInvite(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, ''))} style={{ fontSize: 24, letterSpacing: 4, textAlign: 'center' }} />
    <button className="btn" style={{ marginTop: 20 }} disabled={busy || invite.length < 6}
      onClick={() => run(async () => {
        if (!(await store.join(invite, name || snap.account?.email.split('@')[0] || ''))) throw new Error('No cat has that code. Check it and try again.');
        audio.sparkle(); onDone();
      })}>{busy ? 'Joining…' : 'Join'}</button>
    <ErrLine err={err} />
  </>;
}

/**
 * Full-screen flow from Settings, in two clear steps.
 * share: 1 your account → 2 invite someone.   join: 1 your account → 2 enter their invite code.
 */
export function Together({ mode }: { mode: 'share' | 'join' }) {
  const snap = useStore();
  const [step, setStep] = useState<'account' | 'next'>(snap.account ? 'next' : 'account');
  const [name, setName] = useState('');
  const [copied, setCopied] = useState(false);
  const catName = snap.cat?.name ?? 'Chester';
  const leave = () => (snap.cat ? go('settings') : history.length > 1 ? history.back() : go('home'));

  if (!sharingConfigured()) return <div className="screen"><Top onBack={leave} title="Train together" /><p className="m">Sharing isn’t switched on in this version of the app yet.</p></div>;

  const wrap = (n: 1 | 2, label: string, body: React.ReactNode) => <div className="screen" style={{ display: 'flex', flexDirection: 'column' }}>
    <Top onBack={leave} title={mode === 'join' ? 'Join with a code' : 'Train together'} />
    <div className="card mint" style={{ display: 'flex', justifyContent: 'center', padding: '14px 12px 6px', margin: 0 }}><Chester coat={snap.cat?.coat ?? 'black'} eyes={snap.cat?.eyes ?? 'gold'} mood="happy" width={100} interactive label={catName} /></div>
    <StepLabel n={n} of={2} label={label} />
    {body}
  </div>;

  if (step === 'account') return wrap(1, 'Your account', <AccountForm share={mode === 'share'}
    intro={mode === 'join' ? 'You need your own account to train together. Next you’ll enter the invite code.' : `An account saves ${catName}’s progress online. Next you’ll get an invite code to send.`}
    onDone={(n) => { setName(n); setStep('next'); }} />);

  if (mode === 'join') return wrap(2, 'Invite code', <CodeForm name={name} onDone={() => go('home')} />);

  const h = snap.household; const others = (h?.members.length ?? 1) - 1;
  return wrap(2, 'Invite', <>
    <h1 style={{ marginTop: 6 }}>{others > 0 ? 'You’re all set' : `Invite someone to train ${catName}`}</h1>
    <p className="m" style={{ marginTop: 6 }}>{others > 0
      ? `${catName} is shared. Anyone else can join with this code too.`
      : 'Send them this code. They open the app, choose “Someone invited me”, make their own account, and enter it.'}</p>
    {h ? <div className="card sky" style={{ textAlign: 'center' }}>
      <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: 4, fontVariantNumeric: 'tabular-nums' }}>{h.inviteCode}</span>
    </div> : <p className="s" style={{ marginTop: 14 }} aria-live="polite">{snap.sync === 'offline' ? 'Can’t reach the server. Check your connection.' : 'Getting your code…'}</p>}
    {h && <button className="btn" style={{ marginTop: 16 }} onClick={async () => { if (await sendInvite(catName, h.inviteCode)) { setCopied(true); setTimeout(() => setCopied(false), 2000); } }}>{copied ? 'Copied' : 'Send invite'}</button>}
    {!h && snap.sync === 'offline' && <button className="btn2" style={{ marginTop: 12 }} onClick={() => void store.sync()}>Try again</button>}
    <button className="btn2" style={{ marginTop: 10, width: '100%' }} onClick={() => go('settings')}>Done</button>
  </>);
}

function Top({ onBack, title }: { onBack: () => void; title: string }) {
  return <div className="top"><button className="iconbtn" aria-label="Back" onClick={onBack}><Icon name="back" /></button><b style={{ fontSize: 17 }}>{title}</b></div>;
}

/** The Settings card: who trains the cat, the invite code, and sync status. */
export function TogetherCard() {
  const { cat, account, household, sync } = useStore();
  const [copied, setCopied] = useState(false);
  const savedName = household?.members.find((m) => m.userId === account?.userId)?.name || store.myName;
  const [myName, setMyName] = useState(savedName);
  useEffect(() => { setMyName(savedName); }, [savedName]);
  if (!sharingConfigured() || !cat) return null;
  if (!account) return <div className="card sky">
    <b>Train {cat.name} together</b>
    <p className="s" style={{ marginTop: 4 }}>Share {cat.name}’s progress with someone else, so you both see the same skills, treats and daily limits.</p>
    <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: 'wrap' }}>
      <button className="btn2" style={{ background: 'var(--surface)' }} onClick={() => go('together')}>Share {cat.name}</button>
      <button className="btn2" style={{ background: 'transparent' }} onClick={() => go('join')}>I have a code</button>
    </div>
  </div>;

  const me = account.userId;
  const names = (household?.members ?? []).map((m) => (m.userId === me ? `${m.name || 'You'} (you)` : m.name || 'Someone'));
  const share = async () => { if (household && (await sendInvite(cat.name, household.inviteCode))) { setCopied(true); setTimeout(() => setCopied(false), 2000); } };
  const status = sync === 'syncing' ? 'Syncing…' : sync === 'offline' ? 'Offline. Sets are saved here and sync when you’re back online.' : 'Up to date';
  return <div className="card sky">
    <b>Training together</b>
    <p className="s" style={{ marginTop: 4 }}>{names.length ? names.join(' · ') : account.email}</p>
    <label className="field" htmlFor="myname">Your name</label>
    <div className="row" style={{ gap: 8 }}>
      <input id="myname" className="in" style={{ background: 'var(--surface)' }} value={myName} onChange={(e) => setMyName(e.target.value)} placeholder="So Home can greet you" autoComplete="given-name" />
      <button className="btn2" style={{ background: 'var(--surface)' }} disabled={!myName.trim() || myName.trim() === savedName} onClick={() => void store.renameMe(myName)}>{myName.trim() && myName.trim() === savedName ? 'Saved' : 'Save'}</button>
    </div>
    {household && names.length < 2 && <p className="s" style={{ marginTop: 8 }}>Invite someone with this code:</p>}
    {household && <div className="row" style={{ marginTop: 8, gap: 10, alignItems: 'center' }}>
      <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: 3, fontVariantNumeric: 'tabular-nums' }}>{household.inviteCode}</span>
      <button className="btn2" style={{ background: 'var(--surface)', marginLeft: 'auto' }} onClick={share}>{copied ? 'Copied' : 'Send invite'}</button>
    </div>}
    <p className="s" style={{ marginTop: 10 }} aria-live="polite">{status}</p>
    <div className="row" style={{ marginTop: 8, gap: 8, flexWrap: 'wrap' }}>
      {sync === 'offline' && <button className="btn2" style={{ background: 'var(--surface)' }} onClick={() => void store.sync()}>Try again</button>}
      <button className="btn2" style={{ background: 'transparent' }} onClick={() => void store.signOut()}>Sign out</button>
    </div>
  </div>;
}
