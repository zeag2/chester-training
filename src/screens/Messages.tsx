import { useEffect, useRef, useState } from 'react';
import { store, useStore } from '../db/store';
import type { ContactMessage } from '../sync/remote';
import { Icon } from '../ui/icons';
import { back } from '../ui/router';
import { hideToast, showToast } from '../ui/Toast';

const UNDO_MS = 6000;
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/* #/messages (Settings → Messages): the "Contact us" inbox, for the app owner only (a row in app_admins). Newest first;
   mark done (Saved · Undo) and delete (Deleted · Undo: the delete is sent when the Undo note goes). */
export function Messages() {
  const { account } = useStore();
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [list, setList] = useState<ContactMessage[] | null>(null);
  const [err, setErr] = useState('');
  const pending = useRef(new Map<number, number>()); // id → timer of a delete waiting out its Undo

  const load = () => { setErr(''); store.contactMessages().then(setList, () => setErr('Couldn’t load the messages. Check your connection and try again.')); };
  useEffect(() => { let on = true; void store.isAppAdmin().then((a) => { if (!on) return; setAdmin(a); if (a) load(); }); return () => { on = false; }; }, [account?.userId]); // eslint-disable-line react-hooks/exhaustive-deps
  // leaving the screen sends any delete still waiting on its Undo
  useEffect(() => () => { for (const [id, t] of pending.current) { window.clearTimeout(t); void store.deleteContact(id).catch(() => {}); } }, []);

  const patch = (id: number, f: (m: ContactMessage) => ContactMessage | null) =>
    setList((l) => l && l.flatMap((m) => { if (m.id !== id) return [m]; const n = f(m); return n ? [n] : []; }));

  const setDone = async (m: ContactMessage, done: boolean, undo = false) => {
    patch(m.id, (x) => ({ ...x, done }));
    try {
      await store.setContactDone(m.id, done);
      if (!undo) showToast({ msg: done ? 'Saved · marked done' : 'Saved · not done', action: { label: 'Undo', run: () => { hideToast(); void setDone(m, !done, true); } } });
    } catch { patch(m.id, (x) => ({ ...x, done: !done })); showToast({ msg: 'Couldn’t save. Check your connection and try again.' }); }
  };

  const remove = (m: ContactMessage) => {
    const at = list?.findIndex((x) => x.id === m.id) ?? -1;
    patch(m.id, () => null);
    const t = window.setTimeout(() => {
      pending.current.delete(m.id);
      store.deleteContact(m.id).catch(() => { setList((l) => l && [...l, m].sort((a, b) => b.at.localeCompare(a.at))); showToast({ msg: 'Couldn’t delete it. Check your connection and try again.' }); });
    }, UNDO_MS);
    pending.current.set(m.id, t);
    showToast({ msg: 'Deleted', ms: UNDO_MS, action: { label: 'Undo', run: () => {
      hideToast(); window.clearTimeout(t); pending.current.delete(m.id);
      setList((l) => { if (!l) return l; const n = [...l]; n.splice(at < 0 ? n.length : Math.min(at, n.length), 0, m); return n; });
    } } });
  };

  const open = list?.filter((m) => !m.done).length ?? 0;
  return <div className="screen">
    <div className="row" style={{ marginTop: 10 }}><button className="iconbtn" aria-label="Back" onClick={() => back('settings')}><Icon name="back" /></button><h1 className="sp">Messages</h1></div>
    {admin === false ? <p className="m" style={{ marginTop: 'var(--sp-3)' }}>Only PalDex’s owner can read the messages.</p>
      : admin === null || (list === null && !err) ? <p className="s" style={{ marginTop: 'var(--sp-3)' }} aria-live="polite">Loading…</p>
      : err ? <><p className="s" role="alert" style={{ marginTop: 'var(--sp-3)', color: 'var(--rose)' }}>{err}</p><button className="btn2" style={{ marginTop: 'var(--sp-3)', width: '100%' }} onClick={load}>Try again</button></>
      : <>
        <p className="m" style={{ marginTop: 'var(--sp-1)' }}>From the Contact us form, newest first. {list!.length ? (open ? `${open} not done yet.` : 'All done.') : ''}</p>
        {list!.length === 0 && <div className="card grey" style={{ marginTop: 'var(--sp-4)' }}><p className="s">No messages yet.</p></div>}
        {list!.map((m) => <article key={m.id} className="card white" style={{ marginTop: 'var(--sp-3)' }} aria-label={`Message from ${m.name || 'someone'}`}>
          <div className="row">
            <b className="sp">{m.name || (m.signedIn ? 'Someone signed in' : 'Someone signed out')}</b>
            {m.done && <span className="chip" style={{ background: 'var(--mint)', color: 'var(--teal-ink)' }}><Icon name="check" size={14} />Done</span>}
          </div>
          <p className="s">{[when(m.at), m.appVersion && `PalDex ${m.appVersion}`, m.name && (m.signedIn ? 'signed in' : 'signed out')].filter(Boolean).join(' · ')}</p>
          <p className="m" style={{ marginTop: 'var(--sp-2)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: m.done ? 'var(--muted)' : undefined }}>{m.message}</p>
          <p className="s" style={{ marginTop: 'var(--sp-2)', overflowWrap: 'anywhere' }}>{m.reach ? <>Reach them: <b style={{ color: 'var(--ink-2)' }}>{m.reach}</b></> : 'No way to reach them given.'}</p>
          <div className="row" style={{ marginTop: 'var(--sp-3)', gap: 'var(--sp-2)' }}>
            <button className="btn2" style={{ flex: 1 }} onClick={() => void setDone(m, !m.done)}>{m.done ? 'Not done' : 'Mark done'}</button>
            <button className="btn2" style={{ background: 'transparent', color: 'var(--rose)' }} onClick={() => remove(m)}>Delete</button>
          </div>
        </article>)}
      </>}
    <div style={{ height: 'var(--sp-8)' }} />
  </div>;
}
