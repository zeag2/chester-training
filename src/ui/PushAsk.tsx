import { useEffect, useState, useSyncExternalStore } from 'react';
import { store, useStore } from '../db/store';
import { enablePush, shouldAsk, snoozeAsk } from '../lib/push';
import { Sheet } from './Sheet';
import { showToast } from './Toast';

/* "Turn on notifications?", asked at the moment it's useful (docs/plans/2026-11-23-push-notifications.md):
   after a friend request (inline, `PushAsk`), after saving a repeating medicine (`askForPush` → `PushAskHost`, a Sheet,
   since the medicine form has closed), and always from Settings → Notifications. Shown only when `shouldAsk` says so:
   signed in, the push SQL run, this browser able and never asked, no "Not now" in the last 30 days. */

/** Whether an ask may show now (async: it checks the server once per session). */
export function useCanAsk(): boolean {
  const { account } = useStore();
  const [ok, setOk] = useState(false);
  useEffect(() => {
    let live = true;
    void shouldAsk(store.remote, account?.userId).then((v) => { if (live) setOk(v); });
    return () => { live = false; };
  }, [account?.userId]);
  return ok;
}

export function PushAsk({ title, sub, onDone }: { title: string; sub: string; onDone?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const yes = () => {
    if (busy || !store.remote) return; setBusy(true);
    // enablePush asks the browser first thing, inside this tap
    void enablePush(store.remote).then((r) => {
      setBusy(false);
      if (r === 'on') { showToast({ msg: 'Notifications on for this phone' }); onDone?.(); }
      else if (r === 'blocked') setNote('Notifications are blocked for PalDex. Turn them on in your phone’s settings.');
      else setNote('Couldn’t turn them on. Try again from Settings → Notifications.');
    });
  };
  const no = () => { snoozeAsk(); onDone?.(); };
  return <div className="card butter" role="region" aria-label="Notifications">
    <b style={{ color: 'var(--butter-ink)' }}>{title}</b>
    <p className="s" style={{ marginTop: 'var(--sp-1)', color: 'var(--butter-ink)' }}>{note || sub}</p>
    {note ? <button className="btn2" style={{ width: '100%', marginTop: 'var(--sp-3)', background: 'var(--surface)' }} onClick={() => { snoozeAsk(); onDone?.(); }}>OK</button>
      : <div className="row" style={{ gap: 'var(--sp-2)', marginTop: 'var(--sp-3)' }}>
        <button className="btn2" style={{ flex: 1, background: 'var(--surface)' }} disabled={busy} onClick={yes}>{busy ? '…' : 'Turn on'}</button>
        <button className="btn2" style={{ flex: 1, background: 'transparent', color: 'var(--butter-ink)' }} disabled={busy} onClick={no}>Not now</button>
      </div>}
  </div>;
}

// ---- an ask after a sheet has closed ----
type Ask = { title: string; sub: string } | null;
let pending: Ask = null;
const subs = new Set<() => void>();
const set = (a: Ask) => { pending = a; subs.forEach((f) => f()); };
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

/** Show an ask in a sheet, if one may show now. */
export async function askForPush(a: { title: string; sub: string }) {
  if (await shouldAsk(store.remote, store.get().account?.userId)) set(a);
}

export function PushAskHost() {
  const a = useSyncExternalStore(subscribe, () => pending);
  if (!a) return null;
  const close = () => set(null);
  return <Sheet label="Notifications" onClose={() => { snoozeAsk(); close(); }}>
    <PushAsk title={a.title} sub={a.sub} onDone={close} />
  </Sheet>;
}
