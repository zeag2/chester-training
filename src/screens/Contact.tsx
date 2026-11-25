import { useEffect, useState } from 'react';
import { store, useStore } from '../db/store';
import { APP_VERSION } from '../lib/version';
import { Icon } from '../ui/icons';
import { back } from '../ui/router';

const MAX = 2000;

/* #/contact: "Contact us". Works signed in or out, with or without a pet (linked from Privacy and Settings → App).
   Saved to the app's own database (contact_messages, insert-only); the app owner reads them in Settings → Messages.
   Until its SQL is run (or with no shared copy) it says the form isn't available yet. */
export function Contact() {
  const { account } = useStore();
  const [ready, setReady] = useState<boolean | null>(null);
  const [name, setName] = useState(() => (account && store.myName) || '');
  const [message, setMessage] = useState('');
  const [reach, setReach] = useState('');
  const [state, setState] = useState<'' | 'sending' | 'sent'>('');
  const [err, setErr] = useState('');
  useEffect(() => { let on = true; void store.contactReady().then((r) => { if (on) setReady(r); }); return () => { on = false; }; }, []);
  const ok = message.trim().length > 0 && message.trim().length <= MAX && state === '';

  const send = async () => {
    if (!ok) return; setState('sending'); setErr('');
    try { await store.sendContact({ name, reach, message }); setState('sent'); }
    catch (e) {
      const m = String((e as Error)?.message);
      setState('');
      if (m.includes('contact-missing')) setReady(false);
      else if (m.includes('contact-rate-limited')) setErr('You’ve sent a few messages in the last hour. Please try again a bit later. Your message is still here.');
      else setErr('Couldn’t send it. Check your connection and try again. Your message is still here.');
    }
  };

  return <div className="screen">
    <div className="row" style={{ marginTop: 'var(--sp-3)' }}><button className="iconbtn" aria-label="Back" onClick={() => back('settings')}><Icon name="back" /></button><h1 className="sp">Contact us</h1></div>

    {state === 'sent' ? <>
      <div className="card mint" role="status" style={{ marginTop: 'var(--sp-4)' }}>
        <div className="row"><span className="ico" aria-hidden="true"><Icon name="check" /></span><b className="sp" style={{ color: 'var(--teal-ink)' }}>Saved. Thank you!</b></div>
        <p className="s" style={{ marginTop: 'var(--sp-2)', color: 'var(--teal-ink)' }}>Your message reached PalDex. {reach.trim() ? 'If it needs an answer, we’ll get back to you.' : 'You didn’t leave a way to reach you, so we can’t write back, but we read every message.'}</p>
      </div>
      <button className="btn" style={{ marginTop: 'var(--sp-4)' }} onClick={() => back('settings')}>Done</button>
      <button className="btn2" style={{ marginTop: 'var(--sp-3)', width: '100%' }} onClick={() => { setMessage(''); setState(''); }}>Write another</button>
    </> : ready === false ? <>
      <div className="card butter" style={{ marginTop: 'var(--sp-4)' }}><p className="s" style={{ color: 'var(--butter-ink)' }}><b>Not available yet.</b> The message box needs one more setup step on PalDex’s side. Please try again in a few days.</p></div>
      <button className="btn2" style={{ marginTop: 'var(--sp-4)', width: '100%' }} onClick={() => back('settings')}>Back</button>
    </> : <>
      <p className="m" style={{ marginTop: 'var(--sp-1)' }}>A question, an idea, or something not working? Write it here{account ? '' : ', no account needed'}.</p>
      <label className="field" htmlFor="ct-msg">Message</label>
      <textarea id="ct-msg" className="in" rows={6} maxLength={MAX} value={message} onChange={(e) => setMessage(e.target.value)} aria-describedby="ct-count" />
      <p id="ct-count" className="s" style={{ marginTop: 'var(--sp-1)', textAlign: 'right' }}>{message.length > MAX - 200 ? `${MAX - message.length} characters left` : ''}</p>
      <label className="field" htmlFor="ct-name" style={{ marginTop: 'var(--sp-2)' }}>Your name (optional)</label>
      <input id="ct-name" className="in" maxLength={80} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
      <label className="field" htmlFor="ct-reach">How to reach you (optional)</label>
      <input id="ct-reach" className="in" maxLength={200} autoComplete="email" value={reach} onChange={(e) => setReach(e.target.value)} aria-describedby="ct-reach-note" />
      <p id="ct-reach-note" className="s" style={{ marginTop: 6 }}>An email or phone number, only if you’d like an answer.</p>
      <p className="s" style={{ marginTop: 'var(--sp-4)' }}>The app version ({APP_VERSION}) is sent with it, so we know which PalDex you have.</p>
      {err && <p className="s" role="alert" style={{ marginTop: 'var(--sp-3)', color: 'var(--rose)' }}>{err}</p>}
      <button className="btn" style={{ marginTop: 'var(--sp-4)' }} disabled={!ok || ready === null} onClick={() => void send()}>{state === 'sending' ? 'Sending…' : 'Send'}</button>
    </>}
    <div style={{ height: 'var(--sp-8)' }} />
  </div>;
}
