import { useEffect, useState } from 'react';
import { Chester } from '../chester/Chester';
import { store, useStore } from '../db/store';
import { sharingConfigured } from '../sync/config';
import { Icon } from '../ui/icons';
import { back, go } from '../ui/router';
import * as audio from '../lib/audio';
import { resetRedirect, takePendingRecovery } from '../lib/recovery';

const appLink = () => location.origin + import.meta.env.BASE_URL;
export const errText = (e: unknown) => {
  const m = e instanceof Error ? e.message : String(e);
  if (m === 'bad-login') return 'That email and password don’t match. New here? Tap “Create account” above.';
  if (m === 'email-taken') return 'That email already has an account. Tap “I already have one” above to sign in.';
  if (m === 'confirm-email-on') return 'Almost: in Supabase, turn off “Confirm email” (Authentication → Sign In / Providers → Email), then try again.';
  if (m === 'link-expired') return 'That reset link has expired or was already used. Ask for a new one.';
  if (m === 'same-password') return 'That’s your current password. Pick a new one.';
  if (m === 'photo-unreadable') return 'That photo couldn’t be opened. Try another, or take a screenshot of it.';
  if (m === 'photo-too-big') return 'That photo is too big even after shrinking. Try another.';
  if (m === 'photos-missing') return 'Photos aren’t switched on yet. Try again later.';
  if (/rate|security purposes/i.test(m)) return 'Too many tries just now. Wait a minute and try again.';
  if (/password/i.test(m)) return m;
  if (/fetch|network|offline/i.test(m)) return 'No connection. Try again when you’re online.';
  return m;
};

/** Send the invite code with the phone's share sheet, or copy it. Returns true when copied. */
export async function sendInvite(catName: string, code: string): Promise<boolean> {
  const text = `Join my PalDex household to help train ${catName}! Open ${appLink()} , choose “Someone invited me”, create an account, and enter ${code}.`;
  try {
    if (navigator.share) { await navigator.share({ title: `Train ${catName}`, text }); return false; }
    await navigator.clipboard.writeText(text); return true;
  } catch { return false; /* closed the share sheet */ }
}

export function useRun() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const run = async (fn: () => Promise<void>) => { setBusy(true); setErr(''); try { await fn(); } catch (e) { setErr(errText(e)); } finally { setBusy(false); } };
  return { busy, err, setErr, run };
}
export const ErrLine = ({ err }: { err: string }) => (err ? <p role="alert" className="s" style={{ marginTop: 12, color: '#b4412b', fontWeight: 700 }}>{err}</p> : null);
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
  const [forgot, setForgot] = useState<'' | 'ask' | 'sent'>('');
  const { busy, err, setErr, run } = useRun();
  const emailOk = /\S+@\S+\.\S+/.test(email);
  if (forgot) return <>
    <h1 style={{ marginTop: 6 }}>{forgot === 'sent' ? 'Check your email' : 'Reset your password'}</h1>
    {forgot === 'sent'
      ? <p className="m" style={{ marginTop: 6 }} role="status">If {email.trim()} has an account, a link is on its way. Tap it to set a new password, then sign in here with it. No email? Check spam, or wait a minute and send again.</p>
      : <><p className="m" style={{ marginTop: 6 }}>We’ll email you a link to set a new one.</p>
        <label className="field" htmlFor="tre">Email</label>
        <input id="tre" className="in" type="email" inputMode="email" autoComplete="username" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} enterKeyHint="send" /></>}
    {forgot === 'ask' && <button className="btn" style={{ marginTop: 20 }} disabled={busy || !emailOk}
      onClick={() => run(async () => { await store.forgotPassword(email, resetRedirect()); setForgot('sent'); })}>{busy ? 'Sending…' : 'Send reset link'}</button>}
    <button className="btn2" style={{ marginTop: 10, width: '100%' }} onClick={() => { setForgot(''); setErr(''); }}>Back to sign in</button>
    <ErrLine err={err} />
  </>;
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
    {!create && <button className="btn2" style={{ marginTop: 10, width: '100%' }} onClick={() => { setForgot('ask'); setErr(''); }}>Forgot password?</button>}
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
  const leave = () => (snap.cat ? go('settings') : back('home'));

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
    <h1 style={{ marginTop: 6 }}>{others > 0 ? 'You’re all set' : 'Invite someone to your household'}</h1>
    <p className="m" style={{ marginTop: 6 }}>{others > 0
      ? `${catName} is shared. Anyone else can join with this code too.`
      : 'Send them this code. They open the app, choose “Someone invited me”, make their own account, and enter it. They’ll see every pet in your household, including ones you add later.'}</p>
    {h ? <div className="card sky" style={{ textAlign: 'center' }}>
      <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: 4, fontVariantNumeric: 'tabular-nums' }}>{h.inviteCode}</span>
    </div> : <p className="s" style={{ marginTop: 14 }} aria-live="polite">{snap.sync === 'offline' ? 'Can’t reach the server. Check your connection.' : 'Getting your code…'}</p>}
    {h && <button className="btn" style={{ marginTop: 16 }} onClick={async () => { if (await sendInvite(catName, h.inviteCode)) { setCopied(true); setTimeout(() => setCopied(false), 2000); } }}>{copied ? 'Copied' : 'Send invite'}</button>}
    {!h && snap.sync === 'offline' && <button className="btn2" style={{ marginTop: 12 }} onClick={() => void store.sync()}>Try again</button>}
    <button className="btn2" style={{ marginTop: 10, width: '100%' }} onClick={() => go('settings')}>Done</button>
  </>);
}

