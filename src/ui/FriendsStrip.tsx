import { useEffect } from 'react';
import { Chester } from '../chester/Chester';
import { store, useStore } from '../db/store';
import { Icon, Paw } from './icons';
import { go } from './router';
import * as audio from '../lib/audio';
import { pendingFriend } from '../lib/invite';
import { FRIEND_BONUS } from '../engine/corner';
import type { FriendPet, FriendRequest } from '../sync/remote';

/** "Accept Erin?" with Accept and Not now. Declining is quiet: Erin isn't told and still sees it as waiting. */
export function FriendRequestRow({ q, style }: { q: FriendRequest; style?: React.CSSProperties }) {
  const name = q.name || 'Someone';
  return <div className="pop" role="group" aria-label={`Friend request from ${name}`} style={style}>
    <b style={{ fontSize: 15 }}>{name} wants to be friends. Accept?</b>
    <div className="row" style={{ gap: 8, marginTop: 8 }}>
    <button className="btn2" style={{ flex: 1, minHeight: 44, background: 'var(--ink)', color: 'var(--on-ink)' }} onClick={() => { audio.sparkle(); void store.answerFriend(q.userId, true).catch(() => {}); }}>Accept</button>
    <button className="btn2" style={{ flex: 1, minHeight: 44, background: 'var(--surface)' }} onClick={() => { void store.answerFriend(q.userId, false).catch(() => {}); }}>Not now</button>
    </div>
  </div>;
}

/** "Erin gave Chester a treat" / "Erin and Dana gave Chester treats". */
export function treatLine(cat: string, names: string[]): string {
  const who = names.length <= 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return names.length === 1 ? `${who} gave ${cat} a treat` : `${who} gave ${cat} treats`;
}

/** Friends' cats grouped by who they belong to (cats that live together share a tile), in the order they came. */
export function households(pets: FriendPet[]): { owner: string; ownerName: string; pets: FriendPet[] }[] {
  const out = new Map<string, { owner: string; ownerName: string; pets: FriendPet[] }>();
  for (const p of pets) { const h = out.get(p.owner) ?? { owner: p.owner, ownerName: p.ownerName, pets: [] }; h.pets.push(p); out.set(p.owner, h); }
  return [...out.values()];
}
const andList = (xs: string[]) => (xs.length <= 2 ? xs.join(' & ') : `${xs.slice(0, -1).join(', ')} & ${xs[xs.length - 1]}`);

/** One friend's cats sitting together on a little floor, with whose they are and their names. Tap a cat to visit. */
function HouseholdTile({ h, given, canTreat }: { h: { ownerName: string; pets: FriendPet[] }; given: Set<string>; canTreat: boolean }) {
  const shown = h.pets.slice(0, 4); const more = h.pets.length - shown.length;
  const whose = h.ownerName ? `${h.ownerName}’s` : 'A friend’s';
  return <div className="household" role="listitem">
    <div className="householdcats">
      {shown.map((p, i) => { const fresh = canTreat && !given.has(p.catId);
        return <button key={p.catId} className="householdcat" style={{ zIndex: shown.length - i }} onClick={() => { audio.chirp(); go('visit/' + p.catId); }}
          aria-label={`Visit ${p.card.name}, ${whose.toLowerCase() === 'a friend’s' ? 'a friend’s' : whose} cat${fresh ? '. Can have a treat today' : ''}`}>
          <Chester coat={p.card.coat} eyes={p.card.eyes} wear={p.card.wear} mood="curious" width={62} label={p.card.name} />
          {fresh && <span className="treatbadge" aria-hidden="true"><Paw color="#d4a23a" size={12} /></span>}
        </button>; })}
      {more > 0 && <span className="s householdmore">+{more}</span>}
    </div>
    <b className="householdwho">{whose}</b>
    <span className="s householdnames">{andList(h.pets.map((p) => p.card.name))}</span>
  </div>;
}

/** Home's one friends card: friends' cats as little faces (tap one to visit), a paw on each that can still get
    today's treat, a line when a friend gave one of your cats a treat, and + to invite someone. */
export function FriendsStrip({ onInvite }: { onInvite: () => void }) {
  const { account, friends, treatNews, cat, thanks, requests } = useStore();
  useEffect(() => { if (account && !friends) store.loadFriends().catch(() => {}); }, [account, friends]);
  if (!account) return null;
  const pets = friends && !friends.missing ? friends.pets : [];
  const given = new Set(friends?.given ?? []);
  const canTreat = !!friends && friends.treats !== 'missing';
  return <div className="card sky" style={{ paddingBottom: 10 }}>
    {requests.filter((q) => q.incoming).map((q) => <FriendRequestRow key={q.userId} q={q} style={{ marginBottom: 10 }} />)}
    {treatNews && <div className="row pop" role="status" style={{ marginBottom: 10 }}>
      <Paw color="#d4a23a" size={22} />
      <b className="sp" style={{ fontSize: 15 }}>{treatLine(treatNews.cat, treatNews.names)}</b>
      {treatNews.items?.length ? (treatNews.thanked ? <span className="s" style={{ fontWeight: 700 }}>Thanks sent</span>
        : <button className="btn2" style={{ minHeight: 44, background: 'var(--surface)' }} onClick={() => { audio.chirp(); void store.thankTreats(); }}>Say thanks</button>) : null}
      <button className="iconbtn" aria-label="Dismiss" onClick={() => store.dismissTreatNews()}><Icon name="close" size={18} /></button>
    </div>}
    {thanks.length > 0 && <div className="row pop" role="status" style={{ marginBottom: 10 }}>
      <Paw color="#d4a23a" size={22} />
      <b className="sp" style={{ fontSize: 15 }}>{[...new Set(thanks.map((t) => t.catName || 'A friend’s cat'))].join(' and ')} {thanks.length === 1 ? 'says' : 'say'} thank you for the treat!</b>
      <button className="iconbtn" aria-label="Dismiss" onClick={() => store.dismissThanks()}><Icon name="close" size={18} /></button>
    </div>}
    <div className="row" style={{ gap: 8 }}>
      <a href="#/friends" className="sp" style={{ color: 'inherit', textDecoration: 'none' }}><b>Friends’ cats</b>
        {!pets.length && <p className="s">{pendingFriend() ? 'A friend invited you. Tap to add them.' : `Each new friend: +${FRIEND_BONUS.treats} treats for ${cat?.name ?? 'your cat'}.`}</p>}</a>
      {pets.length > 0 && <a href="#/friends" className="s" style={{ color: 'inherit', fontWeight: 700 }}>See all</a>}
      <button className="plusbtn" aria-label="Invite a friend" onClick={onInvite}><Icon name="plus" size={22} /></button></div>
    {pets.length > 0 && <div className="households" role="list" aria-label="Friends’ cats">
      {households(pets).map((h) => <HouseholdTile key={h.owner} h={h} given={given} canTreat={canTreat} />)}
    </div>}
  </div>;
}
