import { useState } from 'react';
import { Chester } from '../chester/Chester';
import { store, useStore } from '../db/store';
import { sharingConfigured } from '../sync/config';
import { Icon } from '../ui/icons';
import { go } from '../ui/router';
import * as audio from '../lib/audio';

const appLink = () => location.origin + import.meta.env.BASE_URL;
const errText = (e: unknown) => {
  const m = e instanceof Error ? e.message : String(e);
  if (m === 'wrong-password') return 'That email already has an account with a different password.';
  if (m === 'confirm-email-on') return 'Almost: in Supabase, turn off “Confirm email” (Authentication → Sign In / Providers → Email), then try again.';
  if (/rate|security purposes/i.test(m)) return 'Too many tries just now. Wait a minute and try again.';
  if (/password/i.test(m)) return m;
  if (/fetch|network|offline/i.test(m)) return 'No connection. Try again when you’re online.';
  return m;
};

/**
 * Full-screen flow for training Chester together.
 * mode "share": sign in and share this phone's Chester. mode "join": sign in and join with an invite code.
 */
export function Together({ mode }: { mode: 'share' | 'join' }) {
  const snap = useStore();
  const [step, setStep] = useState<'email' | 'invite'>(snap.account ? 'invite' : 'email');
  const [email, setEmail] = useState(snap.account?.email ?? '');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [invite, setInvite] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const catName = snap.cat?.name ?? 'Chester';
  const run = async (fn: () => Promise<void>) => { setBusy(true); setErr(''); try { await fn(); } catch (e) { setErr(errText(e)); } finally { setBusy(false); } };
  const leave = () => (snap.cat ? go('settings') : history.length > 1 ? history.back() : go('home'));

  if (!sharingConfigured()) return <div className="screen"><Top onBack={leave} title="Train together" /><p className="m">Sharing isn’t switched on in this version of the app yet.</p></div>;

  const wrap = (body: React.ReactNode) => <div className="screen" style={{ display: 'flex', flexDirection: 'column' }}>
    <Top onBack={leave} title={mode === 'join' ? 'Join with a code' : 'Train together'} />
    <div className="card mint" style={{ display: 'flex', justifyContent: 'center', padding: '18px 12px 8px', margin: 0 }}><Chester coat={snap.cat?.coat ?? 'black'} eyes={snap.cat?.eyes ?? 'gold'} mood="happy" width={120} interactive label={catName} /></div>
    {body}
    {err && <p role="alert" className="s" style={{ marginTop: 12, color: '#b4412b', fontWeight: 700 }}>{err}</p>}
  </div>;

  if (step === 'email') return wrap(<>
    <h1 style={{ marginTop: 20 }}>{mode === 'join' ? 'Join someone’s cat' : `Train ${catName} together`}</h1>
    <p className="m" style={{ marginTop: 6 }}>{mode === 'join'
      ? 'Sign in, then enter the invite code you were sent. You’ll both see the same progress, treats and limits.'
      : `Sign in so ${catName}’s progress is saved online. Then send an invite code to whoever trains with you.`}</p>
    <label className="field" htmlFor="tn">Your first name</label>
    <input id="tn" className="in" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" enterKeyHint="next" />
    <label className="field" htmlFor="te">Email</label>
    <input id="te" className="in" type="email" inputMode="email" autoComplete="username" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} enterKeyHint="next" />
    <label className="field" htmlFor="tp">Password</label>
    <input id="tp" className="in" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} enterKeyHint="go" />
    <p className="s" style={{ marginTop: 8 }}>New here? This creates your account. At least 6 characters.</p>
    <button className="btn" style={{ marginTop: 20 }} disabled={busy || !/\S+@\S+\.\S+/.test(email) || !name.trim() || password.length < 6}
      onClick={() => run(async () => {
        await store.signIn(email, password, name, mode === 'share');
        audio.sparkle();
        if (mode === 'share') go('settings'); else setStep('invite');
      })}>{busy ? 'Signing in…' : 'Sign in'}</button>
  </>);

  return wrap(<>
    <h1 style={{ marginTop: 20 }}>Enter the invite code</h1>
    <p className="m" style={{ marginTop: 6 }}>{snap.cat && snap.household === null
      ? `Joining replaces the ${catName} on this phone with the shared one.`
      : 'Ask the person you train with. It’s in their Settings, under Train together.'}</p>
    <label className="field" htmlFor="ti">Invite code</label>
    <input id="ti" className="in" autoCapitalize="characters" autoComplete="off" maxLength={8} value={invite} onChange={(e) => setInvite(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, ''))} style={{ fontSize: 24, letterSpacing: 4, textAlign: 'center' }} />
    <button className="btn" style={{ marginTop: 20 }} disabled={busy || invite.length < 6}
      onClick={() => run(async () => {
        if (!(await store.join(invite, name || snap.account?.email.split('@')[0] || ''))) throw new Error('No cat has that code. Check it and try again.');
        audio.sparkle(); go('home');
      })}>{busy ? 'Joining…' : 'Join'}</button>
  </>);
}

