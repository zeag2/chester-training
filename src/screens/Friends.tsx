import { useEffect, useState } from 'react';
import { Chester } from '../chester/Chester';
import { store, useStore } from '../db/store';
import { bondLevel } from '../engine/corner';
import { SKILL_BY_ID } from '../engine/skills';
import { ageText } from '../lib/stats';
import type { FriendPet } from '../sync/remote';
import { Icon, Paw } from '../ui/icons';
import { go } from '../ui/router';
import * as audio from '../lib/audio';

function PetCardView({ p }: { p: FriendPet }) {
  const c = p.card; const mastered = c.mastered ?? [];
  const he = c.sex === 'f' ? 'She' : 'He';
  return <div className="card white" style={{ margin: 0, padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
    <div style={{ display: 'flex', justifyContent: 'center', height: 96, alignItems: 'flex-end' }}>
      <Chester coat={c.coat} eyes={c.eyes} wear={c.wear} mood="happy" width={92} label={c.name} /></div>
    <b style={{ fontSize: 16 }}>{c.name}</b>
    <p className="s" style={{ marginTop: -4 }}>{p.ownerName ? `${p.ownerName}’s` : 'A friend’s'}{c.birthday ? ` · ${ageText(c.birthday)}` : ''}</p>
    <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
      <span className="chip" style={{ background: 'var(--mint)' }}>{mastered.length} {mastered.length === 1 ? 'skill' : 'skills'}</span>
      {(c.streak ?? 0) > 0 && <span className="chip" style={{ background: 'var(--butter)', color: 'var(--butter-ink)' }}>{c.streak}-day streak</span>}
    </div>
    <p className="s" style={{ lineHeight: 1.35 }}>{mastered.length ? `${he} can: ${mastered.slice(0, 3).map((id) => SKILL_BY_ID[id]?.name ?? id).join(', ')}${mastered.length > 3 ? '…' : ''}` : `${c.setsWeek ? `${c.setsWeek} sets this week` : 'Just getting started'}`}</p>
    <p className="s">Bond: {bondLevel(c.bond ?? 0).name}</p>
  </div>;
}

export function Friends() {
  const { account, friends, cat } = useStore();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState('');
  useEffect(() => { if (!account) { setLoading(false); return; } store.loadFriends().catch(() => setErr('Can’t reach PalDex right now. Check your connection.')).finally(() => setLoading(false)); }, [account]);

  const add = async () => {
    if (busy || !code.trim()) return; setBusy(true); setMsg('');
    try {
      const name = await store.addFriend(code);
      if (name === null) setMsg('That code didn’t match anyone. Check the letters and try again.');
      else { audio.sparkle(); setMsg(`You’re friends${name ? ` with ${name}` : ''}!`); setCode(''); }
    } catch { setMsg('Can’t reach PalDex right now. Try again in a moment.'); }
    finally { setBusy(false); }
  };
  const share = async () => {
    const text = `Add me as a friend on PalDex so our cats can meet! My friend code is ${friends?.code}. ${location.origin}${import.meta.env.BASE_URL}`;
    try { if (navigator.share) { await navigator.share({ text }); return; } } catch { return; }
    try { await navigator.clipboard.writeText(text); setMsg('Copied. Paste it in a message.'); } catch { setMsg(`Your code is ${friends?.code}`); }
  };

  const top = <div className="top"><button className="iconbtn" aria-label="Back" onClick={() => go('home')}><Icon name="back" /></button><b style={{ fontSize: 17 }}>Friends</b></div>;
  if (!account) return <div className="screen">{top}
    <div className="card mint"><b>Sign in to add friends</b><p className="s" style={{ marginTop: 4 }}>Friends see each other’s cats: their look, outfit, skills and streak. Never care records or documents.</p>
      <button className="btn" style={{ marginTop: 12 }} onClick={() => go('together')}>Sign in or create an account</button></div></div>;

  return <div className="screen">{top}
    <div className="stag">
      <p className="m">Friends see each other’s cats: their look, outfit, skills, streak and bond. Never care records, documents or the training log.</p>
      {loading ? <p className="s" style={{ marginTop: 16 }} aria-busy="true">Loading…</p>
        : err ? <div className="card peach"><p className="s" style={{ color: 'var(--peach-ink)' }}>{err}</p></div>
        : friends?.missing ? <div className="card butter"><b style={{ color: 'var(--butter-ink)' }}>Friends aren’t switched on yet</b><p className="s" style={{ color: 'var(--butter-ink)', marginTop: 4 }}>Whoever runs this PalDex needs to run its friends setup once. Check back soon.</p></div>
        : friends && <>
          <div className="card butter" style={{ textAlign: 'center' }}>
            <p className="s" style={{ color: 'var(--butter-ink)' }}>Your friend code</p>
            <b className="num" style={{ display: 'block', fontSize: 34, letterSpacing: 6, marginTop: 4, color: 'var(--butter-ink)' }} aria-label={`Your friend code: ${friends.code.split('').join(' ')}`}>{friends.code}</b>
            <button className="btn" style={{ marginTop: 12 }} onClick={share}>Send my code</button>
          </div>
          <div className="card grey">
            <b>Add a friend</b>
            <div className="row" style={{ gap: 8, marginTop: 10 }}>
              <input className="in" style={{ background: 'var(--surface)', marginTop: 0, textTransform: 'uppercase', letterSpacing: 2 }} value={code} onChange={(e) => setCode(e.target.value.slice(0, 12))} placeholder="Their code" aria-label="Friend code" autoCapitalize="characters" autoComplete="off" enterKeyHint="go" onKeyDown={(e) => { if (e.key === 'Enter') void add(); }} />
              <button className="btn2" style={{ background: 'var(--surface)' }} disabled={busy || !code.trim()} onClick={add}>{busy ? '…' : 'Add'}</button>
            </div>
            {msg && <p className="s" style={{ marginTop: 8 }} role="status">{msg}</p>}
          </div>
          <h2 style={{ marginTop: 22 }}>Friends’ cats</h2>
          {friends.pets.length === 0
            ? <div className="card grey row"><Paw size={24} color="var(--faint)" /><p className="s">{friends.list.length ? 'Your friends haven’t added a cat yet.' : `Send your code to a friend, or add theirs, and their cats will show up here next to ${cat?.name ?? 'yours'}.`}</p></div>
            : <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>{friends.pets.map((p) => <PetCardView key={p.catId} p={p} />)}</div>}
          {friends.list.length > 0 && <>
            <h2 style={{ marginTop: 22 }}>Your friends</h2>
            {friends.list.map((f) => <div key={f.userId} className="card grey row" style={{ marginTop: 8 }}>
              <b className="sp">{f.name || 'A friend'}</b>
              {removing === f.userId
                ? <><button className="btn2" style={{ minHeight: 36, background: 'var(--peach)', color: 'var(--peach-ink)' }} onClick={() => { setRemoving(''); void store.removeFriend(f.userId); }}>Remove</button><button className="btn2" style={{ minHeight: 36, background: 'var(--surface)' }} onClick={() => setRemoving('')}>Keep</button></>
                : <button className="btn2" style={{ minHeight: 36, background: 'var(--surface)' }} onClick={() => setRemoving(f.userId)} aria-label={`Remove ${f.name || 'this friend'}`}>Remove</button>}
            </div>)}</>}
        </>}
    </div>
  </div>;
}
