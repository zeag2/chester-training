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
import { inviteText, pendingFriend, setPendingFriend } from '../lib/invite';
import { titleFor } from '../lib/appname';
import { FRIEND_BONUS, owned } from '../engine/corner';
import { FriendRequestRow } from '../ui/FriendsStrip';

function PetCardView({ p }: { p: FriendPet }) {
  const c = p.card; const mastered = c.mastered ?? [];
  const he = c.sex === 'f' ? 'She' : 'He';
  return <a href={'#/visit/' + p.catId} aria-label={`Visit ${c.name}`} className="card white" style={{ margin: 0, padding: 14, display: 'flex', flexDirection: 'column', gap: 6, color: 'inherit', textDecoration: 'none' }}>
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
    <span className="chip" style={{ alignSelf: 'flex-start', background: 'var(--sky)' }}>Visit and pet</span>
  </a>;
}

/** Your code, a way to send it, and a box for a friend's code. Used on the Friends screen and in the invite sheet. */
export function InvitePanel({ prefill = '' }: { prefill?: string }) {
  const { friends, pets, cat } = useStore();
  const [code, setCode] = useState(prefill || pendingFriend());
  const [msg, setMsg] = useState(prefill || pendingFriend() ? 'A friend invited you. Tap Add to send them a friend request.' : '');
  const [busy, setBusy] = useState(false);
  if (!friends || friends.missing) return null;
  const mine = friends.code;
  const add = async () => {
    if (busy || !code.trim()) return; setBusy(true); setMsg('');
    try {
      const res = await store.addFriend(code);
      if (res === null) setMsg(code.trim().toUpperCase() === mine ? 'That’s your own code. Send it to a friend instead.' : 'That code didn’t match anyone. Check the letters and try again.');
      else {
        const who = res.name || 'them';
        if (res.status === 'friends') { audio.sparkle(); setMsg(`You’re friends${res.name ? ` with ${res.name}` : ''}!${cat ? ` +${FRIEND_BONUS.treats} treats for ${cat.name}.` : ''}`); }
        else if (res.status === 'already') setMsg(`You’re already friends with ${res.name || 'them'}.`);
        else { audio.chirp(); setMsg(`Request sent. You’ll be friends once ${who} accepts.`); }
        setCode(''); setPendingFriend('');
      }
    } catch { setMsg('Can’t reach PalDex right now. Try again in a moment.'); }
    finally { setBusy(false); }
  };
  const text = inviteText(mine, titleFor(pets.map((p) => p.name)));
  const send = async () => {
    try { if (navigator.share) { await navigator.share({ text }); return; } } catch { return; }
    copy(text, 'Invite copied. Paste it in a message.');
  };
  const copy = async (t: string, done: string) => { try { await navigator.clipboard.writeText(t); setMsg(done); audio.chirp(); } catch { setMsg(`Your code is ${mine}`); } };
  return <>
    <div className="card butter" style={{ textAlign: 'center' }}>
      <p className="s" style={{ color: 'var(--butter-ink)' }}>Your friend code</p>
      <b className="num" style={{ display: 'block', fontSize: 34, letterSpacing: 6, marginTop: 4, color: 'var(--butter-ink)' }} aria-label={`Your friend code: ${mine.split('').join(' ')}`}>{mine}</b>
      <p className="s" style={{ color: 'var(--butter-ink)', marginTop: 8 }}>Each new friend: +{FRIEND_BONUS.treats} treats and +1 bond for {cat?.name ?? 'your cat'}, for you both{owned(cat?.corner).has('scarf') ? '.' : '. Your first friend also unlocks a Friendship scarf.'}</p>
      <button className="btn" style={{ marginTop: 12 }} onClick={send}>Send an invite</button>
      <button className="btn2" style={{ width: '100%', marginTop: 8, background: 'var(--surface)' }} onClick={() => copy(mine, 'Code copied.')}>Copy code</button>
    </div>
    <div className="card grey">
      <b>Add a friend</b>
      <div className="row" style={{ gap: 8, marginTop: 10 }}>
        <input className="in" style={{ background: 'var(--surface)', marginTop: 0, textTransform: 'uppercase', letterSpacing: 2 }} value={code} onChange={(e) => setCode(e.target.value.slice(0, 12))} placeholder="Their code" aria-label="Friend code" autoCapitalize="characters" autoComplete="off" enterKeyHint="go" onKeyDown={(e) => { if (e.key === 'Enter') void add(); }} />
        <button className="btn2" style={{ background: code.trim() ? 'var(--ink)' : 'var(--surface)', color: code.trim() ? 'var(--on-ink)' : undefined }} disabled={busy || !code.trim()} onClick={add}>{busy ? '…' : 'Add'}</button>
      </div>
      {msg && <p className="s" style={{ marginTop: 8 }} role="status">{msg}</p>}
    </div>
  </>;
}