let recovering: Promise<void> | null = null;
/** #/reset-password: opened from the reset email. Signs in with the link, then asks for a new password. */
export function ResetPassword() {
  const [state, setState] = useState<'checking' | 'ready' | 'done' | 'bad'>('checking');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const { busy, err, setErr, run } = useRun();
  useEffect(() => {
    recovering ??= (async () => {
      const p = takePendingRecovery();
      if (p?.accessToken && p.refreshToken) await store.startRecovery(p.accessToken, p.refreshToken);
      else if (p?.error || !store.get().account) throw new Error('link-expired'); // a stale link, or reopened signed out
    })();
    recovering.then(() => setState('ready'), (e) => { setErr(errText(e)); setState('bad'); });
  }, []);
  const leave = () => location.replace('#/' + (store.get().cat ? 'settings' : 'home'));
  return <div className="screen">
    <Top onBack={leave} title="New password" />
    {state === 'checking' && <p className="m" aria-busy="true">Opening your reset link…</p>}
    {state === 'bad' && <>
      <h1 style={{ marginTop: 6 }}>Link didn’t work</h1>
      <ErrLine err={err} />
      <p className="m" style={{ marginTop: 6 }}>On the sign-in screen, tap “Forgot password?” to get a fresh link.</p>
      <button className="btn" style={{ marginTop: 20 }} onClick={leave}>Back to the app</button>
    </>}
    {state === 'ready' && <>
      <h1 style={{ marginTop: 6 }}>Set a new password</h1>
      <p className="m" style={{ marginTop: 6 }}>{store.get().account?.email ? `For ${store.get().account!.email}.` : ''} At least 6 characters.</p>
      <label className="field" htmlFor="np">New password</label>
      <div className="row" style={{ gap: 8 }}>
        <input id="np" className="in" type={show ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} enterKeyHint="done" />
        <button className="btn2" onClick={() => setShow(!show)} aria-pressed={show}>{show ? 'Hide' : 'Show'}</button>
      </div>
      <button className="btn" style={{ marginTop: 20 }} disabled={busy || password.length < 6}
        onClick={() => run(async () => { await store.setPassword(password); audio.sparkle(); setState('done'); })}>{busy ? 'Saving…' : 'Save password'}</button>
      <ErrLine err={err} />
    </>}
    {state === 'done' && <>
      <h1 style={{ marginTop: 6 }}>Password changed</h1>
      <p className="m" style={{ marginTop: 6 }} role="status">You’re signed in. If you use PalDex from your Home Screen, open it there and sign in with the new password.</p>
      <button className="btn" style={{ marginTop: 20 }} onClick={leave}>Done</button>
    </>}
  </div>;
}

export function Top({ onBack, title }: { onBack: () => void; title: string }) {
  return <div className="top"><button className="iconbtn" aria-label="Back" onClick={onBack}><Icon name="back" /></button><b style={{ fontSize: 17 }}>{title}</b></div>;
}