function Top({ onBack, title }: { onBack: () => void; title: string }) {
  return <div className="top"><button className="iconbtn" aria-label="Back" onClick={onBack}><Icon name="back" /></button><b style={{ fontSize: 17 }}>{title}</b></div>;
}

/** The Settings card: who trains the cat, the invite code, and sync status. */
export function TogetherCard() {
  const { cat, account, household, sync } = useStore();
  const [copied, setCopied] = useState(false);
  if (!sharingConfigured() || !cat) return null;
  if (!account) return <div className="card sky">
    <b>Train {cat.name} together</b>
    <p className="s" style={{ marginTop: 4 }}>Share {cat.name}’s progress with someone else, so you both see the same skills, treats and daily limits.</p>
    <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: 'wrap' }}>
      <button className="btn2" style={{ background: '#fff' }} onClick={() => go('together')}>Share {cat.name}</button>
      <button className="btn2" style={{ background: 'transparent' }} onClick={() => go('join')}>I have a code</button>
    </div>
  </div>;

  const me = account.userId;
  const names = (household?.members ?? []).map((m) => (m.userId === me ? `${m.name || 'You'} (you)` : m.name || 'Someone'));
  const share = async () => {
    const code = household?.inviteCode ?? '';
    const text = `Help me train ${cat.name}! Open ${appLink()} , tap “I have an invite code”, and enter ${code}.`;
    try {
      if (navigator.share) await navigator.share({ title: `Train ${cat.name}`, text });
      else { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    } catch { /* closed the share sheet */ }
  };
  const status = sync === 'syncing' ? 'Syncing…' : sync === 'offline' ? 'Offline. Sets are saved here and sync when you’re back online.' : 'Up to date';
  return <div className="card sky">
    <b>Training together</b>
    <p className="s" style={{ marginTop: 4 }}>{names.length ? names.join(' · ') : account.email}</p>
    {household && names.length < 2 && <p className="s" style={{ marginTop: 8 }}>Invite someone with this code:</p>}
    {household && <div className="row" style={{ marginTop: 8, gap: 10, alignItems: 'center' }}>
      <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: 3, fontVariantNumeric: 'tabular-nums' }}>{household.inviteCode}</span>
      <button className="btn2" style={{ background: '#fff', marginLeft: 'auto' }} onClick={share}>{copied ? 'Copied' : 'Send invite'}</button>
    </div>}
    <p className="s" style={{ marginTop: 10 }} aria-live="polite">{status}</p>
    <div className="row" style={{ marginTop: 8, gap: 8, flexWrap: 'wrap' }}>
      {sync === 'offline' && <button className="btn2" style={{ background: '#fff' }} onClick={() => void store.sync()}>Try again</button>}
      <button className="btn2" style={{ background: 'transparent' }} onClick={() => void store.signOut()}>Sign out</button>
    </div>
  </div>;
}