/** The invite sheet behind the + buttons. */
export function InviteSheet({ onClose }: { onClose: () => void }) {
  const { friends, account } = useStore();
  const [err, setErr] = useState('');
  useEffect(() => { if (account && !friends) store.loadFriends().catch(() => setErr('Can’t reach PalDex right now. Check your connection.')); }, [account, friends]);
  return <div className="overlay sheetbg" onClick={onClose}><div className="sheet" role="dialog" aria-modal="true" aria-label="Invite a friend" onClick={(e) => e.stopPropagation()}>
    <div className="row"><b className="sp" style={{ fontSize: 18 }}>Invite a friend</b><button className="iconbtn" aria-label="Close" onClick={onClose}><Icon name="close" /></button></div>
    <p className="s" style={{ marginTop: 4 }}>Friends see each other’s cats: their look, outfit, skills and streak. Never care records or documents.</p>
    {!account ? <><p className="m" style={{ marginTop: 12 }}>Sign in first so friends can find you.</p><button className="btn" style={{ marginTop: 12 }} onClick={() => { onClose(); go('together'); }}>Sign in or create an account</button></>
      : err ? <p className="s" style={{ marginTop: 12 }}>{err}</p>
      : !friends ? <p className="s" style={{ marginTop: 12 }} aria-busy="true">Loading…</p>
      : friends.missing ? <p className="s" style={{ marginTop: 12 }}>Friends aren’t switched on yet.</p>
      : <><InvitePanel /><button className="btn2" style={{ width: '100%', marginTop: 10, background: 'transparent' }} onClick={() => { onClose(); go('friends'); }}>See friends’ cats</button></>}
  </div></div>;
}

export function Friends({ code: linkCode }: { code?: string }) {
  const { account, friends, cat, requests } = useStore();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [removing, setRemoving] = useState('');
  const [sheet, setSheet] = useState(false);
  useEffect(() => { if (linkCode) setPendingFriend(linkCode); }, [linkCode]);
  useEffect(() => { if (!account) { setLoading(false); return; } store.loadFriends().catch(() => setErr('Can’t reach PalDex right now. Check your connection.')).finally(() => setLoading(false)); }, [account]);

  const top = <div className="top"><button className="iconbtn" aria-label="Back" onClick={() => go('me')}><Icon name="back" /></button><b className="sp" style={{ fontSize: 17 }}>Friends</b>
    {account && friends && !friends.missing && <button className="iconbtn" aria-label="Invite a friend" onClick={() => setSheet(true)}><Icon name="plus" /></button>}</div>;
  if (!account) return <div className="screen">{top}
    <div className="card mint"><b>Sign in to add friends</b><p className="s" style={{ marginTop: 4 }}>Friends see each other’s cats: their look, outfit, skills and streak. Never care records or documents.{pendingFriend() ? ' Your invite is saved; it’ll be ready once you’re signed in.' : ''}</p>
      <button className="btn" style={{ marginTop: 12 }} onClick={() => go('together')}>Sign in or create an account</button></div></div>;

  return <div className="screen">{top}
    <div className="stag">
      <p className="m">Friends see each other’s cats: their look, outfit, skills, streak and bond. Never care records, documents or the training log.</p>
      {loading ? <p className="s" style={{ marginTop: 16 }} aria-busy="true">Loading…</p>
        : err ? <div className="card peach"><p className="s" style={{ color: 'var(--peach-ink)' }}>{err}</p></div>
        : friends?.missing ? <div className="card butter"><b style={{ color: 'var(--butter-ink)' }}>Friends aren’t switched on yet</b><p className="s" style={{ color: 'var(--butter-ink)', marginTop: 4 }}>Whoever runs this PalDex needs to run its friends setup once. Check back soon.</p></div>
        : friends && <>
          {requests.some((q) => q.incoming) && <div className="card sky">
            <b>Friend requests</b>
            <p className="s" style={{ marginTop: 2 }}>Friends see your cats’ look, skills and streak. Not now is quiet: they aren’t told.</p>
            {requests.filter((q) => q.incoming).map((q) => <FriendRequestRow key={q.userId} q={q} style={{ marginTop: 10 }} />)}
          </div>}
          <InvitePanel prefill={linkCode} />
          <h2 style={{ marginTop: 22 }}>Friends’ cats</h2>
          {friends.pets.length === 0
            ? <div className="card grey row"><Paw size={24} color="var(--faint)" /><p className="s">{friends.list.length ? 'Your friends haven’t added a cat yet.' : `Send your code to a friend, or add theirs, and their cats will show up here next to ${cat?.name ?? 'yours'}.`}</p></div>
            : <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>{friends.pets.map((p) => <PetCardView key={p.catId} p={p} />)}</div>}
          {requests.some((q) => !q.incoming) && <>
            <h2 style={{ marginTop: 22 }}>Waiting to accept</h2>
            {requests.filter((q) => !q.incoming).map((q) => <div key={q.userId} className="card grey row" style={{ marginTop: 8 }}>
              <span className="sp"><b>{q.name || 'A friend'}</b><p className="s">Request sent</p></span>
              <button className="btn2" style={{ minHeight: 36, background: 'var(--surface)' }} onClick={() => { void store.cancelFriendRequest(q.userId).catch(() => {}); }} aria-label={`Cancel the request to ${q.name || 'this friend'}`}>Cancel</button>
            </div>)}</>}
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
    {sheet && <InviteSheet onClose={() => setSheet(false)} />}
  </div>;
}
