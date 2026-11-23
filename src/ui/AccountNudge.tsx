import { useState } from 'react';
import { useStore } from '../db/store';
import { sharingConfigured } from '../sync/config';
import { go } from './router';

const KEY = 'paldex-account-nudge';
const dismissed = () => { try { return localStorage.getItem(KEY) === 'no'; } catch { return false; } };

/** Sign-up, asked after the first Fed tap instead of during setup (navigation plan, onboarding): once there's a Fed
    in the log and no account, a card offers to save the cat to an account. "Not now" hides it on this phone. */
export function AccountNudge() {
  const { account, cat, care } = useStore();
  const [hidden, setHidden] = useState(dismissed);
  if (!sharingConfigured() || account || !cat || hidden) return null;
  if (!care.some((c) => c.kind === 'daily' && (c.data as { what?: string }).what === 'fed')) return null;
  const not = () => { try { localStorage.setItem(KEY, 'no'); } catch { /* private mode: hide for now */ } setHidden(true); };
  return <div className="card sky" role="region" aria-label="Save to an account">
    <b>Save {cat.name} to your account?</b>
    <p className="s" style={{ marginTop: 'var(--sp-1)' }}>It’s backed up, and the people you live with can log too. Takes a minute.</p>
    <div className="row" style={{ gap: 'var(--sp-2)', marginTop: 'var(--sp-3)' }}>
      <button className="btn" style={{ flex: 1, marginTop: 0 }} onClick={() => go('together')}>Create account</button>
      <button className="btn2" style={{ flex: 1 }} onClick={not}>Not now</button>
    </div>
  </div>;
}
